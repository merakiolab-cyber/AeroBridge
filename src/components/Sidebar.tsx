import React, { useState } from 'react';
import { FolderNode, FilterState } from '../types';
import {
  Folder,
  FolderOpen,
  Star,
  X,
  Sparkles,
  HardDrive,
} from 'lucide-react';
import { NativeExplorerTree } from './NativeExplorerTree';
import { Win11Folder, Win11Star } from './Win11Icons';

interface SidebarProps {
  folders: FolderNode[];
  activeFolder: string;
  onSelectFolder: (path: string) => void;
  favoriteFolders: string[];
  onToggleFavorite: (path: string) => void;
  onMoveAssets: (assetIds: string[], targetFolder: string) => void;
  filters?: FilterState;
  onUpdateFilter?: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters?: () => void;
  onImportFiles: () => void;
  totalAssetsCount: number;
  width?: number;
  onOpenNativeFolder?: () => void;
  nativeActivePath?: string | null;
  onNavigateNative?: (path: string) => void;
  onContextMenuFolder?: (e: React.MouseEvent, folder: { name: string; path: string }, allSelectedPaths?: string[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  activeFolder,
  onSelectFolder,
  favoriteFolders,
  onToggleFavorite,
  onMoveAssets,
  filters,
  onUpdateFilter,
  onResetFilters,
  onImportFiles,
  totalAssetsCount,
  width = 260,
  onOpenNativeFolder,
  nativeActivePath = null,
  onNavigateNative,
  onContextMenuFolder,
}) => {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // Helper to extract clean human-friendly folder name
  const getFolderName = (path: string): string => {
    if (path === '/') return 'Všechny soubory';
    const parts = path.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? last.replace(/^[0-9]+\.\s*/, '') : path;
  };

  const findFolderByPath = (nodes: FolderNode[], path: string): FolderNode | null => {
    for (const n of nodes) {
      if (n.path === path) return n;
      if (n.subfolders) {
        const found = findFolderByPath(n.subfolders, path);
        if (found) return found;
      }
    }
    return null;
  };

  // Drag and drop handlers for folders
  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPath !== path) {
      setDragOverPath(path);
    }
  };

  const handleDragLeave = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverPath === path) {
      setDragOverPath(null);
    }
  };

  const handleDrop = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    // Try reading JSON array of asset IDs
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.assetIds && Array.isArray(parsed.assetIds)) {
          onMoveAssets(parsed.assetIds, path);
          return;
        }
      }
    } catch {
      // ignore JSON parse error
    }

    const plain = e.dataTransfer.getData('text/plain');
    if (plain) {
      const ids = plain.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        onMoveAssets(ids, path);
      }
    }
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-[#16171a] border-r border-white/[0.06] flex flex-col h-full shrink-0 select-none overflow-y-auto"
    >
      {/* 0. NATIVE FILE EXPLORER (desktop only): places + drives */}
      {onNavigateNative ? (
        <NativeExplorerTree
          activePath={nativeActivePath}
          onNavigate={onNavigateNative}
          onContextMenu={onContextMenuFolder}
          favoriteFolders={favoriteFolders}
          onToggleFavorite={onToggleFavorite}
          onMoveAssets={onMoveAssets}
        />
      ) : (
        <div className="border-b border-white/[0.06] p-3 bg-white/[0.02]">
          <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5 mb-2">
            <HardDrive className="w-3.5 h-3.5 text-[#e2e4e9]" />
            Tento počítač (Disky)
          </div>
          <div className="p-2.5 bg-black/40 border border-white/[0.08] text-[11px] text-zinc-400 space-y-2">
            <p className="leading-relaxed">
              Pro přímé procházení disků <span className="text-[#e2e4e9] font-mono font-medium">C:\, D:\</span> jako v Adobe Bridge spusťte aplikaci v desktopovém režimu:
            </p>
            <div className="font-mono text-[10px] bg-white/[0.06] p-1.5 text-[#e2e4e9] border border-white/10 select-all rounded-xs">
              npm run desktop:dev
            </div>
            {onOpenNativeFolder && (
              <button
                type="button"
                onClick={onOpenNativeFolder}
                className="w-full mt-1 py-1.5 px-2 bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                title="Vybrat a otevřít libovolnou složku z počítače"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#e2e4e9]" />
                Otevřít složku z disku...
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
