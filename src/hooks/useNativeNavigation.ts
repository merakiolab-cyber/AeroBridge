import { useState, useRef, useCallback, useEffect } from 'react';
import { AssetItem } from '../types';
import {
  isDesktopApp,
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
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setFocusedId: React.Dispatch<React.SetStateAction<string | null>>;
  addToast: (title: string, description: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const directImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'];

function computeEntriesFingerprint(entries: NativeFileEntry[]): string {
  return entries
    .map((e) => `${e.path}|${e.is_dir ? 1 : 0}|${e.size}|${e.modified_ms}`)
    .join('\n');
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
  const nativeDirRef = useRef<string | null>(null);
  nativeDirRef.current = nativeDir;
  const thumbJobRef = useRef<ThumbJob | null>(null);
  const bgThumbJobRef = useRef<ThumbJob | null>(null);
  const lastFingerprintRef = useRef<string>('');
  const isScanningRef = useRef<boolean>(false);

  const hydrateAssetsIconsAndThumbs = useCallback(
    (itemsToHydrate: AssetItem[], isBackground = false) => {
      if (itemsToHydrate.length === 0) return;

      // 1. Native Windows (Explorer) file-type icons for folders and files without a content preview
      void (async () => {
        const keys = new Map<string, { ext: string; isDir: boolean }>();
        itemsToHydrate.forEach((a) => {
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
        const targetIds = new Set(itemsToHydrate.map((a) => a.id));
        setAssets((prev) =>
          prev.map((a) => {
            if (!targetIds.has(a.id)) return a;
            const k = a.isFolder ? '<dir>' : a.extension.toLowerCase().replace(/^\./, '');
            const u = urls.get(k);
            if (u && (a.isIcon || !a.url)) {
              return { ...a, url: u, isIcon: true };
            }
            return a;
          })
        );
      })();

      // 2. Real previews (PDF, INDD, AI, PSD, RAW, video) are generated in the background
      const job = hydrateNativeThumbnails(itemsToHydrate, (patches) => {
        setAssets((prev) =>
          prev.map((a) => {
            const p = patches.get(a.id);
            if (!p) return a;
            const ext = a.extension ? a.extension.toLowerCase().replace(/^\./, '') : '';
            const isDirectImage = directImageExtensions.includes(ext);
            const resolvedUrl = isDirectImage && a.fullPath ? toDesktopAssetUrl(a.fullPath) : p.url;
            return {
              ...a,
              url: resolvedUrl,
              dimensions: p.dimensions,
              duration: p.duration ?? a.duration,
              isIcon: p.isIcon ?? false,
              pageCount: p.pageCount ?? a.pageCount,
              currentPage: p.currentPage ?? a.currentPage,
              size: p.size !== undefined ? p.size : a.size,
              exif: p.resolutionDpi ? { ...a.exif, resolutionDpi: p.resolutionDpi } : a.exif,
            };
          })
        );
      });

      if (isBackground) {
        if (bgThumbJobRef.current) bgThumbJobRef.current.cancelled = true;
        bgThumbJobRef.current = job;
      } else {
        thumbJobRef.current = job;
      }
    },
    [setAssets]
  );

  const navigateNative = useCallback(
    async (rawPath: string, opts?: { historyIndex?: number; preserveState?: boolean }) => {
      const path = rawPath.trim();
      if (!path) return;

      const isSameFolderRefresh =
        opts?.preserveState ||
        (nativeDirRef.current !== null &&
          nativeDirRef.current.replace(/[\\/]+$/, '').toLowerCase() ===
            path.replace(/[\\/]+$/, '').toLowerCase() &&
          opts?.historyIndex === undefined);

      if (!isSameFolderRefresh) {
        setNativeLoading(true);
      }
      isScanningRef.current = true;
      try {
        const entries = await scanNativeFolder(path);
        lastFingerprintRef.current = computeEntriesFingerprint(entries);

        const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || path;
        const imported = parseNativeEntriesToAssets(entries, name, path);

        if (isSameFolderRefresh) {
          // Incremental update: preserve existing hydrated thumbnails & selection/scroll
          let toHydrate: AssetItem[] = [];
          setAssets((prev) => {
            const existingByPath = new Map<string, AssetItem>();
            for (const a of prev) {
              if (a.id.startsWith('native-') && a.fullPath) {
                existingByPath.set(a.fullPath.toLowerCase(), a);
              }
            }

            const newPathSet = new Set(
              imported.map((a) => (a.fullPath || '').toLowerCase()).filter(Boolean)
            );

            // Revoke blob URLs only for removed assets
            for (const [oldKey, oldAsset] of existingByPath.entries()) {
              if (!newPathSet.has(oldKey)) {
                if (oldAsset.url && oldAsset.url.startsWith('blob:') && !isSharedIconUrl(oldAsset.url)) {
                  try {
                    URL.revokeObjectURL(oldAsset.url);
                  } catch {}
                }
              }
            }

            const freshlyNeeded: AssetItem[] = [];
            const merged = imported.map((imp) => {
              const key = (imp.fullPath || '').toLowerCase();
              const existing = key ? existingByPath.get(key) : undefined;
              if (
                existing &&
                existing.size === imp.size &&
                existing.dateModified === imp.dateModified &&
                existing.url
              ) {
                return existing;
              }
              freshlyNeeded.push(imp);
              return imp;
            });

            toHydrate = freshlyNeeded;
            return [...merged, ...prev.filter((a) => !a.id.startsWith('native-'))];
          });

          setNativeDir(path);
          setNativeSubdirs(entries.filter((e) => e.is_dir));
          setActiveFolder(`native:${path}`);

          // Preserve valid selectedIds & focusedId (do NOT reset to imported[0]!)
          const validIds = new Set(imported.map((a) => a.id));
          setSelectedIds((prev) => {
            const kept = new Set(Array.from(prev).filter((id) => validIds.has(id)));
            return kept;
          });
          setFocusedId((prev) => (prev && validIds.has(prev) ? prev : null));

          if (toHydrate.length > 0) {
            hydrateAssetsIconsAndThumbs(toHydrate, true);
          }
        } else {
          // Full folder navigation to a different folder
          if (thumbJobRef.current) thumbJobRef.current.cancelled = true;
          if (bgThumbJobRef.current) bgThumbJobRef.current.cancelled = true;

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

          hydrateAssetsIconsAndThumbs(imported, false);
        }
      } catch (err) {
        addToast('Složku nelze otevřít', String(err), 'warning');
      } finally {
        isScanningRef.current = false;
        setNativeLoading(false);
      }
    },
    [setAssets, setActiveFolder, setSelectedIds, setFocusedId, addToast, hydrateAssetsIconsAndThumbs]
  );

  // Silent automatic background folder watcher: detects added/removed/modified files in real time
  useEffect(() => {
    if (!isDesktopApp() || !nativeDir) return;

    let cancelled = false;
    const checkFolderChanges = async () => {
      if (cancelled || isScanningRef.current) return;
      const currentPath = nativeDirRef.current;
      if (!currentPath) return;

      isScanningRef.current = true;
      try {
        const entries = await scanNativeFolder(currentPath);
        if (cancelled || nativeDirRef.current !== currentPath) return;

        const nextFp = computeEntriesFingerprint(entries);
        if (nextFp === lastFingerprintRef.current) return;

        lastFingerprintRef.current = nextFp;
        const name = currentPath.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() || currentPath;
        const imported = parseNativeEntriesToAssets(entries, name, currentPath);

        let toHydrate: AssetItem[] = [];
        setAssets((prev) => {
          const existingByPath = new Map<string, AssetItem>();
          for (const a of prev) {
            if (a.id.startsWith('native-') && a.fullPath) {
              existingByPath.set(a.fullPath.toLowerCase(), a);
            }
          }

          const newPathSet = new Set(
            imported.map((a) => (a.fullPath || '').toLowerCase()).filter(Boolean)
          );

          for (const [oldKey, oldAsset] of existingByPath.entries()) {
            if (!newPathSet.has(oldKey)) {
              if (oldAsset.url && oldAsset.url.startsWith('blob:') && !isSharedIconUrl(oldAsset.url)) {
                try {
                  URL.revokeObjectURL(oldAsset.url);
                } catch {}
              }
            }
          }

          const freshlyNeeded: AssetItem[] = [];
          const merged = imported.map((imp) => {
            const key = (imp.fullPath || '').toLowerCase();
            const existing = key ? existingByPath.get(key) : undefined;
            if (
              existing &&
              existing.size === imp.size &&
              existing.dateModified === imp.dateModified &&
              existing.url
            ) {
              return existing;
            }
            freshlyNeeded.push(imp);
            return imp;
          });

          toHydrate = freshlyNeeded;
          return [...merged, ...prev.filter((a) => !a.id.startsWith('native-'))];
        });

        setNativeSubdirs(entries.filter((e) => e.is_dir));

        const validIds = new Set(imported.map((a) => a.id));
        setSelectedIds((prev) => {
          let changed = false;
          for (const id of prev) {
            if (!validIds.has(id)) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
          return new Set(Array.from(prev).filter((id) => validIds.has(id)));
        });
        setFocusedId((prev) => (prev && !validIds.has(prev) ? null : prev));

        if (toHydrate.length > 0) {
          hydrateAssetsIconsAndThumbs(toHydrate, true);
        }

        // Notify Explorer tree so any added/removed subfolders update in the left sidebar too
        window.dispatchEvent(
          new CustomEvent('aerobridge:tree-refresh', { detail: { path: currentPath, silent: true } })
        );
      } catch {
        // Ignore transient background scan errors
      } finally {
        isScanningRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void checkFolderChanges();
    }, 2000);

    const handleWindowFocus = () => {
      void checkFolderChanges();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [nativeDir, setAssets, setSelectedIds, setFocusedId, hydrateAssetsIconsAndThumbs]);

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
      void navigateNative(nativeDir, {
        historyIndex: navHistoryRef.current.index,
        preserveState: true,
      });
      window.dispatchEvent(
        new CustomEvent('aerobridge:tree-refresh', { detail: { path: nativeDir } })
      );
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
