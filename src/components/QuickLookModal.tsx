import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { AssetItem } from '../types';
import { formatBytes } from '../utils/localFileSystem';
import { ZoomableCanvas } from './ZoomableCanvas';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
} from 'lucide-react';

interface QuickLookModalProps {
  asset: AssetItem | null;
  assets: AssetItem[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  asset,
  assets,
  isOpen,
  onClose,
  onNavigate,
  onCopyPath,
  onCopyImage,
}) => {
  const [direction, setDirection] = useState<number>(0);
  const prevIndexRef = useRef<number>(-1);

  const currentIndex = asset ? assets.findIndex((a) => a.id === asset.id) : -1;

  // Track flip direction (1 for next, -1 for prev)
  useEffect(() => {
    if (currentIndex >= 0) {
      if (prevIndexRef.current >= 0) {
        if (currentIndex > prevIndexRef.current) {
          setDirection(1);
        } else if (currentIndex < prevIndexRef.current) {
          setDirection(-1);
        }
      } else {
        setDirection(0);
      }
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDirection(-1);
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDirection(1);
        onNavigate('next');
      } else if (asset) {
        if (e.key.toLowerCase() === 'c' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onCopyImage(asset);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, asset, onClose, onNavigate, onCopyImage]);

  if (!isOpen || !asset) return null;

  const slideVariants: Variants = {
    enter: (dir: number) => ({
      x: dir === 0 ? 0 : dir > 0 ? 140 : -140,
      opacity: 0,
      scale: 0.96,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 320, damping: 32 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      },
    },
    exit: (dir: number) => ({
      x: dir === 0 ? 0 : dir > 0 ? -140 : 140,
      opacity: 0,
      scale: 0.96,
      transition: {
        x: { type: 'spring', stiffness: 320, damping: 32 },
        opacity: { duration: 0.18 },
        scale: { duration: 0.18 },
      },
    }),
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl select-none overflow-hidden"
        onClick={onClose}
      >
        {/* Fullscreen Edge-to-Edge Image Canvas with Smooth Directional Slide */}
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence custom={direction} mode="popLayout" initial={false}>
            <motion.div
              key={asset.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 flex items-center justify-center will-change-transform"
            >
              <ZoomableCanvas
                src={asset.url}
                alt={asset.name}
                enableOverlayControls={true}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Minimal Info Pill (Top Left - Floating, Zero Stripe) */}
        <motion.div
          key={`info-${asset.id}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute top-6 left-6 z-20 flex items-center gap-3 bg-[#11131a]/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-widest text-white/95 bg-black/80 rounded-none border border-white/10">
            {asset.extension}
          </span>
          <span className="text-xs font-medium text-white truncate max-w-xs sm:max-w-md">
            {asset.name}
          </span>
          <span className="text-xs text-zinc-300 font-mono tabular-nums">
            · {asset.dimensions.width} × {asset.dimensions.height} · <span className="text-[#e2e4e9] font-mono font-medium">{asset.exif.colorProfile || 'sRGB IEC61966-2.1'}</span> · {formatBytes(asset.size)}
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            ({currentIndex + 1}/{assets.length})
          </span>
        </motion.div>

        {/* Floating Action Buttons (Top Right - Floating, Zero Stripe) */}
        <div
          className="absolute top-6 right-6 z-20 flex items-center gap-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onCopyImage(asset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#11131a]/80 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md border border-white/10 shadow-2xl transition-all hover:scale-102"
            title="Kopírovat obrázek do schránky (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Kopírovat</span>
          </button>
          <button
            type="button"
            onClick={() => onCopyPath(asset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#11131a]/80 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md border border-white/10 shadow-2xl transition-all hover:scale-102"
            title="Kopírovat cestu k souboru"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Cesta</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#11131a]/80 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md border border-white/10 shadow-2xl transition-all hover:scale-105 ml-1"
            title="Zavřít náhled (Esc nebo Mezerník)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtle Previous & Next Navigation Buttons */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDirection(-1);
            onNavigate('prev');
          }}
          disabled={currentIndex <= 0}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 disabled:opacity-0 disabled:pointer-events-none transition-all hover:scale-108 backdrop-blur-md shadow-2xl pointer-events-auto active:scale-95"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDirection(1);
            onNavigate('next');
          }}
          disabled={currentIndex >= assets.length - 1}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center border border-white/10 disabled:opacity-0 disabled:pointer-events-none transition-all hover:scale-108 backdrop-blur-md shadow-2xl pointer-events-auto active:scale-95"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
