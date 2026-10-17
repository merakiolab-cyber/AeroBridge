/**
 * AeroBridge Studio — Ultra-Fast Creative Asset Manager
 * Bauhaus-inspired rectilinear layout with Flowty elegance and zero clutter.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AssetItem,
  FilterState,
  FolderNode,
  WorkspaceView,
  BrowserViewMode,
  BatchIptcConfig,
} from './types';
import { INITIAL_ASSETS, INITIAL_FOLDERS } from './data/mockAssets';
import {
  parseFilesToAssets,
  parseNativeEntriesToAssets,
  pickLocalDirectory,
  copyImageToClipboard,
  copyTextToClipboard,
} from './utils/localFileSystem';
import {
  isDesktopApp,
  pickNativeFolder,
  revealInWindowsExplorer,
} from './utils/tauriBridge';
import { NativePathBar } from './components/NativePathBar';
import { writeMetadataBackToAsset } from './utils/metadataWriter';
import {
  saveAssetsToIndexedDB,
  loadAssetsFromIndexedDB,
  saveWorkspaceSession,
  loadWorkspaceSession,
} from './utils/indexedDbStorage';
import {
  useNativeNavigation,
  useFileOperations,
  useKeyboardShortcuts,
} from './hooks';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { AssetGrid } from './components/AssetGrid';
import { FilmstripView } from './components/FilmstripView';
import { CompareView } from './components/CompareView';
import { MetadataTableView } from './components/MetadataTableView';
import { CommanderView } from './components/CommanderView';
import { PreviewInspector } from './components/PreviewInspector';
import { QuickLookModal } from './components/QuickLookModal';
import { BatchRenameModal } from './components/BatchRenameModal';
import { BatchExportModal } from './components/BatchExportModal';
import { BatchIptcModal } from './components/BatchIptcModal';
import { SettingsModal } from './components/SettingsModal';
import { FileContextMenu } from './components/FileContextMenu';
import { InputDialog } from './components/InputDialog';
import { renderPdfPage } from './utils/pdfPreview';
import { purgeFolderCache } from './utils/cacheManager';
import { ToastContainer, ToastMessage } from './components/Toast';

export default function App() {
  // --- Core State ---
  const [assets, setAssets] = useState<AssetItem[]>(INITIAL_ASSETS);
  const [folders, setFolders] = useState<FolderNode[]>(INITIAL_FOLDERS);
  const [activeFolder, setActiveFolder] = useState<string>('/');
  const [favoriteFolders, setFavoriteFolders] = useState<string[]>([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<WorkspaceView>('browser');
  const [browserViewMode, setBrowserViewMode] = useState<BrowserViewMode>(() => {
    try {
      const saved = localStorage.getItem('aerobridge_browser_view_mode');
      return saved === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleBrowserViewModeChange = useCallback((mode: BrowserViewMode) => {
    setBrowserViewMode(mode);
    if (currentView !== 'browser' && currentView !== 'essentials') {
      setCurrentView('browser');
    }
    try {
      localStorage.setItem('aerobridge_browser_view_mode', mode);
    } catch {}
  }, [currentView]);

  // --- Selection State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set([INITIAL_ASSETS[0]?.id || ''])
  );
  const [focusedId, setFocusedId] = useState<string | null>(
    INITIAL_ASSETS[0]?.id || null
  );

  // --- Display Settings ---
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('aerobridge_sidebar_width');
      return saved ? Math.max(180, Math.min(500, parseInt(saved, 10))) : 260;
    } catch {
      return 260;
    }
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('aerobridge_inspector_width');
      return saved ? Math.max(260, Math.min(950, parseInt(saved, 10))) : 440;
    } catch {
      return 440;
    }
  });
  const [isResizingInspector, setIsResizingInspector] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useState<number>(200);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [showAllInfo, setShowAllInfo] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('aerobridge_show_file_info');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  // --- Sorting State ---
  const [sortField, setSortField] = useState<'name' | 'dateModified' | 'size' | 'extension' | 'dimensions'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- Filter State ---
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    formatFilter: null,
    orientationFilter: 'all',
    keywordFilter: null,
  });

  // --- UI & Modals State ---
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [batchExportOpen, setBatchExportOpen] = useState(false);
  const [batchIptcOpen, setBatchIptcOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // --- Refs ---
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Notification Toast Helper ---
  const addToast = useCallback((title: string, description?: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Native Navigation Hook (Explorer-like folder traversal, history, thumbnails) ---
  const {
    nativeDir,
    nativeSubdirs,
    nativeLoading,
    navHistory,
    navigateNative,
    handleNativeBack,
    handleNativeForward,
    handleNativeUp,
    handleNativeRefresh,
  } = useNativeNavigation({
    setAssets,
    setActiveFolder,
    setSelectedIds,
    setFocusedId,
    addToast,
  });

  // --- Cache Purge Handlers ---
  const handlePurgeFolderCache = useCallback(() => {
    if (nativeDir) {
      const res = purgeFolderCache(nativeDir);
      void navigateNative(nativeDir);
      addToast(
        'Mezipaměť složky vymazána',
        `Uvolněno ${res.deletedThumbnails} miniatur. Znovu načítám data z disku.`,
        'success'
      );
    } else {
      addToast('Mezipaměť', 'Není otevřena žádná disková složka k promazání', 'info');
    }
  }, [nativeDir, navigateNative, addToast]);

  const handlePurgeAllCache = useCallback(() => {
    if (nativeDir) {
      void navigateNative(nativeDir);
    }
    addToast('Mezipaměť vyčištěna', 'Paměť RAM byla uvolněna a náhledy resetovány', 'success');
  }, [nativeDir, navigateNative, addToast]);

  // --- Filtered & Sorted Assets Computation ---
  const filteredAssets = useMemo(() => {
    const list = assets.filter((asset) => {
      // Folder filtering
      if (activeFolder !== '/') {
        if (activeFolder.startsWith('native:')) {
          if (asset.folder !== activeFolder) return false;
        } else if (!asset.folder.startsWith(activeFolder)) {
          return false;
        }
      }

      // Fulltext Search
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(query);
        const matchFormat = asset.format.toLowerCase().includes(query);
        const matchExtension = asset.extension.toLowerCase().includes(query);
        const matchKeywords = asset.iptc.keywords.some((k) => k.toLowerCase().includes(query));
        const matchCamera = asset.exif.camera?.toLowerCase().includes(query);
        const matchCreator = asset.iptc.creator?.toLowerCase().includes(query);
        if (!matchName && !matchFormat && !matchExtension && !matchKeywords && !matchCamera && !matchCreator) {
          return false;
        }
      }

      // Format category filter
      if (filters.formatFilter !== null) {
        if (asset.isFolder) return false;
        const ext = (asset.extension || asset.name.split('.').pop() || '').toLowerCase();
        if (filters.formatFilter === 'tiff') {
          if (ext !== 'tif' && ext !== 'tiff') return false;
        } else if (filters.formatFilter === 'jpg') {
          if (ext !== 'jpg' && ext !== 'jpeg') return false;
        } else if (filters.formatFilter === 'png') {
          if (ext !== 'png') return false;
        } else if (filters.formatFilter === 'webp') {
          if (ext !== 'webp') return false;
        } else if (filters.formatFilter === 'pptx') {
          if (ext !== 'pptx' && ext !== 'ppt' && ext !== 'ppsx' && ext !== 'pps') return false;
        } else if (filters.formatFilter === 'html') {
          if (ext !== 'html' && ext !== 'htm' && asset.category !== 'html') return false;
        } else if (filters.formatFilter === 'krita') {
          if (ext !== 'kra' && asset.category !== 'krita') return false;
        } else if (asset.category !== filters.formatFilter) {
          return false;
        }
      }

      // Orientation filter
      if (filters.orientationFilter !== 'all') {
        if (asset.isFolder) return false;
        const isLandscape = asset.dimensions.width > asset.dimensions.height;
        const isPortrait = asset.dimensions.height > asset.dimensions.width;
        const isSquare = asset.dimensions.width === asset.dimensions.height;
        if (filters.orientationFilter === 'landscape' && !isLandscape) return false;
        if (filters.orientationFilter === 'portrait' && !isPortrait) return false;
        if (filters.orientationFilter === 'square' && !isSquare) return false;
      }

      return true;
    });

    // Apply Sorting: Folders always placed at the top (like Adobe Bridge)
    list.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'cs', { numeric: true, sensitivity: 'base' });
          break;
        case 'dateModified':
          comparison = new Date(a.dateModified).getTime() - new Date(b.dateModified).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'extension':
          comparison = a.extension.localeCompare(b.extension);
          break;
        case 'dimensions':
          comparison = (a.dimensions.width * a.dimensions.height) - (b.dimensions.width * b.dimensions.height);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [assets, activeFolder, filters, sortField, sortOrder]);

  // Focused asset (for Preview Inspector)
  const focusedAsset = useMemo(() => {
    if (focusedId) {
      const found = assets.find((a) => a.id === focusedId);
      if (found) return found;
    }
    if (selectedIds.size > 0) {
      const firstId = Array.from(selectedIds)[0];
      return assets.find((a) => a.id === firstId) || null;
    }
    return filteredAssets[0] || null;
  }, [assets, focusedId, selectedIds, filteredAssets]);

  // Selected asset items
  const selectedAssets = useMemo(() => {
    return assets.filter((a) => selectedIds.has(a.id));
  }, [assets, selectedIds]);

  // --- File Operations Hook (Clipboard, Context Menu, Dialogs, Deletes, Renames) ---
  const {
    clipboard,
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
  } = useFileOperations({
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
  });

  // --- Handlers: Selection ---
  const handleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    setFocusedId(id);
    if (!e) {
      setSelectedIds(new Set([id]));
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else if (e.shiftKey && focusedId) {
      // Range select
      const lastIndex = filteredAssets.findIndex((a) => a.id === focusedId);
      const currentIndex = filteredAssets.findIndex((a) => a.id === id);
      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = filteredAssets.slice(start, end + 1).map((a) => a.id);
        setSelectedIds(new Set(rangeIds));
      } else {
        setSelectedIds(new Set([id]));
      }
    } else {
      setSelectedIds(new Set([id]));
    }
  }, [filteredAssets, focusedId]);

  // --- Copy Handlers ---
  const handleCopyPath = useCallback(async (asset: AssetItem) => {
    const textToCopy = asset.fullPath || asset.name;
    const ok = await copyTextToClipboard(textToCopy);
    if (ok) {
      addToast('Cesta zkopírována', textToCopy);
    }
  }, [addToast]);

  const handleCopyImage = useCallback(async (asset: AssetItem) => {
    addToast('Kopíruji do schránky...', asset.name, 'info');
    const ok = await copyImageToClipboard(asset);
    if (ok) {
      addToast('Obrázek zkopírován', 'Připraven k vložení (Ctrl+V)');
    } else {
      addToast('Zkopírován název souboru', asset.name);
    }
  }, [addToast]);

  // Download Single File
  const handleDownloadSingle = useCallback((asset: AssetItem) => {
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = asset.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast('Stahování zahájeno', asset.name);
  }, [addToast]);

  // --- Dynamic Folder Item Counts ---
  const computedFolders = useMemo(() => {
    const updateNode = (node: FolderNode): FolderNode => {
      const count = assets.filter((a) =>
        node.path === '/'
          ? true
          : a.folder === node.path || a.folder.startsWith(node.path + '/')
      ).length;
      return {
        ...node,
        itemCount: count,
        subfolders: node.subfolders?.map(updateNode),
      };
    };
    return folders.map(updateNode);
  }, [folders, assets]);

  // --- Folder Management & Drag-Drop Move ---
  const handleToggleFavoriteFolder = useCallback(
    (folderPath: string) => {
      setFavoriteFolders((prev) => {
        const isFav = prev.includes(folderPath);
        const next = isFav
          ? prev.filter((p) => p !== folderPath)
          : [...prev, folderPath];
        addToast(
          isFav ? 'Odebráno z oblíbených' : 'Přidáno do oblíbených',
          folderPath
        );
        return next;
      });
    },
    [addToast]
  );

  const handleMoveAssetsToFolder = useCallback(
    (assetIds: string[], targetFolder: string) => {
      setAssets((prev) =>
        prev.map((a) =>
          assetIds.includes(a.id) ? { ...a, folder: targetFolder } : a
        )
      );
      const displayFolderName =
        targetFolder === '/'
          ? 'Všechny soubory'
          : targetFolder.replace(/^\//, '').replace(/\//g, ' / ');
      addToast(
        'Soubory přesunuty',
        `${assetIds.length} ${
          assetIds.length === 1 ? 'soubor byl přesunut' : 'souborů přesunuto'
        } do "${displayFolderName}"`
      );
    },
    [addToast]
  );

  // --- Dynamic Sidebar Resizing Handler ---
  const handleSidebarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSidebar(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const startX = e.clientX;
      const startW = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextW = Math.max(180, Math.min(500, startW + delta));
        setSidebarWidth(nextW);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        setIsResizingSidebar(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        const delta = upEvent.clientX - startX;
        const finalW = Math.max(180, Math.min(500, startW + delta));
        try {
          localStorage.setItem('aerobridge_sidebar_width', String(finalW));
        } catch {}
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth]
  );

  // --- Dynamic Right Inspector Resizing Handler ---
  const handleInspectorResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingInspector(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const startX = e.clientX;
      const startW = inspectorWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        // Dragging to the left increases width of the right panel
        const delta = startX - moveEvent.clientX;
        const maxW = Math.max(440, Math.min(1000, window.innerWidth - 320));
        const nextW = Math.max(260, Math.min(maxW, startW + delta));
        setInspectorWidth(nextW);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        setIsResizingInspector(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        const delta = startX - upEvent.clientX;
        const maxW = Math.max(440, Math.min(1000, window.innerWidth - 320));
        const finalW = Math.max(260, Math.min(maxW, startW + delta));
        try {
          localStorage.setItem('aerobridge_inspector_width', String(finalW));
        } catch {}
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [inspectorWidth]
  );

  const handleSidebarResetWidth = useCallback(() => {
    setSidebarWidth(280);
    try {
      localStorage.setItem('aerobridge_sidebar_width', '280');
    } catch {}
  }, []);

  const handleInspectorResetWidth = useCallback(() => {
    setInspectorWidth(440);
    try {
      localStorage.setItem('aerobridge_inspector_width', '440');
    } catch {}
  }, []);


  // --- Open Folder & File Import ---
  // --- IndexedDB Hydration & Synchronization ---
  useEffect(() => {
    let isMounted = true;

    async function hydrateFromIndexedDB() {
      try {
        // 1. Load stored custom assets
        const savedAssets = (await loadAssetsFromIndexedDB()).filter(
          (a) => !a.id.startsWith('native-')
        );
        if (isMounted && savedAssets.length > 0) {
          setAssets((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            const freshToLoad = savedAssets.filter((a) => !existingIds.has(a.id));
            return [...freshToLoad, ...prev];
          });
        }

        // 3. Load workspace session state
        const session = await loadWorkspaceSession();
        if (isMounted && session) {
          if (Array.isArray(session.favoriteFolders)) {
            const cleaned = session.favoriteFolders.filter(
              (p) => p !== '/adobe-projects' && p !== '/commercial'
            );
            setFavoriteFolders(cleaned);
          }
          if (session.activeFolder) {
            setActiveFolder(session.activeFolder);
          }
          if (session.sortField) {
            setSortField(session.sortField as any);
          }
          if (session.sortOrder) {
            setSortOrder(session.sortOrder as any);
          }
        }
      } catch (err) {
        console.warn('Error during IndexedDB hydration:', err);
      } finally {
        if (isMounted) setIsInitialLoadDone(true);
      }
    }

    hydrateFromIndexedDB();

    return () => {
      isMounted = false;
    };
  }, []);

  // Save workspace session to IndexedDB on changes
  useEffect(() => {
    if (!isInitialLoadDone) return;
    saveWorkspaceSession(favoriteFolders, activeFolder, sortField, sortOrder);
  }, [favoriteFolders, activeFolder, sortField, sortOrder, isInitialLoadDone]);



  // Mouse side buttons: button 3 = Back, button 4 = Forward (capture phase so WebView2 does not swallow them)
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;

  useEffect(() => {
    if (!isDesktopApp()) return;
    const swallow = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        if (currentViewRef.current === 'commander') {
          window.dispatchEvent(
            new CustomEvent('aerobridge:commander-back', {
              detail: { clientX: e.clientX, clientY: e.clientY },
            })
          );
        } else {
          handleNativeBack();
        }
      } else if (e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        if (currentViewRef.current === 'commander') {
          window.dispatchEvent(
            new CustomEvent('aerobridge:commander-forward', {
              detail: { clientX: e.clientX, clientY: e.clientY },
            })
          );
        } else {
          handleNativeForward();
        }
      }
    };
    window.addEventListener('mousedown', swallow, true);
    window.addEventListener('auxclick', swallow, true);
    window.addEventListener('mouseup', onMouseUp, true);
    return () => {
      window.removeEventListener('mousedown', swallow, true);
      window.removeEventListener('auxclick', swallow, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    };
  }, [handleNativeBack, handleNativeForward]);

  // Priority default working drive: F:\ (Working) instead of C:\ System drive
  useEffect(() => {
    if (!isInitialLoadDone || !isDesktopApp()) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem('aerobridge_last_native_dir');
    } catch {}

    import('./utils/tauriBridge').then(async ({ listNativeDrives }) => {
      try {
        const drives = await listNativeDrives();
        // Priority for default drive: F:\ (Working) > drive with "working" in name > first non-C drive > F:\ fallback
        const fDrive = drives.find(
          (d) => d.path.toUpperCase().startsWith('F:') || d.name.toLowerCase().includes('working')
        );
        const nonCDrive = drives.find((d) => !d.path.toUpperCase().startsWith('C:'));
        const preferredDefault = fDrive?.path || nonCDrive?.path || 'F:\\';

        // Never open C:\ System drive by default on launch
        if (last && !last.toUpperCase().startsWith('C:')) {
          void navigateNative(last);
        } else {
          void navigateNative(preferredDefault);
        }
      } catch (e) {
        console.warn('Initial desktop drive navigation failed:', e);
        void navigateNative('F:\\');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoadDone]);

  // --- Open Folder & Local File System Access ---
  const handleOpenLocalFolder = async () => {
    // 1. Native Windows 11 Desktop workflow (Tauri v2)
    if (isDesktopApp()) {
      try {
        const nativePath = await pickNativeFolder();
        if (nativePath) {
          await navigateNative(nativePath);
        }
        return;
      } catch (err) {
        console.warn('Native folder selection fallback to web API:', err);
      }
    }

    // 2. Web browser File System Access API workflow
    const result = await pickLocalDirectory();
    if (result && result.files.length > 0) {
      addToast('Analyzuji složku...', `${result.files.length} souborů`, 'info');
      const imported = await parseFilesToAssets(result.files, result.folderName);
      if (imported.length > 0) {
        setAssets((prev) => [...imported, ...prev]);
        setSelectedIds(new Set([imported[0].id]));
        setFocusedId(imported[0].id);
        const folderPath = `/${result.folderName}`;
        setActiveFolder(folderPath);

        // Save imported assets to IndexedDB
        saveAssetsToIndexedDB(imported);

        addToast(
          'Složka připojena',
          `Přidáno ${imported.length} souborů do mezipaměti`
        );
      }
    } else if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleRevealInExplorer = useCallback(async (asset: AssetItem) => {
    if (!asset.fullPath) return;
    if (isDesktopApp()) {
      try {
        // If it's a mock asset (doesn't have native disk path like C:\ or D:\)
        if (!asset.fullPath.match(/^[a-zA-Z]:[\\/]/)) {
          if (nativeDir) {
            await revealInWindowsExplorer(nativeDir);
            addToast('Otevřeno v Průzkumníku', nativeDir, 'info');
          } else {
            addToast('Ukázkový projekt', 'Tento soubor je ukázka v paměti. Otevřete skutečnou složku z disku.', 'info');
          }
          return;
        }

        await revealInWindowsExplorer(asset.fullPath);
        addToast('Zobrazeno v Průzkumníku Windows', asset.name, 'info');
      } catch (err) {
        addToast('Nelze otevřít umístění', String(err), 'warning');
      }
    } else {
      handleCopyPath(asset);
    }
  }, [nativeDir, addToast, handleCopyPath]);


  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addToast('Načítám soubory...', `${e.target.files.length} souborů`, 'info');
      const imported = await parseFilesToAssets(e.target.files);
      if (imported.length > 0) {
        setAssets((prev) => [...imported, ...prev]);
        setSelectedIds(new Set([imported[0].id]));
        setFocusedId(imported[0].id);
        setActiveFolder('/local');
        saveAssetsToIndexedDB(imported);
        addToast('Import dokončen', `Uloženo ${imported.length} souborů do IndexedDB`);
      }
    }
  };

  // --- Drag & Drop Listener ---
  const handleDragOver = (e: React.DragEvent) => {
    if (currentView === 'commander') return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (currentView === 'commander') return;
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (currentView === 'commander') return;
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addToast('Zpracovávám přetažené položky...', `${e.dataTransfer.files.length} položek`, 'info');
      const imported = await parseFilesToAssets(e.dataTransfer.files);
      if (imported.length > 0) {
        setAssets((prev) => [...imported, ...prev]);
        setSelectedIds(new Set([imported[0].id]));
        setFocusedId(imported[0].id);
        saveAssetsToIndexedDB(imported);
        addToast('Úspěšně načteno', `Zobrazeno a uloženo ${imported.length} souborů offline`);
      }
    }
  };



  // --- PDF Multi-page Page Navigation Handler ---
  const handlePageChange = useCallback(async (assetId: string, pageNum: number, resolvedUrl?: string) => {
    let newUrl = resolvedUrl;
    if (!newUrl) {
      const target = assets.find((a) => a.id === assetId);
      if (target) {
        const rendered = await renderPdfPage(target, pageNum, 1200);
        if (rendered) newUrl = rendered.url;
      }
    }
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
              ...a,
              currentPage: pageNum,
              url: newUrl || a.url,
            }
          : a
      )
    );
  }, [assets]);

  // --- Toggle File Info (Adobe Bridge Style: Show Thumbnail Only / Show Details) ---
  const handleToggleShowAllInfo = useCallback(() => {
    if (currentView !== 'browser' && currentView !== 'essentials') {
      setCurrentView('browser');
    }
    if (browserViewMode !== 'grid') {
      setBrowserViewMode('grid');
    }
    setShowAllInfo((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aerobridge_show_file_info', String(next));
      } catch {}
      addToast(
        next ? 'Zobrazeny názvy a přípony souborů' : 'Pouze miniatury (názvy skryty)',
        next
          ? 'Pod obrázky je zobrazeno jméno a přípona (Ctrl+T)'
          : 'Podrobnosti skryty, zobrazeno pouze po najetí (Ctrl+T)'
      );
      return next;
    });
  }, [currentView, addToast]);

  // --- Global Keyboard Shortcuts Hook ---
  useKeyboardShortcuts({
    quickLookOpen,
    batchRenameOpen,
    batchExportOpen,
    batchIptcOpen,
    focusedAsset,
    filteredAssets,
    focusedId,
    selectedIds,
    selectedAssets,
    nativeDir,
    clipboard,
    contextMenuPos,
    closeContextMenu,
    setSelectedIds,
    setFocusedId,
    setQuickLookOpen,
    setBatchRenameOpen,
    setBatchIptcOpen,
    searchInputRef,
    handleOpenAsset,
    handleRenameRequest,
    handleCreateFolderRequest,
    handleDeleteRequest,
    handleDeleteSelected,
    handleCopyFiles,
    handleCutFiles,
    handlePasteFiles,
    handleCopyImage,
    handleToggleShowAllInfo,
    handleNativeRefresh,
    handleNativeBack,
    handleNativeForward,
    handleNativeUp,
    handleShowProperties,
    currentView,
    browserViewMode,
    onToggleBrowserViewMode: handleBrowserViewModeChange,
    onViewChange: setCurrentView,
    settingsOpen,
    setSettingsOpen,
    handlePurgeFolderCache,
    addToast,
  });

  // --- Batch Rename Execution ---
  const handleApplyBatchRename = (renamedMap: Record<string, string>) => {
    setAssets((prev) => {
      const updated = prev.map((a) => {
        if (renamedMap[a.id]) {
          return { ...a, name: renamedMap[a.id] };
        }
        return a;
      });
      saveAssetsToIndexedDB(updated);
      return updated;
    });
    addToast('Přejmenováno', `Aktualizováno ${Object.keys(renamedMap).length} souborů`);
  };

  // --- Batch IPTC Metadata Update ---
  const handleApplyBatchIptc = (assetIds: string[], config: BatchIptcConfig) => {
    setAssets((prev) => {
      const updated = prev.map((a) => {
        if (!assetIds.includes(a.id)) return a;

        let title = a.iptc.title;
        if (config.updateTitle) title = config.title;

        let caption = a.iptc.caption;
        if (config.updateCaption) {
          if (config.captionMode === 'replace') {
            caption = config.caption;
          } else {
            caption = caption ? `${caption} ${config.caption}` : config.caption;
          }
        }

        let creator = a.iptc.creator;
        if (config.updateCreator) creator = config.creator;

        let copyright = a.iptc.copyright;
        if (config.updateCopyright) copyright = config.copyright;

        let location = a.iptc.location;
        if (config.updateLocation) location = config.location;

        let keywords = [...a.iptc.keywords];
        if (config.updateKeywords) {
          if (config.keywordsMode === 'replace') {
            keywords = [...config.keywords];
          } else if (config.keywordsMode === 'append') {
            keywords = Array.from(new Set([...keywords, ...config.keywords]));
          } else if (config.keywordsMode === 'remove') {
            keywords = keywords.filter((k) => !config.keywords.includes(k));
          }
        }

        return {
          ...a,
          iptc: {
            ...a.iptc,
            title,
            caption,
            creator,
            copyright,
            location,
            keywords,
          },
        };
      });

      saveAssetsToIndexedDB(updated);

      // Direct disk writeback if enabled
      if (config.writebackToDisk) {
        (async () => {
          let writtenDiskCount = 0;
          for (const assetId of assetIds) {
            const item = updated.find((x) => x.id === assetId);
            if (item) {
              const res = await writeMetadataBackToAsset(item, item.iptc);
              if (res.success && item.fileHandle) {
                writtenDiskCount++;
              }
            }
          }
          if (writtenDiskCount > 0) {
            addToast(
              'Zápis na disk dokončen',
              `Metadata fyzicky zapsána do ${writtenDiskCount} souborů na disku`
            );
          }
        })();
      }

      return updated;
    });

    addToast(
      'IPTC metadata uložena',
      `Aktualizováno ${assetIds.length} ${
        assetIds.length === 1 ? 'soubor' : 'souborů'
      }`
    );
  };

  // --- Keywords Update ---
  const handleUpdateKeywords = (newKeywords: string[]) => {
    if (!focusedAsset) return;
    setAssets((prev) => {
      const updated = prev.map((a) =>
        a.id === focusedAsset.id
          ? { ...a, iptc: { ...a.iptc, keywords: newKeywords } }
          : a
      );
      saveAssetsToIndexedDB(updated);
      return updated;
    });
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#121316] text-zinc-100 font-sans select-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File System Inputs */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />
      <input
        ref={filesInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* Top Bar — Minimalist 2-row Bauhaus Header */}
      <TopBar
        currentView={currentView}
        onViewChange={(v) => {
          if (v === 'essentials' || v === 'table') {
            setCurrentView('browser');
          } else {
            setCurrentView(v);
          }
        }}
        browserViewMode={browserViewMode}
        onBrowserViewModeChange={handleBrowserViewModeChange}
        onOpenFolder={handleOpenLocalFolder}
        selectedCount={selectedIds.size}
        activeFolder={activeFolder}
        totalFilteredCount={filteredAssets.length}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters((f) => ({ ...f, searchQuery: q }))}
        formatFilter={filters.formatFilter}
        onFormatFilterChange={(fmt) => setFilters((f) => ({ ...f, formatFilter: fmt }))}
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        thumbnailSize={thumbnailSize}
        onThumbnailSizeChange={setThumbnailSize}
        fitMode={fitMode}
        onFitModeToggle={() => setFitMode((m) => (m === 'cover' ? 'contain' : 'cover'))}
        onBatchRename={() => setBatchRenameOpen(true)}
        onBatchExport={() => setBatchExportOpen(true)}
        onBatchIptc={() => setBatchIptcOpen(true)}
        showAllInfo={showAllInfo}
        onToggleShowAllInfo={handleToggleShowAllInfo}
        onSelectAll={() => setSelectedIds(new Set(filteredAssets.map((a) => a.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onOpenSettings={() => setSettingsOpen(true)}
        onPurgeFolderCache={handlePurgeFolderCache}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Hidden in Commander dual-pane mode) */}
        {currentView !== 'commander' && (
          <>
            <Sidebar
              width={sidebarWidth}
              folders={computedFolders}
              activeFolder={activeFolder}
              onSelectFolder={setActiveFolder}
              favoriteFolders={favoriteFolders}
              onToggleFavorite={handleToggleFavoriteFolder}
              onMoveAssets={handleMoveAssetsToFolder}
              filters={filters}
              onUpdateFilter={(k, v) => setFilters({ ...filters, [k]: v })}
              onResetFilters={() =>
                setFilters({
                  searchQuery: '',
                  formatFilter: null,
                  orientationFilter: 'all',
                  keywordFilter: null,
                })
              }
              onImportFiles={() => filesInputRef.current?.click()}
              totalAssetsCount={assets.length}
              onOpenNativeFolder={handleOpenLocalFolder}
              nativeActivePath={activeFolder.startsWith('native:') ? nativeDir : null}
              onNavigateNative={isDesktopApp() ? navigateNative : undefined}
              onContextMenuFolder={handleContextMenuFolder}
            />

            {/* Dynamic Sidebar Resize Handle (Tahem myši rozšiřovat/zužovat) */}
            <div
              onMouseDown={handleSidebarResizeStart}
              onDoubleClick={handleSidebarResetWidth}
              className={`w-1 relative z-10 cursor-col-resize select-none shrink-0 transition-colors group flex items-center justify-center ${
                isResizingSidebar
                  ? 'bg-[#e2e4e9] opacity-100'
                  : 'bg-transparent hover:bg-[#e2e4e9]/50'
              }`}
              title="Tahem myši změnit šířku bočního panelu (dvojklik pro výchozí šířku)"
            >
              <div className="absolute inset-y-0 left-0 -right-2.5 cursor-col-resize" />
            </div>
          </>
        )}

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#121316] relative overflow-hidden">
          {isDesktopApp() && nativeDir && activeFolder.startsWith('native:') && currentView !== 'commander' && (
            <NativePathBar
              path={nativeDir}
              canBack={navHistory.index > 0}
              canForward={navHistory.index < navHistory.stack.length - 1}
              isLoading={nativeLoading}
              onBack={handleNativeBack}
              onForward={handleNativeForward}
              onUp={handleNativeUp}
              onRefresh={handleNativeRefresh}
              onNavigate={navigateNative}
            />
          )}
          {/* Main Browsing Canvas: Grid or List Table within unified Prohlížeč section */}
          {(currentView === 'browser' || currentView === 'essentials' || currentView === 'table') && (
            browserViewMode === 'grid' ? (
              <AssetGrid
                assets={filteredAssets}
                selectedIds={selectedIds}
                focusedId={focusedId}
                thumbnailSize={thumbnailSize}
                onThumbnailSizeChange={setThumbnailSize}
                fitMode={fitMode}
                onFitModeToggle={() =>
                  setFitMode((m) => (m === 'cover' ? 'contain' : 'cover'))
                }
                onSelect={handleSelect}
                onOpenQuickLook={(id) => {
                  setFocusedId(id);
                  setQuickLookOpen(true);
                }}
                onOpenAsset={handleOpenAsset}
                onCopyPath={handleCopyPath}
                onCopyImage={handleCopyImage}
                isDragOver={isDragOver}
                showAllInfo={showAllInfo}
                onNavigateFolder={navigateNative}
                onContextMenu={handleContextMenu}
                onPageChange={handlePageChange}
              />
            ) : (
              <MetadataTableView
                assets={filteredAssets}
                selectedIds={selectedIds}
                focusedId={focusedId}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={(field) => {
                  if (sortField === field) {
                    setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortField(field);
                    setSortOrder('asc');
                  }
                }}
                onSelect={handleSelect}
                onOpenQuickLook={(id) => {
                  setFocusedId(id);
                  setQuickLookOpen(true);
                }}
                onOpenAsset={handleOpenAsset}
                onCopyPath={handleCopyPath}
                onCopyImage={handleCopyImage}
                onContextMenu={handleContextMenu}
                thumbnailSize={thumbnailSize}
                onThumbnailSizeChange={setThumbnailSize}
                fitMode={fitMode}
              />
            )
          )}

          {currentView === 'filmstrip' && (
            <FilmstripView
              assets={filteredAssets}
              selectedId={focusedId}
              onSelect={(id) => {
                setFocusedId(id);
                setSelectedIds(new Set([id]));
              }}
              onOpenQuickLook={(id) => {
                setFocusedId(id);
                setQuickLookOpen(true);
              }}
              onCopyPath={handleCopyPath}
              onCopyImage={handleCopyImage}
            />
          )}

          {currentView === 'compare' && (
            <CompareView
              assets={filteredAssets}
              selectedIds={selectedIds}
              onOpenQuickLook={(id) => {
                setFocusedId(id);
                setQuickLookOpen(true);
              }}
              onCopyPath={handleCopyPath}
              onCopyImage={handleCopyImage}
            />
          )}

          {/* Commander Mode: Full-screen dual-pane file manager a la Total Commander */}
          {currentView === 'commander' && (
            <CommanderView
              initialLeftPath={nativeDir && !nativeDir.toUpperCase().startsWith('C:') ? nativeDir : 'F:\\'}
              initialRightPath={nativeDir && !nativeDir.toUpperCase().startsWith('C:') ? nativeDir : 'F:\\'}
              onNotify={addToast}
              onOpenQuickLook={(asset) => {
                setFocusedId(asset.id);
                setQuickLookOpen(true);
              }}
            />
          )}
        </main>

        {/* Right Inspector Drawer with Dynamic Resize Handle */}
        {(currentView === 'browser' || currentView === 'essentials' || currentView === 'table') && (
          <>
            {/* Dynamic Inspector Resize Handle (Tahem myši rozšiřovat/zužovat vlevo) */}
            <div
              onMouseDown={handleInspectorResizeStart}
              onDoubleClick={handleInspectorResetWidth}
              className={`w-1 relative z-10 cursor-col-resize select-none shrink-0 transition-colors group flex items-center justify-center ${
                isResizingInspector
                  ? 'bg-[#e2e4e9] opacity-100'
                  : 'bg-transparent hover:bg-[#e2e4e9]/50'
              }`}
              title="Tahem myši změnit šířku panelu náhledu (dvojklik pro výchozí šířku)"
            >
              <div className="absolute inset-y-0 left-0 -right-2.5 cursor-col-resize" />
            </div>

            <PreviewInspector
              width={inspectorWidth}
              asset={focusedAsset}
              selectedCount={selectedIds.size}
              onOpenQuickLook={() => setQuickLookOpen(true)}
              onOpenFile={handleOpenAsset}
              onCopyPath={() => focusedAsset && handleCopyPath(focusedAsset)}
              onCopyImage={() => focusedAsset && handleCopyImage(focusedAsset)}
              onDownload={() => focusedAsset && handleDownloadSingle(focusedAsset)}
              onRevealInExplorer={() => focusedAsset && handleRevealInExplorer(focusedAsset)}
              onUpdateKeywords={handleUpdateKeywords}
              onOpenBatchIptc={() => setBatchIptcOpen(true)}
              onOpenFolder={navigateNative}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>

      {/* Quick Look Fullscreen Modal */}
      <QuickLookModal
        isOpen={quickLookOpen}
        onClose={() => setQuickLookOpen(false)}
        asset={focusedAsset}
        assets={filteredAssets}
        onNavigate={(dir) => {
          const currentIndex = filteredAssets.findIndex(
            (a) => a.id === focusedAsset?.id
          );
          if (dir === 'prev' && currentIndex > 0) {
            const prev = filteredAssets[currentIndex - 1];
            setFocusedId(prev.id);
            setSelectedIds(new Set([prev.id]));
          } else if (dir === 'next' && currentIndex < filteredAssets.length - 1) {
            const next = filteredAssets[currentIndex + 1];
            setFocusedId(next.id);
            setSelectedIds(new Set([next.id]));
          }
        }}
        onCopyPath={handleCopyPath}
        onCopyImage={handleCopyImage}
        onOpenFile={handleOpenAsset}
        onPageChange={handlePageChange}
      />

      {/* Batch Rename Modal */}
      <BatchRenameModal
        isOpen={batchRenameOpen}
        onClose={() => setBatchRenameOpen(false)}
        selectedAssets={selectedAssets}
        onApplyRename={handleApplyBatchRename}
      />

      {/* Batch Export Modal */}
      <BatchExportModal
        isOpen={batchExportOpen}
        onClose={() => setBatchExportOpen(false)}
        selectedAssets={selectedAssets}
        onNotify={addToast}
      />

      {/* Batch IPTC Metadata Modal */}
      <BatchIptcModal
        isOpen={batchIptcOpen}
        onClose={() => setBatchIptcOpen(false)}
        selectedAssets={selectedAssets}
        onApplyBatchIptc={handleApplyBatchIptc}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Windows Explorer Style Right-Click File Context Menu */}
      <FileContextMenu
        position={contextMenuPos}
        target={contextMenuTarget}
        clipboard={clipboard}
        onClose={closeContextMenu}
        onOpen={handleOpenContextMenuTarget}
        onRevealInExplorer={(path) => revealInWindowsExplorer(path)}
        onOpenTerminal={handleOpenTerminal}
        onCopy={handleCopyFiles}
        onCut={handleCutFiles}
        onPaste={handlePasteFiles}
        onCopyPath={(p) => {
          copyTextToClipboard(p);
          addToast('Cesta zkopírována', p);
        }}
        onRename={handleRenameRequest}
        onDelete={handleDeleteRequest}
        onCreateFolder={handleCreateFolderRequest}
        onRefresh={() => {
          if (nativeDir) {
            void navigateNative(nativeDir);
            addToast('Aktualizováno');
          }
        }}
        onSelectAll={() => setSelectedIds(new Set(filteredAssets.map((a) => a.id)))}
        onShowProperties={handleShowProperties}
        favoriteFolders={favoriteFolders}
        onToggleFavorite={handleToggleFavoriteFolder}
      />

      {/* Input / Confirm Modal for Rename, New Folder, Delete */}
      <InputDialog
        isOpen={inputDialog.isOpen}
        type={inputDialog.type}
        title={inputDialog.title}
        initialValue={inputDialog.initialValue}
        itemCount={inputDialog.itemCount}
        onClose={() => setInputDialog((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={handleDialogSubmit}
      />

      {/* Settings and Cache Management Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeFolder={nativeDir}
        onPurgeActiveFolder={handlePurgeFolderCache}
        onPurgeAll={handlePurgeAllCache}
        onNotify={addToast}
      />
    </div>
  );
}
