import React, { useRef } from 'react';
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

  const activeIndex = assets.findIndex((a) => a.id === selectedId);
  const currentAsset = activeIndex >= 0 ? assets[activeIndex] : assets[0] || null;

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
          src={currentAsset.url}
          alt={currentAsset.name}
          enableOverlayControls={true}
        />

        {/* Floating Minimal Info Overlay at Top */}
        <div className="absolute top-5 inset-x-8 flex items-center justify-between pointer-events-none z-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            key={currentAsset.id}
            className="pointer-events-auto flex items-center gap-2.5 bg-[#12141c]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs text-white shadow-xl"
          >
            <span className="px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold tracking-widest bg-black/80 text-white/90 border border-white/10">
              {currentAsset.extension}
            </span>
            <span className="font-medium truncate max-w-sm">{currentAsset.name}</span>
            <span className="text-slate-400 font-mono text-[11px] tabular-nums">
              · {currentAsset.dimensions.width} × {currentAsset.dimensions.height} · <span className="text-[#e2e4e9] font-mono font-medium">{currentAsset.exif.colorProfile || 'sRGB IEC61966-2.1'}</span>
            </span>
          </motion.div>

          <div className="pointer-events-auto flex items-center gap-1.5 bg-[#12141c]/80 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-xl">
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
          className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 disabled:opacity-15 disabled:pointer-events-none backdrop-blur-md transition-all shadow-xl hover:scale-105"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={activeIndex >= assets.length - 1}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 disabled:opacity-15 disabled:pointer-events-none backdrop-blur-md transition-all shadow-xl hover:scale-105"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Horizontal Bottom Filmstrip Carousel */}
      <div
        ref={filmstripRef}
        className="h-28 bg-[#0d0f14] border-t border-white/[0.06] px-6 py-3 flex items-center gap-3 overflow-x-auto shrink-0 select-none"
      >
        {assets.map((asset) => {
          const isCurrent = asset.id === currentAsset.id;
          return (
            <motion.div
              key={asset.id}
              whileHover={{ y: -2 }}
              onClick={() => onSelect(asset.id)}
              className={`h-full aspect-4/3 rounded-none overflow-hidden relative cursor-pointer shrink-0 transition-all ${
                isCurrent
                  ? 'ring-1 ring-[#e2e4e9] scale-102 bg-[#161922] shadow-lg'
                  : 'border border-white/[0.08] opacity-60 hover:opacity-100 bg-[#111319]'
              }`}
            >
              <img
                src={asset.url}
                alt={asset.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-none"
                loading="lazy"
              />
              <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-widest text-white/90 bg-black/80 rounded-none border border-white/10">
                {asset.extension}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
