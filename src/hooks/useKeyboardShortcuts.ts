import { useEffect, useRef } from 'react';
import { AssetItem, WorkspaceView } from '../types';
import { type ContextMenuPosition, type ContextMenuTarget } from '../components/FileContextMenu';

interface UseKeyboardShortcutsProps {
  quickLookOpen: boolean;
  batchRenameOpen: boolean;
  batchExportOpen: boolean;
  batchIptcOpen: boolean;
  focusedAsset: AssetItem | null;
  filteredAssets: AssetItem[];
  focusedId: string | null;
  selectedIds: Set<string>;
  selectedAssets: AssetItem[];
  nativeDir: string | null;
  clipboard: { paths: string[]; op: 'copy' | 'cut' } | null;
  contextMenuPos: ContextMenuPosition | null;
  closeContextMenu: () => void;
  setSelectedIds: (ids: Set<string>) => void;
  setFocusedId: (id: string | null) => void;
  setQuickLookOpen: (open: boolean) => void;
  setBatchRenameOpen: (open: boolean) => void;
  setBatchIptcOpen: (open: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  handleOpenAsset: (asset: AssetItem) => Promise<void>;
  handleRenameRequest: (target: ContextMenuTarget) => void;
  handleCreateFolderRequest: (parentFolder: string) => void;
  handleDeleteRequest: (paths: string[], names: string[]) => void;
  handleDeleteSelected: () => void;
  handleCopyFiles: (paths: string[]) => void;
  handleCutFiles: (paths: string[]) => void;
  handlePasteFiles: (destFolder: string) => Promise<void>;
  handleCopyImage: (asset: AssetItem) => void;
  handleToggleShowAllInfo: () => void;
  handleNativeRefresh: () => void;
  handleNativeBack: () => void;
  handleNativeForward: () => void;
  handleNativeUp: () => void;
  handleShowProperties: (path?: string) => Promise<void>;
  currentView?: WorkspaceView;
  browserViewMode?: 'grid' | 'table';
  onToggleBrowserViewMode?: (mode: 'grid' | 'table') => void;
  onViewChange?: (view: WorkspaceView) => void;
  settingsOpen?: boolean;
  setSettingsOpen?: (open: boolean) => void;
  handlePurgeFolderCache?: () => void;
  addToast: (title: string, desc: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useKeyboardShortcuts(props: UseKeyboardShortcutsProps) {
  // Store props in a mutable ref to keep the event listener reference stable
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const p = propsRef.current;
      const isAnyModalOpen =
        p.quickLookOpen || p.batchRenameOpen || p.batchExportOpen || p.batchIptcOpen || p.settingsOpen;

      // When in Commander view, yield all shortcuts to CommanderView except workspace switcher (Ctrl+1..5)
      if (p.currentView === 'commander') {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
          if (e.key === '1') { e.preventDefault(); p.onViewChange?.('browser'); p.onToggleBrowserViewMode?.('grid'); }
          else if (e.key === '2') { e.preventDefault(); p.onViewChange?.('browser'); p.onToggleBrowserViewMode?.('table'); }
          else if (e.key === '3') { e.preventDefault(); p.onViewChange?.('filmstrip'); }
          else if (e.key === '4') { e.preventDefault(); p.onViewChange?.('compare'); }
          else if (e.key === '5') { e.preventDefault(); p.onViewChange?.('commander'); }
          return;
        }
        return;
      }

      // Tab: Toggle between Grid and List / Table in Prohlížeč view
      if (
        e.key === 'Tab' &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !isAnyModalOpen &&
        (!p.currentView || p.currentView === 'browser' || p.currentView === 'essentials' || p.currentView === 'table')
      ) {
        e.preventDefault();
        const nextMode = p.browserViewMode === 'table' ? 'grid' : 'table';
        p.onToggleBrowserViewMode?.(nextMode);
        return;
      }

      // Alt + Left: Navigate Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        p.handleNativeBack();
        return;
      }

      // Alt + Right: Navigate Forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        p.handleNativeForward();
        return;
      }

      // Alt + Up: Navigate Up to Parent Directory
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        p.handleNativeUp();
        return;
      }

      // Alt + Enter: Windows Properties
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        void p.handleShowProperties(p.focusedAsset?.fullPath || undefined);
        return;
      }

      // Enter: Open folder or open file
      if (e.key === 'Enter' && !isAnyModalOpen) {
        if (p.focusedAsset) {
          e.preventDefault();
          void p.handleOpenAsset(p.focusedAsset);
          return;
        }
      }

      // Spacebar: Quick Look Fullscreen
      if (e.key === ' ' && !isAnyModalOpen) {
        e.preventDefault();
        if (p.focusedAsset) p.setQuickLookOpen(true);
        return;
      }

      // F2: Windows Rename
      if (e.key === 'F2') {
        e.preventDefault();
        if (p.selectedAssets.length === 1) {
          p.handleRenameRequest({ type: 'asset', asset: p.selectedAssets[0] });
        } else if (p.selectedAssets.length > 1) {
          p.setBatchRenameOpen(true);
        } else {
          p.addToast('Přejmenování', 'Nejprve vyberte alespoň jeden soubor (F2)', 'info');
        }
        return;
      }

      // F5: Refresh active directory
      if (e.key === 'F5') {
        e.preventDefault();
        if (p.nativeDir) {
          p.handleNativeRefresh();
          p.addToast('Aktualizováno', p.nativeDir, 'info');
        }
        return;
      }

      // Ctrl + Shift + N: New folder
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (p.nativeDir) {
          p.handleCreateFolderRequest(p.nativeDir);
        }
        return;
      }

      // Ctrl + 1: Switch to Grid view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === '1') {
        e.preventDefault();
        p.onViewChange?.('browser');
        p.onToggleBrowserViewMode?.('grid');
        return;
      }

      // Ctrl + 2: Switch to List / Table view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === '2') {
        e.preventDefault();
        p.onViewChange?.('browser');
        p.onToggleBrowserViewMode?.('table');
        return;
      }

      // Ctrl + 3: Switch to Filmstrip view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === '3') {
        e.preventDefault();
        p.onViewChange?.('filmstrip');
        return;
      }

      // Ctrl + 4: Switch to Compare view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === '4') {
        e.preventDefault();
        p.onViewChange?.('compare');
        return;
      }

      // Ctrl + 5: Switch to Commander view
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === '5') {
        e.preventDefault();
        p.onViewChange?.('commander');
        return;
      }

      // Delete: Move selected items to Recycle Bin
      if (e.key === 'Delete' && !isAnyModalOpen) {
        if (p.selectedAssets.length > 0) {
          e.preventDefault();
          const nativePaths = p.selectedAssets.map((a) => a.fullPath).filter(Boolean) as string[];
          if (nativePaths.length > 0) {
            p.handleDeleteRequest(nativePaths, p.selectedAssets.map((a) => a.name));
          } else {
            p.handleDeleteSelected();
          }
        }
        return;
      }

      // Escape: Clear selection & close context menu
      if (e.key === 'Escape' && !isAnyModalOpen) {
        if (p.contextMenuPos) {
          e.preventDefault();
          p.closeContextMenu();
          return;
        }
        if (p.selectedIds.size > 0) {
          e.preventDefault();
          p.setSelectedIds(new Set());
        }
        return;
      }

      // Cmd/Ctrl + A: Select All
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        p.setSelectedIds(new Set(p.filteredAssets.map((a) => a.id)));
        return;
      }

      // Cmd/Ctrl + M: Open Batch IPTC Modal
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (p.selectedAssets.length > 0) {
          p.setBatchIptcOpen(true);
        } else {
          p.addToast('IPTC úprava', 'Nejprve vyberte alespoň jeden soubor', 'info');
        }
        return;
      }

      // Cmd/Ctrl + T or Cmd/Ctrl + I: Toggle file information display
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'i')
      ) {
        e.preventDefault();
        p.handleToggleShowAllInfo();
        return;
      }

      // Cmd/Ctrl + ,: Open Settings Modal
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        p.setSettingsOpen?.(true);
        return;
      }

      // Ctrl + F5: Purge Folder Cache & Refresh
      if ((e.metaKey || e.ctrlKey) && e.key === 'F5') {
        e.preventDefault();
        p.handlePurgeFolderCache?.();
        return;
      }

      // Cmd/Ctrl + F: Search focus
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        p.searchInputRef.current?.focus();
        return;
      }

      // Cmd/Ctrl + C: Copy Files (or Copy Image if mock)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        const nativePaths = p.selectedAssets.map((a) => a.fullPath).filter(Boolean) as string[];
        if (nativePaths.length > 0) {
          e.preventDefault();
          p.handleCopyFiles(nativePaths);
        } else if (p.focusedAsset?.fullPath) {
          e.preventDefault();
          p.handleCopyFiles([p.focusedAsset.fullPath]);
        } else if (p.focusedAsset) {
          e.preventDefault();
          p.handleCopyImage(p.focusedAsset);
        }
        return;
      }

      // Cmd/Ctrl + X: Cut Files
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
        const nativePaths = p.selectedAssets.map((a) => a.fullPath).filter(Boolean) as string[];
        if (nativePaths.length > 0) {
          e.preventDefault();
          p.handleCutFiles(nativePaths);
        } else if (p.focusedAsset?.fullPath) {
          e.preventDefault();
          p.handleCutFiles([p.focusedAsset.fullPath]);
        }
        return;
      }

      // Cmd/Ctrl + V: Paste Files
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'v' || e.code === 'KeyV')) {
        if (p.nativeDir) {
          e.preventDefault();
          void p.handlePasteFiles(p.nativeDir);
        }
        return;
      }

      // Navigation: Arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const currentIndex = p.filteredAssets.findIndex((a) => a.id === p.focusedId);
        let nextIndex = currentIndex;

        if (e.key === 'ArrowLeft' && currentIndex > 0) nextIndex = currentIndex - 1;
        if (e.key === 'ArrowRight' && currentIndex < p.filteredAssets.length - 1) nextIndex = currentIndex + 1;
        if (e.key === 'ArrowUp' && currentIndex > 3) nextIndex = currentIndex - 4;
        if (e.key === 'ArrowDown' && currentIndex < p.filteredAssets.length - 4) nextIndex = currentIndex + 4;

        if (nextIndex >= 0 && nextIndex < p.filteredAssets.length && nextIndex !== currentIndex) {
          const nextAsset = p.filteredAssets[nextIndex];
          p.setFocusedId(nextAsset.id);
          p.setSelectedIds(new Set([nextAsset.id]));
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
}
