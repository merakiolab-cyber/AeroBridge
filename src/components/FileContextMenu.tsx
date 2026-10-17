import React, { useEffect, useRef } from 'react';
import {
  ExternalLink,
  FolderOpen,
  Copy,
  Scissors,
  ClipboardPaste,
  Edit3,
  Trash2,
  FolderPlus,
  RefreshCw,
  Info,
  Link,
  CheckSquare,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { AssetItem } from '../types';
import { Win11Star } from './Win11Icons';

export interface ContextMenuTarget {
  type: 'asset' | 'background' | 'folder';
  asset?: AssetItem;
  selectedAssets?: AssetItem[];
  folderPath?: string;
  folderName?: string;
  selectedFolderPaths?: string[];
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface FileContextMenuProps {
  position: ContextMenuPosition | null;
  target: ContextMenuTarget | null;
  clipboard: { paths: string[]; op: 'copy' | 'cut' } | null;
  onClose: () => void;
  onOpen: (target: ContextMenuTarget) => void;
  onRevealInExplorer: (path: string) => void;
  onOpenTerminal?: (path: string) => void;
  onCopy: (paths: string[]) => void;
  onCut: (paths: string[]) => void;
  onPaste: (destFolder: string) => void;
  onCopyPath: (path: string) => void;
  onRename: (target: ContextMenuTarget) => void;
  onDelete: (paths: string[], names: string[]) => void;
  onCreateFolder: (parentFolder: string) => void;
  onRefresh: () => void;
  onSelectAll?: () => void;
  onShowProperties?: (path: string) => void;
  favoriteFolders?: string[];
  onToggleFavorite?: (path: string) => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  position,
  target,
  clipboard,
  onClose,
  onOpen,
  onRevealInExplorer,
  onOpenTerminal,
  onCopy,
  onCut,
  onPaste,
  onCopyPath,
  onRename,
  onDelete,
  onCreateFolder,
  onRefresh,
  onSelectAll,
  onShowProperties,
  favoriteFolders,
  onToggleFavorite,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [position, onClose]);

  if (!position || !target) return null;

  // Resolve target paths
  const isAssetTarget = target.type === 'asset';
  const isFolderTreeTarget = target.type === 'folder';
  const isBackground = target.type === 'background';

  const selectedList = target.selectedAssets && target.selectedAssets.length > 0
    ? target.selectedAssets
    : target.asset ? [target.asset] : [];

  const targetPaths = isAssetTarget
    ? selectedList.map((a) => a.fullPath || a.id).filter(Boolean)
    : target.selectedFolderPaths && target.selectedFolderPaths.length > 0
    ? target.selectedFolderPaths
    : target.folderPath ? [target.folderPath] : [];

  const targetNames = isAssetTarget
    ? selectedList.map((a) => a.name)
    : target.selectedFolderPaths && target.selectedFolderPaths.length > 0
    ? target.selectedFolderPaths.map((p) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p)
    : target.folderName ? [target.folderName] : [];

  const singleAsset = isAssetTarget ? target.asset : undefined;
  const isFolderAsset = singleAsset?.isFolder || isFolderTreeTarget;

  // Destination folder for Paste / New Folder
  const destFolder = isFolderAsset
    ? (singleAsset?.fullPath || target.folderPath)
    : target.folderPath;

  const canPaste = !!destFolder;

  // Calculate adjusted position to keep menu inside viewport
  const menuWidth = 240;
  const menuEstimatedHeight = isAssetTarget ? 320 : 180;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const left = position.x + menuWidth > screenW ? Math.max(10, screenW - menuWidth - 10) : position.x;
  const top = position.y + menuEstimatedHeight > screenH ? Math.max(10, screenH - menuEstimatedHeight - 10) : position.y;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[230px] py-1.5 px-1 bg-[#181a20]/95 backdrop-blur-xl border border-white/10 rounded-none shadow-[0_12px_40px_rgba(0,0,0,0.7)] text-xs text-zinc-300 font-sans select-none animate-in fade-in zoom-in-95 duration-100"
      style={{ left: `${left}px`, top: `${top}px` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* --- CASE A: File or Selected Assets --- */}
      {isAssetTarget && (
        <>
          <button
            onClick={() => {
              onClose();
              onOpen(target);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 font-medium">
              {isFolderAsset ? (
                <FolderOpen className="w-4 h-4 text-[#e2e4e9]" />
              ) : (
                <ExternalLink className="w-4 h-4 text-[#e2e4e9]" />
              )}
              <span>{isFolderAsset ? 'Otevřít složku' : 'Otevřít ve výchozí aplikaci'}</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Enter</span>
          </button>

          {singleAsset?.fullPath && (
            <button
              onClick={() => {
                onClose();
                onRevealInExplorer(singleAsset.fullPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-zinc-400" />
                <span>Zobrazit v Průzkumníku</span>
              </div>
            </button>
          )}

          {isFolderAsset && singleAsset?.fullPath && onToggleFavorite && (
            <button
              onClick={() => {
                onClose();
                onToggleFavorite(singleAsset.fullPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Win11Star className="w-4 h-4" />
                <span>
                  {favoriteFolders?.includes(singleAsset.fullPath)
                    ? 'Odebrat z oblíbených'
                    : 'Přidat do oblíbených'}
                </span>
              </div>
            </button>
          )}
          {singleAsset?.fullPath && onOpenTerminal && (
            <button
              onClick={() => {
                onClose();
                onOpenTerminal(singleAsset.fullPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span>{isFolderAsset ? 'Otevřít v terminálu' : 'Otevřít terminál ve složce'}</span>
              </div>
            </button>
          )}

          <div className="h-px bg-white/[0.08] my-1" />

          {/* Cut / Copy */}
          <button
            onClick={() => {
              onClose();
              onCut(targetPaths);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Scissors className="w-4 h-4 text-zinc-400" />
              <span>Vyjmout</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+X</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onCopy(targetPaths);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-zinc-400" />
              <span>Kopírovat</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+C</span>
          </button>

          {/* Paste into selected folder if it's a directory, or into current directory */}
          {destFolder && (
            <button
              disabled={!canPaste}
              onClick={() => {
                onClose();
                const targetDir = isFolderAsset && singleAsset?.fullPath ? singleAsset.fullPath : destFolder;
                if (targetDir) onPaste(targetDir);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none transition-colors ${
                canPaste
                  ? 'hover:bg-white/[0.08] hover:text-white cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardPaste className="w-4 h-4 text-zinc-400" />
                <span>{isFolderAsset ? 'Vložit do této složky' : 'Vložit'}</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Ctrl+V</span>
            </button>
          )}

          {targetPaths.length === 1 && (
            <button
              onClick={() => {
                onClose();
                onCopyPath(targetPaths[0]);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Link className="w-4 h-4 text-zinc-400" />
                <span>Kopírovat celou cestu</span>
              </div>
            </button>
          )}

          <div className="h-px bg-white/[0.08] my-1" />

          {/* Rename */}
          <button
            onClick={() => {
              onClose();
              onRename(target);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Edit3 className="w-4 h-4 text-zinc-400" />
              <span>{selectedList.length > 1 ? 'Dávkově přejmenovat...' : 'Přejmenovat'}</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">F2</span>
          </button>

          {/* Delete to Recycle Bin */}
          <button
            onClick={() => {
              onClose();
              onDelete(targetPaths, targetNames);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none text-rose-300 hover:bg-rose-500/20 hover:text-rose-100 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-400 group-hover:text-rose-300" />
              <span>Přesunout do Koše</span>
            </div>
            <span className="text-[10px] text-rose-400/70 font-mono">Del</span>
          </button>

          {singleAsset?.fullPath && (
            <>
              <div className="h-px bg-white/[0.08] my-1" />
              <button
                onClick={() => {
                  onClose();
                  onShowProperties?.(singleAsset.fullPath!);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-zinc-400" />
                  <span>Vlastnosti</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Alt+Enter</span>
              </button>
            </>
          )}
        </>
      )}

      {/* --- CASE B: Empty Area / Background --- */}
      {isBackground && (
        <>
          {destFolder && (
            <button
              onClick={() => {
                onClose();
                onRevealInExplorer(destFolder);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-zinc-400" />
                <span>Otevřít složku v Průzkumníku</span>
              </div>
            </button>
          )}

          {destFolder && onOpenTerminal && (
            <button
              onClick={() => {
                onClose();
                onOpenTerminal(destFolder);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span>Otevřít v terminálu</span>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onRefresh();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-zinc-400" />
              <span>Aktualizovat</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">F5</span>
          </button>

          <div className="h-px bg-white/[0.08] my-1" />

          {destFolder && (
            <button
              onClick={() => {
                onClose();
                onCreateFolder(destFolder);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 font-medium text-white/90">
                <FolderPlus className="w-4 h-4 text-[#e2e4e9]" />
                <span>Nová složka</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+N</span>
            </button>
          )}

          <button
            disabled={!canPaste}
            onClick={() => {
              onClose();
              if (destFolder) onPaste(destFolder);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none transition-colors ${
              canPaste
                ? 'hover:bg-white/[0.08] hover:text-white cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardPaste className="w-4 h-4 text-zinc-400" />
              <span>Vložit</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+V</span>
          </button>

          {onSelectAll && (
            <>
              <div className="h-px bg-white/[0.08] my-1" />
              <button
                onClick={() => {
                  onClose();
                  onSelectAll();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-zinc-400" />
                  <span>Vybrat vše</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Ctrl+A</span>
              </button>
            </>
          )}
        </>
      )}

      {/* --- CASE C: Folder in Tree --- */}
      {isFolderTreeTarget && (
        <>
          <button
            onClick={() => {
              onClose();
              onOpen(target);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <FolderOpen className="w-4 h-4 text-[#e2e4e9]" />
              <span>Otevřít</span>
            </div>
          </button>

          {target.folderPath && (
            <button
              onClick={() => {
                onClose();
                onRevealInExplorer(target.folderPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <ExternalLink className="w-4 h-4 text-zinc-400" />
                <span>Zobrazit v Průzkumníku</span>
              </div>
            </button>
          )}

          {target.folderPath && onToggleFavorite && (
            <button
              onClick={() => {
                onClose();
                onToggleFavorite(target.folderPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Win11Star className="w-4 h-4" />
                <span>
                  {favoriteFolders?.includes(target.folderPath)
                    ? 'Odebrat z oblíbených'
                    : 'Přidat do oblíbených'}
                </span>
              </div>
            </button>
          )}
          {target.folderPath && onOpenTerminal && (
            <button
              onClick={() => {
                onClose();
                onOpenTerminal(target.folderPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span>Otevřít v terminálu</span>
              </div>
            </button>
          )}

          <div className="h-px bg-white/[0.08] my-1" />

          {target.folderPath && (
            <button
              onClick={() => {
                onClose();
                onCreateFolder(target.folderPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FolderPlus className="w-4 h-4 text-[#e2e4e9]" />
                <span>Nová podsložka</span>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              onCopy(targetPaths);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-zinc-400" />
              <span>{targetPaths.length > 1 ? `Kopírovat složky (${targetPaths.length})` : 'Kopírovat složku'}</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+C</span>
          </button>

          <button
            disabled={!canPaste}
            onClick={() => {
              onClose();
              if (destFolder) onPaste(destFolder);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none transition-colors ${
              canPaste
                ? 'hover:bg-white/[0.08] hover:text-white cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardPaste className="w-4 h-4 text-zinc-400" />
              <span>Vložit sem</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+V</span>
          </button>

          {target.folderPath && (
            <button
              onClick={() => {
                onClose();
                onCopyPath(target.folderPath!);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Link className="w-4 h-4 text-zinc-400" />
                <span>Kopírovat cestu</span>
              </div>
            </button>
          )}

          <div className="h-px bg-white/[0.08] my-1" />

          <button
            onClick={() => {
              onClose();
              onRename(target);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Edit3 className="w-4 h-4 text-zinc-400" />
              <span>Přejmenovat složku</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">F2</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onDelete(targetPaths, targetNames);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-left rounded-none text-rose-300 hover:bg-rose-500/20 hover:text-rose-100 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-400 group-hover:text-rose-300" />
              <span>{targetPaths.length > 1 ? `Přesunout ${targetPaths.length} složek do Koše` : 'Přesunout do Koše'}</span>
            </div>
            <span className="text-[10px] text-rose-400/70 font-mono">Del</span>
          </button>
        </>
      )}
    </div>
  );
};
