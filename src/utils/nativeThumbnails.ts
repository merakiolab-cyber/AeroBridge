/**
 * Native (Tauri) thumbnail pipeline.
 * Generates real previews for PDF, InDesign, Illustrator, Photoshop, RAW and video files
 * lazily in the background so that folder browsing stays instant.
 */

import { AssetItem } from '../types';
import {
  extractAiThumbnail,
  extractEmbeddedJpeg,
  extractPsdThumbnail,
  extractRawThumbnail,
  generateDocumentPlaceholder,
  getImageDimensions,
} from './adobeThumbnailExtractor';
import {
  extractNativeXmpThumbnail,
  readNativeFileBinary,
  toDesktopAssetUrl,
} from './tauriBridge';

export interface ThumbPatch {
  url: string;
  dimensions: { width: number; height: number };
  duration?: number;
}

const MB = 1024 * 1024;
const MAX_PDF_BYTES = 200 * MB;

// ---------------------------------------------------------------------------
// Cheap, cached per-extension placeholders (no per-file canvas work during scan)
// ---------------------------------------------------------------------------
const placeholderCache = new Map<string, string>();

export function getCachedPlaceholder(extension: string, color: string, format: string): string {
  const key = `${extension}|${color}`;
  let url = placeholderCache.get(key);
  if (!url) {
    url = generateDocumentPlaceholder(format, extension, color, 'Načítám náhled…');
    placeholderCache.set(key, url);
  }
  return url;
}

// ---------------------------------------------------------------------------
// PDF (pdf.js, fully offline) – also used for .ai (PDF-compatible Illustrator files)
// ---------------------------------------------------------------------------
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, workerMod] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'),
      ]);
      pdfjs.GlobalWorkerOptions.workerPort = new workerMod.default();
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
// Public: generate preview for a single native asset
// ---------------------------------------------------------------------------
export async function generateNativeThumbnail(asset: AssetItem): Promise<ThumbPatch | null> {
  const path = asset.fullPath;
  if (!path) return null;
  const ext = asset.extension.toLowerCase();

  try {
    switch (asset.category) {
      case 'image':
        // Standard web-renderable images are displayed directly through the asset URL
        return null;

      case 'video':
        return await videoSnapshot(toDesktopAssetUrl(path));

      case 'pdf': {
        if (asset.size > MAX_PDF_BYTES) return null;
        const buf = await readNativeFileBinary(path);
        return await renderPdfFirstPage(buf);
      }

      case 'adobe-indd': {
        if (ext === 'idml') {
          const t = await idmlThumbnail(path);
          if (t) return await withDims(t);
          return null;
        }
        const xmp = await extractNativeXmpThumbnail(path, 700);
        if (xmp) return await withDims(xmp);
        const head = await readNativeFileBinary(path, 24 * MB);
        const jpeg = extractEmbeddedJpeg(head, 8192, 24 * MB);
        return jpeg ? await withDims(jpeg) : null;
      }

      case 'adobe-ai': {
        // Modern .ai files are PDF-compatible – render the artboard with pdf.js
        if (asset.size <= MAX_PDF_BYTES) {
          const buf = await readNativeFileBinary(path);
          const head = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
          const isPdf = new TextDecoder().decode(head).includes('%PDF-');
          if (isPdf) {
            const rendered = await renderPdfFirstPage(buf);
            if (rendered) return rendered;
          }
        }
        const xmp = await extractNativeXmpThumbnail(path, 700);
        if (xmp) return await withDims(xmp);
        const buf = await readNativeFileBinary(path, 8 * MB);
        const res = await extractAiThumbnail(buf, asset.name);
        return { url: res.url, dimensions: { width: res.width, height: res.height } };
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
        return { url: res.url, dimensions: { width: res.width, height: res.height } };
      }

      case 'vector': {
        if (ext === 'eps') {
          const buf = await readNativeFileBinary(path, 8 * MB);
          const res = await extractAiThumbnail(buf, asset.name);
          return { url: res.url, dimensions: { width: res.width, height: res.height } };
        }
        return null;
      }

      default:
        return null;
    }
  } catch (err) {
    console.warn(`[Thumbnails] Failed for ${asset.name}:`, err);
    return null;
  }
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
  const queue = assets.filter((a) => a.category !== 'image' && a.category !== 'other' && a.fullPath);
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
    if (!flushTimer) flushTimer = setTimeout(flush, 120);
  };

  const worker = async () => {
    while (!job.cancelled) {
      const asset = queue[index++];
      if (!asset) break;
      const patch = await generateNativeThumbnail(asset);
      if (job.cancelled) break;
      if (patch) {
        pending.set(asset.id, patch);
      } else {
        // Failure: switch from the "loading" card to a named placeholder
        pending.set(asset.id, {
          url: generateDocumentPlaceholder(asset.name, asset.extension, asset.colorBadge, asset.format),
          dimensions: { width: 1200, height: 900 },
        });
      }
      schedule();
    }
    if (index >= queue.length) flush();
  };

  for (let i = 0; i < concurrency; i++) void worker();
  return job;
}
