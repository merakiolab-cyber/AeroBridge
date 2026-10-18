import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { AssetItem } from '../types';
import { ThumbnailCard } from './ThumbnailCard';
import { Layers, Sparkles } from 'lucide-react';
import { isDesktopApp, startNativeFileDrag } from '../utils/tauriBridge';

interface AssetGridProps {
  assets: AssetItem[];
  selectedIds: Set<string>;
  focusedId: string | null;
  thumbnailSize: number;
  onThumbnailSizeChange: (size: number) => void;
  fitMode: 'cover' | 'contain';
  onFitModeToggle?: () => void;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onOpenQuickLook: (id: string) => void;
  onOpenAsset?: (asset: AssetItem) => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
  isDragOver: boolean;
  showAllInfo?: boolean;
  activeFolder?: string;
  onNavigateFolder?: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, asset?: AssetItem) => void;
  onPageChange?: (assetId: string, pageNum: number) => void;
  onMoveAssets?: (idsOrPaths: string[], targetFolder: string, isCopy?: boolean) => void;
}

export const AssetGrid: React.FC<AssetGridProps> = ({
  assets,
  selectedIds,
  focusedId,
  thumbnailSize,
  onThumbnailSizeChange,
  fitMode,
  onSelect,
  onOpenQuickLook,
  onOpenAsset,
  onCopyPath,
  onCopyImage,
  isDragOver,
  showAllInfo = false,
  activeFolder,
  onNavigateFolder,
  onContextMenu,
  onPageChange,
  onMoveAssets,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Viewport dimensions for virtualized grid calculation
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [scrollTop, setScrollTop] = useState(0);

  // Measure viewport size
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset scroll position on folder change
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [activeFolder]);

  // Ctrl / Cmd + MouseWheel to dynamically resize thumbnails in real time (Finder / Bridge style)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelResize = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const step = delta > 0 ? 15 : -15;
        const newSize = Math.min(Math.max(thumbnailSize + step, 100), 460);
        onThumbnailSizeChange(newSize);
      }
    };

    container.addEventListener('wheel', handleWheelResize, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelResize);
    };
  }, [thumbnailSize, onThumbnailSizeChange]);

  // Virtualization constants
  const GAP = 16;
  const PADDING_X = 48; // 24px left + 24px right (p-6)
  const itemWidth = thumbnailSize;
  const itemHeight = showAllInfo ? Math.round(thumbnailSize * 0.82) + 76 : thumbnailSize;
  const rowHeight = itemHeight + GAP;

  // Compute number of columns that fit horizontally
  const availableWidth = Math.max(itemWidth, dimensions.width - PADDING_X);
  const columns = Math.max(1, Math.floor((availableWidth + GAP) / (itemWidth + GAP)));
  const totalRows = Math.ceil(assets.length / columns);
  const totalHeight = totalRows * rowHeight;

  // Handle scroll events with RAF throttling for high-frame-rate rendering
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Compute visible range with 2-row overscan before and after
  const { startRow, endRow, visibleAssets, offsetTop } = useMemo(() => {
    if (assets.length === 0) {
      return { startRow: 0, endRow: 0, visibleAssets: [], offsetTop: 0 };
    }

    // Always render all directly if 60 items or fewer for zero overhead
    if (assets.length <= 60) {
      return {
        startRow: 0,
        endRow: totalRows,
        visibleAssets: assets,
        offsetTop: 0,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
    const end = Math.min(totalRows - 1, Math.ceil((scrollTop + dimensions.height) / rowHeight) + 2);
    const startIndex = start * columns;
    const endIndex = Math.min(assets.length, (end + 1) * columns);

    return {
      startRow: start,
      endRow: end,
      visibleAssets: assets.slice(startIndex, endIndex),
      offsetTop: start * rowHeight,
    };
  }, [assets, scrollTop, rowHeight, totalRows, dimensions.height, columns]);

  // Auto-scroll viewport into view when focusedId changes (e.g. keyboard arrow navigation)
  useEffect(() => {
    if (!focusedId || !viewportRef.current) return;
    const index = assets.findIndex((a) => a.id === focusedId);
    if (index === -1) return;

    const itemRow = Math.floor(index / columns);
    const itemTop = itemRow * rowHeight;
    const itemBottom = itemTop + rowHeight;
    const currentScrollTop = viewportRef.current.scrollTop;
    const viewHeight = dimensions.height;

    if (itemTop < currentScrollTop) {
      viewportRef.current.scrollTop = itemTop;
    } else if (itemBottom > currentScrollTop + viewHeight - 24) {
      viewportRef.current.scrollTop = itemBottom - viewHeight + 24;
    }
  }, [focusedId, assets, columns, rowHeight, dimensions.height]);

  const handleDragStart = useCallback(
    (asset: AssetItem, e: React.DragEvent) => {
      const isSelected = selectedIds.has(asset.id);
      const itemsToDrag = isSelected && selectedIds.size > 1
        ? assets.filter((a) => selectedIds.has(a.id))
        : [asset];
      const paths = itemsToDrag.map((a) => a.fullPath).filter(Boolean) as string[];
      const ids = itemsToDrag.map((a) => a.id);

      if (isDesktopApp() && paths.length > 0) {
        e.preventDefault();
        const icon = asset.url?.startsWith('data:image/png;base64,') ? asset.url : undefined;
        void startNativeFileDrag(paths, icon);
        return;
      }

      e.dataTransfer.setData('application/json', JSON.stringify({ assetIds: ids, paths }));
      e.dataTransfer.setData('text/plain', paths.length > 0 ? paths.join('\r\n') : ids.join(','));
      e.dataTransfer.effectAllowed = 'copyMove';
    },
    [selectedIds, assets]
  );

  const handleDropOnFolder = useCallback(
    (e: React.DragEvent, targetFolderPath: string) => {
      const isCopy = e.ctrlKey;
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = (parsed.paths && parsed.paths.length > 0) ? parsed.paths : parsed.assetIds;
          if (items && Array.isArray(items) && items.length > 0) {
            onMoveAssets?.(items, targetFolderPath, isCopy);
            return;
          }
        }
      } catch {}

      const plain = e.dataTransfer.getData('text/plain');
      if (plain) {
        const items = plain.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (items.length > 0) {
          onMoveAssets?.(items, targetFolderPath, isCopy);
          return;
        }
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filePaths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const p = (file as unknown as { path?: string }).path;
          if (p) filePaths.push(p);
        }
        if (filePaths.length > 0) {
          onMoveAssets?.(filePaths, targetFolderPath, isCopy);
          return;
        }
      }
    },
    [onMoveAssets]
  );

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-500 select-none bg-[#121316]">
        <div className="w-16 h-16 rounded-none bg-[#1c1e22] border border-white/[0.06] flex items-center justify-center mb-4 text-zinc-400 shadow-xl">
          <Layers className="w-8 h-8 opacity-50 text-[#e2e4e9]" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-1">
          Žádné soubory k zobrazení
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm mb-4">
          Zkuste změnit filtry vyhledávání nebo přetáhněte složku ze svého počítače.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-[#121316] relative overflow-hidden select-none outline-hidden"
      tabIndex={0}
    >
      {/* Main Virtualized Grid Viewport */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        onContextMenu={(e) => {
          // If clicked directly on the viewport, the spacer canvas or empty area
          e.preventDefault();
          onContextMenu?.(e, undefined);
        }}
        className="flex-1 overflow-y-auto p-6"
      >
        {/* Drop zone overlay in Material surface style */}
        {isDragOver && (
          <div className="absolute inset-0 z-40 bg-sky-500/10 m-4 rounded-3xl flex items-center justify-center backdrop-blur-sm pointer-events-none transition-all">
            <div className="bg-[#1e2028] px-8 py-5 rounded-2xl text-center shadow-2xl">
              <Sparkles className="w-8 h-8 text-sky-400 mx-auto mb-2 animate-bounce" />
              <span className="text-sm font-semibold text-zinc-200">
                Pusťte složky nebo soubory pro okamžité offline načtení
              </span>
            </div>
          </div>
        )}

        {/* Outer virtualized scroll canvas with exact height */}
        <div
          className="relative w-full"
          style={{ height: `${Math.max(totalHeight, dimensions.height)}px` }}
        >
          {/* Inner visible rows placed with hardware accelerated translation */}
          <div
            className="absolute left-0 right-0 grid gap-4 content-start"
            style={{
              top: `${offsetTop}px`,
              gridTemplateColumns: `repeat(${columns}, ${thumbnailSize}px)`,
            }}
          >
            {visibleAssets.map((asset) => (
              <ThumbnailCard
                key={asset.id}
                asset={asset}
                isSelected={selectedIds.has(asset.id)}
                isFocused={focusedId === asset.id}
                thumbnailSize={thumbnailSize}
                fitMode={fitMode}
                showAllInfo={showAllInfo}
                onDragStart={handleDragStart}
                onClick={(e) => onSelect(asset.id, e)}
                onDoubleClick={() => {
                  if (asset.isFolder && onNavigateFolder && asset.fullPath) {
                    onNavigateFolder(asset.fullPath);
                  } else if (onOpenAsset) {
                    onOpenAsset(asset);
                  } else {
                    onOpenQuickLook(asset.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu?.(e, asset);
                }}
                onCopyPath={() => onCopyPath(asset)}
                onCopyImage={() => onCopyImage(asset)}
                onPageChange={onPageChange}
                onDropOnFolder={handleDropOnFolder}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
