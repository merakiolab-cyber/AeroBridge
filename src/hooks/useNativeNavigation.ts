import { useState, useRef, useCallback } from 'react';
import { AssetItem } from '../types';
import {
  scanNativeFolder,
  getNativeFileIcon,
  isSharedIconUrl,
  toDesktopAssetUrl,
  type NativeFileEntry,
} from '../utils/tauriBridge';
import { parseNativeEntriesToAssets } from '../utils/localFileSystem';
import { hydrateNativeThumbnails, type ThumbJob } from '../utils/nativeThumbnails';
import { pathAncestors } from '../components/NativeExplorerTree';

interface UseNativeNavigationProps {
  setAssets: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  setActiveFolder: (folder: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setFocusedId: (id: string | null) => void;
  addToast: (title: string, description: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export function useNativeNavigation({
  setAssets,
  setActiveFolder,
  setSelectedIds,
  setFocusedId,
  addToast,
}: UseNativeNavigationProps) {
  const [nativeDir, setNativeDir] = useState<string | null>(null);
  const [nativeLoading, setNativeLoading] = useState(false);
  const [nativeSubdirs, setNativeSubdirs] = useState<NativeFileEntry[]>([]);
  const [navHistory, setNavHistory] = useState<{ stack: string[]; index: number }>({
    stack: [],
    index: -1,
  });

  const navHistoryRef = useRef(navHistory);
  navHistoryRef.current = navHistory;
  const thumbJobRef = useRef<ThumbJob | null>(null);

  const navigateNative = useCallback(
    async (rawPath: string, opts?: { historyIndex?: number }) => {
      const path = rawPath.trim();
      if (!path) return;
      setNativeLoading(true);
      try {
        const entries = await scanNativeFolder(path);
        if (thumbJobRef.current) thumbJobRef.current.cancelled = true;

        const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || path;
        const imported = parseNativeEntriesToAssets(entries, name, path);

        // Revoke orphaned blob URLs from previous native assets to free memory
        setAssets((prev) => {
          const oldNative = prev.filter((a) => a.id.startsWith('native-'));
          for (const a of oldNative) {
            if (a.url && a.url.startsWith('blob:') && !isSharedIconUrl(a.url)) {
              try {
                URL.revokeObjectURL(a.url);
              } catch {}
            }
          }
          return [...imported, ...prev.filter((a) => !a.id.startsWith('native-'))];
        });

        setNativeDir(path);
        setNativeSubdirs(entries.filter((e) => e.is_dir));
        setActiveFolder(`native:${path}`);
        setSelectedIds(new Set(imported[0] ? [imported[0].id] : []));
        setFocusedId(imported[0]?.id ?? null);
        try {
          localStorage.setItem('aerobridge_last_native_dir', path);
        } catch {}

        // History bookkeeping
        const h = navHistoryRef.current;
        let nextHistory = h;
        if (opts?.historyIndex !== undefined) {
          nextHistory = { stack: h.stack, index: opts.historyIndex };
        } else if (h.stack[h.index] !== path) {
          const stack = [...h.stack.slice(0, h.index + 1), path];
          nextHistory = { stack, index: stack.length - 1 };
        }
        navHistoryRef.current = nextHistory;
        setNavHistory(nextHistory);

        // Native Windows (Explorer) file-type icons for folders and files without a content preview
        void (async () => {
          const keys = new Map<string, { ext: string; isDir: boolean }>();
          imported.forEach((a) => {
            const k = a.isFolder ? '<dir>' : a.extension.toLowerCase().replace(/^\./, '');
            if (!keys.has(k)) keys.set(k, { ext: a.isFolder ? '' : a.extension, isDir: !!a.isFolder });
          });
          const urls = new Map<string, string>();
          await Promise.all(
            Array.from(keys.entries()).map(async ([k, v]) => {
              const u = await getNativeFileIcon(v.ext, v.isDir);
              if (u) urls.set(k, u);
            })
          );
          if (urls.size === 0) return;
          setAssets((prev) =>
            prev.map((a) => {
              if (!a.id.startsWith('native-')) return a;
              const k = a.isFolder ? '<dir>' : a.extension.toLowerCase().replace(/^\./, '');
              const u = urls.get(k);
              if (u && (a.isIcon || !a.url)) {
                return { ...a, url: u, isIcon: true };
              }
              return a;
            })
          );
        })();

        // Real previews (PDF, INDD, AI, PSD, RAW, video) are generated in the background
        const directImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'];
        thumbJobRef.current = hydrateNativeThumbnails(imported, (patches) => {
          setAssets((prev) =>
            prev.map((a) => {
              const p = patches.get(a.id);
              if (!p) return a;
              const ext = a.extension ? a.extension.toLowerCase().replace(/^\./, '') : '';
              const isDirectImage = directImageExtensions.includes(ext);
              const resolvedUrl = (isDirectImage && a.fullPath)
                ? toDesktopAssetUrl(a.fullPath)
                : p.url;
              return {
                ...a,
                url: resolvedUrl,
                dimensions: p.dimensions,
                duration: p.duration ?? a.duration,
                isIcon: p.isIcon ?? false,
                pageCount: p.pageCount ?? a.pageCount,
                currentPage: p.currentPage ?? a.currentPage,
                size: p.size !== undefined ? p.size : a.size,
                exif: p.resolutionDpi
                  ? { ...a.exif, resolutionDpi: p.resolutionDpi }
                  : a.exif,
              };
            })
          );
        });
      } catch (err) {
        addToast('Složku nelze otevřít', String(err), 'warning');
      } finally {
        setNativeLoading(false);
      }
    },
    [setAssets, setActiveFolder, setSelectedIds, setFocusedId, addToast]
  );

  const handleNativeBack = useCallback(() => {
    const h = navHistoryRef.current;
    if (h.index > 0) void navigateNative(h.stack[h.index - 1], { historyIndex: h.index - 1 });
  }, [navigateNative]);

  const handleNativeForward = useCallback(() => {
    const h = navHistoryRef.current;
    if (h.index < h.stack.length - 1) {
      void navigateNative(h.stack[h.index + 1], { historyIndex: h.index + 1 });
    }
  }, [navigateNative]);

  const handleNativeUp = useCallback(() => {
    if (!nativeDir) return;
    const ancestors = pathAncestors(nativeDir);
    if (ancestors.length > 1) void navigateNative(ancestors[ancestors.length - 2]);
  }, [nativeDir, navigateNative]);

  const handleNativeRefresh = useCallback(() => {
    if (nativeDir) {
      void navigateNative(nativeDir, { historyIndex: navHistoryRef.current.index });
    }
  }, [nativeDir, navigateNative]);

  return {
    nativeDir,
    setNativeDir,
    nativeLoading,
    nativeSubdirs,
    navHistory,
    setNavHistory,
    navHistoryRef,
    thumbJobRef,
    navigateNative,
    handleNativeBack,
    handleNativeForward,
    handleNativeUp,
    handleNativeRefresh,
  };
}
