import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, ZoomIn, ZoomOut, Maximize, Columns2 } from 'lucide-react';

interface ZoomableCanvasProps {
  src: string;
  alt: string;
  className?: string;
  paddingClassName?: string;
  onDoubleClick?: () => void;
  enableOverlayControls?: boolean;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  preserveZoom?: boolean;
  scale?: number;
  onScaleChange?: (scale: number) => void;
}

export const ZoomableCanvas: React.FC<ZoomableCanvasProps> = ({
  src,
  alt,
  className = '',
  paddingClassName,
  onDoubleClick,
  enableOverlayControls = true,
  onLoad,
  preserveZoom = false,
  scale: controlledScale,
  onScaleChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [internalScale, setInternalScale] = useState(controlledScale ?? 1);
  const scale = controlledScale !== undefined ? controlledScale : internalScale;

  const setScale = useCallback(
    (action: number | ((prev: number) => number)) => {
      const next = typeof action === 'function' ? action(scale) : action;
      if (controlledScale === undefined) {
        setInternalScale(next);
      }
      onScaleChange?.(next);
    },
    [scale, controlledScale, onScaleChange]
  );

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showBadge, setShowBadge] = useState(false);
  const [badgeText, setBadgeText] = useState<string>('');
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null);

  // Trigger transient zoom percentage badge
  const triggerBadge = useCallback((customText?: string) => {
    if (customText) setBadgeText(customText);
    setShowBadge(true);
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => {
      setShowBadge(false);
    }, 1300);
  }, []);

  // Sync external controlled scale if it changes
  useEffect(() => {
    if (controlledScale !== undefined) {
      setInternalScale(controlledScale);
    }
  }, [controlledScale]);

  // Reset zoom & pan when image source changes (unless preserveZoom is enabled)
  useEffect(() => {
    if (!preserveZoom) {
      setScale(1);
    }
    setPosition({ x: 0, y: 0 });
    setNaturalDims(null);
  }, [src, preserveZoom, setScale]);

  // Is this a tall / vertical image (e.g. infographic, webpage screenshot, poster)
  const isTallImage = useMemo(() => {
    if (!naturalDims) return false;
    return naturalDims.height > naturalDims.width * 1.25;
  }, [naturalDims]);

  // Compute reference scales relative to rendered layout
  const layoutDims = useMemo(() => {
    const img = imgRef.current;
    if (!img) return { w: 1, h: 1 };
    return {
      w: Math.max(img.offsetWidth, 1),
      h: Math.max(img.offsetHeight, 1),
    };
  }, [scale, naturalDims]);

  // Scale needed to reach 1:1 true pixel resolution
  const actualScale = useMemo(() => {
    if (!naturalDims || !imgRef.current) return 1;
    const wLayout = Math.max(imgRef.current.offsetWidth, 1);
    return Math.max(0.1, naturalDims.width / wLayout);
  }, [naturalDims]);

  // Scale needed to fit container width comfortably
  const fitWidthScale = useMemo(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return 1;
    const cRect = container.getBoundingClientRect();
    const wLayout = Math.max(img.offsetWidth, 1);
    return Math.max(1, (cRect.width * 0.92) / wLayout);
  }, [naturalDims]);

  // True percentage of native image resolution
  const actualPercent = useMemo(() => {
    if (!actualScale || actualScale <= 0) return Math.round(scale * 100);
    return Math.round((scale / actualScale) * 100);
  }, [scale, actualScale]);

  // Reset to full view (fit to window)
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    triggerBadge('Přizpůsobeno oknu');
  }, [triggerBadge]);

  // Fit image to viewport width (ideal for tall infographics & landing pages)
  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const cRect = container.getBoundingClientRect();
    const wLayout = Math.max(img.offsetWidth, 1);
    const hLayout = Math.max(img.offsetHeight, 1);

    const targetScale = Math.max(1, (cRect.width * 0.92) / wLayout);
    setScale(targetScale);

    // If image becomes taller than container, align top edge near top of viewport
    const scaledHeight = hLayout * targetScale;
    if (scaledHeight > cRect.height) {
      const topOffset = (scaledHeight - cRect.height) / 2 - 32;
      setPosition({ x: 0, y: -topOffset });
    } else {
      setPosition({ x: 0, y: 0 });
    }
    triggerBadge('Přizpůsobeno šířce');
  }, [triggerBadge]);

  // 1:1 Pixel-Perfect Native Size
  const fitToActualSize = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const cRect = container.getBoundingClientRect();
    const wLayout = Math.max(img.offsetWidth, 1);
    const hLayout = Math.max(img.offsetHeight, 1);
    const wNat = naturalDims?.width || img.naturalWidth || wLayout;
    const hNat = naturalDims?.height || img.naturalHeight || hLayout;

    const targetScale = Math.max(0.2, wNat / wLayout);
    setScale(targetScale);

    const scaledHeight = hLayout * targetScale;
    if (scaledHeight > cRect.height && hNat > wNat * 1.25) {
      const topOffset = (scaledHeight - cRect.height) / 2 - 32;
      setPosition({ x: 0, y: -topOffset });
    } else {
      setPosition({ x: 0, y: 0 });
    }
    triggerBadge('100% · Skutečná velikost');
  }, [naturalDims, triggerBadge]);

  const zoomIn = useCallback(() => {
    setScale((s) => {
      const next = Math.min(s * 1.35, Math.max(30, fitWidthScale * 3));
      triggerBadge();
      return next;
    });
  }, [fitWidthScale, triggerBadge]);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(s / 1.35, 0.2);
      triggerBadge();
      return next;
    });
  }, [setScale, triggerBadge]);

  // Cycle between view modes on badge click
  const cycleViewMode = useCallback(() => {
    if (Math.abs(scale - 1) < 0.05) {
      if (isTallImage) fitToWidth();
      else fitToActualSize();
    } else if (isTallImage && Math.abs(scale - fitWidthScale) < 0.1) {
      fitToActualSize();
    } else {
      resetZoom();
    }
  }, [scale, isTallImage, fitWidthScale, fitToWidth, fitToActualSize, resetZoom]);

  // Mouse wheel: scroll vertically when image overflows in height, or zoom at cursor when Ctrl is pressed / fits
  useEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const cRect = container.getBoundingClientRect();
      const wLayout = img?.offsetWidth || 1;
      const hLayout = img?.offsetHeight || 1;
      const scaledHeight = hLayout * scale;

      // If image is taller than container and Ctrl is NOT held: smooth vertical page scroll
      if (!e.ctrlKey && scaledHeight > cRect.height * 1.05) {
        const maxScrollOffset = (scaledHeight - cRect.height) / 2 + 60;
        setPosition((prev) => {
          const nextY = prev.y - e.deltaY;
          const clampedY = Math.max(-maxScrollOffset, Math.min(maxScrollOffset, nextY));
          return { x: prev.x, y: clampedY };
        });
        return;
      }

      // Otherwise: Zoom centered at mouse cursor
      const mouseX = e.clientX - cRect.left - cRect.width / 2;
      const mouseY = e.clientY - cRect.top - cRect.height / 2;

      const zoomIntensity = e.ctrlKey ? 0.02 : 0.0018;
      const delta = -e.deltaY;
      const factor = Math.exp(delta * zoomIntensity);

      setScale((prevScale) => {
        const maxLimit = Math.max(30, fitWidthScale * 3);
        const newScale = Math.min(Math.max(prevScale * factor, 0.2), maxLimit);

        setPosition((prevPos) => {
          if (newScale <= 1) {
            return { x: prevPos.x * 0.8, y: prevPos.y * 0.8 };
          }
          const scaleDiff = newScale / prevScale;
          return {
            x: mouseX - (mouseX - prevPos.x) * scaleDiff,
            y: mouseY - (mouseY - prevPos.y) * scaleDiff,
          };
        });

        triggerBadge();
        return newScale;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scale, fitWidthScale, triggerBadge]);

  // Drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Smart double-click: for vertical images toggles between fit-window and fit-width
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDoubleClick) {
      onDoubleClick();
      return;
    }

    if (scale > 1.15 || position.x !== 0 || position.y !== 0) {
      resetZoom();
    } else if (isTallImage) {
      fitToWidth();
    } else {
      fitToActualSize();
    }
  };

  // Keyboard shortcuts (W: fit width, 0: 100%, + / -: zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        fitToWidth();
      } else if (e.key === '0') {
        e.preventDefault();
        fitToActualSize();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitToWidth, fitToActualSize, zoomIn, zoomOut]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0) {
      setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
    }
    onLoad?.(e);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full min-w-0 min-h-0 overflow-hidden select-none flex items-center justify-center ${
        paddingClassName || 'p-4 md:p-6'
      } ${
        scale > 1.05 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
      } ${className}`}
    >
      {/* Zoomable Image with Smooth Hardware-Accelerated Transform */}
      <motion.div
        animate={{
          x: position.x,
          y: position.y,
          scale: scale,
        }}
        transition={
          isDragging
            ? { duration: 0 }
            : {
                type: 'spring',
                damping: 28,
                stiffness: 300,
                mass: 0.45,
              }
        }
        className={`flex items-center justify-center w-full h-full max-w-full max-h-full min-w-0 min-h-0 origin-center pointer-events-none ${
          isDragging ? 'will-change-transform' : ''
        }`}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={handleImageLoad}
          className="max-w-full max-h-full w-auto h-auto object-contain drop-shadow-2xl rounded-none transition-shadow duration-300 pointer-events-auto"
          style={{
            imageRendering: 'auto',
          }}
          draggable={false}
        />
      </motion.div>

      {/* Dynamic Zoom Percentage HUD Pill */}
      <AnimatePresence>
        {(showBadge || scale !== 1) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-5 left-6 px-3.5 py-1.5 rounded-full bg-[#12141c]/90 text-white/90 text-xs font-mono font-medium backdrop-blur-md border border-white/10 shadow-xl pointer-events-none flex items-center gap-2"
          >
            <span className="tabular-nums font-semibold text-[#e2e4e9]">
              {actualPercent}%
            </span>
            <span className="text-[11px] text-zinc-400">
              {badgeText ||
                (scale === 1
                  ? 'Přizpůsobeno oknu'
                  : isTallImage && Math.abs(scale - fitWidthScale) < 0.1
                  ? 'Přizpůsobeno šířce · Kolečkem posunujte'
                  : 'Kolečkem zvětšete / Dvojklik pro reset')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Micro Zoom Bar Controls */}
      {enableOverlayControls && (
        <div className="absolute bottom-5 right-6 flex items-center gap-1.5 bg-[#12141c]/85 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          {/* Mode: Fit to Window */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
            className={`px-2.5 h-7 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              scale === 1
                ? 'bg-sky-500/20 text-sky-300 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Přizpůsobit oknu"
          >
            <Maximize className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Okno</span>
          </button>

          {/* Mode: Fit to Width (for tall images) */}
          {isTallImage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fitToWidth();
              }}
              className={`px-2.5 h-7 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                Math.abs(scale - fitWidthScale) < 0.1
                  ? 'bg-sky-500/20 text-sky-300 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Přizpůsobit šířce (Klávesa W) – ideální pro čtení dlouhých stránek a infografik"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Šířka</span>
            </button>
          )}

          {/* Mode: 1:1 Actual Resolution */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fitToActualSize();
            }}
            className={`px-2.5 h-7 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              Math.abs(scale - actualScale) < 0.1
                ? 'bg-sky-500/20 text-sky-300 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Skutečná velikost 100% (Klávesa 0) – 1 pixel obrázku = 1 pixel monitoru"
          >
            <span className="font-mono">1:1</span>
          </button>

          <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

          {/* Zoom Out */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Zmenšit (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Percentage Indicator Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cycleViewMode();
            }}
            className="px-2 h-7 rounded-full text-[11px] font-medium font-mono text-slate-200 hover:text-white hover:bg-white/10 transition-colors tabular-nums"
            title="Přepnout režim zobrazení (Okno / Šířka / 100%)"
          >
            {actualPercent}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Zvětšit (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Reset button if scale or position is modified */}
          {(scale !== 1 || position.x !== 0 || position.y !== 0) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetZoom();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-0.5"
              title="Resetovat pozici a měřítko"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
