import {
  getThumbnailCacheStats,
  purgeThumbnailCache,
  getMaxThumbCacheLimit,
  setMaxThumbCacheLimit,
} from './nativeThumbnails';
import {
  getNativeIconCacheStats,
  purgeNativeIconCache,
} from './tauriBridge';
import {
  getPdfCacheStats,
  purgePdfCache,
} from './pdfPreview';
import {
  getIndexedDbStats,
  clearIndexedDbAssets,
} from './indexedDbStorage';

export interface AppCacheStats {
  thumbnails: {
    count: number;
    maxLimit: number;
    placeholderCount: number;
  };
  nativeIcons: {
    iconCount: number;
    folderSizeCount: number;
  };
  pdf: {
    docCount: number;
    pageCount: number;
  };
  indexedDb: {
    assetCount: number;
    directoryCount: number;
    estimatedSizeMb: number;
  };
}

/**
 * Collects complete real-time cache statistics across RAM and disk stores
 */
export async function getAppCacheOverview(): Promise<AppCacheStats> {
  const [thumbStats, iconStats, pdfStats, idbStats] = await Promise.all([
    Promise.resolve(getThumbnailCacheStats()),
    Promise.resolve(getNativeIconCacheStats()),
    Promise.resolve(getPdfCacheStats()),
    getIndexedDbStats(),
  ]);

  return {
    thumbnails: thumbStats,
    nativeIcons: iconStats,
    pdf: pdfStats,
    indexedDb: idbStats,
  };
}

/**
 * Purges cache strictly for the active folder (forces fresh thumbnail re-hydration)
 * Same as Adobe Bridge: Tools > Cache > Purge Cache for Folder
 */
export function purgeFolderCache(folderPath: string): { deletedThumbnails: number; deletedPdfDocs: number } {
  if (!folderPath) return { deletedThumbnails: 0, deletedPdfDocs: 0 };
  const deletedThumbnails = purgeThumbnailCache(folderPath);
  const deletedPdfDocs = purgePdfCache(folderPath);
  return { deletedThumbnails, deletedPdfDocs };
}

/**
 * Purges ALL in-memory and persistent cache stores:
 * - Thumbnail LRU cache & placeholders
 * - Windows native shell icons & folder sizes
 * - PDF document and page render cache
 * - IndexedDB asset cache
 */
export async function purgeEntireAppCache(): Promise<void> {
  purgeThumbnailCache();
  purgeNativeIconCache();
  purgePdfCache();
  await clearIndexedDbAssets();
}

export { getMaxThumbCacheLimit, setMaxThumbCacheLimit };
