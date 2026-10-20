import { useEffect, useRef } from 'react';
import { AssetItem, WorkspaceView } from '../types';
import { type ContextMenuPosition, type ContextMenuTarget } from '../components/FileContextMenu';
import { copyTextToClipboard } from '../utils/localFileSystem';

export interface UseKeyboardShortcutsProps {
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
  setClipboard?: (clipboard: { paths: string[]; op: 'copy' | 'cut' } | null) => void;
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

/**
 * Extracts all native file/folder paths for the current user selection or focused item.
 */
function getEffectivePaths(p: UseKeyboardShortcutsProps): string[] {
  // 1. Direct from selectedAssets
  const fromSelected = (p.selectedAssets || [])
    .map((a) => a.fullPath)
    .filter(Boolean) as string[];
  if (fromSelected.length > 0) return fromSelected;

  // 2. From selectedIds matched against filteredAssets
  if (p.selectedIds && p.selectedIds.size > 0) {
    const fromFiltered = (p.filteredAssets || [])
      .filter((a) => p.selectedIds.has(a.id))
      .map((a) => a.fullPath)
      .filter(Boolean) as string[];
    if (fromFiltered.length > 0) return fromFiltered;
  }

  // 3. Fallback to focusedAsset
  if (p.focusedAsset?.fullPath) {
    return [p.focusedAsset.fullPath];
  }

  // 4. Fallback to focusedId matched against filteredAssets
  if (p.focusedId) {
    const focused = (p.filteredAssets || []).find((a) => a.id === p.focusedId);
    if (focused?.fullPath) return [focused.fullPath];
  }

  return [];
}

export function useKeyboardShortcuts(props: UseKeyboardShortcutsProps) {
  // Store props in a mutable ref so the keydown listener in capture phase always accesses latest state
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Don't intercept when user is typing in any text input, textarea, contentEditable, or inside terminal
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest('.xterm') ||
        target?.closest('[data-terminal-container]') ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.isContentEditable ||
        activeEl?.closest('.xterm') ||
        activeEl?.closest('[data-terminal-container]')
      ) {
        return;
      }

      const p = propsRef.current;
      const isAnyModalOpen =
        p.quickLookOpen || p.batchRenameOpen || p.batchExportOpen || p.batchIptcOpen || p.settingsOpen;

      // 2. Workspace View switchers (Ctrl+1..5) - accessible everywhere including Commander
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        (['1', '2', '3', '4', '5'].includes(e.key) ||
          ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5'].includes(e.code))
      ) {
        const keyChar = e.key;
        const code = e.code;
        if (keyChar === '1' || code === 'Digit1' || code === 'Numpad1') {
          e.preventDefault(); e.stopPropagation();
          p.onViewChange?.('browser'); p.onToggleBrowserViewMode?.('grid');
          return;
        }
        if (keyChar === '2' || code === 'Digit2' || code === 'Numpad2') {
          e.preventDefault(); e.stopPropagation();
          p.onViewChange?.('browser'); p.onToggleBrowserViewMode?.('table');
          return;
        }
        if (keyChar === '3' || code === 'Digit3' || code === 'Numpad3') {
          e.preventDefault(); e.stopPropagation();
          p.onViewChange?.('filmstrip');
          return;
        }
        if (keyChar === '4' || code === 'Digit4' || code === 'Numpad4') {
          e.preventDefault(); e.stopPropagation();
          p.onViewChange?.('compare');
          return;
        }
        if (keyChar === '5' || code === 'Digit5' || code === 'Numpad5') {
          e.preventDefault(); e.stopPropagation();
          p.onViewChange?.('commander');
          return;
        }
      }

      // 3. When in Commander view, yield all other shortcuts to CommanderView's dedicated handler
      if (p.currentView === 'commander') {
        return;
      }

      // 4. If any dialog modal is open, yield shortcuts to that modal
      if (isAnyModalOpen) {
        return;
      }

      // Tab: Toggle between Grid and List / Table in Prohlížeč view
      if (
        e.key === 'Tab' &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        (!p.currentView || p.currentView === 'browser' || p.currentView === 'essentials' || p.currentView === 'table')
      ) {
        e.preventDefault();
        e.stopPropagation();
        const nextMode = p.browserViewMode === 'table' ? 'grid' : 'table';
        p.onToggleBrowserViewMode?.(nextMode);
        return;
      }

      // Alt + Left: Navigate Back
      if (e.altKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
        e.preventDefault();
        e.stopPropagation();
        p.handleNativeBack();
        return;
      }

      // Alt + Right: Navigate Forward
      if (e.altKey && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        p.handleNativeForward();
        return;
      }

      // Alt + Up: Navigate Up to Parent Directory
      if (e.altKey && (e.key === 'ArrowUp' || e.code === 'ArrowUp')) {
        e.preventDefault();
        e.stopPropagation();
        p.handleNativeUp();
        return;
      }

      // Alt + Enter: Windows Properties
      if (e.altKey && (e.key === 'Enter' || e.code === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        const paths = getEffectivePaths(p);
        void p.handleShowProperties(paths[0] || undefined);
        return;
      }

      // Enter: Open folder or launch file
      if (e.key === 'Enter' || e.code === 'Enter') {
        const targetAsset = p.focusedAsset || (p.selectedAssets.length === 1 ? p.selectedAssets[0] : null);
        if (targetAsset) {
          e.preventDefault();
          e.stopPropagation();
          void p.handleOpenAsset(targetAsset);
          return;
        }
      }

      // Spacebar: Quick Look Fullscreen
      if ((e.key === ' ' || e.code === 'Space') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const targetAsset = p.focusedAsset || (p.selectedAssets.length > 0 ? p.selectedAssets[0] : null);
        if (targetAsset) {
          e.preventDefault();
          e.stopPropagation();
          p.setFocusedId(targetAsset.id);
          p.setQuickLookOpen(true);
          return;
        }
      }

      // F2: Rename active file or open Batch Rename
      if (e.key === 'F2' || e.code === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        const selected = p.selectedAssets.length > 0
          ? p.selectedAssets
          : p.focusedAsset
            ? [p.focusedAsset]
            : [];
        if (selected.length === 1) {
          p.handleRenameRequest({ type: 'asset', asset: selected[0] });
        } else if (selected.length > 1) {
          p.setBatchRenameOpen(true);
        } else {
          p.addToast('Přejmenování', 'Nejprve vyberte soubor k přejmenování (F2)', 'info');
        }
        return;
      }

      // F5 (without Ctrl): Refresh active directory
      if ((e.key === 'F5' || e.code === 'F5') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (p.nativeDir) {
          p.handleNativeRefresh();
          p.addToast('Aktualizováno', p.nativeDir, 'info');
        }
        return;
      }

      // Ctrl + F5: Purge Folder Cache & Full Refresh
      if ((e.metaKey || e.ctrlKey) && (e.key === 'F5' || e.code === 'F5')) {
        e.preventDefault();
        e.stopPropagation();
        p.handlePurgeFolderCache?.();
        return;
      }

      // Ctrl + Shift + N: New folder
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        e.stopPropagation();
        if (p.nativeDir) {
          p.handleCreateFolderRequest(p.nativeDir);
        }
        return;
      }

      // Delete: Move selected items to Recycle Bin
      if (e.key === 'Delete' || e.code === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        const paths = getEffectivePaths(p);
        if (paths.length > 0) {
          const names = paths.map((path) => path.split(/[/\\]/).pop() || path);
          p.handleDeleteRequest(paths, names);
        } else if (p.selectedAssets.length > 0) {
          p.handleDeleteSelected();
        }
        return;
      }

      // Escape: Cancel cut state, close context menu, or clear selection
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (p.clipboard?.op === 'cut') {
          e.preventDefault();
          e.stopPropagation();
          p.setClipboard?.(null);
          p.addToast('Zrušeno', 'Vyjmutí souborů bylo zrušeno', 'info');
          return;
        }
        if (p.contextMenuPos) {
          e.preventDefault();
          e.stopPropagation();
          p.closeContextMenu();
          return;
        }
        if (p.selectedIds.size > 0) {
          e.preventDefault();
          e.stopPropagation();
          p.setSelectedIds(new Set());
          return;
        }
      }

      // Cmd/Ctrl + Shift + C: Copy full file path(s) to OS clipboard
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        e.preventDefault();
        e.stopPropagation();
        const paths = getEffectivePaths(p);
        if (paths.length > 0) {
          void copyTextToClipboard(paths.join('\r\n'));
          p.addToast('Cesta zkopírována', paths.length === 1 ? paths[0] : `${paths.length} cest zkopírováno`, 'info');
        } else if (p.focusedAsset?.fullPath) {
          void copyTextToClipboard(p.focusedAsset.fullPath);
          p.addToast('Cesta zkopírována', p.focusedAsset.fullPath, 'info');
        }
        return;
      }

      // Cmd/Ctrl + C: Copy Files (or Copy Image if mock)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        e.preventDefault();
        e.stopPropagation();
        const paths = getEffectivePaths(p);
        if (paths.length > 0) {
          p.handleCopyFiles(paths);
        } else if (p.focusedAsset?.fullPath) {
          p.handleCopyFiles([p.focusedAsset.fullPath]);
        } else if (p.focusedAsset) {
          p.handleCopyImage(p.focusedAsset);
        }
        return;
      }

      // Cmd/Ctrl + X: Cut Files
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
        e.preventDefault();
        e.stopPropagation();
        const paths = getEffectivePaths(p);
        if (paths.length > 0) {
          p.handleCutFiles(paths);
        } else if (p.focusedAsset?.fullPath) {
          p.handleCutFiles([p.focusedAsset.fullPath]);
        }
        return;
      }

      // Cmd/Ctrl + V: Paste Files
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'v' || e.code === 'KeyV')) {
        e.preventDefault();
        e.stopPropagation();
        if (p.nativeDir) {
          void p.handlePasteFiles(p.nativeDir);
        } else {
          p.addToast('Nelze vložit', 'Není otevřena žádná disková složka', 'warning');
        }
        return;
      }

      // Cmd/Ctrl + A: Select All
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
        e.preventDefault();
        e.stopPropagation();
        p.setSelectedIds(new Set(p.filteredAssets.map((a) => a.id)));
        return;
      }

      // Cmd/Ctrl + D: Clear selection
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'd' || e.code === 'KeyD')) {
        e.preventDefault();
        e.stopPropagation();
        p.setSelectedIds(new Set());
        return;
      }

      // Cmd/Ctrl + M: Open Batch IPTC Modal
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'm' || e.code === 'KeyM')) {
        e.preventDefault();
        e.stopPropagation();
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
        (e.key.toLowerCase() === 't' || e.code === 'KeyT' || e.key.toLowerCase() === 'i' || e.code === 'KeyI')
      ) {
        e.preventDefault();
        e.stopPropagation();
        p.handleToggleShowAllInfo();
        return;
      }

      // Cmd/Ctrl + ,: Open Settings Modal
      if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        e.stopPropagation();
        p.setSettingsOpen?.(true);
        return;
      }

      // Cmd/Ctrl + F: Search focus
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) {
        e.preventDefault();
        e.stopPropagation();
        p.searchInputRef.current?.focus();
        return;
      }

      // Navigation: Arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
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

    // Capture phase (`true`) so no child or WebView2 accelerator can swallow Ctrl+C/X/V before us (same as Commander)
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, []);
}
