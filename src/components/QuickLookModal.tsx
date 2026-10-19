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
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { isVisualAsset } from '../utils/adobeThumbnailExtractor';
import { getPdfDocInfo, renderPdfPage } from '../utils/pdfPreview';
import { getResolutionInfo } from '../utils/extractors';
import { toDesktopAssetUrl } from '../utils/tauriBridge';
import { useHiResPreview, previewReflectsDocumentSize } from '../utils/hiResPreview';
import { FileTypeBadge } from './AppIcons';

const directImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'];

function resolveFullAssetUrl(asset: AssetItem | null): string {
  if (!asset) return '';
  const ext = asset.extension ? asset.extension.toLowerCase().replace(/^\./, '') : '';
  if (directImageExtensions.includes(ext) && asset.fullPath) {
    return toDesktopAssetUrl(asset.fullPath);
  }
  return asset.url;
}

interface QuickLookModalProps {
  asset: AssetItem | null;
  assets: AssetItem[];
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
  onOpenFile?: (asset: AssetItem) => void;
  onPageChange?: (assetId: string, pageNum: number, url: string) => void;
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  asset,
  assets,
  isOpen,
  onClose,
  onNavigate,
  onCopyPath,
  onCopyImage,
  onOpenFile,
  onPageChange,
}) => {
  const [direction, setDirection] = useState<number>(0);
  const prevIndexRef = useRef<number>(-1);

  const isPdf = !!asset && (
    asset.category === 'pdf' ||
    asset.extension.toLowerCase() === 'pdf' ||
    asset.format.toLowerCase().includes('pdf') ||
    ((asset.extension.toLowerCase() === 'tif' || asset.extension.toLowerCase() === 'tiff') && (asset.pageCount || 1) > 1)
  );

  const [pdfPage, setPdfPage] = useState<number>(asset?.currentPage || 1);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(asset?.pageCount || 1);
  const [currentUrl, setCurrentUrl] = useState<string>(asset?.url || '');
  const [isPageRendering, setIsPageRendering] = useState(false);
  const [renderedDimensions, setRenderedDimensions] = useState<{ width: number; height: number } | null>(null);

  const hiResRaw = useHiResPreview(isOpen ? asset : null, 2400);
  // Never let a page-1 rendition shadow a page the user navigated to
  const hiRes = asset && pdfPage !== (asset.currentPage || 1) ? null : hiResRaw;

  const currentIndex = asset ? assets.findIndex((a) => a.id === asset.id) : -1;

  const activeWidth = asset && asset.dimensions.width > 0
    ? asset.dimensions.width
    : (renderedDimensions?.width || 0);
  const activeHeight = asset && asset.dimensions.height > 0
    ? asset.dimensions.height
    : (renderedDimensions?.height || 0);
  const resInfo = asset && activeWidth > 0
    ? getResolutionInfo(activeWidth, activeHeight, asset.exif?.resolutionDpi)
    : null;

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

  // Sync state when current asset changes
  useEffect(() => {
    if (!asset) return;
    setPdfPage(asset.currentPage || 1);
    setCurrentUrl(resolveFullAssetUrl(asset));
    setRenderedDimensions(null);

    if (isPdf) {
      getPdfDocInfo(asset).then((info) => {
        if (info && info.numPages) {
          setPdfTotalPages(info.numPages);
        }
      });
    }
  }, [asset?.id, asset?.url, isPdf]);

  const goToPdfPage = async (page: number) => {
    if (!asset || !isPdf || page < 1 || page > pdfTotalPages || isPageRendering) return;
    setIsPageRendering(true);
    setPdfPage(page);
    try {
      const res = await renderPdfPage(asset, page, 1600);
      if (res) {
        setCurrentUrl(res.url);
        onPageChange?.(asset.id, page, res.url);
      }
    } finally {
      setIsPageRendering(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (asset && onOpenFile) {
          onOpenFile(asset);
          onClose();
        }
      } else if (isPdf && (e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === '[')) {
        e.preventDefault();
        void goToPdfPage(pdfPage - 1);
      } else if (isPdf && (e.key === 'PageDown' || e.key === 'ArrowDown' || e.key === ']')) {
        e.preventDefault();
        void goToPdfPage(pdfPage + 1);
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
  }, [isOpen, asset, isPdf, pdfPage, pdfTotalPages, isPageRendering, onClose, onNavigate, onCopyImage]);

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
              className="absolute inset-0 flex items-center justify-center"
            >
              <ZoomableCanvas
                src={hiRes ?? currentUrl}
                alt={asset.name}
                enableOverlayControls={true}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  // A downsampled hi-res rendition must not overwrite the asset's real dimensions
                  if (!hiRes && previewReflectsDocumentSize(asset) && img.naturalWidth > 0) {
                    if (asset.dimensions.width !== img.naturalWidth || asset.dimensions.height !== img.naturalHeight) {
                      asset.dimensions = {
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      };
                    }
                    setRenderedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                  }
                }}
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
          className="absolute top-6 left-6 z-20 flex items-center gap-3 bg-[#11131a]/85 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-2xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <FileTypeBadge
            extension={asset.extension}
            size={18}
            badgeClassName="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wide text-white/95 bg-black/70 rounded-md shadow-sm"
          />
          <span className="text-xs font-medium text-white truncate max-w-xs sm:max-w-md">
            {asset.name}
          </span>
          <span className="text-xs text-zinc-300 font-mono tabular-nums">
            {isPdf && pdfTotalPages > 1 ? (
              <span className="text-zinc-200 font-medium font-mono">
                · Stránka {pdfPage} z {pdfTotalPages} ·{' '}
              </span>
            ) : null}
            {activeWidth > 0 ? (
              <>
                {activeWidth} × {activeHeight}
                {resInfo ? ` (${resInfo.megapixelsFormatted}${resInfo.standard ? ` · ${resInfo.standard}` : ''})` : ''} ·{' '}
              </>
            ) : null}
            <span className="text-zinc-300 font-mono font-medium">{asset.exif.colorProfile || 'sRGB IEC61966-2.1'}</span> · {formatBytes(asset.size)}
          </span>
          <span className="text-[11px] text-zinc-500 font-mono">
            ({currentIndex + 1}/{assets.length})
          </span>
        </motion.div>

        {/* PDF Multi-page Floating Scrubber & Navigation Toolbar */}
        {isPdf && pdfTotalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#11131a]/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.8)] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={pdfPage <= 1 || isPageRendering}
              onClick={() => goToPdfPage(pdfPage - 1)}
              className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="Předchozí stránka PDF (↑ nebo PageUp)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
              {isPageRendering ? (
                <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>Stránka</span>
              <span className="font-bold text-white px-2.5 py-0.5 bg-black/70 rounded-md shadow-sm">
                {pdfPage}
              </span>
              <span className="text-zinc-500">z</span>
              <span className="font-semibold text-white">{pdfTotalPages}</span>
            </div>

            <button
              type="button"
              disabled={pdfPage >= pdfTotalPages || isPageRendering}
              onClick={() => goToPdfPage(pdfPage + 1)}
              className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              title="Další stránka PDF (↓ nebo PageDown)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Floating Action Buttons (Top Right - Floating, Zero Stripe) */}
        <div
          className="absolute top-6 right-6 z-20 flex items-center gap-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {onOpenFile && (
            <button
              type="button"
              onClick={() => {
                onOpenFile(asset);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold shadow-2xl transition-all hover:scale-102 cursor-pointer"
              title="Otevřít soubor ve výchozí aplikaci (Enter)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Otevřít aplikaci</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onCopyImage(asset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141620]/90 hover:bg-[#252838] text-white text-xs font-medium backdrop-blur-md shadow-2xl transition-all hover:scale-102"
            title="Kopírovat obrázek do schránky (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Kopírovat</span>
          </button>
          <button
            type="button"
            onClick={() => onCopyPath(asset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141620]/90 hover:bg-[#252838] text-white text-xs font-medium backdrop-blur-md shadow-2xl transition-all hover:scale-102"
            title="Kopírovat cestu k souboru"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Cesta</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#141620]/90 hover:bg-[#252838] text-white flex items-center justify-center backdrop-blur-md shadow-2xl transition-all hover:scale-105 ml-1"
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
