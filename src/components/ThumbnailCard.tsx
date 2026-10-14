import React from 'react';
import { motion } from 'motion/react';
import { AssetItem } from '../types';
import { formatBytes } from '../utils/localFileSystem';
import { Copy, Eye, FileText } from 'lucide-react';

interface ThumbnailCardProps {
  asset: AssetItem;
  isSelected: boolean;
  isFocused: boolean;
  thumbnailSize: number;
  fitMode: 'cover' | 'contain';
  showAllInfo: boolean;
  selectedIds: Set<string>;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onCopyPath: () => void;
  onCopyImage: () => void;
}

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  asset,
  isSelected,
  isFocused,
  thumbnailSize,
  fitMode,
  showAllInfo,
  selectedIds,
  onClick,
  onDoubleClick,
  onCopyPath,
  onCopyImage,
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    // If this item is part of a multi-selection, drag all selected items
    const idsToDrag =
      isSelected && selectedIds.size > 1 ? Array.from(selectedIds) : [asset.id];

    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ assetIds: idsToDrag })
    );
    e.dataTransfer.setData('text/plain', idsToDrag.join(','));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <motion.div
      draggable
      onDragStartCapture={handleDragStart}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.12, ease: 'easeOut' } }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group relative flex flex-col rounded-none transition-all duration-150 cursor-pointer select-none text-left overflow-hidden ${
        isSelected
          ? 'bg-[#332f2b] shadow-xl'
          : 'border ' + (isFocused
          ? 'bg-[#1e1c1a] border-white/20'
          : 'bg-[#181715] border-white/[0.06] hover:bg-[#201e1b] hover:border-white/[0.15]')
      }`}
      style={{
        width: `${thumbnailSize}px`,
      }}
    >
      {/* Thumbnail Image Container */}
      <div
        className="relative overflow-hidden bg-[#11100f] flex items-center justify-center rounded-none"
        style={{
          height: showAllInfo
            ? `${Math.round(thumbnailSize * 0.82)}px`
            : `${thumbnailSize}px`,
        }}
      >
        {/* Highly visible warm ivory tint overlay when selected */}
        {isSelected && (
          <div className="absolute inset-0 bg-[#ede8df]/30 z-15 pointer-events-none transition-opacity duration-150 flex items-start justify-end p-2">
            <div className="w-5 h-5 rounded-full bg-[#ede8df] text-[#111317] flex items-center justify-center shadow-lg font-bold text-xs">
              ✓
            </div>
          </div>
        )}

        <img
          src={asset.url}
          alt={asset.name}
          referrerPolicy="no-referrer"
          className={`w-full h-full rounded-none transition-transform duration-200 ease-out group-hover:scale-[1.02] ${
            fitMode === 'contain' ? 'object-contain p-2' : 'object-cover'
          }`}
          loading="lazy"
        />

        {/* Minimalist Bauhaus Format Tag */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-widest text-white/95 rounded-none bg-black/80 backdrop-blur-md border border-white/15 z-20">
          {asset.extension}
        </div>

        {/* Video Duration / Play Icon */}
        {asset.category === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none group-hover:bg-black/10 transition-colors z-10">
            <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
              <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
            </div>
            {asset.duration && (
              <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 text-[10px] font-mono bg-black/70 backdrop-blur-xs text-white/90 rounded border border-white/10">
                {Math.floor(asset.duration / 60)}:
                {String(Math.floor(asset.duration % 60)).padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        {/* Smooth Glass Hover Action Toolbar (at top/middle) */}
        <div className="absolute top-8 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          <button
            type="button"
            title="Rychlý náhled a zoom (Mezerník)"
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick();
            }}
            className="p-1.5 bg-black/70 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-none text-slate-200 hover:text-white transition-colors"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Kopírovat obrázek do schránky (Ctrl+C)"
            onClick={(e) => {
              e.stopPropagation();
              onCopyImage();
            }}
            className="p-1.5 bg-black/70 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-none text-slate-200 hover:text-white transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Kopírovat cestu k souboru"
            onClick={(e) => {
              e.stopPropagation();
              onCopyPath();
            }}
            className="p-1.5 bg-black/70 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-none text-slate-200 hover:text-white transition-colors"
          >
            <FileText className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Elegant Information Panel:
          - If showAllInfo is true: constantly visible docked beneath image
          - If showAllInfo is false: hidden until hovered, then overlays smoothly from bottom
      */}
      <div
        className={`p-2.5 flex flex-col justify-between gap-1 transition-all duration-200 select-none ${
          showAllInfo
            ? 'relative bg-[#0e1016] border-t border-white/[0.06] opacity-100'
            : 'absolute inset-x-0 bottom-0 bg-[#0a0c10]/95 backdrop-blur-md border-t border-white/15 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 z-30 shadow-2xl'
        }`}
      >
        <div
          className="text-xs font-medium text-white/95 truncate tracking-tight group-hover:text-white"
          title={asset.name}
        >
          {asset.name}
        </div>
        <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono tabular-nums">
          <span>{formatBytes(asset.size)}</span>
          <span>
            {asset.dimensions.width > 0
              ? `${asset.dimensions.width} × ${asset.dimensions.height}`
              : asset.format}
          </span>
        </div>
        {asset.exif.colorProfile && (
          <div className="text-[10px] text-[#ede8df] font-mono truncate">
            {asset.exif.colorProfile}
          </div>
        )}
      </div>
    </motion.div>
  );
};
