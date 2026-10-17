import { useState, useCallback, useRef } from 'react';
import { AssetItem } from '../types';
import {
  isDesktopApp,
  openFileNative,
  renameFileNative,
  createFolderNative,
  deleteFilesNative,
  copyFilesNative,
  moveFilesNative,
  showFilePropertiesNative,
  openTerminalNative,
} from '../utils/tauriBridge';
import { copyTextToClipboard } from '../utils/localFileSystem';
import { isVisualAsset } from '../utils/adobeThumbnailExtractor';
import { type ContextMenuPosition, type ContextMenuTarget } from '../components/FileContextMenu';

export interface InputDialogState {
  isOpen: boolean;
  type: 'rename' | 'new-folder' | 'confirm-delete';
  title: string;
  initialValue: string;
  itemCount?: number;
  targetPath?: string;
  targetPaths?: string[];
}

interface UseFileOperationsProps {
  assets: AssetItem[];
  setAssets: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  filteredAssets: AssetItem[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  setFocusedId: (id: string | null) => void;
  setQuickLookOpen: (open: boolean) => void;
  setBatchRenameOpen: (open: boolean) => void;
  nativeDir: string | null;
  navigateNative: (path: string) => Promise<void>;
  addToast: (title: string, description: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useFileOperations({
  assets,
  setAssets,
  filteredAssets,
  selectedIds,
  setSelectedIds,
  setFocusedId,
  setQuickLookOpen,
  setBatchRenameOpen,
  nativeDir,
  navigateNative,
  addToast,
}: UseFileOperationsProps) {
  const [clipboard, setClipboard] = useState<{ paths: string[]; op: 'copy' | 'cut' } | null>(null);
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;

  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget | null>(null);
  const [inputDialog, setInputDialog] = useState<InputDialogState>({
    isOpen: false,
    type: 'rename',
    title: '',
    initialValue: '',
  });

  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null);
    setContextMenuTarget(null);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, asset?: AssetItem) => {
      e.preventDefault();
      if (asset) {
        if (!selectedIds.has(asset.id)) {
          setSelectedIds(new Set([asset.id]));
          setFocusedId(asset.id);
        }
        const currentSelected = selectedIds.has(asset.id)
          ? filteredAssets.filter((a) => selectedIds.has(a.id))
          : [asset];
        setContextMenuTarget({
          type: 'asset',
          asset,
          selectedAssets: currentSelected,
          folderPath: nativeDir || (asset.fullPath ? asset.fullPath.substring(0, asset.fullPath.lastIndexOf('\\')) : undefined),
        });
      } else {
        setContextMenuTarget({
          type: 'background',
          folderPath: nativeDir || undefined,
        });
      }
      setContextMenuPos({ x: e.clientX, y: e.clientY });
    },
    [selectedIds, filteredAssets, nativeDir, setSelectedIds, setFocusedId]
  );

  const handleContextMenuFolder = useCallback(
    (e: React.MouseEvent, folder: { name: string; path: string }, allSelectedPaths?: string[]) => {
      e.preventDefault();
      setContextMenuTarget({
        type: 'folder',
        folderPath: folder.path,
        folderName: folder.name,
        selectedFolderPaths: allSelectedPaths && allSelectedPaths.length > 1 ? allSelectedPaths : undefined,
      });
      setContextMenuPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleOpenAsset = useCallback(
    async (asset: AssetItem) => {
      if (asset.isFolder) {
        if (asset.fullPath) {
          await navigateNative(asset.fullPath);
        }
        return;
      }

      // 1. Native Windows desktop: open in system assigned app (Acrobat, Photoshop, Word, etc.)
      if (isDesktopApp() && asset.fullPath) {
        try {
          await openFileNative(asset.fullPath);
          addToast('Otevřeno ve výchozí aplikaci', asset.name, 'info');
        } catch (err) {
          addToast('Nelze otevřít soubor', String(err), 'warning');
        }
        return;
      }

      // 2. Web browser fallback
      if (!isVisualAsset(asset)) {
        if (asset.url) {
          window.open(asset.url, '_blank');
        }
        return;
      }

      setFocusedId(asset.id);
      setQuickLookOpen(true);
    },
    [navigateNative, addToast, setFocusedId, setQuickLookOpen]
  );

  const handleOpenContextMenuTarget = useCallback(
    async (target: ContextMenuTarget) => {
      if (target.type === 'asset' && target.asset) {
        if (target.asset.isFolder) {
          if (target.asset.fullPath) await navigateNative(target.asset.fullPath);
        } else if (isDesktopApp() && target.asset.fullPath) {
          try {
            await openFileNative(target.asset.fullPath);
            addToast('Otevřeno ve výchozí aplikaci', target.asset.name, 'info');
          } catch (err) {
            addToast('Nelze otevřít soubor', String(err), 'warning');
          }
        } else {
          await handleOpenAsset(target.asset);
        }
      } else if (target.type === 'folder' && target.folderPath) {
        await navigateNative(target.folderPath);
      }
    },
    [handleOpenAsset, navigateNative, addToast]
  );

  const handleCopyFiles = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return;
      const nextClip = { paths, op: 'copy' as const };
      clipboardRef.current = nextClip;
      setClipboard(nextClip);
      copyTextToClipboard(paths.join('\r\n'));
      addToast('Zkopírováno do schránky', `${paths.length} ${paths.length === 1 ? 'položka' : 'položek'}`);
    },
    [addToast]
  );

  const handleCutFiles = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return;
      const nextClip = { paths, op: 'cut' as const };
      clipboardRef.current = nextClip;
      setClipboard(nextClip);
      copyTextToClipboard(paths.join('\r\n'));
      addToast('Vyjmuté položky', `${paths.length} ${paths.length === 1 ? 'položka' : 'položek'} — připraveno k vložení`, 'info');
    },
    [addToast]
  );

  const handlePasteFiles = useCallback(
    async (destFolder: string) => {
      const currentClip = clipboardRef.current || clipboard;
      let pathsToPaste = currentClip?.paths || [];
      let opToUse: 'copy' | 'cut' = currentClip?.op || 'copy';

      // Fallback: check system clipboard if internal state is empty
      if (pathsToPaste.length === 0) {
        try {
          const clipText = await navigator.clipboard.readText();
          if (clipText && clipText.trim()) {
            const lines = clipText
              .split(/\r?\n/)
              .map((l) => l.trim().replace(/^"|"$/g, ''))
              .filter(Boolean);
            const valid = lines.filter((l) => /^[a-zA-Z]:[\\/]|^\\[\\/]/.test(l));
            if (valid.length > 0) {
              pathsToPaste = valid;
              opToUse = 'copy';
            }
          }
        } catch {
          // ignore clipboard read error
        }
      }

      if (pathsToPaste.length === 0) {
        addToast('Schránka je prázdná', 'Nejprve zkopírujte (Ctrl+C) nebo vyjměte (Ctrl+X) soubory', 'warning');
        return;
      }

      // Safety check: Don't paste folder into itself or its subfolder
      const normDest = destFolder.toLowerCase().replace(/\\+$/, '');
      const isSelfOrSub = pathsToPaste.some((p: string) => {
        const normP = p.toLowerCase().replace(/\\+$/, '');
        return normDest === normP || normDest.startsWith(normP + '\\');
      });
      if (isSelfOrSub) {
        addToast('Neplatný cíl', 'Nelze vložit složku do sebe samé nebo její podsložky', 'warning');
        return;
      }

      try {
        if (opToUse === 'copy') {
          const created = await copyFilesNative(pathsToPaste, destFolder);
          const count = created && created.length > 0 ? created.length : pathsToPaste.length;
          addToast('Položky zkopírovány', `Vloženo ${count} položek`);
        } else {
          const moved = await moveFilesNative(pathsToPaste, destFolder);
          const count = moved && moved.length > 0 ? moved.length : pathsToPaste.length;
          clipboardRef.current = null;
          setClipboard(null);
          addToast('Položky přesunuty', `Přesunuto ${count} položek`);
        }
        if (nativeDir) {
          await navigateNative(nativeDir);
        }
      } catch (err) {
        addToast('Chyba při vkládání', String(err), 'warning');
      }
    },
    [clipboard, nativeDir, navigateNative, addToast]
  );

  const handleRenameRequest = useCallback(
    (target: ContextMenuTarget) => {
      if (target.type === 'asset') {
        const selected =
          target.selectedAssets && target.selectedAssets.length > 1
            ? target.selectedAssets
            : target.asset
            ? [target.asset]
            : [];

        if (selected.length > 1) {
          setBatchRenameOpen(true);
        } else if (selected.length === 1) {
          setInputDialog({
            isOpen: true,
            type: 'rename',
            title: 'Přejmenovat soubor',
            initialValue: selected[0].name,
            targetPath: selected[0].fullPath,
          });
        }
      } else if (target.type === 'folder' && target.folderPath) {
        setInputDialog({
          isOpen: true,
          type: 'rename',
          title: 'Přejmenovat složku',
          initialValue: target.folderName || '',
          targetPath: target.folderPath,
        });
      }
    },
    [setBatchRenameOpen]
  );

  const handleCreateFolderRequest = useCallback((parentFolder: string) => {
    setInputDialog({
      isOpen: true,
      type: 'new-folder',
      title: 'Nová složka',
      initialValue: 'Nová složka',
      targetPath: parentFolder,
    });
  }, []);

  const handleDeleteRequest = useCallback((paths: string[], names: string[]) => {
    if (paths.length === 0) return;
    setInputDialog({
      isOpen: true,
      type: 'confirm-delete',
      title: 'Přesunout do Koše',
      initialValue: names[0] || '',
      itemCount: paths.length,
      targetPaths: paths,
    });
  }, []);

  const handleExecuteDelete = useCallback(
    async (paths: string[]) => {
      try {
        if (isDesktopApp()) {
          await deleteFilesNative(paths);
        }
        const pathSet = new Set(paths);
        setAssets((prev) => prev.filter((a) => !a.fullPath || !pathSet.has(a.fullPath)));
        setSelectedIds(new Set());
        setFocusedId(null);
        if (nativeDir) {
          await navigateNative(nativeDir);
        }
        addToast('Přesunuto do Koše', `${paths.length} ${paths.length === 1 ? 'položka přesunuta' : 'položek přesunuto'}`);
      } catch (err) {
        addToast('Chyba při mazání', String(err), 'warning');
      }
    },
    [nativeDir, navigateNative, addToast, setAssets, setSelectedIds, setFocusedId]
  );

  const handleDialogSubmit = useCallback(
    async (value: string) => {
      try {
        if (inputDialog.type === 'rename' && inputDialog.targetPath) {
          await renameFileNative(inputDialog.targetPath, value);
          addToast('Přejmenováno', `Nový název: ${value}`);
          if (nativeDir) await navigateNative(nativeDir);
        } else if (inputDialog.type === 'new-folder' && inputDialog.targetPath) {
          await createFolderNative(inputDialog.targetPath, value);
          addToast('Složka vytvořena', value);
          if (nativeDir) await navigateNative(nativeDir);
        } else if (inputDialog.type === 'confirm-delete' && inputDialog.targetPaths) {
          await handleExecuteDelete(inputDialog.targetPaths);
        }
      } catch (err) {
        addToast('Operace se nezdařila', String(err), 'warning');
      } finally {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
      }
    },
    [inputDialog, nativeDir, navigateNative, handleExecuteDelete, addToast]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const removedAssets = assets.filter((a) => selectedIds.has(a.id));

    removedAssets.forEach((a) => {
      if (a.url && a.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(a.url);
        } catch {}
      }
    });

    setAssets((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    setFocusedId(null);
    addToast(
      'Položky odebrány ze zobrazení',
      `Odebráno ${count} ${count === 1 ? 'položka' : count < 5 ? 'položky' : 'položek'}`
    );
  }, [selectedIds, assets, addToast, setAssets, setSelectedIds, setFocusedId]);

  const handleShowProperties = useCallback(
    async (path?: string) => {
      const targetPath = path || nativeDir;
      if (!targetPath) return;
      try {
        await showFilePropertiesNative(targetPath);
      } catch (err) {
        addToast('Vlastnosti', String(err), 'warning');
      }
    },
    [nativeDir, addToast]
  );

  const handleOpenTerminal = useCallback(
    async (path?: string) => {
      const targetPath = path || nativeDir;
      if (!targetPath) return;
      try {
        await openTerminalNative(targetPath);
      } catch (err) {
        addToast('Terminál', String(err), 'warning');
      }
    },
    [nativeDir, addToast]
  );

  return {
    clipboard,
    setClipboard,
    contextMenuPos,
    contextMenuTarget,
    inputDialog,
    setInputDialog,
    closeContextMenu,
    handleContextMenu,
    handleContextMenuFolder,
    handleOpenAsset,
    handleOpenContextMenuTarget,
    handleCopyFiles,
    handleCutFiles,
    handlePasteFiles,
    handleRenameRequest,
    handleCreateFolderRequest,
    handleDeleteRequest,
    handleExecuteDelete,
    handleDialogSubmit,
    handleDeleteSelected,
    handleShowProperties,
    handleOpenTerminal,
  };
}
