import React from 'react';
import { AssetItem } from '../types';
import { formatBytes } from '../utils/localFileSystem';
import { Copy, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Win11Folder } from './Win11Icons';
import { FileTypeBadge } from './AppIcons';
import { getNativeFileIcon } from '../utils/tauriBridge';

interface ThumbnailCardProps {
  asset: AssetItem;
  isSelected: boolean;
  isFocused: boolean;
  thumbnailSize: number;
  fitMode: 'cover' | 'contain';
  showAllInfo: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onCopyPath: () => void;
  onCopyImage: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onPageChange?: (assetId: string, pageNum: number) => void;
  onDragStart?: (asset: AssetItem, e: React.DragEvent) => void;
  onDropOnFolder?: (e: React.DragEvent, targetFolderPath: string) => void;
}

const ThumbnailCardComponent: React.FC<ThumbnailCardProps> = ({
  asset,
  isSelected,
  isFocused,
  thumbnailSize,
  fitMode,
  showAllInfo,
  onClick,
  onDoubleClick,
  onCopyPath,
  onCopyImage,
  onContextMenu,
  onPageChange,
  onDragStart,
  onDropOnFolder,
}) => {
  const fullFileName = React.useMemo(() => {
    if (asset.isFolder) return asset.name;
    if (!asset.extension) return asset.name;
    const ext = asset.extension.toLowerCase();
    if (asset.name.toLowerCase().endsWith('.' + ext)) {
      return asset.name;
    }
    return `${asset.name}.${ext}`;
  }, [asset.name, asset.extension, asset.isFolder]);

  const [hasImgError, setHasImgError] = React.useState(false);
  const [fallbackIcon, setFallbackIcon] = React.useState<string | null>(null);
  const [isDragTarget, setIsDragTarget] = React.useState(false);

  React.useEffect(() => {
    setHasImgError(false);
    setFallbackIcon(null);
    if (asset.isIcon || !asset.url) {
      getNativeFileIcon(asset.extension, !!asset.isFolder).then((icon) => {
        if (icon) setFallbackIcon(icon);
      });
    }
  }, [asset.url, asset.id, asset.isIcon, asset.extension, asset.isFolder]);

  const handleImageError = () => {
    if (hasImgError) return;
    setHasImgError(true);
    getNativeFileIcon(asset.extension, !!asset.isFolder).then((icon) => {
      if (icon) setFallbackIcon(icon);
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(asset, e);
    } else {
      e.dataTransfer.setData('application/json', JSON.stringify({ assetIds: [asset.id], paths: asset.fullPath ? [asset.fullPath] : [] }));
      e.dataTransfer.setData('text/plain', asset.fullPath || asset.id);
      e.dataTransfer.effectAllowed = 'copyMove';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!asset.isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    if (!isDragTarget) setIsDragTarget(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!asset.isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!asset.isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragTarget(false);
    const folderPath = asset.fullPath || asset.folder;
    if (folderPath && onDropOnFolder) {
      onDropOnFolder(e, folderPath);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDrag}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={`group relative flex flex-col rounded-xl transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer select-none text-left overflow-hidden will-change-transform ${
        isDragTarget
          ? 'ring-2 ring-[#60cdff] bg-[#60cdff]/20 shadow-2xl scale-[1.02]'
          : isSelected
          ? 'bg-[#2b303d] shadow-xl shadow-black/50'
          : isFocused
          ? 'bg-[#23252d] shadow-md shadow-black/30'
          : 'bg-[#18191f] shadow-sm shadow-black/20 hover:bg-[#22242c] hover:shadow-lg hover:shadow-black/40'
      }`}
      style={{
        width: `${thumbnailSize}px`,
      }}
    >
      {/* Drag Over Overlay on Folder */}
      {isDragTarget && (
        <div className="absolute inset-0 bg-[#60cdff]/25 backdrop-blur-xs z-30 flex items-center justify-center rounded-xl pointer-events-none">
          <span className="text-[11px] font-bold text-white bg-black/80 px-2.5 py-1 rounded-full shadow-lg border border-[#60cdff]/40">
            + Přesunout sem
          </span>
        </div>
      )}
      {/* Thumbnail Image Container */}
      <div
        className={`relative overflow-hidden bg-[#101115] flex items-center justify-center ${
          showAllInfo ? 'rounded-t-xl' : 'rounded-xl'
        }`}
        style={{
          height: showAllInfo
            ? `${Math.round(thumbnailSize * 0.82)}px`
            : `${thumbnailSize}px`,
        }}
      >
        {/* Material Selection indicator */}
        {isSelected && (
          <div className="absolute inset-0 bg-sky-500/10 z-15 pointer-events-none transition-opacity duration-150 flex items-start justify-end p-2.5">
            <div className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center shadow-md font-bold text-xs">
              ✓
            </div>
          </div>
        )}

        {asset.isFolder ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#131419] group-hover:bg-[#191a21] transition-colors relative">
            <div className="w-16 h-16 rounded-xl bg-white/[0.04] flex items-center justify-center mb-1 group-hover:scale-105 transition-all shadow-sm">
              <Win11Folder className="w-11 h-11 drop-shadow-md" />
            </div>
          </div>
        ) : (asset.isIcon || hasImgError || !asset.url) ? (
          <div className="w-full h-full flex items-center justify-center bg-[#131419] group-hover:bg-[#191a21] transition-colors p-4">
            {fallbackIcon || (asset.url && !hasImgError) ? (
              <img
                src={fallbackIcon || asset.url}
                alt={asset.name}
                draggable={false}
                className="object-contain max-w-[65%] max-h-[65%] drop-shadow-xl transition-transform duration-200 ease-out group-hover:scale-105"
                onError={handleImageError}
              />
            ) : null}
          </div>
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center overflow-hidden ${
              asset.extension.toLowerCase() === 'svg' ? 'bg-checkerboard p-2' : ''
            }`}
          >
            <img
              src={asset.url}
              alt={asset.name}
              referrerPolicy="no-referrer"
              onError={handleImageError}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth > 0 && asset.dimensions.width === 0) {
                  asset.dimensions.width = img.naturalWidth;
                  asset.dimensions.height = img.naturalHeight;
                }
              }}
              className={`w-full h-full ${showAllInfo ? 'rounded-t-xl' : 'rounded-xl'} transition-transform duration-200 ease-out group-hover:scale-[1.02] ${
                fitMode === 'contain' || asset.extension.toLowerCase() === 'svg' ? 'object-contain' : 'object-cover'
              }`}
              loading="lazy"
            />
          </div>
        )}

        {/* Material Format Pill + Multi-page indicator */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-20">
          <FileTypeBadge
            extension={asset.extension}
            size={thumbnailSize >= 200 ? 20 : 16}
          />
          {asset.pageCount && asset.pageCount > 1 && (
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold text-zinc-300 rounded-md bg-black/70 backdrop-blur-md shadow-sm">
              {asset.currentPage || 1}/{asset.pageCount}
            </span>
          )}
        </div>

        {/* Multi-page Scrubber Hover Toolbar for PDF */}
        {asset.pageCount && asset.pageCount > 1 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#14151b]/90 backdrop-blur-md px-2.5 py-1 rounded-full z-25 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg select-none"
          >
            <button
              type="button"
              disabled={(asset.currentPage || 1) <= 1}
              onClick={(e) => {
                e.stopPropagation();
                onPageChange?.(asset.id, (asset.currentPage || 1) - 1);
              }}
              className="p-1 text-zinc-300 hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer rounded-full hover:bg-white/10 transition-colors"
              title="Předchozí stránka"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-zinc-200">
              {asset.currentPage || 1}/{asset.pageCount}
            </span>
            <button
              type="button"
              disabled={(asset.currentPage || 1) >= asset.pageCount}
              onClick={(e) => {
                e.stopPropagation();
                onPageChange?.(asset.id, (asset.currentPage || 1) + 1);
              }}
              className="p-1 text-zinc-300 hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer rounded-full hover:bg-white/10 transition-colors"
              title="Další stránka"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Video Duration / Play Icon */}
        {asset.category === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none group-hover:bg-black/10 transition-colors z-10">
            <div className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
              <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[9px] border-l-white ml-0.5" />
            </div>
            {asset.duration && (
              <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 text-[10px] font-mono bg-black/75 backdrop-blur-xs text-white/90 rounded-md shadow-sm">
                {Math.floor(asset.duration / 60)}:
                {String(Math.floor(asset.duration % 60)).padStart(2, '0')}
              </span>
            )}
          </div>
        )}

        {/* Material Floating Action Toolbar */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          <button
            type="button"
            title="Rychlý náhled a zoom (Mezerník)"
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick();
            }}
            className="p-1.5 bg-[#14151b]/85 hover:bg-[#252733] backdrop-blur-md rounded-lg text-slate-200 hover:text-white transition-colors shadow-md"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Kopírovat obrázek do schránky (Ctrl+C)"
            onClick={(e) => {
              e.stopPropagation();
              onCopyImage();
            }}
            className="p-1.5 bg-[#14151b]/85 hover:bg-[#252733] backdrop-blur-md rounded-lg text-slate-200 hover:text-white transition-colors shadow-md"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Kopírovat cestu k souboru"
            onClick={(e) => {
              e.stopPropagation();
              onCopyPath();
            }}
            className="p-1.5 bg-[#14151b]/85 hover:bg-[#252733] backdrop-blur-md rounded-lg text-slate-200 hover:text-white transition-colors shadow-md"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Material Information Panel:
          - If showAllInfo is true: constantly visible docked beneath image as lower surface plane
          - If showAllInfo is false: hidden until hovered, then overlays smoothly from bottom
      */}
      <div
        className={`p-3 px-3.5 flex flex-col justify-between gap-1 transition-all duration-200 select-none ${
          showAllInfo
            ? 'relative bg-[#14151b] opacity-100 min-h-[72px] rounded-b-xl'
            : 'absolute inset-x-0 bottom-0 bg-[#14151b]/95 backdrop-blur-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 z-30 shadow-2xl rounded-b-xl'
        }`}
      >
        <div
          className="text-xs font-medium text-white/95 line-clamp-2 break-all tracking-tight leading-snug group-hover:text-white"
          title={fullFileName}
        >
          {fullFileName}
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums pt-0.5">
          <span>{asset.isFolder ? (asset.size > 0 ? formatBytes(asset.size) : 'Složka') : formatBytes(asset.size)}</span>
          <div className="flex items-center gap-1.5">
            {asset.dimensions.width > 0 && (
              <span>
                {asset.dimensions.width} × {asset.dimensions.height}
                {asset.dimensions.width * asset.dimensions.height >= 500_000 && (
                  <span className="text-zinc-500 ml-1">
                    ({((asset.dimensions.width * asset.dimensions.height) / 1_000_000).toFixed(1)} MP)
                  </span>
                )}
              </span>
            )}
            {asset.extension && (
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300 bg-white/[0.06] px-1.5 py-0.5 rounded">
                {asset.extension}
              </span>
            )}
          </div>
        </div>
        {asset.exif.colorProfile && (
          <div className="text-[10px] text-zinc-400 font-mono truncate">
            {asset.exif.colorProfile}
          </div>
        )}
      </div>
    </div>
  );
};

export const ThumbnailCard = React.memo(
  ThumbnailCardComponent,
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isFocused === next.isFocused &&
      prev.thumbnailSize === next.thumbnailSize &&
      prev.fitMode === next.fitMode &&
      prev.showAllInfo === next.showAllInfo &&
      prev.asset.id === next.asset.id &&
      prev.asset.url === next.asset.url &&
      prev.asset.name === next.asset.name &&
      prev.asset.size === next.asset.size &&
      prev.asset.isIcon === next.asset.isIcon &&
      prev.asset.currentPage === next.asset.currentPage &&
      prev.asset.pageCount === next.asset.pageCount
    );
  }
);
