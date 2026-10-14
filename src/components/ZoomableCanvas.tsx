import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ZoomableCanvasProps {
  src: string;
  alt: string;
  className?: string;
  onDoubleClick?: () => void;
  enableOverlayControls?: boolean;
}

export const ZoomableCanvas: React.FC<ZoomableCanvasProps> = ({
  src,
  alt,
  className = '',
  enableOverlayControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showBadge, setShowBadge] = useState(false);
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger transient zoom percentage badge
  const triggerBadge = useCallback(() => {
    setShowBadge(true);
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => {
      setShowBadge(false);
    }, 1200);
  }, []);

  // Reset zoom & pan when image source changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  // Smooth mouse wheel zoom at cursor point (Figma / Photoshop style)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      // Dynamic zoom factor based on wheel delta
      const zoomIntensity = e.ctrlKey ? 0.02 : 0.0015;
      const delta = -e.deltaY;
      const factor = Math.exp(delta * zoomIntensity);

      setScale((prevScale) => {
        const newScale = Math.min(Math.max(prevScale * factor, 0.6), 12);

        // Adjust position so the zoom centers on the mouse cursor
        setPosition((prevPos) => {
          if (newScale <= 1) {
            // Re-center smoothly when zoomed out
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
  }, [triggerBadge]);

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

  // Double click toggles between 100% (fit) and 2.5x zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1.2) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        setScale(2.5);
        setPosition({ x: -mouseX * 1.5, y: -mouseY * 1.5 });
      } else {
        setScale(2.5);
      }
    }
    triggerBadge();
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    triggerBadge();
  };

  const zoomIn = () => {
    setScale((s) => Math.min(s * 1.35, 12));
    triggerBadge();
  };

  const zoomOut = () => {
    setScale((s) => Math.max(s / 1.35, 0.6));
    triggerBadge();
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden select-none flex items-center justify-center ${
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
        className="flex items-center justify-center max-w-full max-h-full origin-center pointer-events-none will-change-transform"
      >
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className="max-w-[98vw] max-h-[96vh] object-contain drop-shadow-2xl rounded-none transition-shadow duration-300"
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
              {Math.round(scale * 100)}%
            </span>
            <span className="text-[11px] text-zinc-400">
              {scale === 1 ? 'Přizpůsobeno' : 'Kolečkem zvětšete / Dvojklik pro reset'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Micro Zoom Bar Controls */}
      {enableOverlayControls && (
        <div className="absolute bottom-5 right-6 flex items-center gap-1.5 bg-[#12141c]/80 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-xl pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomOut();
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Zmenšit"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
            className="px-2.5 h-7 rounded-full text-[11px] font-medium font-mono text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Resetovat na 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomIn();
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Zvětšit"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {scale !== 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resetZoom();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#e2e4e9] hover:text-white hover:bg-white/10 transition-colors"
              title="Přizpůsobit oknu"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
