import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Columns2,
  ArrowLeft,
  ArrowRight,
  CornerLeftUp,
  RotateCw,
  Search,
  X,
  Check,
  FolderPlus,
  Copy,
  Move,
  Trash2,
  Eye,
  ExternalLink,
  ArrowUpDown,
  ArrowLeftRight,
  Equal,
  HardDrive,
  Folder,
  FileText,
  Terminal,
  Scissors,
  ClipboardPaste,
} from 'lucide-react';
import {
  scanNativeFolder,
  listNativeDrives,
  listNativePlaces,
  moveFilesNative,
  copyFilesNative,
  deleteFilesNative,
  createFolderNative,
  renameFileNative,
  openFileNative,
  openTerminalNative,
  revealInWindowsExplorer,
  showFilePropertiesNative,
  getNativeFileIcon,
  isDesktopApp,
  startNativeFileDrag,
  type NativeFileEntry,
  type NativePlace,
} from '../utils/tauriBridge';
import { copyTextToClipboard } from '../utils/localFileSystem';
import {
  FileContextMenu,
  type ContextMenuPosition,
  type ContextMenuTarget,
} from './FileContextMenu';
import {
  Win11Folder,
  Win11Drive,
  Win11Desktop,
  Win11Downloads,
  Win11Documents,
  Win11Pictures,
} from './Win11Icons';
import { getAppIcon } from './AppIcons';
import { AssetItem } from '../types';
import { CommanderNotepad } from './CommanderNotepad';
import { CommanderTerminal } from './CommanderTerminal';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'log', 'csv', 'tsv', 'ini', 'cfg', 'conf',
  'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'xml', 'yaml', 'yml',
  'rs', 'py', 'bat', 'cmd', 'ps1', 'sh', 'sql', 'toml', 'env'
]);

function isTextLikeFile(ext: string): boolean {
  return TEXT_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ''));
}

export interface CommanderViewProps {
  initialLeftPath?: string;
  initialRightPath?: string;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenQuickLook?: (asset: AssetItem) => void;
}

type SortField = 'name' | 'ext' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';

interface PaneState {
  currentPath: string;
  items: NativeFileEntry[];
  loading: boolean;
  selectedPaths: Set<string>;
  focusedIndex: number;
  sortField: SortField;
  sortOrder: SortOrder;
  filterQuery: string;
  history: string[];
  historyIndex: number;
  inputPath: string;
  isEditingPath: boolean;
}

const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

/** Normalizes and gets parent directory of a path (e.g. C:\Users\me -> C:\Users, C:\Users -> C:\, C:\ -> null) */
function getParentDir(p: string): string | null {
  if (!p) return null;
  const clean = p.replace(/\//g, '\\').replace(/\\+$/, '');
  const lastSlash = clean.lastIndexOf('\\');
  if (lastSlash === -1) return null;
  if (lastSlash === 2 && clean[1] === ':') {
    return `${clean.substring(0, 2)}\\`;
  }
  if (clean.length === 3 && clean[1] === ':' && clean[2] === '\\') {
    return null; // Already at drive root
  }
  const parent = clean.substring(0, lastSlash);
  return parent.length === 2 && parent[1] === ':' ? `${parent}\\` : parent;
}

/** Formats byte size into human readable string */
function formatFileSize(bytes: number, isDir: boolean): string {
  if (isDir) return '<SLOŽKA>';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Formats modification timestamp */
function formatModifiedDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

/** Formats extension color badge */
function getExtBadgeStyle(ext: string, isDir: boolean): { bg: string; text: string } {
  if (isDir) return { bg: 'bg-amber-500/15', text: 'text-amber-300' };
  const e = ext.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(e)) {
    return { bg: 'bg-lime-500/15', text: 'text-lime-300' };
  }
  if (['psd', 'psb'].includes(e)) return { bg: 'bg-sky-500/15', text: 'text-sky-300' };
  if (['ai', 'eps', 'svg'].includes(e)) return { bg: 'bg-orange-500/15', text: 'text-orange-300' };
  if (['indd', 'indt'].includes(e)) return { bg: 'bg-pink-500/15', text: 'text-pink-300' };
  if (['pdf'].includes(e)) return { bg: 'bg-rose-500/15', text: 'text-rose-300' };
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(e)) return { bg: 'bg-purple-500/15', text: 'text-purple-300' };
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv'].includes(e)) {
    return { bg: 'bg-blue-500/15', text: 'text-blue-300' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return { bg: 'bg-amber-500/15', text: 'text-amber-300' };
  return { bg: 'bg-zinc-700/30', text: 'text-zinc-400' };
}

/** In-memory drag session payload fallback for reliable WebView2 / desktop drag & drop */
let activeDragPayload: { paths: string[]; sourcePane: 'left' | 'right' } | null = null;

const getInitialPanePath = (initial?: string, storageKey?: string): string => {
  if (initial && !initial.toUpperCase().startsWith('C:')) return initial;
  let saved: string | null = null;
  if (storageKey) {
    try {
      saved = localStorage.getItem(storageKey);
    } catch {}
  }
  if (saved && !saved.toUpperCase().startsWith('C:')) return saved;
  return 'F:\\';
};

export const CommanderView: React.FC<CommanderViewProps> = ({
  initialLeftPath,
  initialRightPath,
  onNotify,
  onOpenQuickLook,
}) => {
  // Drives & Quick Places (loaded from OS)
  const [drives, setDrives] = useState<NativePlace[]>([]);
  const [places, setPlaces] = useState<NativePlace[]>([]);

  // Splitter ratio (percentage for left pane, default 50%)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active Pane ('left' | 'right')
  const [activePane, setActivePane] = useState<'left' | 'right'>('left');

  // Initial path resolution (defaults to Working drive F:\ instead of C:\ System)
  const initialLeft = getInitialPanePath(initialLeftPath, 'aerobridge_commander_left_path');
  const initialRight = getInitialPanePath(initialRightPath, 'aerobridge_commander_right_path');

  // Left Pane State
  const [left, setLeft] = useState<PaneState>({
    currentPath: initialLeft,
    items: [],
    loading: false,
    selectedPaths: new Set(),
    focusedIndex: 0,
    sortField: 'name',
    sortOrder: 'asc',
    filterQuery: '',
    history: [initialLeft],
    historyIndex: 0,
    inputPath: initialLeft,
    isEditingPath: false,
  });

  // Right Pane State
  const [right, setRight] = useState<PaneState>({
    currentPath: initialRight,
    items: [],
    loading: false,
    selectedPaths: new Set(),
    focusedIndex: 0,
    sortField: 'name',
    sortOrder: 'asc',
    filterQuery: '',
    history: [initialRight],
    historyIndex: 0,
    inputPath: initialRight,
    isEditingPath: false,
  });

  // Pane view mode: each pane can be toggled between 'files' (explorer), 'notepad' (scratchpad), and 'terminal'
  const [leftViewMode, setLeftViewMode] = useState<'files' | 'notepad' | 'terminal'>('files');
  const [rightViewMode, setRightViewMode] = useState<'files' | 'notepad' | 'terminal'>('files');
  const [leftNotepadFile, setLeftNotepadFile] = useState<string | null>(null);
  const [rightNotepadFile, setRightNotepadFile] = useState<string | null>(null);

  // Open file in Notepad handler
  const handleOpenInNotepad = useCallback((filePath: string, preferredPane?: 'left' | 'right') => {
    const target = preferredPane || activePane;
    if (target === 'left') {
      setLeftNotepadFile(filePath);
      setLeftViewMode('notepad');
      setActivePane('left');
    } else {
      setRightNotepadFile(filePath);
      setRightViewMode('notepad');
      setActivePane('right');
    }
    const name = filePath.split('\\').pop() || filePath;
    onNotify?.('Zápisník', `Otevřen soubor: ${name}`, 'info');
  }, [activePane, onNotify]);

  // Drag-and-drop hover state
  const [dragTargetFolder, setDragTargetFolder] = useState<{ pane: 'left' | 'right'; path: string } | null>(null);
  const [dragTargetPane, setDragTargetPane] = useState<'left' | 'right' | null>(null);

  // Clipboard state for Explorer Cut/Copy/Paste operations
  const [clipboard, setClipboard] = useState<{ paths: string[]; op: 'copy' | 'cut' } | null>(null);

  // Context Menu State
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTarget | null>(null);

  // Modal Operation State (for F5 Copy, F6 Move, F7 New Folder, F8 Delete, F2 Rename)
  const [operationModal, setOperationModal] = useState<{
    type: 'copy' | 'move' | 'new-folder' | 'delete' | 'rename' | null;
    sourcePaths: string[];
    sourceNames: string[];
    targetDir: string;
    inputValue: string;
  }>({
    type: null,
    sourcePaths: [],
    sourceNames: [],
    targetDir: '',
    inputValue: '',
  });


  // Fetch directory listing for a pane
  const fetchDirectory = useCallback(async (targetPath: string, paneKey: 'left' | 'right') => {
    if (!targetPath) return;

    if (paneKey === 'left') {
      setLeft((prev) => ({ ...prev, loading: true, inputPath: targetPath }));
    } else {
      setRight((prev) => ({ ...prev, loading: true, inputPath: targetPath }));
    }

    try {
      const entries = await scanNativeFolder(targetPath);
      const hasParent = !!getParentDir(targetPath);
      const defaultFocus = entries.length > 0 && hasParent ? 1 : 0;
      const defaultSel = entries.length > 0 ? new Set([entries[0].path]) : new Set<string>();

      if (paneKey === 'left') {
        setLeft((prev) => ({
          ...prev,
          items: entries,
          loading: false,
          currentPath: targetPath,
          inputPath: targetPath,
          selectedPaths: defaultSel,
          focusedIndex: defaultFocus,
        }));
        try {
          localStorage.setItem('aerobridge_commander_left_path', targetPath);
        } catch {}
      } else {
        setRight((prev) => ({
          ...prev,
          items: entries,
          loading: false,
          currentPath: targetPath,
          inputPath: targetPath,
          selectedPaths: defaultSel,
          focusedIndex: defaultFocus,
        }));
        try {
          localStorage.setItem('aerobridge_commander_right_path', targetPath);
        } catch {}
      }
    } catch (err) {
      console.warn(`[CommanderView] Error loading directory for ${paneKey}:`, err);
      onNotify?.('Chyba při čtení složky', String(err), 'error');
      if (paneKey === 'left') setLeft((prev) => ({ ...prev, loading: false }));
      else setRight((prev) => ({ ...prev, loading: false }));
    }
  }, [onNotify]);

  // Initial load and drive resolution (F:\ Working drive preference)
  useEffect(() => {
    listNativePlaces().then(setPlaces);
    listNativeDrives().then((drv) => {
      setDrives(drv);
      const fDrive = drv.find((d) => d.path.toUpperCase().startsWith('F:') || d.name.toLowerCase().includes('working'));
      const fallback = fDrive?.path || drv.find((d) => !d.path.toUpperCase().startsWith('C:'))?.path || 'F:\\';

      setLeft((prev) => {
        const target = prev.currentPath.toUpperCase().startsWith('C:') ? fallback : prev.currentPath;
        void fetchDirectory(target, 'left');
        return target !== prev.currentPath
          ? { ...prev, currentPath: target, inputPath: target, history: [target] }
          : prev;
      });

      setRight((prev) => {
        const target = prev.currentPath.toUpperCase().startsWith('C:') ? fallback : prev.currentPath;
        void fetchDirectory(target, 'right');
        return target !== prev.currentPath
          ? { ...prev, currentPath: target, inputPath: target, history: [target] }
          : prev;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate helper with history stack
  const navigatePane = useCallback(
    (newPath: string, paneKey: 'left' | 'right') => {
      const setter = paneKey === 'left' ? setLeft : setRight;
      setter((prev) => {
        const nextHist = prev.history.slice(0, prev.historyIndex + 1);
        nextHist.push(newPath);
        return {
          ...prev,
          history: nextHist,
          historyIndex: nextHist.length - 1,
        };
      });
      void fetchDirectory(newPath, paneKey);
    },
    [fetchDirectory]
  );

  // History back
  const handleHistoryBack = useCallback(
    (paneKey: 'left' | 'right') => {
      const p = paneKey === 'left' ? left : right;
      if (p.historyIndex > 0) {
        const targetPath = p.history[p.historyIndex - 1];
        const setter = paneKey === 'left' ? setLeft : setRight;
        setter((prev) => ({ ...prev, historyIndex: prev.historyIndex - 1 }));
        void fetchDirectory(targetPath, paneKey);
      }
    },
    [left, right, fetchDirectory]
  );

  // History forward
  const handleHistoryForward = useCallback(
    (paneKey: 'left' | 'right') => {
      const p = paneKey === 'left' ? left : right;
      if (p.historyIndex < p.history.length - 1) {
        const targetPath = p.history[p.historyIndex + 1];
        const setter = paneKey === 'left' ? setLeft : setRight;
        setter((prev) => ({ ...prev, historyIndex: prev.historyIndex + 1 }));
        void fetchDirectory(targetPath, paneKey);
      }
    },
    [left, right, fetchDirectory]
  );

  // Navigate Up (..)
  const handleNavigateUp = useCallback(
    (paneKey: 'left' | 'right') => {
      const p = paneKey === 'left' ? left : right;
      const parent = getParentDir(p.currentPath);
      if (parent) {
        navigatePane(parent, paneKey);
      }
    },
    [left, right, navigatePane]
  );

  // Synchronize paths (=): set inactive pane to active pane's path
  const handleSyncPaths = useCallback(() => {
    const active = activePane === 'left' ? left : right;
    const targetKey = activePane === 'left' ? 'right' : 'left';
    navigatePane(active.currentPath, targetKey);
    onNotify?.('Cesty sjednoceny', `Cílový panel nastaven na ${active.currentPath}`, 'info');
  }, [activePane, left, right, navigatePane, onNotify]);

  // Swap paths (⇆): exchange left and right paths
  const handleSwapPanes = useCallback(() => {
    const leftPath = left.currentPath;
    const rightPath = right.currentPath;
    navigatePane(rightPath, 'left');
    navigatePane(leftPath, 'right');
    onNotify?.('Panely prohozeny', undefined, 'info');
  }, [left.currentPath, right.currentPath, navigatePane, onNotify]);

  // Refresh both panes
  const handleRefreshBoth = useCallback(() => {
    void fetchDirectory(left.currentPath, 'left');
    void fetchDirectory(right.currentPath, 'right');
    onNotify?.('Oba panely aktualizovány', undefined, 'info');
  }, [fetchDirectory, left.currentPath, right.currentPath, onNotify]);

  // Splitter mouse drag
  const handleSplitterMouseDown = useCallback(() => {
    setIsDraggingSplitter(true);
  }, []);

  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const ratio = Math.max(20, Math.min(80, (relativeX / rect.width) * 100));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // Mouse side buttons navigation (button 3 = Back, button 4 = Forward)
  useEffect(() => {
    const handleMouseNavBack = (e: Event) => {
      const custom = e as CustomEvent<{ clientX?: number; clientY?: number }>;
      let targetPane = activePane;
      if (typeof custom.detail?.clientX === 'number' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const midX = rect.left + (rect.width * splitRatio) / 100;
        targetPane = custom.detail.clientX < midX ? 'left' : 'right';
        setActivePane(targetPane);
      }
      handleHistoryBack(targetPane);
    };

    const handleMouseNavForward = (e: Event) => {
      const custom = e as CustomEvent<{ clientX?: number; clientY?: number }>;
      let targetPane = activePane;
      if (typeof custom.detail?.clientX === 'number' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const midX = rect.left + (rect.width * splitRatio) / 100;
        targetPane = custom.detail.clientX < midX ? 'left' : 'right';
        setActivePane(targetPane);
      }
      handleHistoryForward(targetPane);
    };

    window.addEventListener('aerobridge:commander-back', handleMouseNavBack);
    window.addEventListener('aerobridge:commander-forward', handleMouseNavForward);
    return () => {
      window.removeEventListener('aerobridge:commander-back', handleMouseNavBack);
      window.removeEventListener('aerobridge:commander-forward', handleMouseNavForward);
    };
  }, [activePane, splitRatio, handleHistoryBack, handleHistoryForward]);

  // Helper to filter and sort items for each pane
  const processItems = (pane: PaneState) => {
    let result = [...pane.items];

    // Filter
    if (pane.filterQuery.trim()) {
      const q = pane.filterQuery.toLowerCase();
      result = result.filter(
        (it) => it.name.toLowerCase().includes(q) || it.extension.toLowerCase().includes(q)
      );
    }

    // Sort: directories always first!
    result.sort((a, b) => {
      if (a.is_dir && !b.is_dir) return -1;
      if (!a.is_dir && b.is_dir) return 1;

      let cmp = 0;
      if (pane.sortField === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
      } else if (pane.sortField === 'ext') {
        cmp = a.extension.localeCompare(b.extension, undefined, { sensitivity: 'base' });
      } else if (pane.sortField === 'size') {
        cmp = a.size - b.size;
      } else if (pane.sortField === 'modified') {
        cmp = a.modified_ms - b.modified_ms;
      }
      return pane.sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  };

  const leftDisplayItems = useMemo(() => processItems(left), [left]);
  const rightDisplayItems = useMemo(() => processItems(right), [right]);

  // Stable ref holding latest mutable state for keydown and clipboard listeners
  const stateRef = useRef({
    activePane,
    left,
    right,
    leftDisplayItems,
    rightDisplayItems,
    leftViewMode,
    rightViewMode,
    leftNotepadFile,
    rightNotepadFile,
    clipboard,
    operationModal,
    contextMenuPos,
  });
  stateRef.current = {
    activePane,
    left,
    right,
    leftDisplayItems,
    rightDisplayItems,
    leftViewMode,
    rightViewMode,
    leftNotepadFile,
    rightNotepadFile,
    clipboard,
    operationModal,
    contextMenuPos,
  };
  const clipboardRef = useRef<{ paths: string[]; op: 'copy' | 'cut' } | null>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // Selected items extraction for Active Pane
  const getActiveSelectedItems = useCallback(() => {
    const s = stateRef.current;
    const isLeft = s.activePane === 'left';
    const pane = isLeft ? s.left : s.right;
    const displayList = isLeft ? s.leftDisplayItems : s.rightDisplayItems;
    const hasParent = !!getParentDir(pane.currentPath);

    let paths = Array.from(pane.selectedPaths);
    let names: string[] = [];

    // If nothing multi-selected, use currently focused item, or fall back to first item
    if (paths.length === 0 && displayList.length > 0) {
      const itemIdx = hasParent ? pane.focusedIndex - 1 : pane.focusedIndex;
      if (itemIdx >= 0 && itemIdx < displayList.length) {
        const focusedItem = displayList[itemIdx];
        if (focusedItem) {
          paths = [focusedItem.path];
          names = [focusedItem.name];
        }
      } else if (displayList[0]) {
        paths = [displayList[0].path];
        names = [displayList[0].name];
      }
    } else {
      names = paths.map((p) => {
        const found = pane.items.find((it) => it.path === p);
        return found ? found.name : p.split('\\').pop() || p;
      });
    }

    return { paths, names };
  }, []);

  // --- ACTIONS ---

  // F5: Copy
  const triggerCopy = useCallback(() => {
    const { paths, names } = getActiveSelectedItems();
    if (paths.length === 0) {
      onNotify?.('Vyberte soubory', 'Není vybrán žádný soubor ke kopírování', 'warning');
      return;
    }
    const targetDir = activePane === 'left' ? right.currentPath : left.currentPath;
    setOperationModal({
      type: 'copy',
      sourcePaths: paths,
      sourceNames: names,
      targetDir,
      inputValue: targetDir,
    });
  }, [getActiveSelectedItems, activePane, right.currentPath, left.currentPath, onNotify]);

  // F6: Move
  const triggerMove = useCallback(() => {
    const { paths, names } = getActiveSelectedItems();
    if (paths.length === 0) {
      onNotify?.('Vyberte soubory', 'Není vybrán žádný soubor k přesunu', 'warning');
      return;
    }
    const targetDir = activePane === 'left' ? right.currentPath : left.currentPath;
    setOperationModal({
      type: 'move',
      sourcePaths: paths,
      sourceNames: names,
      targetDir,
      inputValue: targetDir,
    });
  }, [getActiveSelectedItems, activePane, right.currentPath, left.currentPath, onNotify]);

  // F7: New Folder
  const triggerNewFolder = useCallback(() => {
    const currentDir = activePane === 'left' ? left.currentPath : right.currentPath;
    setOperationModal({
      type: 'new-folder',
      sourcePaths: [],
      sourceNames: [],
      targetDir: currentDir,
      inputValue: 'Nová složka',
    });
  }, [activePane, left.currentPath, right.currentPath]);

  // F8: Delete
  const triggerDelete = useCallback(() => {
    const { paths, names } = getActiveSelectedItems();
    if (paths.length === 0) {
      onNotify?.('Vyberte soubory', 'Není vybrán žádný soubor ke smazání', 'warning');
      return;
    }
    setOperationModal({
      type: 'delete',
      sourcePaths: paths,
      sourceNames: names,
      targetDir: '',
      inputValue: '',
    });
  }, [getActiveSelectedItems, onNotify]);

  // F2: Rename
  const triggerRename = useCallback((customTarget?: { path: string; name: string }) => {
    if (customTarget) {
      setOperationModal({
        type: 'rename',
        sourcePaths: [customTarget.path],
        sourceNames: [customTarget.name],
        targetDir: getParentDir(customTarget.path) || '',
        inputValue: customTarget.name,
      });
      return;
    }
    const isLeft = activePane === 'left';
    const pane = isLeft ? left : right;
    const displayList = isLeft ? leftDisplayItems : rightDisplayItems;
    const hasParent = !!getParentDir(pane.currentPath);
    const itemIdx = hasParent ? pane.focusedIndex - 1 : pane.focusedIndex;
    if (itemIdx < 0 || itemIdx >= displayList.length) return;
    const item = displayList[itemIdx];
    if (!item) return;

    setOperationModal({
      type: 'rename',
      sourcePaths: [item.path],
      sourceNames: [item.name],
      targetDir: pane.currentPath,
      inputValue: item.name,
    });
  }, [activePane, left, right, leftDisplayItems, rightDisplayItems]);

  // F3: QuickLook
  const triggerQuickLook = useCallback(() => {
    const isLeft = activePane === 'left';
    const pane = isLeft ? left : right;
    const displayList = isLeft ? leftDisplayItems : rightDisplayItems;
    const hasParent = !!getParentDir(pane.currentPath);
    const itemIdx = hasParent ? pane.focusedIndex - 1 : pane.focusedIndex;
    if (itemIdx < 0 || itemIdx >= displayList.length) return;
    const item = displayList[itemIdx];
    if (!item || item.is_dir) return;

    if (onOpenQuickLook) {
      const mockAsset: AssetItem = {
        id: item.path,
        name: item.name,
        folder: pane.currentPath,
        fullPath: item.path,
        url: '',
        type: 'image',
        category: 'image',
        format: item.extension.toUpperCase(),
        extension: item.extension,
        colorBadge: '#84cc16',
        size: item.size,
        dimensions: { width: 0, height: 0 },
        dateModified: new Date(item.modified_ms).toISOString(),
        dateCreated: new Date(item.modified_ms).toISOString(),
        exif: {},
        iptc: { keywords: [] },
      };
      onOpenQuickLook(mockAsset);
    }
  }, [activePane, left, right, leftDisplayItems, rightDisplayItems, onOpenQuickLook]);

  // F4 / Enter / Double Click: Open file or enter folder
  const handleOpenItem = useCallback(
    async (item: NativeFileEntry, paneKey: 'left' | 'right') => {
      if (item.is_dir) {
        navigatePane(item.path, paneKey);
      } else {
        try {
          await openFileNative(item.path);
          onNotify?.('Otevřeno ve výchozí aplikaci', item.name, 'info');
        } catch (err) {
          onNotify?.('Nelze otevřít soubor', String(err), 'error');
        }
      }
    },
    [navigatePane, onNotify]
  );

  // Execute operation modal submit
  const handleExecuteOperation = async () => {
    const { type, sourcePaths, targetDir, inputValue } = operationModal;
    if (!type) return;

    try {
      if (type === 'copy') {
        const dest = inputValue.trim() || targetDir;
        await copyFilesNative(sourcePaths, dest);
        onNotify?.(
          'Zkopírováno',
          `${sourcePaths.length} položek do ${dest.split('\\').pop() || dest}`,
          'success'
        );
        void fetchDirectory(left.currentPath, 'left');
        void fetchDirectory(right.currentPath, 'right');
      } else if (type === 'move') {
        const dest = inputValue.trim() || targetDir;
        await moveFilesNative(sourcePaths, dest);
        onNotify?.(
          'Přesunuto',
          `${sourcePaths.length} položek do ${dest.split('\\').pop() || dest}`,
          'success'
        );
        void fetchDirectory(left.currentPath, 'left');
        void fetchDirectory(right.currentPath, 'right');
      } else if (type === 'new-folder') {
        const folderName = inputValue.trim() || 'Nová složka';
        await createFolderNative(targetDir, folderName);
        onNotify?.('Vytvořena složka', folderName, 'success');
        void fetchDirectory(activePane === 'left' ? left.currentPath : right.currentPath, activePane);
      } else if (type === 'delete') {
        await deleteFilesNative(sourcePaths);
        onNotify?.('Přesunuto do Koše', `${sourcePaths.length} položek`, 'info');
        void fetchDirectory(activePane === 'left' ? left.currentPath : right.currentPath, activePane);
      } else if (type === 'rename') {
        const newName = inputValue.trim();
        if (newName && sourcePaths[0]) {
          await renameFileNative(sourcePaths[0], newName);
          onNotify?.('Přejmenováno', newName, 'success');
          void fetchDirectory(activePane === 'left' ? left.currentPath : right.currentPath, activePane);
        }
      }
    } catch (err) {
      console.error('[CommanderView] Operation failed:', err);
      onNotify?.('Operace selhala', String(err), 'error');
    } finally {
      setOperationModal({
        type: null,
        sourcePaths: [],
        sourceNames: [],
        targetDir: '',
        inputValue: '',
      });
    }
  };

  // Windows Explorer: Copy (Ctrl+C)
  const handleCopyClipboard = useCallback(
    (customPaths?: string[]) => {
      const paths = customPaths && customPaths.length > 0 ? customPaths : getActiveSelectedItems().paths;
      if (paths.length === 0) {
        onNotify?.('Vyberte soubory', 'Není vybrán žádný soubor ke kopírování', 'warning');
        return;
      }
      clipboardRef.current = { paths, op: 'copy' };
      setClipboard({ paths, op: 'copy' });
      void copyTextToClipboard(paths.join('\r\n'));
      onNotify?.(
        'Zkopírováno do schránky (Ctrl+C)',
        `${paths.length} ${paths.length === 1 ? 'položka zkopírována' : 'položek zkopírováno'} (vložte pomocí Ctrl+V)`,
        'info'
      );
    },
    [getActiveSelectedItems, onNotify]
  );

  // Windows Explorer: Cut (Ctrl+X)
  const handleCut = useCallback(
    (customPaths?: string[]) => {
      const paths = customPaths && customPaths.length > 0 ? customPaths : getActiveSelectedItems().paths;
      if (paths.length === 0) {
        onNotify?.('Vyberte soubory', 'Není vybrán žádný soubor k vyjmutí', 'warning');
        return;
      }
      clipboardRef.current = { paths, op: 'cut' };
      setClipboard({ paths, op: 'cut' });
      void copyTextToClipboard(paths.join('\r\n'));
      onNotify?.(
        'Vyjmuté položky (Ctrl+X)',
        `${paths.length} ${paths.length === 1 ? 'položka připravena k přesunu' : 'položek připraveno k přesunu'} (vložte pomocí Ctrl+V)`,
        'info'
      );
    },
    [getActiveSelectedItems, onNotify]
  );

  // Windows Explorer: Paste (Ctrl+V)
  const handlePasteClipboard = useCallback(
    async (destFolderParam?: string) => {
      const s = stateRef.current;
      const activeCurrentPath = s.activePane === 'left' ? s.left.currentPath : s.right.currentPath;
      const destFolder = destFolderParam || activeCurrentPath;

      const clip = clipboardRef.current || s.clipboard;
      let pathsToPaste = clip ? [...clip.paths] : [];
      let opToUse = clip ? clip.op : 'copy';

      // Fallback: check system clipboard text if in-memory clipboard is empty
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
        onNotify?.('Schránka je prázdná', 'Nejprve zkopírujte (Ctrl+C) nebo vyjměte (Ctrl+X) soubory', 'warning');
        return;
      }

      // Safety check: Don't paste folder into itself or its child
      const normDest = norm(destFolder);
      const isSelfOrSub = pathsToPaste.some((p) => {
        const normP = norm(p);
        return normDest === normP || normDest.startsWith(normP + '\\');
      });
      if (isSelfOrSub) {
        onNotify?.('Neplatný cíl', 'Nelze vložit složku do sebe samé nebo její podsložky', 'warning');
        return;
      }

      try {
        if (opToUse === 'copy') {
          const copied = await copyFilesNative(pathsToPaste, destFolder);
          const count = copied && copied.length > 0 ? copied.length : pathsToPaste.length;
          onNotify?.(
            'Vloženo (Kopírování)',
            `${count} ${count === 1 ? 'položka vložena' : 'položek vloženo'} do ${destFolder.split('\\').pop() || destFolder}`,
            'success'
          );
        } else {
          const moved = await moveFilesNative(pathsToPaste, destFolder);
          const count = moved && moved.length > 0 ? moved.length : pathsToPaste.length;
          clipboardRef.current = null;
          setClipboard(null);
          onNotify?.(
            'Vloženo (Přesun)',
            `${count} ${count === 1 ? 'položka přesunuta' : 'položek přesunuto'} do ${destFolder.split('\\').pop() || destFolder}`,
            'success'
          );
        }
        await fetchDirectory(s.left.currentPath, 'left');
        await fetchDirectory(s.right.currentPath, 'right');
      } catch (err) {
        console.error('[CommanderView] Paste failed:', err);
        onNotify?.('Chyba při vkládání', String(err), 'error');
      }
    },
    [fetchDirectory, onNotify]
  );

  // Drag and Drop execution (between panes or into subfolders)
  const handleDropOnPane = useCallback(
    async (e: React.DragEvent, destFolder: string, _targetPaneKey: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      setDragTargetFolder(null);
      setDragTargetPane(null);

      let sourcePaths: string[] = [];
      if (activeDragPayload && activeDragPayload.paths.length > 0) {
        sourcePaths = [...activeDragPayload.paths];
      }
      activeDragPayload = null;

      if (sourcePaths.length === 0) {
        try {
          const raw = e.dataTransfer.getData('application/json');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.paths)) sourcePaths = parsed.paths;
          }
        } catch {}
      }

      if (sourcePaths.length === 0) {
        const plain = e.dataTransfer.getData('text/plain');
        if (plain) {
          sourcePaths = plain.split('\n').map((s) => s.trim()).filter(Boolean);
        }
      }

      if (sourcePaths.length === 0 && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const p = (file as unknown as { path?: string }).path;
          if (p && typeof p === 'string') {
            sourcePaths.push(p);
          }
        }
      }

      if (sourcePaths.length === 0) {
        onNotify?.('Přetažení', 'Nepodařilo se zjistit zdrojové soubory', 'warning');
        return;
      }

      const normDest = norm(destFolder);

      // If source and destination are the exact same folder, duplicate (copy with auto collision suffix) instead of failing
      const isCopy = e.ctrlKey;
      const firstParent = getParentDir(sourcePaths[0]);
      const isSameFolder = !!(firstParent && norm(firstParent) === normDest);
      const effectiveCopy = isCopy || isSameFolder;

      // Safety check: Prevent dropping folder into itself or its child
      const isDroppingIntoSelf = sourcePaths.some((p) => {
        const normP = norm(p);
        return normDest === normP || normDest.startsWith(normP + '\\');
      });
      if (isDroppingIntoSelf) {
        onNotify?.('Neplatná operace', 'Nelze přesunout nebo kopírovat složku do sebe samé nebo její podsložky', 'warning');
        return;
      }

      try {
        if (effectiveCopy) {
          await copyFilesNative(sourcePaths, destFolder);
          onNotify?.(
            isSameFolder ? 'Duplikováno v kořeni' : 'Zkopírováno',
            `${sourcePaths.length} ${sourcePaths.length === 1 ? 'položka' : 'položek'} ${isSameFolder ? 'zkopírována (vytvořena kopie)' : `zkopírováno do ${destFolder.split('\\').pop() || destFolder}`}`,
            'success'
          );
        } else {
          await moveFilesNative(sourcePaths, destFolder);
          onNotify?.(
            'Přesunuto',
            `${sourcePaths.length} ${sourcePaths.length === 1 ? 'položka přesunuta' : 'položek přesunuto'} do ${destFolder.split('\\').pop() || destFolder}`,
            'success'
          );
        }
        // If moved items were in cut state in clipboard, clear cut
        if (clipboard?.op === 'cut' && sourcePaths.some((p) => clipboard.paths.includes(p))) {
          setClipboard(null);
        }
        void fetchDirectory(left.currentPath, 'left');
        void fetchDirectory(right.currentPath, 'right');
      } catch (err) {
        console.error('[CommanderView] Drag drop failed:', err);
        onNotify?.('Chyba při přenosu', String(err), 'error');
      }
    },
    [clipboard, fetchDirectory, left.currentPath, right.currentPath, onNotify]
  );

  // Keyboard navigation & Total Commander function shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input/textarea (blur if Escape)
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl?.tagName === 'INPUT' ||
        targetEl?.tagName === 'TEXTAREA' ||
        targetEl?.isContentEditable
      ) {
        const s = stateRef.current;
        if (e.key === 'Escape') {
          if (s.operationModal.type) {
            setOperationModal({ type: null, sourcePaths: [], sourceNames: [], targetDir: '', inputValue: '' });
          }
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      const s = stateRef.current;

      // Close modal on Escape
      if (s.operationModal.type) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOperationModal({ type: null, sourcePaths: [], sourceNames: [], targetDir: '', inputValue: '' });
        }
        return;
      }

      // Close context menu on Escape
      if (s.contextMenuPos) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setContextMenuPos(null);
          setContextMenuTarget(null);
          return;
        }
      }

      // Cancel cut state on Escape
      const clip = clipboardRef.current || s.clipboard;
      if (e.key === 'Escape' && clip?.op === 'cut') {
        e.preventDefault();
        clipboardRef.current = null;
        setClipboard(null);
        onNotify?.('Zrušeno', 'Vyjmutí souborů bylo zrušeno', 'info');
        return;
      }

      // Ctrl + C: Copy to clipboard
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        e.preventDefault();
        e.stopPropagation();
        handleCopyClipboard();
        return;
      }

      // Ctrl + X: Cut to clipboard
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) {
        e.preventDefault();
        e.stopPropagation();
        handleCut();
        return;
      }

      // Ctrl + V: Paste from clipboard
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'v' || e.code === 'KeyV')) {
        e.preventDefault();
        e.stopPropagation();
        void handlePasteClipboard();
        return;
      }

      // Ctrl + Shift + C: Copy full file path(s) to OS clipboard
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        e.preventDefault();
        e.stopPropagation();
        const { paths } = getActiveSelectedItems();
        if (paths.length > 0) {
          void copyTextToClipboard(paths.join('\r\n'));
          onNotify?.('Cesta zkopírována', paths.length === 1 ? paths[0] : `${paths.length} cest zkopírováno`, 'info');
        }
        return;
      }

      // Tab: Switch active pane
      if (e.key === 'Tab') {
        e.preventDefault();
        const nextPane = s.activePane === 'left' ? 'right' : 'left';
        setActivePane(nextPane);
        if (nextPane === 'left') {
          leftPaneRef.current?.focus();
        } else {
          rightPaneRef.current?.focus();
        }
        return;
      }

      // F3: QuickLook
      if (e.key === 'F3') {
        e.preventDefault();
        triggerQuickLook();
        return;
      }

      // F4: Toggle / Open in Notepad (Zápisník)
      if (e.key === 'F4') {
        e.preventDefault();
        const isLeft = s.activePane === 'left';
        const currentMode = isLeft ? s.leftViewMode : s.rightViewMode;
        if (currentMode === 'notepad') {
          if (isLeft) setLeftViewMode('files');
          else setRightViewMode('files');
        } else {
          const pane = isLeft ? s.left : s.right;
          const list = isLeft ? s.leftDisplayItems : s.rightDisplayItems;
          const hasParent = !!getParentDir(pane.currentPath);
          const itemIdx = hasParent ? pane.focusedIndex - 1 : pane.focusedIndex;
          const it = itemIdx >= 0 && itemIdx < list.length ? list[itemIdx] : null;

          if (it && !it.is_dir && isTextLikeFile(it.extension)) {
            handleOpenInNotepad(it.path, s.activePane);
          } else {
            if (isLeft) setLeftViewMode('notepad');
            else setRightViewMode('notepad');
          }
        }
        return;
      }

      // F5: Copy to opposite pane
      if (e.key === 'F5' && !e.ctrlKey) {
        e.preventDefault();
        triggerCopy();
        return;
      }

      // F6: Move to opposite pane
      if (e.key === 'F6' && !e.shiftKey) {
        e.preventDefault();
        triggerMove();
        return;
      }

      // F7: New Folder
      if (e.key === 'F7') {
        e.preventDefault();
        triggerNewFolder();
        return;
      }

      // F8 or Delete: Delete
      if (e.key === 'F8' || e.key === 'Delete') {
        e.preventDefault();
        triggerDelete();
        return;
      }

      // F2 or Shift+F6: Rename
      if (e.key === 'F2' || (e.key === 'F6' && e.shiftKey)) {
        e.preventDefault();
        triggerRename();
        return;
      }

      // Ctrl+U: Swap panes
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'u' || e.code === 'KeyU')) {
        e.preventDefault();
        handleSwapPanes();
        return;
      }

      // Ctrl+R or F5 (with Ctrl): Refresh active pane
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) {
        e.preventDefault();
        void fetchDirectory(s.activePane === 'left' ? s.left.currentPath : s.right.currentPath, s.activePane);
        return;
      }

      // Alt + ArrowLeft: Navigate Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleHistoryBack(s.activePane);
        return;
      }

      // Alt + ArrowRight: Navigate Forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleHistoryForward(s.activePane);
        return;
      }

      // Alt + ArrowUp: Navigate Up to Parent Directory
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigateUp(s.activePane);
        return;
      }

      // Backspace: Parent directory (..)
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleNavigateUp(s.activePane);
        return;
      }

      // Enter: Open focused folder or file
      if (e.key === 'Enter') {
        e.preventDefault();
        const isLeft = s.activePane === 'left';
        const pane = isLeft ? s.left : s.right;
        const list = isLeft ? s.leftDisplayItems : s.rightDisplayItems;
        const parent = getParentDir(pane.currentPath);

        // If at index 0 and parent exists -> navigate up
        if (parent && pane.focusedIndex === 0) {
          handleNavigateUp(s.activePane);
          return;
        }

        const adjustedIdx = parent ? pane.focusedIndex - 1 : pane.focusedIndex;
        const it = list[adjustedIdx];
        if (it) void handleOpenItem(it, s.activePane);
        return;
      }

      // Arrow Up / Down navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const isLeft = s.activePane === 'left';
        const pane = isLeft ? s.left : s.right;
        const list = isLeft ? s.leftDisplayItems : s.rightDisplayItems;
        const hasParent = !!getParentDir(pane.currentPath);
        const totalRows = list.length + (hasParent ? 1 : 0);
        if (totalRows === 0) return;

        let nextIdx = pane.focusedIndex;
        if (e.key === 'ArrowDown') {
          nextIdx = Math.min(totalRows - 1, pane.focusedIndex + 1);
        } else {
          nextIdx = Math.max(0, pane.focusedIndex - 1);
        }

        const setter = isLeft ? setLeft : setRight;
        const itemIdx = hasParent ? nextIdx - 1 : nextIdx;
        const targetItem = itemIdx >= 0 && itemIdx < list.length ? list[itemIdx] : null;

        setter((prev) => ({
          ...prev,
          focusedIndex: nextIdx,
          selectedPaths: targetItem ? new Set([targetItem.path]) : prev.selectedPaths,
        }));
        return;
      }

      // Space or Insert: Toggle selection of focused item and move down (Total Commander style!)
      if (e.key === ' ' || e.key === 'Insert') {
        e.preventDefault();
        const isLeft = s.activePane === 'left';
        const pane = isLeft ? s.left : s.right;
        const list = isLeft ? s.leftDisplayItems : s.rightDisplayItems;
        const hasParent = !!getParentDir(pane.currentPath);
        const itemIdx = hasParent ? pane.focusedIndex - 1 : pane.focusedIndex;

        if (itemIdx >= 0 && itemIdx < list.length) {
          const item = list[itemIdx];
          const setter = isLeft ? setLeft : setRight;
          setter((prev) => {
            const nextSel = new Set(prev.selectedPaths);
            if (nextSel.has(item.path)) nextSel.delete(item.path);
            else nextSel.add(item.path);

            const nextFocus = Math.min(list.length + (hasParent ? 1 : 0) - 1, prev.focusedIndex + 1);
            return { ...prev, selectedPaths: nextSel, focusedIndex: nextFocus };
          });
        }
        return;
      }

      // Ctrl + A: Select all items in active pane
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
        e.preventDefault();
        e.stopPropagation();
        const isLeft = s.activePane === 'left';
        const list = isLeft ? s.leftDisplayItems : s.rightDisplayItems;
        const setter = isLeft ? setLeft : setRight;
        setter((prev) => ({
          ...prev,
          selectedPaths: new Set(list.map((it) => it.path)),
        }));
        return;
      }

      // Ctrl + D: Clear selection
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.code === 'KeyD')) {
        e.preventDefault();
        e.stopPropagation();
        const setter = s.activePane === 'left' ? setLeft : setRight;
        setter((prev) => ({ ...prev, selectedPaths: new Set() }));
        return;
      }
    };

    // Capture phase so no child/global handler can swallow Ctrl+C/X/V before us
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    handleCopyClipboard,
    handleCut,
    handlePasteClipboard,
    triggerCopy,
    triggerMove,
    triggerNewFolder,
    triggerDelete,
    triggerRename,
    triggerQuickLook,
    handleOpenItem,
    handleSwapPanes,
    handleNavigateUp,
    fetchDirectory,
    getActiveSelectedItems,
    onNotify,
  ]);

  // Render a Single Commander Pane
  const renderPane = (paneKey: 'left' | 'right') => {
    const isLeft = paneKey === 'left';
    const pane = isLeft ? left : right;
    const oppositePane = isLeft ? right : left;
    const viewMode = isLeft ? leftViewMode : rightViewMode;
    const items = isLeft ? leftDisplayItems : rightDisplayItems;
    const isActive = activePane === paneKey;
    const parentDir = getParentDir(pane.currentPath);

    const isPaneDropTarget = dragTargetPane === paneKey && !dragTargetFolder;

    const totalBytes = items.reduce((acc, it) => acc + (it.is_dir ? 0 : it.size), 0);
    const selectedList = items.filter((it) => pane.selectedPaths.has(it.path));
    const selectedBytes = selectedList.reduce((acc, it) => acc + (it.is_dir ? 0 : it.size), 0);

    return (
      <div
        ref={isLeft ? leftPaneRef : rightPaneRef}
        tabIndex={0}
        onFocus={() => setActivePane(paneKey)}
        onClick={(e) => {
          setActivePane(paneKey);
          if (
            document.activeElement instanceof HTMLElement &&
            document.activeElement !== e.target &&
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
          ) {
            document.activeElement.blur();
          }
        }}
        onMouseUp={(e) => {
          if (e.button === 3) {
            e.preventDefault();
            e.stopPropagation();
            setActivePane(paneKey);
            handleHistoryBack(paneKey);
          } else if (e.button === 4) {
            e.preventDefault();
            e.stopPropagation();
            setActivePane(paneKey);
            handleHistoryForward(paneKey);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
          if (dragTargetPane !== paneKey && !dragTargetFolder) {
            setDragTargetPane(paneKey);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          void handleDropOnPane(e, pane.currentPath, paneKey);
        }}
        className={`flex-1 flex flex-col min-w-0 h-full border focus:outline-hidden ${
          isPaneDropTarget
            ? 'border-[#60cdff] ring-2 ring-[#60cdff]/60 bg-[#16202c] shadow-[0_0_25px_rgba(96,205,255,0.25)]'
            : isActive
            ? 'border-[#60cdff]/50 bg-[#14161c] shadow-[0_0_15px_rgba(96,205,255,0.08)]'
            : 'border-white/[0.06] bg-[#111215]'
        } transition-all duration-150 overflow-hidden relative`}
      >
        {/* Floating root drop indicator when dragging over pane (outside a subfolder) */}
        {isPaneDropTarget && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-2 px-3.5 py-1.5 bg-[#60cdff] text-[#111215] font-bold text-xs rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            <FolderPlus className="w-4 h-4 shrink-0" />
            <span>↳ Vložit do kořene složky: <span className="font-mono underline">{pane.currentPath.split('\\').pop() || pane.currentPath}</span></span>
          </div>
        )}

        {/* Top: Drive Buttons, Quick Places & Pane Mode Toggle */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
            if (!dragTargetFolder) setDragTargetPane(paneKey);
          }}
          onDrop={(e) => {
            e.preventDefault();
            void handleDropOnPane(e, pane.currentPath, paneKey);
          }}
          className="flex items-center justify-between px-2 py-1.5 bg-[#171920] border-b border-white/[0.06] text-xs shrink-0 select-none overflow-x-auto"
        >
          {/* Drive selector pills */}
          <div className="flex items-center gap-1">
            {drives.map((d) => {
              const isCurrentDrive = pane.currentPath.toLowerCase().startsWith(d.path.toLowerCase().replace(/\\$/, ''));
              return (
                <button
                  key={d.path}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigatePane(d.path, paneKey);
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                    isCurrentDrive
                      ? 'bg-[#60cdff] text-[#111215] font-bold shadow-xs'
                      : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1] hover:text-white border border-white/[0.06]'
                  }`}
                  title={`Disk ${d.name} (${d.path})`}
                >
                  <Win11Drive className="w-3.5 h-3.5" />
                  <span>{d.name.replace(/\\$/, '')}</span>
                </button>
              );
            })}
          </div>

          {/* Quick places shortcuts & Mode Switcher */}
          <div className="flex items-center gap-1 shrink-0">
            {places.map((p) => {
              const lower = p.name.toLowerCase();
              let icon = <Folder className="w-3.5 h-3.5" />;
              if (lower.includes('obrázky') || lower.includes('picture')) icon = <Win11Pictures className="w-3.5 h-3.5" />;
              else if (lower.includes('plocha') || lower.includes('desktop')) icon = <Win11Desktop className="w-3.5 h-3.5" />;
              else if (lower.includes('dokumenty') || lower.includes('documents')) icon = <Win11Documents className="w-3.5 h-3.5" />;
              else if (lower.includes('stažené') || lower.includes('download')) icon = <Win11Downloads className="w-3.5 h-3.5" />;

              return (
                <button
                  key={p.path}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigatePane(p.path, paneKey);
                  }}
                  className="p-1 rounded bg-white/[0.03] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title={p.name}
                >
                  {icon}
                </button>
              );
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isLeft) setLeftViewMode('terminal');
                else setRightViewMode('terminal');
              }}
              className="p-1 rounded bg-white/[0.03] hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
              title="Spustit integrovaný terminál v tomto okně"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            {/* Pane View Mode Toggle: Soubory / Zápisník / Terminál */}
            <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10 shrink-0 ml-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLeft) setLeftViewMode('files');
                  else setRightViewMode('files');
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'files'
                    ? 'bg-white/15 text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Zobrazit správce souborů"
              >
                <Folder className="w-3.5 h-3.5 text-[#60cdff]" />
                <span className="hidden sm:inline">Soubory</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLeft) setLeftViewMode('notepad');
                  else setRightViewMode('notepad');
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'notepad'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold shadow-xs ring-1 ring-amber-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Přepnout do zápisníku / poznámkového bloku (F4)"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Zápisník</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLeft) setLeftViewMode('terminal');
                  else setRightViewMode('terminal');
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'terminal'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold shadow-xs ring-1 ring-emerald-500/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Spustit integrovaný terminál v tomto okně"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Terminál</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'notepad' ? (
          <CommanderNotepad
            paneKey={paneKey}
            currentPath={pane.currentPath}
            oppositeSelectedPaths={Array.from(oppositePane.selectedPaths)}
            initialFilePath={isLeft ? leftNotepadFile : rightNotepadFile}
            onCloseNotepad={() => {
              if (isLeft) setLeftViewMode('files');
              else setRightViewMode('files');
            }}
            onNotify={onNotify}
            onFileSaved={() => {
              void fetchDirectory(pane.currentPath, paneKey);
            }}
          />
        ) : viewMode === 'terminal' ? (
          <CommanderTerminal
            paneKey={paneKey}
            currentPath={pane.currentPath}
            oppositeSelectedPaths={Array.from(oppositePane.selectedPaths)}
            onCloseTerminal={() => {
              if (isLeft) setLeftViewMode('files');
              else setRightViewMode('files');
            }}
            onNotify={onNotify}
          />
        ) : (
          <>
            {/* Path Bar & Quick Filter */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
                if (!dragTargetFolder) setDragTargetPane(paneKey);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDropOnPane(e, pane.currentPath, paneKey);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-[#1a1d24] border-b border-white/[0.06] text-xs shrink-0 select-none"
            >
          {/* Navigation Controls */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHistoryBack(paneKey);
            }}
            disabled={pane.historyIndex <= 0}
            className={`p-1 rounded transition-colors ${
              pane.historyIndex > 0 ? 'text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer' : 'text-zinc-600 opacity-40 cursor-default'
            }`}
            title="Zpět (Alt + Vlevo)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleHistoryForward(paneKey);
            }}
            disabled={pane.historyIndex >= pane.history.length - 1}
            className={`p-1 rounded transition-colors ${
              pane.historyIndex < pane.history.length - 1 ? 'text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer' : 'text-zinc-600 opacity-40 cursor-default'
            }`}
            title="Vpřed (Alt + Vpravo)"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNavigateUp(paneKey);
            }}
            disabled={!parentDir}
            className={`p-1 rounded transition-colors ${
              parentDir ? 'text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer' : 'text-zinc-600 opacity-40 cursor-default'
            }`}
            title="O úroveň výš (.. / Backspace)"
          >
            <CornerLeftUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void fetchDirectory(pane.currentPath, paneKey);
            }}
            className="p-1 rounded text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Aktualizovat (Ctrl+R / F5)"
          >
            <RotateCw className={`w-3.5 h-3.5 ${pane.loading ? 'animate-spin text-[#60cdff]' : ''}`} />
          </button>

          {/* Editable Path Input */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={pane.inputPath}
              onChange={(e) => {
                const val = e.target.value;
                const setter = isLeft ? setLeft : setRight;
                setter((prev) => ({ ...prev, inputPath: val }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                  navigatePane(pane.inputPath, paneKey);
                } else if (e.key === 'Escape') {
                  const setter = isLeft ? setLeft : setRight;
                  setter((prev) => ({ ...prev, inputPath: prev.currentPath }));
                  e.currentTarget.blur();
                }
              }}
              className="w-full bg-[#121316] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-200 font-mono placeholder-zinc-500 focus:outline-hidden focus:border-[#60cdff] focus:ring-1 focus:ring-[#60cdff]/30 transition-all truncate"
              title="Stiskněte Enter pro přechod na cestu"
            />
          </div>

          {/* Quick Filter */}
          <div className="relative w-36 shrink-0">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={pane.filterQuery}
              onChange={(e) => {
                const val = e.target.value;
                const setter = isLeft ? setLeft : setRight;
                setter((prev) => ({ ...prev, filterQuery: val }));
              }}
              placeholder="Filtrovat..."
              className="w-full bg-[#121316] border border-white/[0.08] rounded pl-6 pr-6 py-1 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[#60cdff] transition-all"
            />
            {pane.filterQuery && (
              <button
                type="button"
                onClick={() => {
                  const setter = isLeft ? setLeft : setRight;
                  setter((prev) => ({ ...prev, filterQuery: '' }));
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Table Column Headers */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
            if (!dragTargetFolder) setDragTargetPane(paneKey);
          }}
          onDrop={(e) => {
            e.preventDefault();
            void handleDropOnPane(e, pane.currentPath, paneKey);
          }}
          className="grid grid-cols-[1fr_80px_100px_130px] px-2 py-1 bg-[#15171d] border-b border-white/[0.08] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider select-none shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              const setter = isLeft ? setLeft : setRight;
              setter((prev) => ({
                ...prev,
                sortField: 'name',
                sortOrder: prev.sortField === 'name' && prev.sortOrder === 'asc' ? 'desc' : 'asc',
              }));
            }}
            className="flex items-center gap-1 text-left hover:text-white transition-colors cursor-pointer"
          >
            <span>Název</span>
            {pane.sortField === 'name' && (
              <span className="text-[#60cdff] text-[10px]">{pane.sortOrder === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const setter = isLeft ? setLeft : setRight;
              setter((prev) => ({
                ...prev,
                sortField: 'ext',
                sortOrder: prev.sortField === 'ext' && prev.sortOrder === 'asc' ? 'desc' : 'asc',
              }));
            }}
            className="flex items-center gap-1 text-left hover:text-white transition-colors cursor-pointer"
          >
            <span>Příp.</span>
            {pane.sortField === 'ext' && (
              <span className="text-[#60cdff] text-[10px]">{pane.sortOrder === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const setter = isLeft ? setLeft : setRight;
              setter((prev) => ({
                ...prev,
                sortField: 'size',
                sortOrder: prev.sortField === 'size' && prev.sortOrder === 'asc' ? 'desc' : 'asc',
              }));
            }}
            className="flex items-center gap-1 text-right justify-end hover:text-white transition-colors cursor-pointer"
          >
            <span>Velikost</span>
            {pane.sortField === 'size' && (
              <span className="text-[#60cdff] text-[10px]">{pane.sortOrder === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const setter = isLeft ? setLeft : setRight;
              setter((prev) => ({
                ...prev,
                sortField: 'modified',
                sortOrder: prev.sortField === 'modified' && prev.sortOrder === 'asc' ? 'desc' : 'asc',
              }));
            }}
            className="flex items-center gap-1 text-right justify-end hover:text-white transition-colors cursor-pointer pr-1"
          >
            <span>Změněno</span>
            {pane.sortField === 'modified' && (
              <span className="text-[#60cdff] text-[10px]">{pane.sortOrder === 'asc' ? '▲' : '▼'}</span>
            )}
          </button>
        </div>

        {/* Scrollable File List */}
        <div
          onClick={(e) => {
            setActivePane(paneKey);
            if (
              document.activeElement instanceof HTMLElement &&
              (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
            ) {
              document.activeElement.blur();
            }
            if ((e.target as HTMLElement).getAttribute('data-row') !== 'true' && !(e.target as HTMLElement).closest('[data-row="true"]')) {
              const setter = isLeft ? setLeft : setRight;
              setter((prev) => ({ ...prev, selectedPaths: new Set() }));
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
            if (!dragTargetFolder) {
              setDragTargetPane(paneKey);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragTargetPane(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            void handleDropOnPane(e, pane.currentPath, paneKey);
          }}
          onContextMenu={(e) => {
            if ((e.target as HTMLElement).closest('[data-row="true"]')) return;
            e.preventDefault();
            setActivePane(paneKey);
            setContextMenuTarget({
              type: 'background',
              folderPath: pane.currentPath,
              folderName: pane.currentPath.split('\\').pop() || pane.currentPath,
            });
            setContextMenuPos({ x: e.clientX, y: e.clientY });
          }}
          className="flex-1 overflow-y-auto divide-y divide-white/[0.02] font-mono text-xs select-none focus:outline-none relative"
        >

          {/* Row 0: Parent Directory [..] */}
          {parentDir && (
            <div
              data-row="true"
              onClick={() => {
                setActivePane(paneKey);
                if (
                  document.activeElement instanceof HTMLElement &&
                  (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
                ) {
                  document.activeElement.blur();
                }
                const setter = isLeft ? setLeft : setRight;
                setter((prev) => ({ ...prev, focusedIndex: 0 }));
              }}
              onDoubleClick={() => handleNavigateUp(paneKey)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActivePane(paneKey);
                setContextMenuTarget({
                  type: 'folder',
                  folderPath: parentDir,
                  folderName: '..',
                });
                setContextMenuPos({ x: e.clientX, y: e.clientY });
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
                setDragTargetFolder({ pane: paneKey, path: parentDir });
                setDragTargetPane(null);
              }}
              onDragLeave={(e) => {
                if (dragTargetFolder?.path === parentDir) {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragTargetFolder(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDropOnPane(e, parentDir, paneKey);
              }}
              className={`grid grid-cols-[1fr_80px_100px_130px] px-2 py-1 items-center transition-colors cursor-pointer select-none ${
                dragTargetFolder?.pane === paneKey && dragTargetFolder.path === parentDir
                  ? 'bg-[#60cdff]/25 text-white ring-1 ring-[#60cdff]'
                  : isActive && pane.focusedIndex === 0
                  ? 'bg-white/[0.08] text-[#60cdff]'
                  : 'hover:bg-white/[0.04] text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2 truncate pointer-events-none">
                <CornerLeftUp className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold tracking-wider">[ .. ]</span>
                {dragTargetFolder?.pane === paneKey && dragTargetFolder.path === parentDir && (
                  <span className="text-[10px] bg-[#60cdff] text-[#111215] font-bold px-1.5 py-0.2 rounded shadow-xs shrink-0 ml-1">
                    ↳ Vložit do nadřazené složky
                  </span>
                )}
              </div>
              <span className="text-zinc-600 font-sans text-[10px] uppercase pointer-events-none">Rodič</span>
              <span className="text-right text-zinc-600 pointer-events-none">—</span>
              <span className="text-right text-zinc-600 pr-1 pointer-events-none">—</span>
            </div>
          )}

          {/* List of Folders and Files */}
          {items.map((it, idx) => {
            const hasParent = !!parentDir;
            const absoluteRowIdx = hasParent ? idx + 1 : idx;
            const isFocused = isActive && pane.focusedIndex === absoluteRowIdx;
            const isSelected = pane.selectedPaths.has(it.path);
            const isDropTarget = dragTargetFolder?.pane === paneKey && dragTargetFolder.path === it.path;
            const isCut = clipboard?.op === 'cut' && clipboard.paths.includes(it.path);
            const badge = getExtBadgeStyle(it.extension, it.is_dir);

            return (
              <div
                key={it.path}
                data-row="true"
                draggable={true}
                style={{ WebkitUserDrag: 'element' } as React.CSSProperties}
                onDragStart={(e) => {
                  const selPaths = pane.selectedPaths.has(it.path)
                    ? Array.from(pane.selectedPaths)
                    : [it.path];

                  activeDragPayload = { paths: selPaths, sourcePane: paneKey };

                  // Defer React selection state update to next tick so Chromium doesn't abort dragstart
                  setTimeout(() => {
                    setActivePane(paneKey);
                    if (!pane.selectedPaths.has(it.path)) {
                      const setter = isLeft ? setLeft : setRight;
                      setter((prev) => ({
                        ...prev,
                        selectedPaths: new Set([it.path]),
                        focusedIndex: absoluteRowIdx,
                      }));
                    }
                  }, 0);

                  if (isDesktopApp() && selPaths.length > 0) {
                    e.preventDefault();
                    void startNativeFileDrag(selPaths);
                    return;
                  }

                  try {
                    e.dataTransfer.setData('text/plain', selPaths.join('\n'));
                    e.dataTransfer.setData('application/json', JSON.stringify({ paths: selPaths, sourcePane: paneKey }));
                  } catch {}
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onDragEnd={() => {
                  setTimeout(() => {
                    activeDragPayload = null;
                  }, 500);
                  setDragTargetFolder(null);
                  setDragTargetPane(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
                  if (it.is_dir) {
                    if (dragTargetFolder?.path !== it.path || dragTargetFolder?.pane !== paneKey) {
                      setDragTargetFolder({ pane: paneKey, path: it.path });
                    }
                    if (dragTargetPane !== null) setDragTargetPane(null);
                  } else {
                    if (dragTargetFolder !== null) setDragTargetFolder(null);
                    if (dragTargetPane !== paneKey) setDragTargetPane(paneKey);
                  }
                }}
                onDragLeave={(e) => {
                  if (it.is_dir && dragTargetFolder?.path === it.path) {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragTargetFolder(null);
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (it.is_dir) {
                    void handleDropOnPane(e, it.path, paneKey);
                  } else {
                    void handleDropOnPane(e, pane.currentPath, paneKey);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActivePane(paneKey);

                  if (!pane.selectedPaths.has(it.path)) {
                    const setter = isLeft ? setLeft : setRight;
                    setter((prev) => ({
                      ...prev,
                      selectedPaths: new Set([it.path]),
                      focusedIndex: absoluteRowIdx,
                    }));
                  }

                  const selItems = pane.selectedPaths.has(it.path)
                    ? items.filter((x) => pane.selectedPaths.has(x.path))
                    : [it];

                  const asAssets: AssetItem[] = selItems.map((x) => ({
                    id: x.path,
                    name: x.name,
                    folder: pane.currentPath,
                    fullPath: x.path,
                    url: '',
                    type: x.is_dir ? 'other' : 'image',
                    category: x.is_dir ? 'other' : 'image',
                    format: x.extension.toUpperCase(),
                    extension: x.extension,
                    colorBadge: '#60cdff',
                    size: x.size,
                    dimensions: { width: 0, height: 0 },
                    dateModified: new Date(x.modified_ms).toISOString(),
                    dateCreated: new Date(x.modified_ms).toISOString(),
                    exif: {},
                    iptc: { keywords: [] },
                    isFolder: x.is_dir,
                  }));

                  setContextMenuTarget({
                    type: 'asset',
                    asset: asAssets.find((a) => a.fullPath === it.path) || asAssets[0],
                    selectedAssets: asAssets,
                    folderPath: pane.currentPath,
                  });
                  setContextMenuPos({ x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  setActivePane(paneKey);
                  if (
                    document.activeElement instanceof HTMLElement &&
                    (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
                  ) {
                    document.activeElement.blur();
                  }
                  const setter = isLeft ? setLeft : setRight;
                  if (e.ctrlKey || e.metaKey) {
                    setter((prev) => {
                      const next = new Set(prev.selectedPaths);
                      if (next.has(it.path)) next.delete(it.path);
                      else next.add(it.path);
                      return { ...prev, selectedPaths: next, focusedIndex: absoluteRowIdx };
                    });
                  } else if (e.shiftKey) {
                    setter((prev) => {
                      const start = Math.min(prev.focusedIndex, absoluteRowIdx);
                      const end = Math.max(prev.focusedIndex, absoluteRowIdx);
                      const next = new Set<string>();
                      for (let i = start; i <= end; i++) {
                        const targetItem = hasParent ? items[i - 1] : items[i];
                        if (targetItem) next.add(targetItem.path);
                      }
                      return { ...prev, selectedPaths: next, focusedIndex: absoluteRowIdx };
                    });
                  } else {
                    setter((prev) => ({
                      ...prev,
                      selectedPaths: new Set([it.path]),
                      focusedIndex: absoluteRowIdx,
                    }));
                  }
                }}
                onDoubleClick={() => void handleOpenItem(it, paneKey)}
                className={`grid grid-cols-[1fr_80px_100px_130px] px-2 py-1 items-center transition-colors cursor-pointer select-none ${
                  isCut ? 'opacity-40 italic ring-1 ring-amber-400/40' : ''
                } ${
                  isDropTarget
                    ? 'bg-[#60cdff]/30 text-white ring-2 ring-[#60cdff]'
                    : isSelected
                    ? 'bg-[#1a3854] text-[#80d0ff] font-semibold'
                    : isFocused
                    ? 'bg-white/[0.08] text-white ring-1 ring-white/10'
                    : 'hover:bg-white/[0.04] text-zinc-300'
                }`}
                title={it.path}
              >
                {/* Column 1: Icon + Name */}
                <div className="flex items-center gap-2 truncate pr-2 pointer-events-none">
                  {it.is_dir ? (
                    <Win11Folder className="w-4 h-4 shrink-0" />
                  ) : (() => {
                    const AppIconComp = getAppIcon(it.extension);
                    if (AppIconComp) {
                      return <AppIconComp size={15} className="shrink-0" />;
                    }
                    return (
                      <span
                        className={`text-[9px] font-mono px-1 py-0.2 rounded-xs font-bold shrink-0 ${badge.bg} ${badge.text}`}
                      >
                        {it.extension.toUpperCase().slice(0, 4) || 'FILE'}
                      </span>
                    );
                  })()}
                  <span className={`truncate ${it.is_dir ? 'font-medium text-white' : ''}`}>
                    {it.name}
                  </span>
                  {isDropTarget && (
                    <span className="text-[10px] bg-[#60cdff] text-[#111215] font-bold px-1.5 py-0.2 rounded shadow-xs shrink-0 ml-1">
                      ↳ Vložit do podsložky
                    </span>
                  )}
                  {isCut && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/15 px-1 py-0.2 rounded font-mono shrink-0 ml-1">
                      <Scissors className="w-3 h-3" />
                      <span>vyjmuto</span>
                    </span>
                  )}
                </div>

                {/* Column 2: Extension */}
                <div className="truncate text-zinc-400 text-[11px] pointer-events-none">
                  {it.is_dir ? '' : it.extension.toUpperCase()}
                </div>

                {/* Column 3: Size */}
                <div className={`text-right text-[11px] tabular-nums pointer-events-none ${it.is_dir ? 'text-amber-400/80 font-medium' : 'text-zinc-400'}`}>
                  {formatFileSize(it.size, it.is_dir)}
                </div>

                {/* Column 4: Date Modified */}
                <div className="text-right text-[11px] text-zinc-500 tabular-nums pr-1 truncate pointer-events-none">
                  {formatModifiedDate(it.modified_ms)}
                </div>
              </div>
            );
          })}

          {items.length === 0 && !pane.loading && (
            <div className="p-8 text-center text-zinc-500 italic text-xs select-none">
              Složka je prázdná
            </div>
          )}

          {/* Fill bottom empty space in file list for easy drop target */}
          <div
            className="flex-1 min-h-[60px]"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
              if (dragTargetFolder !== null) setDragTargetFolder(null);
              if (dragTargetPane !== paneKey) setDragTargetPane(paneKey);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void handleDropOnPane(e, pane.currentPath, paneKey);
            }}
          />
        </div>

        {/* Status Bar for this Pane */}
        <div className="flex items-center justify-between px-3 py-1 bg-[#171920] border-t border-white/[0.06] text-[11px] text-zinc-400 font-mono select-none shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-white">
              {items.length} {items.length === 1 ? 'položka' : items.length < 5 ? 'položky' : 'položek'}
            </span>
            <span>({formatFileSize(totalBytes, false)})</span>
            {pane.selectedPaths.size > 0 && (
              <span className="text-[#60cdff] font-semibold pl-1">
                · {pane.selectedPaths.size} vybráno ({formatFileSize(selectedBytes, false)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isActive ? (
              <span className="text-[10px] uppercase font-bold text-[#60cdff] bg-[#60cdff]/15 px-1.5 py-0.2 rounded">
                Aktivní panel (Tab)
              </span>
            ) : (
              <span className="text-[10px] uppercase text-zinc-500">
                Pasivní cíl
              </span>
            )}
          </div>
        </div>
      </>
    )}
  </div>
);
};

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-[#111215] text-zinc-300 font-sans select-none overflow-hidden relative"
    >
      {/* Top Commander Toolbar: Sync (=), Swap (⇆), Refresh */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#17181d] border-b border-white/[0.08] shrink-0 text-xs select-none">
        <div className="flex items-center gap-2.5">
          <Columns2 className="w-4 h-4 text-[#60cdff]" />
          <span className="font-semibold text-white tracking-wide">
            Commender — Dvoupanelový správce souborů
          </span>
          <span className="text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded text-zinc-400 font-mono">
            Total Commander Mode
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Clipboard Action Buttons (Explorer style) */}
          <button
            type="button"
            onClick={() => handleCut()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs font-medium"
            title="Vyjmout vybrané soubory (Ctrl+X)"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>Vyjmout</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopyClipboard()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs font-medium"
            title="Kopírovat do schránky (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kopírovat</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors text-xs font-medium cursor-pointer ${
              (clipboard && clipboard.paths.length > 0) || (clipboardRef.current && clipboardRef.current.paths.length > 0)
                ? 'bg-[#60cdff]/15 hover:bg-[#60cdff]/25 text-[#60cdff] border-[#60cdff]/40 shadow-xs'
                : 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1] hover:text-white border-white/10'
            }`}
            title="Vložit ze schránky do aktivního panelu (Ctrl+V)"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Vložit</span>
            {((clipboard && clipboard.paths.length > 0) || (clipboardRef.current && clipboardRef.current.paths.length > 0)) && (
              <span className="text-[10px] bg-[#60cdff]/30 text-white font-mono px-1 rounded-full font-bold">
                {clipboard?.paths.length || clipboardRef.current?.paths.length}
              </span>
            )}
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <button
            type="button"
            onClick={handleSyncPaths}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs font-medium"
            title="Nastavit cílový panel na stejnou složku jako aktivní (=)"
          >
            <Equal className="w-3.5 h-3.5 text-[#60cdff]" />
            <span>Shodná složka (=)</span>
          </button>

          <button
            type="button"
            onClick={handleSwapPanes}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs font-medium"
            title="Prohodit levý a pravý panel (Ctrl+U)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
            <span>Prohodit panely (Ctrl+U)</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshBoth}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.12] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs font-medium"
            title="Obnovit oba panely (F5)"
          >
            <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Obnovit oba</span>
          </button>
        </div>
      </div>

      {/* Dual Panes Container with Resizable Splitter */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0 relative p-1.5 gap-1.5">
        {/* Left Pane */}
        <div style={{ width: `${splitRatio}%` }} className="h-full flex flex-col min-w-[200px]">
          {renderPane('left')}
        </div>

        {/* Central Splitter Handle */}
        <div
          onMouseDown={handleSplitterMouseDown}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
          }}
          className={`w-1.5 h-full cursor-col-resize select-none shrink-0 transition-colors flex items-center justify-center rounded-full ${
            isDraggingSplitter ? 'bg-[#60cdff]' : 'bg-white/[0.06] hover:bg-[#60cdff]/50'
          }`}
          title="Tahem myši změnit poměr panelů"
        >
          <div className="w-0.5 h-8 bg-white/20 rounded-full" />
        </div>

        {/* Right Pane */}
        <div style={{ width: `${100 - splitRatio}%` }} className="h-full flex flex-col min-w-[200px]">
          {renderPane('right')}
        </div>
      </div>

      {/* Bottom Total Commander Function Key Bar (F3 - F8, Tab) */}
      <div className="grid grid-cols-7 gap-1 px-1.5 py-1.5 bg-[#14151a] border-t border-white/[0.08] shrink-0 text-xs select-none">
        <button
          type="button"
          onClick={triggerQuickLook}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer font-medium"
          title="Zobrazit rychlý náhled vybraného souboru (F3)"
        >
          <span className="font-mono text-[#60cdff] font-bold text-[11px]">F3</span>
          <span className="truncate">Zobrazit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const isLeft = activePane === 'left';
            const currentMode = isLeft ? leftViewMode : rightViewMode;
            if (currentMode === 'notepad') {
              if (isLeft) setLeftViewMode('files');
              else setRightViewMode('files');
            } else {
              const pane = isLeft ? left : right;
              const list = isLeft ? leftDisplayItems : rightDisplayItems;
              const hasParent = !!getParentDir(pane.currentPath);
              const itemIdx = hasParent ? pane.focusedIndex - 1 : pane.focusedIndex;
              const it = itemIdx >= 0 && itemIdx < list.length ? list[itemIdx] : null;

              if (it && !it.is_dir && isTextLikeFile(it.extension)) {
                handleOpenInNotepad(it.path, activePane);
              } else {
                if (isLeft) setLeftViewMode('notepad');
                else setRightViewMode('notepad');
              }
            }
          }}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer font-medium"
          title="Přepnout do zápisníku / upravit textový soubor (F4)"
        >
          <span className="font-mono text-amber-400 font-bold text-[11px]">F4</span>
          <span className="truncate">{(activePane === 'left' ? leftViewMode : rightViewMode) === 'notepad' ? 'Soubory' : 'Zápisník'}</span>
        </button>

        <button
          type="button"
          onClick={triggerCopy}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer font-medium"
          title="Kopírovat vybrané soubory do cílového panelu (F5)"
        >
          <span className="font-mono text-emerald-400 font-bold text-[11px]">F5</span>
          <span className="truncate">Kopírovat</span>
        </button>

        <button
          type="button"
          onClick={triggerMove}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer font-medium"
          title="Přesunout vybrané soubory do cílového panelu (F6)"
        >
          <span className="font-mono text-amber-400 font-bold text-[11px]">F6</span>
          <span className="truncate font-semibold text-amber-300">Přesunout</span>
        </button>

        <button
          type="button"
          onClick={triggerNewFolder}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer font-medium"
          title="Vytvořit novou podsložku v aktivním panelu (F7)"
        >
          <span className="font-mono text-sky-400 font-bold text-[11px]">F7</span>
          <span className="truncate">Nová složka</span>
        </button>

        <button
          type="button"
          onClick={triggerDelete}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-rose-300 border border-white/[0.06] transition-colors cursor-pointer font-medium"
          title="Smazat vybrané soubory do Koše (F8 / Delete)"
        >
          <span className="font-mono text-rose-400 font-bold text-[11px]">F8</span>
          <span className="truncate">Smazat</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePane((prev) => (prev === 'left' ? 'right' : 'left'))}
          className="flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white border border-white/10 transition-colors cursor-pointer font-semibold"
          title="Přepnout fokus mezi levým a pravým panelem (Tab)"
        >
          <span className="font-mono text-[#60cdff] font-bold text-[11px]">Tab</span>
          <span className="truncate">Přepnout</span>
        </button>
      </div>

      {/* Operation Confirmation / Input Modal */}
      {operationModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-100">
          <div className="bg-[#181a20] border border-white/15 rounded-xl shadow-2xl w-full max-w-lg p-5 text-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                {operationModal.type === 'copy' && <Copy className="w-5 h-5 text-emerald-400" />}
                {operationModal.type === 'move' && <Move className="w-5 h-5 text-amber-400" />}
                {operationModal.type === 'new-folder' && <FolderPlus className="w-5 h-5 text-sky-400" />}
                {operationModal.type === 'delete' && <Trash2 className="w-5 h-5 text-rose-400" />}
                <h3 className="text-sm font-semibold text-white">
                  {operationModal.type === 'copy' && 'Kopírovat soubory'}
                  {operationModal.type === 'move' && 'Přesunout soubory'}
                  {operationModal.type === 'new-folder' && 'Nová složka'}
                  {operationModal.type === 'delete' && 'Smazat soubory do Koše'}
                  {operationModal.type === 'rename' && 'Přejmenovat položku'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOperationModal({ type: null, sourcePaths: [], sourceNames: [], targetDir: '', inputValue: '' })}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs">
              {operationModal.type === 'delete' ? (
                <div>
                  <p className="text-zinc-300 leading-relaxed">
                    Opravdu chcete přesunout následující{' '}
                    <span className="font-bold text-white">{operationModal.sourcePaths.length}</span>{' '}
                    {operationModal.sourcePaths.length === 1 ? 'položku' : 'položek'} do Koše?
                  </p>
                  <div className="mt-2 max-h-36 overflow-y-auto bg-black/30 border border-white/10 rounded p-2 space-y-1 font-mono text-[11px] text-zinc-400">
                    {operationModal.sourceNames.map((n, i) => (
                      <div key={i} className="truncate">
                        • {n}
                      </div>
                    ))}
                  </div>
                </div>
              ) : operationModal.type === 'new-folder' ? (
                <div>
                  <label className="block text-zinc-400 mb-1.5">Název nové složky v {operationModal.targetDir}:</label>
                  <input
                    type="text"
                    autoFocus
                    value={operationModal.inputValue}
                    onChange={(e) => setOperationModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleExecuteOperation();
                    }}
                    className="w-full bg-[#121316] border border-white/15 rounded px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-[#60cdff]"
                  />
                </div>
              ) : operationModal.type === 'rename' ? (
                <div>
                  <label className="block text-zinc-400 mb-1.5">Nový název položky:</label>
                  <input
                    type="text"
                    autoFocus
                    value={operationModal.inputValue}
                    onChange={(e) => setOperationModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleExecuteOperation();
                    }}
                    className="w-full bg-[#121316] border border-white/15 rounded px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-[#60cdff]"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-zinc-300 mb-2">
                    {operationModal.type === 'move' ? 'Přesunout' : 'Kopírovat'}{' '}
                    <span className="font-bold text-white">{operationModal.sourcePaths.length}</span>{' '}
                    {operationModal.sourcePaths.length === 1 ? 'položku' : 'položek'} do cílové složky:
                  </p>
                  <div className="mb-2 max-h-24 overflow-y-auto bg-black/30 border border-white/10 rounded p-2 font-mono text-[11px] text-zinc-400">
                    {operationModal.sourceNames.map((n, i) => (
                      <div key={i} className="truncate">
                        • {n}
                      </div>
                    ))}
                  </div>
                  <label className="block text-zinc-400 mb-1 text-[11px]">Cílová složka:</label>
                  <input
                    type="text"
                    value={operationModal.inputValue}
                    onChange={(e) => setOperationModal((prev) => ({ ...prev, inputValue: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleExecuteOperation();
                    }}
                    className="w-full bg-[#121316] border border-white/15 rounded px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-[#60cdff]"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setOperationModal({ type: null, sourcePaths: [], sourceNames: [], targetDir: '', inputValue: '' })}
                className="px-4 py-1.5 text-xs rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                Storno (Esc)
              </button>
              <button
                type="button"
                onClick={() => void handleExecuteOperation()}
                className={`px-4 py-1.5 text-xs font-semibold rounded text-[#111215] transition-all shadow-md cursor-pointer ${
                  operationModal.type === 'delete'
                    ? 'bg-rose-400 hover:bg-rose-300'
                    : operationModal.type === 'move'
                    ? 'bg-amber-400 hover:bg-amber-300'
                    : 'bg-[#60cdff] hover:bg-[#72d5ff]'
                }`}
              >
                {operationModal.type === 'copy' && 'Kopírovat (Enter)'}
                {operationModal.type === 'move' && 'Přesunout (Enter)'}
                {operationModal.type === 'new-folder' && 'Vytvořit složku'}
                {operationModal.type === 'delete' && 'Smazat do Koše'}
                {operationModal.type === 'rename' && 'Přejmenovat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Windows 11 Fluent Context Menu */}
      <FileContextMenu
        position={contextMenuPos}
        target={contextMenuTarget}
        clipboard={clipboard}
        onClose={() => {
          setContextMenuPos(null);
          setContextMenuTarget(null);
        }}
        onOpen={(tgt) => {
          if (tgt.asset) {
            const activeList = activePane === 'left' ? left.items : right.items;
            const found = activeList.find((x) => x.path === (tgt.asset?.fullPath || tgt.asset?.id));
            if (found) void handleOpenItem(found, activePane);
          } else if (tgt.folderPath) {
            navigatePane(tgt.folderPath, activePane);
          }
        }}
        onRevealInExplorer={(path) => {
          void revealInWindowsExplorer(path);
        }}
        onOpenTerminal={(path) => {
          void openTerminalNative(path);
        }}
        onOpenInNotepad={(filePath) => handleOpenInNotepad(filePath, activePane)}
        onCopy={(paths) => handleCopyClipboard(paths)}
        onCut={(paths) => handleCut(paths)}
        onPaste={(destFolder) => void handlePasteClipboard(destFolder)}
        onCopyPath={(path) => {
          void copyTextToClipboard(path);
          onNotify?.('Cesta zkopírována', path, 'info');
        }}
        onRename={(tgt) => {
          if (tgt.asset) {
            setOperationModal({
              type: 'rename',
              sourcePaths: [tgt.asset.fullPath || tgt.asset.id],
              sourceNames: [tgt.asset.name],
              targetDir: tgt.folderPath || (activePane === 'left' ? left.currentPath : right.currentPath),
              inputValue: tgt.asset.name,
            });
          } else if (tgt.folderPath) {
            const folderName = tgt.folderName || tgt.folderPath.split('\\').pop() || '';
            setOperationModal({
              type: 'rename',
              sourcePaths: [tgt.folderPath],
              sourceNames: [folderName],
              targetDir: getParentDir(tgt.folderPath) || '',
              inputValue: folderName,
            });
          } else {
            triggerRename();
          }
        }}
        onDelete={(paths, names) => {
          if (paths.length === 0) return;
          setOperationModal({
            type: 'delete',
            sourcePaths: paths,
            sourceNames: names,
            targetDir: '',
            inputValue: '',
          });
        }}
        onCreateFolder={(parentFolder) => {
          setOperationModal({
            type: 'new-folder',
            sourcePaths: [],
            sourceNames: [],
            targetDir: parentFolder || (activePane === 'left' ? left.currentPath : right.currentPath),
            inputValue: 'Nová složka',
          });
        }}
        onRefresh={() => {
          void fetchDirectory(activePane === 'left' ? left.currentPath : right.currentPath, activePane);
        }}
        onSelectAll={() => {
          const isLeft = activePane === 'left';
          const list = isLeft ? leftDisplayItems : rightDisplayItems;
          const setter = isLeft ? setLeft : setRight;
          setter((prev) => ({
            ...prev,
            selectedPaths: new Set(list.map((it) => it.path)),
          }));
        }}
        onShowProperties={(path) => {
          void showFilePropertiesNative(path);
        }}
      />
    </div>
  );
};
