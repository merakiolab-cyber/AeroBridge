import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AssetItem } from '../types';
import { formatBytes } from '../utils/localFileSystem';
import { ZoomableCanvas } from './ZoomableCanvas';
import {
  Maximize2,
  Copy,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { getResolutionInfo } from '../utils/extractors';
import { toDesktopAssetUrl } from '../utils/tauriBridge';
import { FileTypeBadge } from './AppIcons';

interface FilmstripViewProps {
  assets: AssetItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenQuickLook: (id: string) => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
}

export const FilmstripView: React.FC<FilmstripViewProps> = ({
  assets,
  selectedId,
  onSelect,
  onOpenQuickLook,
  onCopyPath,
  onCopyImage,
}) => {
  const filmstripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLDivElement>(null);
  const [filmstripScale, setFilmstripScale] = useState<number>(1);

  // Mouse drag-to-scroll & wheel pan for bottom filmstrip
  const isDraggingStripRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isStripDragging, setIsStripDragging] = useState(false);

  const activeIndex = assets.findIndex((a) => a.id === selectedId);
  const currentAsset = activeIndex >= 0 ? assets[activeIndex] : assets[0] || null;

  // Keep active thumbnail visible in horizontal carousel
  useEffect(() => {
    if (activeThumbRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentAsset?.id]);

  // Convert vertical mouse wheel to horizontal scroll on the bottom filmstrip
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        strip.scrollLeft += e.deltaY;
      }
    };

    strip.addEventListener('wheel', onWheel, { passive: false });
    return () => strip.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left mouse button only
    const strip = filmstripRef.current;
    if (!strip) return;

    isDraggingStripRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    scrollStartXRef.current = strip.scrollLeft;
    setIsStripDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStripRef.current) return;
    const strip = filmstripRef.current;
    if (!strip) return;

    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 4) {
      hasDraggedRef.current = true;
    }
    strip.scrollLeft = scrollStartXRef.current - deltaX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStripRef.current) return;
    isDraggingStripRef.current = false;
    setIsStripDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      onSelect(assets[activeIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (activeIndex < assets.length - 1) {
      onSelect(assets[activeIndex + 1].id);
    }
  };

  if (!currentAsset) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#090a0f] text-slate-500 text-xs">
        Žádná média pro zobrazení
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090a0f] select-none overflow-hidden">
      {/* Hero Canvas with Smooth Wheel Zoom */}
      <div className="flex-1 relative flex items-center justify-center min-h-0 bg-[#06070a] overflow-hidden">
        <ZoomableCanvas
          src={
            ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(
              (currentAsset.extension || '').toLowerCase().replace(/^\./, '')
            ) && currentAsset.fullPath
              ? toDesktopAssetUrl(currentAsset.fullPath)
              : currentAsset.url
          }
          alt={currentAsset.name}
          enableOverlayControls={true}
          preserveZoom={true}
          scale={filmstripScale}
          onScaleChange={setFilmstripScale}
          paddingClassName="p-4 md:p-6 pt-16 pb-16"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth > 0) {
              if (currentAsset.dimensions.width !== img.naturalWidth || currentAsset.dimensions.height !== img.naturalHeight) {
                currentAsset.dimensions = {
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                };
              }
            }
          }}
        />

        {/* Floating Minimal Info Overlay at Top */}
        <div className="absolute top-5 inset-x-8 flex items-center justify-between pointer-events-none z-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            key={currentAsset.id}
            className="pointer-events-auto flex items-center gap-2.5 bg-[#12141c]/85 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs text-white shadow-xl"
          >
            <FileTypeBadge
              extension={currentAsset.extension}
              size={18}
              badgeClassName="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide bg-black/70 text-white/90 shadow-sm"
            />
            <span className="font-medium truncate max-w-sm">{currentAsset.name}</span>
            <span className="text-slate-400 font-mono text-[11px] tabular-nums">
              {currentAsset.dimensions.width > 0 && (
                <>
                  · {currentAsset.dimensions.width} × {currentAsset.dimensions.height} ({getResolutionInfo(currentAsset.dimensions.width, currentAsset.dimensions.height, currentAsset.exif?.resolutionDpi).megapixelsFormatted}){' '}
                </>
              )}
              · <span className="text-zinc-300 font-mono font-medium">{currentAsset.exif.colorProfile || 'sRGB IEC61966-2.1'}</span>
            </span>
          </motion.div>

          <div className="pointer-events-auto flex items-center gap-1.5 bg-[#12141c]/85 backdrop-blur-md p-1 rounded-full shadow-xl">
            <button
              type="button"
              onClick={() => onCopyImage(currentAsset)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Kopírovat obrázek do schránky (Ctrl+C)"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onCopyPath(currentAsset)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Kopírovat cestu k souboru"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenQuickLook(currentAsset.id)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Celoobrazovkový náhled (Mezerník)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Left / Right Nav Chevrons */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={activeIndex <= 0}
          className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-15 disabled:pointer-events-none backdrop-blur-md transition-all shadow-xl hover:scale-105"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={activeIndex >= assets.length - 1}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-15 disabled:pointer-events-none backdrop-blur-md transition-all shadow-xl hover:scale-105"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Horizontal Bottom Filmstrip Carousel with Mouse Grab-to-Scroll & Wheel Pan */}
      <div
        ref={filmstripRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`h-28 bg-[#0c0d12] px-6 py-3 flex items-center gap-3 overflow-x-auto shrink-0 select-none border-t border-white/[0.06] transition-colors scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent ${
          isStripDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {assets.map((asset) => {
          const isCurrent = asset.id === currentAsset.id;
          return (
            <motion.div
              key={asset.id}
              ref={isCurrent ? activeThumbRef : undefined}
              whileHover={{ y: -2 }}
              onClick={() => {
                if (hasDraggedRef.current) return;
                onSelect(asset.id);
              }}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`h-full aspect-4/3 rounded-xl overflow-hidden relative shrink-0 transition-all ${
                isStripDragging ? 'cursor-grabbing' : 'cursor-pointer'
              } ${
                isCurrent
                  ? 'scale-105 bg-[#252834] shadow-xl shadow-black/50 ring-2 ring-[#e2e4e9]'
                  : 'opacity-70 hover:opacity-100 bg-[#16171d] shadow-sm hover:shadow-md'
              }`}
            >
              <img
                src={asset.url}
                alt={asset.name}
                referrerPolicy="no-referrer"
                draggable={false}
                className="w-full h-full object-cover rounded-xl pointer-events-none"
                loading="lazy"
              />
              <div className="absolute top-1.5 left-1.5 pointer-events-none">
                <FileTypeBadge
                  extension={asset.extension}
                  size={15}
                  badgeClassName="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wide text-white/90 bg-black/70 backdrop-blur-md rounded-md shadow-sm pointer-events-none"
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
