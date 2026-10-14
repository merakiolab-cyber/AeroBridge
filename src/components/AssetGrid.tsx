import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssetItem } from '../types';
import { ThumbnailCard } from './ThumbnailCard';
import { Layers, Sparkles } from 'lucide-react';

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
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
  isDragOver: boolean;
  showAllInfo?: boolean;
  activeFolder?: string;
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
  onCopyPath,
  onCopyImage,
  isDragOver,
  showAllInfo = false,
  activeFolder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (assets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-stone-500 select-none bg-[#131211]">
        <div className="w-16 h-16 rounded-none bg-[#1c1b18] border border-white/[0.06] flex items-center justify-center mb-4 text-stone-400 shadow-xl">
          <Layers className="w-8 h-8 opacity-50 text-[#ede8df]" />
        </div>
        <h3 className="text-sm font-semibold text-stone-300 mb-1">
          Žádné soubory k zobrazení
        </h3>
        <p className="text-xs text-stone-500 max-w-sm mb-4">
          Zkuste změnit filtry vyhledávání nebo přetáhněte složku ze svého počítače.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-[#131211] relative overflow-hidden select-none outline-hidden"
      tabIndex={0}
    >
      {/* Main Grid Viewport */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Drop zone overlay in Ivory Bauhaus style */}
        {isDragOver && (
          <div className="absolute inset-0 z-40 bg-[#ede8df]/5 border border-dashed border-[#ede8df] m-4 rounded-none flex items-center justify-center backdrop-blur-xs pointer-events-none">
            <div className="bg-[#1e1d1a] px-6 py-4 rounded-none border border-[#ede8df]/40 text-center shadow-2xl">
              <Sparkles className="w-8 h-8 text-[#ede8df] mx-auto mb-2 animate-bounce" />
              <span className="text-sm font-semibold text-[#ede8df]">
                Pusťte složky nebo soubory pro okamžité offline načtení
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Responsive Grid with smooth fluid rendering */}
        <motion.div
          key={activeFolder || 'all'}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="flex flex-wrap gap-4 items-start content-start"
        >
          {assets.map((asset) => (
            <ThumbnailCard
              key={asset.id}
              asset={asset}
              isSelected={selectedIds.has(asset.id)}
              isFocused={focusedId === asset.id}
              thumbnailSize={thumbnailSize}
              fitMode={fitMode}
              showAllInfo={showAllInfo}
              selectedIds={selectedIds}
              onClick={(e) => onSelect(asset.id, e)}
              onDoubleClick={() => onOpenQuickLook(asset.id)}
              onCopyPath={() => onCopyPath(asset)}
              onCopyImage={() => onCopyImage(asset)}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
};
