/**
 * AeroBridge Studio — PDF Multi-Page Preview & Rendering Engine
 * Offline high-performance PDF page extraction using pdf.js.
 */

import './polyfills';
import { AssetItem } from '../types';
import { isDesktopApp, readNativeFileBinary } from './tauriBridge';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      try {
        const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline');
        if (workerMod && workerMod.default) {
          pdfjs.GlobalWorkerOptions.workerPort = new workerMod.default();
        }
      } catch (e) {
        console.warn('[pdfPreview] Worker inline import failed, falling back to main thread:', e);
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

// In-memory cache for parsed PDF document tasks to prevent reloading large files on each page turn
const docCache = new Map<string, { doc: any; numPages: number }>();
// In-memory cache for rendered pages: `${assetId}_p${pageNum}` -> dataUrl
const pageRenderCache = new Map<string, { url: string; width: number; height: number }>();

async function getPdfBuffer(asset: AssetItem): Promise<ArrayBuffer | null> {
  if (isDesktopApp() && asset.fullPath) {
    try {
      return await readNativeFileBinary(asset.fullPath);
    } catch (err) {
      console.warn('[pdfPreview] readNativeFileBinary failed:', err);
    }
  }

  if (asset.blob) {
    return await asset.blob.arrayBuffer();
  }

  if (asset.fileRef) {
    return await asset.fileRef.arrayBuffer();
  }

  if (asset.url && !asset.url.startsWith('data:') && !asset.url.startsWith('blob:')) {
    try {
      const res = await fetch(asset.url);
      return await res.arrayBuffer();
    } catch (err) {
      console.warn('[pdfPreview] fetch asset url failed:', err);
    }
  }

  return null;
}

export async function getPdfDocInfo(asset: AssetItem): Promise<{ numPages: number } | null> {
  const ext = asset.extension.toLowerCase();
  if (ext === 'tif' || ext === 'tiff') {
    if (asset.pageCount) return { numPages: asset.pageCount };
    const buf = await getPdfBuffer(asset);
    if (!buf) return null;
    try {
      const UTIF = await import('utif');
      const utifModule = (UTIF as any).default || UTIF;
      const ifds = utifModule.decode(buf);
      return { numPages: ifds && ifds.length > 0 ? ifds.length : 1 };
    } catch {
      return { numPages: 1 };
    }
  }

  const key = asset.fullPath || asset.id;
  const cached = docCache.get(key);
  if (cached) return { numPages: cached.numPages };

  const buf = await getPdfBuffer(asset);
  if (!buf) {
    // If mock asset has pageCount defined, return that
    if (asset.pageCount) return { numPages: asset.pageCount };
    return null;
  }

  try {
    let pdfBytes = new Uint8Array(buf);
    const { findPdfOffset } = await import('./adobeThumbnailExtractor');
    const pdfOff = findPdfOffset(pdfBytes, 1024 * 512);
    if (pdfOff > 0) {
      pdfBytes = pdfBytes.subarray(pdfOff);
    }
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: pdfBytes });
    const doc = await task.promise;
    docCache.set(key, { doc, numPages: doc.numPages });
    return { numPages: doc.numPages };
  } catch (err) {
    console.warn('[pdfPreview] Error getting PDF doc:', err);
    return null;
  }
}

/**
 * Renders the first page of an arbitrary PDF ArrayBuffer (including embedded PDF streams in .ai files).
 */
export async function renderPdfBufferFirstPage(
  buffer: ArrayBuffer,
  targetWidth = 1000
): Promise<{ url: string; width: number; height: number; pageCount: number } | null> {
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
        url: canvas.toDataURL('image/jpeg', 0.88),
        width: canvas.width,
        height: canvas.height,
        pageCount: doc.numPages,
      };
    } finally {
      void task.destroy();
    }
  } catch (err) {
    console.warn('[pdfPreview] renderPdfBufferFirstPage failed:', err);
    return null;
  }
}

export async function renderPdfPage(
  asset: AssetItem,
  pageNum: number,
  targetWidth = 1400
): Promise<{ url: string; width: number; height: number } | null> {
  const cacheKey = `${asset.fullPath || asset.id}_p${pageNum}_w${targetWidth}`;
  const cached = pageRenderCache.get(cacheKey);
  if (cached) return cached;

  const ext = asset.extension.toLowerCase();
  if (ext === 'tif' || ext === 'tiff') {
    const buf = await getPdfBuffer(asset);
    if (!buf) return null;
    const { extractTiffThumbnail } = await import('./adobeThumbnailExtractor');
    const res = await extractTiffThumbnail(buf, asset.name, pageNum - 1);
    if (res) {
      const out = { url: res.url, width: res.width, height: res.height };
      pageRenderCache.set(cacheKey, out);
      return out;
    }
    return null;
  }

  const key = asset.fullPath || asset.id;
  let docEntry = docCache.get(key);

  if (!docEntry) {
    const buf = await getPdfBuffer(asset);
    if (!buf) return null;
    let pdfBytes = new Uint8Array(buf);
    const { findPdfOffset } = await import('./adobeThumbnailExtractor');
    const pdfOff = findPdfOffset(pdfBytes, 1024 * 512);
    if (pdfOff > 0) {
      pdfBytes = pdfBytes.subarray(pdfOff);
    }
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: pdfBytes });
    const doc = await task.promise;
    docEntry = { doc, numPages: doc.numPages };
    docCache.set(key, docEntry);
  }

  if (pageNum < 1 || pageNum > docEntry.numPages) return null;

  try {
    const page = await docEntry.doc.getPage(pageNum);
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

    const result = {
      url: canvas.toDataURL('image/jpeg', 0.88),
      width: canvas.width,
      height: canvas.height,
    };

    pageRenderCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[pdfPreview] Error rendering page ${pageNum}:`, err);
    return null;
  }
}
