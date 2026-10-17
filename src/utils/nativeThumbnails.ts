/**
 * Native (Tauri) thumbnail pipeline.
 * Generates real previews for PDF, InDesign, Illustrator, Photoshop, RAW and video files
 * lazily in the background so that folder browsing stays instant.
 */

import './polyfills';
import { AssetItem } from '../types';
import {
  extractAiThumbnail,
  extractEmbeddedJpeg,
  extractPainterThumbnail,
  extractFigmaThumbnail,
  extractKritaThumbnail,
  extractXdThumbnail,
  extractSvgThumbnail,
  extractHtmlThumbnail,
  extractBlendThumbnail,
  extractPsdThumbnail,
  extractRawThumbnail,
  extractTiffThumbnail,
  extractPostScriptThumbnail,
  extractOfficeThumbnail,
  findPdfOffset,
  getImageDimensions,
} from './adobeThumbnailExtractor';
import { parseImageHeader } from './extractors/imageHeaderParser';
import {
  extractNativeXmpThumbnail,
  getNativeFileIcon,
  getNativeFolderSize,
  getNativeShellThumbnail,
  readNativeFileBinary,
  toDesktopAssetUrl,
} from './tauriBridge';

export interface ThumbPatch {
  url: string;
  dimensions: { width: number; height: number };
  duration?: number;
  isIcon?: boolean;
  isPlaceholder?: boolean;
  pageCount?: number;
  currentPage?: number;
  size?: number;
  resolutionDpi?: number;
}

const MB = 1024 * 1024;
const MAX_PDF_BYTES = 200 * MB;

// ---------------------------------------------------------------------------
// Cheap, cached per-extension placeholders (no per-file canvas work during scan)
// ---------------------------------------------------------------------------
const placeholderCache = new Map<string, string>();

export function getCachedPlaceholder(_extension: string, _color: string, _format: string): string {
  return '';
}

// ---------------------------------------------------------------------------
// PDF (pdf.js, fully offline) – also used for .ai (PDF-compatible Illustrator files)
// ---------------------------------------------------------------------------
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      try {
        const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline');
        if (workerMod && workerMod.default) {
          pdfjs.GlobalWorkerOptions.workerPort = new workerMod.default();
        }
      } catch (e) {
        console.warn('[nativeThumbnails] Worker inline import failed, falling back to main thread:', e);
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

async function renderPdfFirstPage(buffer: ArrayBuffer, targetWidth = 900): Promise<ThumbPatch | null> {
  try {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const doc = await task.promise;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(4, targetWidth / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      return {
        url: canvas.toDataURL('image/jpeg', 0.85),
        dimensions: { width: canvas.width, height: canvas.height },
        pageCount: doc.numPages,
        currentPage: 1,
      };
    } finally {
      void task.destroy();
    }
  } catch (err) {
    console.warn('[Thumbnails] PDF render failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Video snapshot via the asset protocol URL
// ---------------------------------------------------------------------------
function videoSnapshot(src: string): Promise<ThumbPatch | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    let settled = false;

    const finish = (val: ThumbPatch | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(val);
    };

    const timer = setTimeout(() => finish(null), 6000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, Math.max(0.1, (video.duration || 1) * 0.1));
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const scale = Math.min(1, 640 / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish({
          url: canvas.toDataURL('image/jpeg', 0.82),
          dimensions: { width: w, height: h },
          duration: video.duration || 0,
        });
      } catch {
        finish(null);
      }
    };
    video.onerror = () => finish(null);
    video.src = src;
  });
}

// ---------------------------------------------------------------------------
// IDML (zip package) thumbnail
// ---------------------------------------------------------------------------
async function idmlThumbnail(path: string): Promise<string | null> {
  try {
    const { default: JSZip } = await import('jszip');
    const buf = await readNativeFileBinary(path, 64 * MB);
    const zip = await JSZip.loadAsync(buf);
    const entry = Object.values(zip.files).find((f) => /thumbnail[^/]*\.(jpe?g|png)$/i.test(f.name));
    if (!entry) return null;
    const b64 = await entry.async('base64');
    const mime = /\.png$/i.test(entry.name) ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

async function withDims(url: string): Promise<ThumbPatch> {
  const dims = await getImageDimensions(url);
  return { url, dimensions: dims };
}

// ---------------------------------------------------------------------------
// Persistent High-Speed LRU Thumbnail Memory Cache
// Prevents re-extracting thumbnails when re-opening folders
// ---------------------------------------------------------------------------
const thumbCache = new Map<string, ThumbPatch>();
let maxThumbCacheLimit = 2500;
try {
  const savedLimit = localStorage.getItem('aerobridge_max_thumb_cache');
  if (savedLimit) maxThumbCacheLimit = parseInt(savedLimit, 10) || 2500;
} catch {}

export function getMaxThumbCacheLimit(): number {
  return maxThumbCacheLimit;
}

export function setMaxThumbCacheLimit(limit: number): void {
  maxThumbCacheLimit = Math.max(500, Math.min(limit, 10000));
  try {
    localStorage.setItem('aerobridge_max_thumb_cache', String(maxThumbCacheLimit));
  } catch {}
}

export function getThumbnailCacheStats() {
  return {
    count: thumbCache.size,
    maxLimit: maxThumbCacheLimit,
    placeholderCount: placeholderCache.size,
  };
}

export function purgeThumbnailCache(folderPath?: string): number {
  if (!folderPath) {
    const count = thumbCache.size;
    thumbCache.clear();
    placeholderCache.clear();
    return count;
  }
  const prefix = folderPath.replace(/[\\/]+$/, '').toLowerCase();
  let deleted = 0;
  for (const key of Array.from(thumbCache.keys())) {
    const pathPart = key.split(':')[0].toLowerCase();
    if (pathPart.startsWith(prefix)) {
      thumbCache.delete(key);
      deleted++;
    }
  }
  return deleted;
}

async function patchToDataUrl(patch: ThumbPatch): Promise<ThumbPatch> {
  if (!patch.url || !patch.url.startsWith('blob:')) {
    return patch;
  }
  try {
    const res = await fetch(patch.url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          ...patch,
          url: (reader.result as string) || patch.url,
        });
      };
      reader.onerror = () => resolve(patch);
      reader.readAsDataURL(blob);
    });
  } catch {
    return patch;
  }
}

async function doGenerateNativeThumbnail(asset: AssetItem, path: string, ext: string): Promise<ThumbPatch | null> {
  if (asset.isFolder) {
    const info = await getNativeFolderSize(path);
    const folderIcon = await getNativeFileIcon('', true);
    return {
      url: folderIcon || asset.url,
      dimensions: { width: 0, height: 0 },
      isIcon: true,
      size: info ? info.total_bytes : asset.size,
    };
  }

  try {
    switch (asset.category) {
      case 'image': {
        if (ext === 'tif' || ext === 'tiff') {
          // Method 1: Windows Shell API (uses WIC)
          const shellThumb = await getNativeShellThumbnail(path, 800);
          if (shellThumb) return await withDims(shellThumb);

          // Method 2: Offline decode via UTIF
          const buf = await readNativeFileBinary(path, 64 * MB);
          const res = await extractTiffThumbnail(buf, asset.name);
          if (res) {
            return {
              url: res.url,
              dimensions: { width: res.width, height: res.height },
              pageCount: res.pageCount,
              currentPage: 1,
            };
          }
          return null;
        }

        // Direct web-compatible raster image formats (JPG, JPEG, PNG, GIF, BMP, WEBP, AVIF)
        const assetUrl = toDesktopAssetUrl(path);

        // Method 1: Ultra-fast binary header parser (512 KB to comfortably fit large EXIF / ICC / XMP chunks)
        try {
          const head = await readNativeFileBinary(path, 524288);
          const meta = parseImageHeader(head);
          if (meta && meta.width > 0 && meta.height > 0) {
            return {
              url: assetUrl,
              dimensions: { width: meta.width, height: meta.height },
              resolutionDpi: meta.dpi,
              isIcon: false,
            };
          }
        } catch (e) {
          console.debug(`[Thumbnails] Fast header parsing failed for ${asset.name}:`, e);
        }

        // Method 2: Inspect dimensions using desktop asset URL directly in Chromium (preserves full resolution)
        try {
          const dims = await getImageDimensions(assetUrl);
          if (dims.width > 0 && dims.height > 0) {
            return { url: assetUrl, dimensions: dims, isIcon: false };
          }
        } catch {}

        // Method 3: Windows Shell API fallback only if browser could not decode assetUrl
        const shellThumb = await getNativeShellThumbnail(path, 800);
        if (shellThumb) return await withDims(shellThumb);

        // Method 4: Fallback reading binary into persistent data URL
        try {
          const buf = await readNativeFileBinary(path, 32 * MB);
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
          const blob = new Blob([buf], { type: mime });
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const dims = await getImageDimensions(dataUrl);
          return { url: dataUrl, dimensions: dims, isIcon: false };
        } catch (e) {
          console.debug(`[Thumbnails] Binary read failed for ${asset.name}:`, e);
        }

        return null;
      }

      case 'video':
        return await videoSnapshot(toDesktopAssetUrl(path));

      case 'pdf': {
        // 1. Windows native Shell thumbnail provider (instant if Acrobat / PowerToys / Sumatra is installed)
        const shellThumb = await getNativeShellThumbnail(path, 600);
        if (shellThumb) return await withDims(shellThumb);

        // 2. High-fidelity rendering via offline pdf.js (with toHex polyfill)
        if (asset.size > MAX_PDF_BYTES) return null;
        try {
          const buf = await readNativeFileBinary(path);
          return await renderPdfFirstPage(buf);
        } catch (err) {
          console.warn('[nativeThumbnails] PDF render error:', err);
          return null;
        }
      }

      case 'adobe-indd': {
        if (ext === 'idml') {
          const t = await idmlThumbnail(path);
          if (t) return await withDims(t);
          return null;
        }

        // 1. Windows Shell thumbnail provider (instant if InDesign / Bridge / SageThumbs is installed)
        const shellThumb = await getNativeShellThumbnail(path, 600);
        if (shellThumb) return await withDims(shellThumb);

        // 2. Stream through file for XMP packet (<xmpGImg:image> Base64 JPEG)
        const xmp = await extractNativeXmpThumbnail(path, 700);
        if (xmp) return await withDims(xmp);

        // 3. Scan for embedded JPEG stream (large page render)
        const head = await readNativeFileBinary(path, 32 * MB);
        const jpeg = extractEmbeddedJpeg(head, 8192, 32 * MB);
        return jpeg ? await withDims(jpeg) : null;
      }

      case 'adobe-ai': {
        // 1. Modern .ai files are PDF-compatible – search for %PDF- stream anywhere in header (up to 8MB) and render with pdf.js
        if (asset.size <= MAX_PDF_BYTES) {
          const buf = await readNativeFileBinary(path);
          const bytes = new Uint8Array(buf);
          const pdfOffset = findPdfOffset(bytes, 8 * MB);
          if (pdfOffset !== -1) {
            const pdfBuffer = pdfOffset === 0 ? buf : buf.slice(pdfOffset);
            const rendered = await renderPdfFirstPage(pdfBuffer);
            if (rendered) return rendered;
          }
        }

        // 2. XMP Packet thumbnail (embedded JPEG in <xmpGImg:image> / <xapGImg:image>)
        const xmp = await extractNativeXmpThumbnail(path, 700);
        if (xmp) return await withDims(xmp);

        // 3. PostScript embedded hex raster thumbnail (%%BeginThumbnail / %AI7_Thumbnail / %%BeginPreview)
        const head = await readNativeFileBinary(path, 16 * MB);
        const psThumb = extractPostScriptThumbnail(head);
        if (psThumb) return await withDims(psThumb);

        // 4. Embedded JPEG stream scan
        const jpeg = extractEmbeddedJpeg(head, 4096, 16 * MB);
        if (jpeg) return await withDims(jpeg);

        // 5. Windows Shell API (IShellItemImageFactory with SIIGBF_THUMBNAILONLY) – uses installed Illustrator / Bridge thumbnail handler
        const shellThumb = await getNativeShellThumbnail(path, 512);
        if (shellThumb) return await withDims(shellThumb);

        // 6. Generic extractAiThumbnail fallback
        const res = await extractAiThumbnail(head, asset.name);
        if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }

        // 7. Fallback: return null so worker assigns the native Windows file-type icon (like .indd)
        return null;
      }

      case 'adobe-psd': {
        const xmp = await extractNativeXmpThumbnail(path, 48);
        if (xmp) return await withDims(xmp);
        const head = await readNativeFileBinary(path, 16 * MB);
        const thumb = extractPsdThumbnail(head);
        return thumb ? await withDims(thumb) : null;
      }

      case 'raw': {
        const head = await readNativeFileBinary(path, 24 * MB);
        const res = await extractRawThumbnail(head, asset.name);
        if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      case 'vector': {
        if (ext === 'eps') {
          const buf = await readNativeFileBinary(path, 8 * MB);
          const res = await extractAiThumbnail(buf, asset.name);
          if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }
        if (ext === 'svg') {
          const buf = await readNativeFileBinary(path, 16 * MB);
          const res = await extractSvgThumbnail(buf, asset.name);
          if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }
        return null;
      }

      case 'painter': {
        // Step 1: In Windows native desktop mode, try Windows Shell thumbnail provider (e.g. Corel Painter RiffSE)
        const shellThumb = await getNativeShellThumbnail(path, 600);
        if (shellThumb) {
          return await withDims(shellThumb);
        }
        // Step 2: Extract embedded JPEG/PNG/DIB/XMP from RIFF binary buffer
        const head = await readNativeFileBinary(path, 32 * MB);
        const res = await extractPainterThumbnail(head, asset.name);
        if (res && !res.isPlaceholder) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      case 'figma': {
        // Step 1: In Windows native desktop mode, try Windows Shell thumbnail provider first (instant if Figma desktop app is installed)
        const shellThumb = await getNativeShellThumbnail(path, 800);
        if (shellThumb) {
          return await withDims(shellThumb);
        }
        // Step 2: Extract embedded thumbnail.png or preview from .fig ZIP archive / kiwi binary stream
        const head = await readNativeFileBinary(path, 64 * MB);
        const res = await extractFigmaThumbnail(head, asset.name);
        if (res && !res.isPlaceholder && res.url) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      case 'adobe-xd': {
        const shellThumb = await getNativeShellThumbnail(path, 800);
        if (shellThumb) {
          return await withDims(shellThumb);
        }
        const head = await readNativeFileBinary(path, 64 * MB);
        const res = await extractXdThumbnail(head, asset.name);
        if (res && !res.isPlaceholder && res.url) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      case 'html': {
        const buf = await readNativeFileBinary(path, 16 * MB);
        const res = await extractHtmlThumbnail(buf, asset.name);
        if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      case 'krita': {
        // Step 1: In Windows native desktop mode, try Windows Shell thumbnail provider if Krita shell handler is registered
        const shellThumb = await getNativeShellThumbnail(path, 800);
        if (shellThumb) {
          return await withDims(shellThumb);
        }
        // Step 2: Extract embedded preview.png, mergedimage.png or thumbnail.png from .kra ZIP archive
        const head = await readNativeFileBinary(path, 64 * MB);
        const res = await extractKritaThumbnail(head, asset.name);
        if (res && !res.isPlaceholder) {
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      case 'blend': {
        // Step 1: Extract embedded 3D scene preview from TEST block in .blend header
        const head = await readNativeFileBinary(path, 1 * MB);
        const res = extractBlendThumbnail(head, asset.name);
        if (res && res.url) {
          return { url: res.url, dimensions: { width: res.width, height: res.height }, isIcon: false };
        }
        // Step 2: Try Windows Shell thumbnail provider if registered
        const shellThumb = await getNativeShellThumbnail(path, 600);
        if (shellThumb) {
          return await withDims(shellThumb);
        }
        return null;
      }

      default: {
        if (ext === 'blend' || ext === 'blend1' || ext === 'blend2') {
          const head = await readNativeFileBinary(path, 1 * MB);
          const res = extractBlendThumbnail(head, asset.name);
          if (res && res.url) {
            return { url: res.url, dimensions: { width: res.width, height: res.height }, isIcon: false };
          }
          const shellThumb = await getNativeShellThumbnail(path, 600);
          if (shellThumb) return await withDims(shellThumb);
          return null;
        }
        // Fallback check for .rif, .riff, .tif, .tiff in case asset was classified differently
        if (ext === 'rif' || ext === 'riff') {
          const shellThumb = await getNativeShellThumbnail(path, 600);
          if (shellThumb) return await withDims(shellThumb);
          const head = await readNativeFileBinary(path, 32 * MB);
          const res = await extractPainterThumbnail(head, asset.name);
          if (res && !res.isPlaceholder) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }

        // PowerPoint, Word, Excel, OpenDocument presentations and documents
        const officeExts = new Set([
          'pptx', 'ppt', 'pps', 'ppsx', 'pot', 'potx',
          'docx', 'doc', 'dot', 'dotx',
          'xlsx', 'xls', 'xlsm', 'xlt', 'xltx',
          'odp', 'odt', 'ods',
        ]);
        if (officeExts.has(ext)) {
          // Step 1: Windows Shell API (uses Office / PowerPoint Viewer / Windows preview handler)
          const shellThumb = await getNativeShellThumbnail(path, 800);
          if (shellThumb) return await withDims(shellThumb);

          // Step 2: Offline OpenXML / OpenDocument thumbnail extractor (docProps/thumbnail.jpeg or Thumbnails/thumbnail.png)
          try {
            const head = await readNativeFileBinary(path, 16 * MB);
            const res = await extractOfficeThumbnail(head, asset.name, ext);
            if (res && !res.isPlaceholder && res.url) {
              return { url: res.url, dimensions: { width: res.width, height: res.height } };
            }
          } catch (e) {
            console.debug(`[Thumbnails] Office extraction failed for ${asset.name}:`, e);
          }
          return null;
        }

        if (ext === 'fig') {
          const shellThumb = await getNativeShellThumbnail(path, 800);
          if (shellThumb) return await withDims(shellThumb);
          const head = await readNativeFileBinary(path, 64 * MB);
          const res = await extractFigmaThumbnail(head, asset.name);
          if (res && !res.isPlaceholder && res.url) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }
        if (ext === 'xd') {
          const shellThumb = await getNativeShellThumbnail(path, 800);
          if (shellThumb) return await withDims(shellThumb);
          const head = await readNativeFileBinary(path, 64 * MB);
          const res = await extractXdThumbnail(head, asset.name);
          if (res && !res.isPlaceholder && res.url) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }
        if (ext === 'kra') {
          const shellThumb = await getNativeShellThumbnail(path, 800);
          if (shellThumb) return await withDims(shellThumb);
          const head = await readNativeFileBinary(path, 64 * MB);
          const res = await extractKritaThumbnail(head, asset.name);
          if (res && !res.isPlaceholder) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }
        if (ext === 'svg') {
          const buf = await readNativeFileBinary(path, 16 * MB);
          const res = await extractSvgThumbnail(buf, asset.name);
          if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }
        if (ext === 'tif' || ext === 'tiff') {
          const shellThumb = await getNativeShellThumbnail(path, 800);
          if (shellThumb) return await withDims(shellThumb);
          const buf = await readNativeFileBinary(path, 64 * MB);
          const res = await extractTiffThumbnail(buf, asset.name);
          if (res) {
            return {
              url: res.url,
              dimensions: { width: res.width, height: res.height },
              pageCount: res.pageCount,
              currentPage: 1,
            };
          }
          return null;
        }
        if (ext === 'html' || ext === 'htm') {
          const buf = await readNativeFileBinary(path, 16 * MB);
          const res = await extractHtmlThumbnail(buf, asset.name);
          if (res && !('isPlaceholder' in res && (res as any).isPlaceholder)) {
            return { url: res.url, dimensions: { width: res.width, height: res.height } };
          }
          return null;
        }


        // Step 3: Universal Windows Shell thumbnail provider fallback (Affinity, Corel, CAD, 3D models, e-books, etc.)
        const shellThumb = await getNativeShellThumbnail(path, 600);
        if (shellThumb) {
          return await withDims(shellThumb);
        }

        return null;
      }
    }
  } catch (err) {
    console.warn(`[Thumbnails] Failed for ${asset.name}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public: generate preview for a single native asset with LRU caching
// ---------------------------------------------------------------------------
export async function generateNativeThumbnail(asset: AssetItem): Promise<ThumbPatch | null> {
  const path = asset.fullPath;
  if (!path) return null;
  const ext = asset.extension.toLowerCase();

  const cacheKey = `${path}:${asset.size}:${asset.dateModified || ''}`;
  const hit = thumbCache.get(cacheKey);
  if (hit) return hit;

  const patch = await doGenerateNativeThumbnail(asset, path, ext);
  if (patch && !patch.isPlaceholder && patch.url) {
    const durable = await patchToDataUrl(patch);
    if (thumbCache.size >= maxThumbCacheLimit) {
      const iter = thumbCache.keys();
      for (let i = 0; i < 400; i++) {
        const k = iter.next().value;
        if (k) thumbCache.delete(k);
      }
    }
    thumbCache.set(cacheKey, durable);
    return durable;
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Background queue with limited concurrency, batching UI updates
// ---------------------------------------------------------------------------
export interface ThumbJob {
  cancelled: boolean;
}

export function hydrateNativeThumbnails(
  assets: AssetItem[],
  applyPatches: (patches: Map<string, ThumbPatch>) => void,
  concurrency = 3
): ThumbJob {
  const job: ThumbJob = { cancelled: false };
  const allTargets = assets.filter((a) => {
    if (!a.fullPath) return false;
    if (a.isFolder) return true;
    // If the asset already has verified non-zero dimensions and a real content preview,
    // and is not a multi-page document, it can be skipped.
    // Freshly scanned JPG, PNG, WEBP files have dimensions 0x0 and MUST be hydrated!
    if (
      a.dimensions &&
      a.dimensions.width > 0 &&
      a.dimensions.height > 0 &&
      !a.isIcon &&
      a.url &&
      (!a.pageCount || a.pageCount <= 1)
    ) {
      return false;
    }
    return true;
  });

  // 1. Immediately apply any cache hits synchronously in 0 ms!
  const immediate = new Map<string, ThumbPatch>();
  const queue: AssetItem[] = [];

  for (const a of allTargets) {
    const cacheKey = `${a.fullPath}:${a.size}:${a.dateModified || ''}`;
    const hit = thumbCache.get(cacheKey);
    if (hit) {
      immediate.set(a.id, hit);
    } else {
      queue.push(a);
    }
  }

  if (immediate.size > 0) {
    applyPatches(immediate);
  }

  if (queue.length === 0) {
    return job;
  }

  let index = 0;
  let pending = new Map<string, ThumbPatch>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    flushTimer = null;
    if (job.cancelled || pending.size === 0) return;
    const batch = pending;
    pending = new Map();
    applyPatches(batch);
  };

  const schedule = () => {
    if (!flushTimer) flushTimer = setTimeout(flush, 100);
  };

  const worker = async () => {
    while (!job.cancelled) {
      const asset = queue[index++];
      if (!asset) break;
      const patch = await generateNativeThumbnail(asset);
      if (job.cancelled) break;
      if (patch && !patch.isPlaceholder && patch.url) {
        pending.set(asset.id, { ...patch, isIcon: patch.isIcon ?? false });
      } else {
        // If image already has a direct desktop asset URL, preserve it and don't overwrite with an icon!
        const isDirect = asset.url && !asset.isIcon;
        if (isDirect) {
          pending.set(asset.id, {
            url: asset.url,
            dimensions: { width: 1920, height: 1080 },
            isIcon: false,
          });
        } else {
          // Failure: show the native Windows file-type or folder icon
          const icon = await getNativeFileIcon(asset.isFolder ? '' : asset.extension, !!asset.isFolder);
          pending.set(asset.id, {
            url: icon || '',
            dimensions: { width: 0, height: 0 },
            isIcon: true,
          });
        }
      }
      schedule();
    }
    if (index >= queue.length) flush();
  };

  for (let i = 0; i < concurrency; i++) void worker();
  return job;
}
