import React, { useEffect, useState, useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';
import {
  listNativeDrives,
  listNativePlaces,
  listNativeSubdirs,
  type NativePlace,
} from '../utils/tauriBridge';
import {
  Win11Folder,
  Win11Desktop,
  Win11Downloads,
  Win11Pictures,
  Win11Videos,
  Win11ThisPC,
  Win11Drive,
  Win11Star,
} from './Win11Icons';

interface NativeExplorerTreeProps {
  activePath: string | null;
  onNavigate: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, folder: NativePlace, allSelectedPaths?: string[]) => void;
  favoriteFolders?: string[];
  onToggleFavorite?: (path: string) => void;
  onMoveAssets?: (assetIds: string[], targetFolder: string, isCopy?: boolean) => void;
}

const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

/** "C:\Users\me" -> ["C:\", "C:\Users", "C:\Users\me"] */
export function pathAncestors(path: string): string[] {
  const parts = path.replace(/\//g, '\\').split('\\').filter(Boolean);
  const result: string[] = [];
  let acc = '';
  parts.forEach((part, i) => {
    acc = i === 0 ? `${part}\\` : acc.endsWith('\\') ? `${acc}${part}` : `${acc}\\${part}`;
    result.push(acc);
  });
  return result;
}

const renderPlaceIcon = (name: string, isOpen: boolean) => {
  const lower = name.toLowerCase();
  if (lower.includes('plocha') || lower.includes('desktop')) {
    return <Win11Desktop className="w-4 h-4 mr-2" />;
  }
  if (lower.includes('stažené') || lower.includes('download')) {
    return <Win11Downloads className="w-4 h-4 mr-2" />;
  }
  if (lower.includes('obrázky') || lower.includes('picture')) {
    return <Win11Pictures className="w-4 h-4 mr-2" />;
  }
  if (lower.includes('videa') || lower.includes('video')) {
    return <Win11Videos className="w-4 h-4 mr-2" />;
  }
  return <Win11Folder isOpen={isOpen} className="w-4 h-4 mr-2" />;
};

/** Extracts clean human-friendly folder name for favorite items */
export function getFavFolderName(p: string): string {
  if (p === '/' || /^[a-zA-Z]:\\?$/.test(p)) return p;
  const clean = p.replace(/\//g, '\\').replace(/\\+$/, '');
  const parts = clean.split('\\').filter(Boolean);
  const last = parts[parts.length - 1];
  return last ? last.replace(/^[0-9]+\.\s*/, '') : p;
}

export const NativeExplorerTree: React.FC<NativeExplorerTreeProps> = ({
  activePath,
  onNavigate,
  onContextMenu,
  favoriteFolders = [],
  onToggleFavorite,
  onMoveAssets,
}) => {
  const [drives, setDrives] = useState<NativePlace[]>([]);
  const [places, setPlaces] = useState<NativePlace[]>([]);
  const [children, setChildren] = useState<Record<string, NativePlace[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Favorites section collapsible state & drag/drop
  const [favoritesExpanded, setFavoritesExpanded] = useState<boolean>(true);
  const [dragOverFav, setDragOverFav] = useState<string | null>(null);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);

  const handleNodeDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    if (dragOverNode !== path) setDragOverNode(path);
  };

  const handleNodeDragLeave = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverNode === path) setDragOverNode(null);
  };

  const handleNodeDrop = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNode(null);
    if (!onMoveAssets) return;
    const isCopy = e.ctrlKey;

    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        const items = (parsed.paths && parsed.paths.length > 0) ? parsed.paths : parsed.assetIds;
        if (items && Array.isArray(items) && items.length > 0) {
          onMoveAssets(items, path, isCopy);
          return;
        }
      }
    } catch {}

    const plain = e.dataTransfer.getData('text/plain');
    if (plain) {
      const ids = plain.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        onMoveAssets(ids, path, isCopy);
      }
    }
  };

  const handleFavDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    if (dragOverFav !== path) setDragOverFav(path);
  };

  const handleFavDragLeave = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFav === path) setDragOverFav(null);
  };

  const handleFavDrop = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFav(null);
    if (!onMoveAssets) return;
    const isCopy = e.ctrlKey;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        const items = (parsed.paths && parsed.paths.length > 0) ? parsed.paths : parsed.assetIds;
        if (items && Array.isArray(items) && items.length > 0) {
          onMoveAssets(items, path, isCopy);
          return;
        }
      }
    } catch {}
    const plain = e.dataTransfer.getData('text/plain');
    if (plain) {
      const ids = plain.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) onMoveAssets(ids, path, isCopy);
    }
  };

  const handleDropOnFavoritesHeader = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const plain = e.dataTransfer.getData('text/plain');
      if (plain && onToggleFavorite && !favoriteFolders.includes(plain)) {
        onToggleFavorite(plain);
      }
    } catch {}
  };

  // Windows 11 Explorer multi-selection states
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedOriginals, setSelectedOriginals] = useState<Map<string, string>>(new Map());
  const [lastAnchor, setLastAnchor] = useState<string | null>(null);

  useEffect(() => {
    listNativeDrives().then(setDrives);
    listNativePlaces().then((allPlaces) => {
      setPlaces(
        allPlaces.filter((p) => {
          const lower = p.name.toLowerCase();
          const isDoc = lower.includes('dokumenty') || lower.includes('documents');
          const isMusic = lower.includes('hudba') || lower.includes('music');
          const isVideo = lower.includes('videa') || lower.includes('video') || lower.includes('videos');
          return !isDoc && !isMusic && !isVideo;
        })
      );
    });
  }, []);

  const loadChildren = useCallback(async (path: string) => {
    const key = norm(path);
    const subs = await listNativeSubdirs(path);
    setChildren((prev) => ({
      ...prev,
      [key]: subs.map((s) => ({ name: s.name, path: s.path })),
    }));
  }, []);

  const toggle = useCallback(
    (path: string) => {
      const key = norm(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      setChildren((prev) => {
        if (!prev[key]) void loadChildren(path);
        return prev;
      });
    },
    [loadChildren]
  );

  // Automatically collapse all open folders in the explorer tree
  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  // Compute ordered list of all currently visible nodes in the tree
  const getVisibleNodes = useCallback((): NativePlace[] => {
    const result: NativePlace[] = [];

    const traverse = (node: NativePlace) => {
      result.push(node);
      const key = norm(node.path);
      if (expanded.has(key)) {
        const kids = children[key];
        if (kids && kids.length > 0) {
          for (const kid of kids) {
            traverse(kid);
          }
        }
      }
    };

    let picturesFound = false;
    for (const p of places) {
      traverse(p);
      const isPictures =
        p.name.toLowerCase().includes('obrázky') ||
        p.name.toLowerCase().includes('picture');
      if (isPictures) {
        picturesFound = true;
        if (favoritesExpanded && favoriteFolders && favoriteFolders.length > 0) {
          for (const fav of favoriteFolders) {
            result.push({ name: getFavFolderName(fav), path: fav });
          }
        }
      }
    }

    if (!picturesFound && favoritesExpanded && favoriteFolders && favoriteFolders.length > 0) {
      for (const fav of favoriteFolders) {
        result.push({ name: getFavFolderName(fav), path: fav });
      }
    }

    for (const d of drives) {
      traverse(d);
    }

    return result;
  }, [places, drives, expanded, children, favoritesExpanded, favoriteFolders]);

  // Keep the tree in sync with the currently opened folder (expand ancestors)
  useEffect(() => {
    if (!activePath) return;
    const key = norm(activePath);
    const ancestors = pathAncestors(activePath);
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestors.forEach((a) => next.add(norm(a)));
      return next;
    });
    ancestors.forEach((a) => {
      if (!children[norm(a)]) void loadChildren(a);
    });

    // Sync active item with selection
    setSelectedPaths((prev) => {
      if (prev.has(key)) return prev;
      return new Set([key]);
    });
    setSelectedOriginals((prev) => {
      const next = new Map(prev);
      next.set(key, activePath);
      return next;
    });
    setLastAnchor((prev) => prev || key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  // Handle node click with Windows 11 Ctrl and Shift selection
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: NativePlace) => {
      const key = norm(node.path);

      if (e.ctrlKey || e.metaKey) {
        // CTRL + CLICK: Toggle node selection
        setSelectedPaths((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          return next;
        });
        setSelectedOriginals((prev) => {
          const next = new Map(prev);
          next.set(key, node.path);
          return next;
        });
        setLastAnchor(key);
        onNavigate(node.path);
      } else if (e.shiftKey && lastAnchor) {
        // SHIFT + CLICK: Range selection between anchor and clicked node among visible nodes
        const visible = getVisibleNodes();
        const targetIdx = visible.findIndex((n) => norm(n.path) === key);
        const anchorIdx = visible.findIndex((n) => norm(n.path) === lastAnchor);

        if (targetIdx !== -1 && anchorIdx !== -1) {
          const start = Math.min(targetIdx, anchorIdx);
          const end = Math.max(targetIdx, anchorIdx);
          const range = visible.slice(start, end + 1);

          const nextSet = new Set<string>();
          const nextOrig = new Map<string, string>();
          for (const item of range) {
            const itemKey = norm(item.path);
            nextSet.add(itemKey);
            nextOrig.set(itemKey, item.path);
          }

          setSelectedPaths(nextSet);
          setSelectedOriginals(nextOrig);
        } else {
          setSelectedPaths(new Set([key]));
          setSelectedOriginals(new Map([[key, node.path]]));
          setLastAnchor(key);
        }
        onNavigate(node.path);
      } else {
        // NORMAL CLICK: Select single node, set anchor, navigate, expand if closed
        setSelectedPaths(new Set([key]));
        setSelectedOriginals(new Map([[key, node.path]]));
        setLastAnchor(key);
        onNavigate(node.path);
        if (!expanded.has(key)) {
          toggle(node.path);
        }
      }
    },
    [expanded, getVisibleNodes, lastAnchor, onNavigate, toggle]
  );

  // Handle right-click context menu preserving or setting multi-selection
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: NativePlace) => {
      e.preventDefault();
      e.stopPropagation();

      const key = norm(node.path);
      if (selectedPaths.has(key)) {
        // Right-clicked an already selected item -> maintain multi-selection
        const allOriginals = Array.from(selectedPaths).map(
          (k) => selectedOriginals.get(k) || k
        );
        onContextMenu?.(e, node, allOriginals);
      } else {
        // Right-clicked an unselected item -> select only this item
        setSelectedPaths(new Set([key]));
        setSelectedOriginals(new Map([[key, node.path]]));
        setLastAnchor(key);
        onContextMenu?.(e, node, [node.path]);
      }
    },
    [onContextMenu, selectedOriginals, selectedPaths]
  );

  // Keyboard navigation within tree (Arrow keys, Shift+Arrow, Ctrl+A, Key A)
  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Ignore if typing in text inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Check if dialog is open
      if (document.querySelector('[role="dialog"], .fixed.inset-0.z-50, .fixed.inset-0.z-60')) {
        return;
      }

      // Key 'a' / 'A' without modifiers collapses all
      if ((e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        collapseAll();
        return;
      }

      const visible = getVisibleNodes();
      if (visible.length === 0) return;

      // Ctrl + A: Select all visible nodes
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const nextSet = new Set<string>();
        const nextOrig = new Map<string, string>();
        for (const item of visible) {
          const itemKey = norm(item.path);
          nextSet.add(itemKey);
          nextOrig.set(itemKey, item.path);
        }
        setSelectedPaths(nextSet);
        setSelectedOriginals(nextOrig);
        return;
      }

      // ArrowUp / ArrowDown navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentKey = lastAnchor || (activePath ? norm(activePath) : norm(visible[0].path));
        const currentIdx = visible.findIndex((n) => norm(n.path) === currentKey);

        let nextIdx = currentIdx;
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < visible.length - 1 ? currentIdx + 1 : currentIdx;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : 0;
        }

        const nextNode = visible[nextIdx];
        if (!nextNode) return;
        const nextKey = norm(nextNode.path);

        if (e.shiftKey && lastAnchor) {
          // Range expansion with Shift+Arrow
          const anchorIdx = visible.findIndex((n) => norm(n.path) === lastAnchor);
          const start = Math.min(anchorIdx, nextIdx);
          const end = Math.max(anchorIdx, nextIdx);
          const range = visible.slice(start, end + 1);

          const nextSet = new Set<string>();
          const nextOrig = new Map<string, string>();
          for (const item of range) {
            const itemKey = norm(item.path);
            nextSet.add(itemKey);
            nextOrig.set(itemKey, item.path);
          }
          setSelectedPaths(nextSet);
          setSelectedOriginals(nextOrig);
          onNavigate(nextNode.path);
        } else {
          // Normal Arrow move
          setSelectedPaths(new Set([nextKey]));
          setSelectedOriginals(new Map([[nextKey, nextNode.path]]));
          setLastAnchor(nextKey);
          onNavigate(nextNode.path);
        }
      }
    },
    [activePath, collapseAll, getVisibleNodes, lastAnchor, onNavigate]
  );

  // Global listener for key 'a' to collapse all folders when not in inputs
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role="dialog"], .fixed.inset-0.z-50, .fixed.inset-0.z-60')) return;

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        collapseAll();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [collapseAll]);

  const renderNode = (
    node: NativePlace,
    level: number,
    getCustomIcon?: (isOpen: boolean) => React.ReactNode,
    isDrive: boolean = false
  ) => {
    const key = norm(node.path);
    const isOpen = expanded.has(key);
    const isActive = !!activePath && norm(activePath) === key;
    const isSelected = selectedPaths.has(key);
    const isDragTarget = dragOverNode === node.path;
    const kids = children[key];
    const isLeaf = kids && kids.length === 0;

    const iconElement = getCustomIcon
      ? getCustomIcon(isOpen)
      : isDrive
      ? <Win11Drive className="w-4 h-4 mr-2" />
      : <Win11Folder isOpen={isOpen} className="w-4 h-4 mr-2" />;

    return (
      <div key={`${level}-${key}`} className="relative">
        <div
          onClick={(e) => handleNodeClick(e, node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          onDragOver={(e) => handleNodeDragOver(e, node.path)}
          onDragLeave={(e) => handleNodeDragLeave(e, node.path)}
          onDrop={(e) => handleNodeDrop(e, node.path)}
          className={`group relative flex items-center mx-1.5 my-[1.5px] py-1.5 pr-2.5 text-[12px] font-normal rounded-[5px] transition-all duration-120 cursor-pointer select-none ${
            isDragTarget
              ? 'bg-[#60cdff]/20 text-white font-semibold ring-1 ring-[#60cdff]/50'
              : isActive
              ? 'bg-white/[0.09] text-white font-medium shadow-xs'
              : isSelected
              ? 'bg-white/[0.07] text-white font-normal ring-1 ring-white/10 shadow-xs'
              : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
          }`}
          style={{ paddingLeft: `${6 + level * 14}px` }}
          title={node.path}
        >
          {/* Windows 11 Signature Left Pill Indicator for Active Selection */}
          {isActive && (
            <span className="absolute left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-[#60cdff] rounded-full shadow-[0_0_6px_rgba(96,205,255,0.5)]" />
          )}

          {/* Windows 11 Animated Smooth Chevron Button */}
          {isLeaf ? (
            <span className="w-4 h-4 shrink-0" />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.path);
              }}
              className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-xs transition-colors shrink-0 mr-0.5"
              aria-label={isOpen ? 'Sbalit' : 'Rozbalit'}
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform duration-150 ${
                  isOpen ? 'rotate-90 text-zinc-200' : 'text-zinc-400'
                }`}
              />
            </button>
          )}

          {/* Windows 11 Fluent Icon */}
          {iconElement}

          {/* Folder Name */}
          <span className="truncate tracking-tight flex-1">{node.name}</span>
        </div>

        {/* Nested Subfolders with subtle Windows 11 tree connection guide */}
        {isOpen && kids && kids.length > 0 && (
          <div className="relative">
            {/* Tree branch guide line */}
            <div
              className="absolute top-0 bottom-1 w-px bg-white/[0.07]"
              style={{ left: `${14 + level * 14}px` }}
            />
            {kids.map((k) => renderNode(k, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFavoritesSection = () => {
    return (
      <div key="w11-favorites-section" className="my-1 border-t border-b border-white/[0.04] bg-white/[0.015] py-0.5">
        <div
          onClick={() => setFavoritesExpanded((v) => !v)}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleDropOnFavoritesHeader}
          className="group flex items-center justify-between mx-1.5 my-[1.5px] px-2 py-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase rounded-[5px] hover:bg-white/[0.04] hover:text-zinc-200 transition-colors cursor-pointer select-none"
          title="Oblíbené složky (kliknutím sbalit/rozbalit, přetažením složky sem přidat)"
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFavoritesExpanded((v) => !v);
              }}
              className="w-3.5 h-3.5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform duration-150 ${
                  favoritesExpanded ? 'rotate-90 text-zinc-300' : 'text-zinc-500'
                }`}
              />
            </button>
            <Win11Star className="w-3.5 h-3.5" />
            <span className="tracking-wider">Oblíbené složky</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums px-1.5 py-0.2 rounded-full bg-white/[0.05]">
            {favoriteFolders.length}
          </span>
        </div>

        {favoritesExpanded && (
          <div className="space-y-0.5">
            {favoriteFolders.length === 0 ? (
              <div className="px-5 py-1.5 text-[11px] text-zinc-500 italic select-none">
                Klikněte pravým tlačítkem na složku pro přidání
              </div>
            ) : (
              favoriteFolders.map((favPath) => {
                const name = getFavFolderName(favPath);
                const key = norm(favPath);
                const isActive = !!activePath && norm(activePath) === key;
                const isSelected = selectedPaths.has(key);
                const isDragTarget = dragOverFav === favPath;

                return (
                  <div
                    key={favPath}
                    onDragOver={(e) => handleFavDragOver(e, favPath)}
                    onDragLeave={(e) => handleFavDragLeave(e, favPath)}
                    onDrop={(e) => handleFavDrop(e, favPath)}
                    onClick={(e) => {
                      handleNodeClick(e, { name, path: favPath });
                    }}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      onContextMenu?.(e, { name, path: favPath }, [favPath]);
                    }}
                    className={`group relative flex items-center justify-between mx-1.5 my-[1.5px] py-1.5 pr-2.5 text-[12px] font-normal rounded-[5px] transition-all duration-120 cursor-pointer select-none pl-6 ${
                      isDragTarget
                        ? 'bg-[#e2e4e9]/20 text-white ring-1 ring-[#e2e4e9]/30'
                        : isActive
                        ? 'bg-white/[0.09] text-white font-medium shadow-xs'
                        : isSelected
                        ? 'bg-white/[0.07] text-white font-normal ring-1 ring-white/10 shadow-xs'
                        : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                    }`}
                    title={favPath}
                  >
                    {isActive && (
                      <span className="absolute left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-[#60cdff] rounded-full shadow-[0_0_6px_rgba(96,205,255,0.5)]" />
                    )}
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <Win11Folder className="w-4 h-4 shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {isDragTarget && (
                        <span className="text-[10px] font-mono text-[#e2e4e9] font-bold">
                          + Přesunout
                        </span>
                      )}
                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(favPath);
                          }}
                          className="p-1 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-white/10"
                          title="Odebrat z oblíbených"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleTreeKeyDown}
      className="border-b border-white/[0.06] pb-2 outline-none focus:outline-none"
    >
      <div className="px-3.5 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Win11ThisPC className="w-4 h-4" />
          <span>Tento počítač</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedPaths.size > 1 && (
            <span className="text-[10px] text-[#60cdff] font-medium bg-[#60cdff]/10 px-1.5 py-0.5 rounded-[4px]">
              {selectedPaths.size} vybráno
            </span>
          )}
          <button
            type="button"
            onClick={collapseAll}
            disabled={expanded.size === 0}
            className={`text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded-[4px] hover:bg-white/[0.08] transition-all cursor-pointer flex items-center gap-1 font-mono normal-case tracking-normal ${
              expanded.size === 0 ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
            title="Sbalit všechny složky (Klávesa A)"
          >
            <span>Sbalit</span>
            <kbd className="px-1 py-0.2 bg-white/10 rounded text-[9px] font-mono">A</kbd>
          </button>
        </div>
      </div>
      <div>
        {places.map((p) => {
          const isPictures =
            p.name.toLowerCase().includes('obrázky') ||
            p.name.toLowerCase().includes('picture');

          return (
            <React.Fragment key={p.path}>
              {renderNode(p, 0, (isOpen) => renderPlaceIcon(p.name, isOpen))}
              {isPictures && renderFavoritesSection()}
            </React.Fragment>
          );
        })}
        {places.length > 0 &&
          !places.some(
            (p) =>
              p.name.toLowerCase().includes('obrázky') ||
              p.name.toLowerCase().includes('picture')
          ) &&
          renderFavoritesSection()}
        {places.length === 0 && renderFavoritesSection()}
        {places.length > 0 && drives.length > 0 && (
          <div className="h-px bg-white/[0.06] mx-3 my-2" />
        )}
        {drives.map((d) => renderNode(d, 0, undefined, true))}
      </div>
    </div>
  );
};
