import React, { useState } from 'react';
import { FolderNode, FilterState } from '../types';
import { SavedDirectoryRecord } from '../utils/indexedDbStorage';
import {
  Folder,
  FolderOpen,
  RotateCcw,
  Upload,
  Star,
  X,
  Sparkles,
  HardDrive,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';

interface SidebarProps {
  folders: FolderNode[];
  activeFolder: string;
  onSelectFolder: (path: string) => void;
  favoriteFolders: string[];
  onToggleFavorite: (path: string) => void;
  onMoveAssets: (assetIds: string[], targetFolder: string) => void;
  filters: FilterState;
  onUpdateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters: () => void;
  onImportFiles: () => void;
  totalAssetsCount: number;
  width?: number;
  savedDirectories?: SavedDirectoryRecord[];
  onRescanDirectory?: (dir: SavedDirectoryRecord) => void;
  onRemoveSavedDirectory?: (id: string) => void;
  onOpenNativeFolder?: () => void;
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
  savedDirectories = [],
  onRescanDirectory,
  onRemoveSavedDirectory,
  onOpenNativeFolder,
}) => {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const isAnyFilterActive =
    filters.formatFilter !== null ||
    filters.orientationFilter !== 'all' ||
    filters.keywordFilter !== null;

  const categories = [
    { id: null, label: 'Všechny formáty' },
    { id: 'adobe-psd', label: 'Photoshop (.psd)' },
    { id: 'adobe-ai', label: 'Illustrator (.ai)' },
    { id: 'adobe-indd', label: 'InDesign (.indd)' },
    { id: 'adobe-ae', label: 'After Effects (.aep)' },
    { id: 'pdf', label: 'PDF dokumenty' },
    { id: 'image', label: 'Obrázky a fotografie' },
    { id: 'video', label: 'Videa a klipy' },
  ];

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

  const renderFolderItem = (node: FolderNode, level = 0) => {
    const isSelected = activeFolder === node.path;
    const isDragTarget = dragOverPath === node.path;
    const isFavorite = favoriteFolders.includes(node.path);

    return (
      <div key={node.id} className="flex flex-col">
        <div
          onDragOver={(e) => handleDragOver(e, node.path)}
          onDragLeave={(e) => handleDragLeave(e, node.path)}
          onDrop={(e) => handleDrop(e, node.path)}
          onClick={() => onSelectFolder(node.path)}
          className={`group flex items-center justify-between w-full py-2 pr-2 text-xs rounded-none transition-all duration-150 text-left border-l-2 cursor-pointer select-none ${
            isDragTarget
              ? 'bg-[#e2e4e9]/20 border-[#e2e4e9] text-white shadow-inner ring-1 ring-[#e2e4e9]/30'
              : isSelected
              ? 'bg-white/[0.08] border-[#e2e4e9] text-[#f4f4f5] font-medium'
              : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white'
          }`}
          style={{ paddingLeft: `${12 + level * 14}px` }}
        >
          <div className="flex items-center gap-2 truncate min-w-0">
            {isSelected ? (
              <FolderOpen className="w-4 h-4 text-[#e2e4e9] shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-zinc-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {isDragTarget ? (
              <span className="text-[10px] font-mono text-[#e2e4e9] font-bold">
                + Přesunout
              </span>
            ) : (
              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                {node.itemCount}
              </span>
            )}

            {/* Star toggle button for favorites */}
            {node.path !== '/' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(node.path);
                }}
                className={`p-1 transition-all rounded ${
                  isFavorite
                    ? 'text-[#e2e4e9] opacity-100'
                    : 'text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100'
                }`}
                title={isFavorite ? 'Odebrat z oblíbených' : 'Přidat složku do oblíbených'}
              >
                <Star
                  className={`w-3 h-3 ${isFavorite ? 'fill-[#e2e4e9]' : ''}`}
                />
              </button>
            )}
          </div>
        </div>

        {node.subfolders && node.subfolders.length > 0 && (
          <div className="flex flex-col mt-0.5 space-y-0.5">
            {node.subfolders.map((sub) => renderFolderItem(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="bg-[#16171a] border-r border-white/[0.06] flex flex-col h-full shrink-0 select-none overflow-y-auto"
    >
      {/* 1. FAVORITES SECTION (Oblíbené) */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
            <Star className="w-3 h-3 text-[#e2e4e9] fill-[#e2e4e9]" />
            Oblíbené složky
          </span>
          <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
            {favoriteFolders.length}
          </span>
        </div>

        {favoriteFolders.length === 0 ? (
          <div className="px-2 py-2 text-[11px] text-zinc-500 italic">
            Klikněte na hvězdičku u složky pro rychlý přístup
          </div>
        ) : (
          <div className="space-y-0.5">
            {favoriteFolders.map((favPath) => {
              const node = findFolderByPath(folders, favPath);
              const name = node ? node.name : getFolderName(favPath);
              const count = node ? node.itemCount : 0;
              const isSelected = activeFolder === favPath;
              const isDragTarget = dragOverPath === favPath;

              return (
                <div
                  key={favPath}
                  onDragOver={(e) => handleDragOver(e, favPath)}
                  onDragLeave={(e) => handleDragLeave(e, favPath)}
                  onDrop={(e) => handleDrop(e, favPath)}
                  onClick={() => onSelectFolder(favPath)}
                  className={`group flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded-none transition-all duration-150 border-l-2 cursor-pointer ${
                    isDragTarget
                      ? 'bg-[#e2e4e9]/20 border-[#e2e4e9] text-white ring-1 ring-[#e2e4e9]/30'
                      : isSelected
                      ? 'bg-white/[0.08] border-[#e2e4e9] text-[#f4f4f5] font-medium'
                      : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <Folder className="w-3.5 h-3.5 text-[#e2e4e9] shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {isDragTarget ? (
                      <span className="text-[10px] font-mono text-[#e2e4e9] font-bold">
                        + Přesunout
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                        {count}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(favPath);
                      }}
                      className="p-1 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Odebrat z oblíbených"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. SAVED LOCAL DIRECTORIES (IndexedDB) */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
            <HardDrive className="w-3 h-3 text-[#e2e4e9]" />
            Místní disky (IndexedDB)
          </span>
          {onOpenNativeFolder && (
            <button
              type="button"
              onClick={onOpenNativeFolder}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-none transition-colors"
              title="Otevřít novou složku z disku počítače"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {savedDirectories.length === 0 ? (
          <div className="px-2 py-1 text-[11px] text-zinc-500 italic">
            Klikněte na + pro výběr a připojení složky z vašeho disku
          </div>
        ) : (
          <div className="space-y-0.5">
            {savedDirectories.map((dir) => {
              const isSelected = activeFolder === dir.path;
              return (
                <div
                  key={dir.id}
                  onClick={() => onSelectFolder(dir.path)}
                  className={`group flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded-none transition-all duration-150 border-l-2 cursor-pointer ${
                    isSelected
                      ? 'bg-white/[0.08] border-[#e2e4e9] text-[#f4f4f5] font-medium'
                      : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <HardDrive className="w-3.5 h-3.5 text-[#e2e4e9] shrink-0" />
                    <span className="truncate">{dir.name}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {onRescanDirectory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRescanDirectory(dir);
                        }}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                        title="Znovu načíst soubory ze složky (Synchronizovat)"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                    {onRemoveSavedDirectory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSavedDirectory(dir.id);
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Odebrat z rychlého přístupu"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. MAIN FOLDER TREE HEADER */}
      <div className="p-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
          Knihovna & Složky
        </span>
        <button
          type="button"
          onClick={onImportFiles}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-none transition-colors"
          title="Importovat soubory z počítače"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Folders List */}
      <div className="p-2 space-y-0.5">
        {folders.map((folder) => renderFolderItem(folder))}
      </div>

      {/* 3. FORMAT CATEGORIES */}
      <div className="p-4 border-t border-white/[0.06] flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Formáty médií
          </span>
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-[11px] text-[#e2e4e9] hover:text-white flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {categories.map((cat) => {
            const isSelected = filters.formatFilter === cat.id;
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => onUpdateFilter('formatFilter', isSelected ? null : (cat.id as any))}
                className={`flex items-center justify-between w-full px-3 py-1.5 text-xs rounded-none transition-all text-left border-l-2 ${
                  isSelected
                    ? 'bg-white/[0.08] border-[#e2e4e9] text-[#f4f4f5] font-medium'
                    : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 bg-[#e2e4e9]" />}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
