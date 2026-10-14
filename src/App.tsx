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
  BatchIptcConfig,
} from './types';
import { INITIAL_ASSETS, INITIAL_FOLDERS } from './data/mockAssets';
import {
  parseFilesToAssets,
  pickLocalDirectory,
  scanDirectoryHandle,
  copyImageToClipboard,
  copyTextToClipboard,
} from './utils/localFileSystem';
import { writeMetadataBackToAsset } from './utils/metadataWriter';
import {
  saveDirectoryHandle,
  getSavedDirectoryHandles,
  removeSavedDirectory,
  verifyDirectoryPermission,
  saveAssetsToIndexedDB,
  loadAssetsFromIndexedDB,
  saveWorkspaceSession,
  loadWorkspaceSession,
  SavedDirectoryRecord,
} from './utils/indexedDbStorage';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { AssetGrid } from './components/AssetGrid';
import { FilmstripView } from './components/FilmstripView';
import { CompareView } from './components/CompareView';
import { MetadataTableView } from './components/MetadataTableView';
import { PreviewInspector } from './components/PreviewInspector';
import { QuickLookModal } from './components/QuickLookModal';
import { BatchRenameModal } from './components/BatchRenameModal';
import { BatchExportModal } from './components/BatchExportModal';
import { BatchIptcModal } from './components/BatchIptcModal';
import { ToastContainer, ToastMessage } from './components/Toast';

export default function App() {
  // --- Core State ---
  const [assets, setAssets] = useState<AssetItem[]>(INITIAL_ASSETS);
  const [folders, setFolders] = useState<FolderNode[]>(INITIAL_FOLDERS);
  const [activeFolder, setActiveFolder] = useState<string>('/');
  const [favoriteFolders, setFavoriteFolders] = useState<string[]>([
    '/adobe-projects',
    '/commercial',
  ]);
  const [savedDirectories, setSavedDirectories] = useState<SavedDirectoryRecord[]>([]);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [currentView, setCurrentView] = useState<WorkspaceView>('essentials');

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
  const [thumbnailSize, setThumbnailSize] = useState<number>(200);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [showAllInfo, setShowAllInfo] = useState<boolean>(false);

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
  const addToast = useCallback((title: string, description?: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Filtered & Sorted Assets Computation ---
  const filteredAssets = useMemo(() => {
    const list = assets.filter((asset) => {
      // Folder filtering
      if (activeFolder !== '/') {
        if (!asset.folder.startsWith(activeFolder)) {
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
        if (asset.category !== filters.formatFilter) return false;
      }

      // Orientation filter
      if (filters.orientationFilter !== 'all') {
        const isLandscape = asset.dimensions.width > asset.dimensions.height;
        const isPortrait = asset.dimensions.height > asset.dimensions.width;
        const isSquare = asset.dimensions.width === asset.dimensions.height;
        if (filters.orientationFilter === 'landscape' && !isLandscape) return false;
        if (filters.orientationFilter === 'portrait' && !isPortrait) return false;
        if (filters.orientationFilter === 'square' && !isSquare) return false;
      }

      return true;
    });

    // Apply Sorting
    list.sort((a, b) => {
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
      const startX = e.clientX;
      const startW = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextW = Math.max(180, Math.min(500, startW + delta));
        setSidebarWidth(nextW);
      };

      const onMouseUp = (upEvent: MouseEvent) => {
        setIsResizingSidebar(false);
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


  // --- Open Folder & File Import ---
  // --- IndexedDB Hydration & Synchronization ---
  useEffect(() => {
    let isMounted = true;

    async function hydrateFromIndexedDB() {
      try {
        // 1. Load saved local directory handles
        const dirs = await getSavedDirectoryHandles();
        if (isMounted && dirs.length > 0) {
          setSavedDirectories(dirs);
        }

        // 2. Load stored custom assets
        const savedAssets = await loadAssetsFromIndexedDB();
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
          if (session.favoriteFolders && session.favoriteFolders.length > 0) {
            setFavoriteFolders(session.favoriteFolders);
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

  // --- Open Folder & Local File System Access ---
  const handleOpenLocalFolder = async () => {
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

        // Store directory handle in IndexedDB for persistent browsing
        if (result.handle) {
          try {
            const saved = await saveDirectoryHandle(result.folderName, result.handle);
            setSavedDirectories((prev) => {
              const filtered = prev.filter((d) => d.id !== saved.id);
              return [...filtered, saved];
            });
          } catch (e) {
            console.warn('Could not store directory handle:', e);
          }
        }

        // Save imported assets to IndexedDB
        saveAssetsToIndexedDB(imported);

        addToast(
          'Složka připojena a uložena',
          `Přidáno ${imported.length} souborů do IndexedDB knihovny`
        );
      }
    } else if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  // Rescan existing saved directory handle from IndexedDB
  const handleRescanSavedDirectory = async (dir: SavedDirectoryRecord) => {
    addToast('Ověřuji oprávnění...', dir.name, 'info');
    const hasPermission = await verifyDirectoryPermission(dir.handle);
    if (!hasPermission) {
      addToast(
        'Vyžadováno oprávnění',
        'Povolte prosím v prohlížeči přístup k místnímu disku',
        'warning'
      );
      return;
    }

    try {
      addToast('Načítám soubory z disku...', `Složka ${dir.name}`, 'info');
      const files = await scanDirectoryHandle(dir.handle);
      const imported = await parseFilesToAssets(files, dir.name);
      if (imported.length > 0) {
        setAssets((prev) => {
          // Replace files from this folder with newly scanned ones
          const remaining = prev.filter((a) => a.folder !== dir.path);
          return [...imported, ...remaining];
        });
        setActiveFolder(dir.path);
        if (imported[0]) {
          setFocusedId(imported[0].id);
          setSelectedIds(new Set([imported[0].id]));
        }
        saveAssetsToIndexedDB(imported);
        addToast(
          'Disk synchronizován',
          `Obnoveno ${imported.length} souborů ze složky "${dir.name}"`
        );
      } else {
        addToast('Složka je prázdná', dir.name, 'info');
      }
    } catch (err) {
      console.error('Failed to rescan local folder:', err);
      addToast('Chyba při čtení disku', 'Zkuste složku vybrat znovu', 'warning');
    }
  };

  // Remove saved directory handle from IndexedDB
  const handleRemoveSavedDirectory = async (id: string) => {
    await removeSavedDirectory(id);
    setSavedDirectories((prev) => prev.filter((d) => d.id !== id));
    addToast('Složka odebrána', 'Odebráno z rychlého přístupu IndexedDB');
  };

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
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
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

  // --- Delete / Remove Selection from View ---
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const removedAssets = assets.filter((a) => selectedIds.has(a.id));

    // Safely revoke any blob URLs to prevent memory leaks
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
  }, [selectedIds, assets, addToast]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Spacebar: Quick Look Fullscreen
      if (e.key === ' ' && !quickLookOpen && !batchRenameOpen && !batchExportOpen && !batchIptcOpen) {
        e.preventDefault();
        if (focusedAsset) setQuickLookOpen(true);
        return;
      }

      // F2: Windows Shortcut for Batch Rename
      if (e.key === 'F2') {
        e.preventDefault();
        if (selectedAssets.length > 0) {
          setBatchRenameOpen(true);
        } else {
          addToast('Dávkové přejmenování', 'Nejprve vyberte alespoň jeden soubor (F2)', 'info');
        }
        return;
      }

      // Delete: Remove selected items from view
      if (e.key === 'Delete' && !quickLookOpen && !batchRenameOpen && !batchExportOpen && !batchIptcOpen) {
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
        return;
      }

      // Escape: Clear selection
      if (e.key === 'Escape' && !quickLookOpen && !batchRenameOpen && !batchExportOpen && !batchIptcOpen) {
        if (selectedIds.size > 0) {
          e.preventDefault();
          setSelectedIds(new Set());
        }
        return;
      }

      // Cmd/Ctrl + A: Select All
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
        return;
      }

      // Cmd/Ctrl + M: Open Batch IPTC Modal
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (selectedAssets.length > 0) {
          setBatchIptcOpen(true);
        } else {
          addToast('IPTC úprava', 'Nejprve vyberte alespoň jeden soubor', 'info');
        }
        return;
      }

      // Cmd/Ctrl + I: Toggle file information display
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowAllInfo((prev) => {
          const next = !prev;
          addToast(
            next ? 'Informace zobrazeny trvale' : 'Informace skryty (pouze po najetí)',
            'Přepnuto klávesovou zkratkou Ctrl+I'
          );
          return next;
        });
        return;
      }

      // Cmd/Ctrl + F: Search focus
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Cmd/Ctrl + C: Copy Image
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (focusedAsset) {
          e.preventDefault();
          handleCopyImage(focusedAsset);
        }
        return;
      }

      // Navigation: Arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const currentIndex = filteredAssets.findIndex((a) => a.id === focusedId);
        let nextIndex = currentIndex;

        if (e.key === 'ArrowLeft' && currentIndex > 0) nextIndex = currentIndex - 1;
        if (e.key === 'ArrowRight' && currentIndex < filteredAssets.length - 1) nextIndex = currentIndex + 1;
        if (e.key === 'ArrowUp' && currentIndex > 3) nextIndex = currentIndex - 4;
        if (e.key === 'ArrowDown' && currentIndex < filteredAssets.length - 4) nextIndex = currentIndex + 4;

        if (nextIndex >= 0 && nextIndex < filteredAssets.length && nextIndex !== currentIndex) {
          const nextAsset = filteredAssets[nextIndex];
          setFocusedId(nextAsset.id);
          setSelectedIds(new Set([nextAsset.id]));
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    quickLookOpen,
    batchRenameOpen,
    batchExportOpen,
    batchIptcOpen,
    focusedAsset,
    filteredAssets,
    focusedId,
    selectedIds,
    selectedAssets.length,
    handleDeleteSelected,
    handleCopyImage,
    addToast,
  ]);

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
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#131211] text-stone-100 font-sans select-none"
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
        onViewChange={setCurrentView}
        onOpenFolder={handleOpenLocalFolder}
        selectedCount={selectedIds.size}
        activeFolder={activeFolder}
        totalFilteredCount={filteredAssets.length}
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters((f) => ({ ...f, searchQuery: q }))}
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
        onToggleShowAllInfo={() => setShowAllInfo((prev) => !prev)}
        onSelectAll={() => setSelectedIds(new Set(filteredAssets.map((a) => a.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
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
          savedDirectories={savedDirectories}
          onRescanDirectory={handleRescanSavedDirectory}
          onRemoveSavedDirectory={handleRemoveSavedDirectory}
          onOpenNativeFolder={handleOpenLocalFolder}
        />

        {/* Dynamic Sidebar Resize Handle (Tahem myši rozšiřovat/zužovat) */}
        <div
          onMouseDown={handleSidebarResizeStart}
          className={`w-1 relative z-20 cursor-col-resize select-none shrink-0 transition-colors group flex items-center justify-center ${
            isResizingSidebar
              ? 'bg-[#ede8df] opacity-100'
              : 'bg-transparent hover:bg-[#ede8df]/50'
          }`}
          title="Tahem myši změnit šířku bočního panelu"
        >
          <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
        </div>

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#131211] relative overflow-hidden">
          {currentView === 'essentials' && (
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
              onCopyPath={handleCopyPath}
              onCopyImage={handleCopyImage}
              isDragOver={isDragOver}
              showAllInfo={showAllInfo}
            />
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

          {currentView === 'table' && (
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
              onCopyPath={handleCopyPath}
              onCopyImage={handleCopyImage}
            />
          )}
        </main>

        {/* Right Inspector Drawer */}
        {(currentView === 'essentials' || currentView === 'table') && (
          <PreviewInspector
            asset={focusedAsset}
            selectedCount={selectedIds.size}
            onOpenQuickLook={() => setQuickLookOpen(true)}
            onCopyPath={() => focusedAsset && handleCopyPath(focusedAsset)}
            onCopyImage={() => focusedAsset && handleCopyImage(focusedAsset)}
            onDownload={() => focusedAsset && handleDownloadSingle(focusedAsset)}
            onUpdateKeywords={handleUpdateKeywords}
            onOpenBatchIptc={() => setBatchIptcOpen(true)}
          />
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
    </div>
  );
}
