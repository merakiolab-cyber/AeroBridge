/**
 * AeroBridge Studio — on-demand high-resolution previews
 *
 * Grid thumbnails stay fast (embedded thumbnails, 900 px PDF renders). The large views (Filmstrip, Compare,
 * QuickLook, Inspector) call this to swap in a sharper rendition once it is ready:
 *  - PSD / PSB: the flattened composite from the end of the file (see extractors/psdComposite.ts)
 *  - PDF / AI:  a re-render of page 1 at the requested width (the grid copy is only 900 px wide)
 * Everything else returns null and keeps showing `asset.url`.
 */

import { useEffect, useState } from 'react';
import { AssetItem } from '../types';
import { decodePsdComposite, RangeReader } from './extractors/psdComposite';
import { isDesktopApp, readNativeFileRange } from './tauriBridge';

const MAX_CACHED = 16;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const ext = (asset: AssetItem) => (asset.extension || '').toLowerCase().replace(/^\./, '');

/**
 * False for formats whose preview is a rescaled rendition of the document (PSD / PSB / PDF / AI): their real size
 * comes from the file header or the page box and must not be replaced by the dimensions of a loaded preview image.
 */
export function previewReflectsDocumentSize(asset: AssetItem): boolean {
  const e = ext(asset);
  return e !== 'psd' && e !== 'psb' && e !== 'pdf' && e !== 'ai';
}

export function canUpgradePreview(asset: AssetItem | null | undefined): boolean {
  if (!asset || asset.isFolder || asset.isIcon) return false;
  const e = ext(asset);
  return e === 'psd' || e === 'psb' || e === 'pdf' || e === 'ai';
}

function keyFor(asset: AssetItem, width: number): string {
  return `${asset.fullPath || asset.id}:${asset.size}:${asset.dateModified || ''}:${asset.currentPage || 1}:w${width}`;
}

function remember(key: string, url: string) {
  cache.delete(key);
  cache.set(key, url);
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value as string;
    const old = cache.get(oldest);
    cache.delete(oldest);
    if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
  }
}

function readerFor(asset: AssetItem): RangeReader | null {
  if (isDesktopApp() && asset.fullPath) {
    const path = asset.fullPath;
    return (offset, length) => readNativeFileRange(path, offset, length);
  }
  const source: Blob | undefined = asset.fileRef ?? asset.blob;
  if (source) return (offset, length) => source.slice(offset, offset + length).arrayBuffer();
  return null;
}

async function build(asset: AssetItem, width: number): Promise<string | null> {
  const e = ext(asset);
  try {
    if (e === 'psd' || e === 'psb') {
      const reader = readerFor(asset);
      if (!reader) return null;
      const res = await decodePsdComposite(reader, width);
      return res?.url ?? null;
    }
    if (e === 'pdf' || e === 'ai') {
      const { renderPdfPage } = await import('./pdfPreview');
      const res = await renderPdfPage(asset, asset.currentPage || 1, width);
      return res?.url ?? null;
    }
  } catch (err) {
    console.debug('[hiResPreview] failed for', asset.name, err);
  }
  return null;
}

/** Cached lookup without starting any work. */
export function peekHiResPreview(asset: AssetItem, width: number): string | null {
  return cache.get(keyFor(asset, width)) ?? null;
}

export function getHiResPreview(asset: AssetItem, width: number): Promise<string | null> {
  if (!canUpgradePreview(asset)) return Promise.resolve(null);
  const key = keyFor(asset, width);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  let pending = inflight.get(key);
  if (!pending) {
    pending = build(asset, width)
      .then((url) => {
        if (url) remember(key, url);
        return url;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

/**
 * Returns a sharper preview URL for `asset` once available, otherwise null (keep using `asset.url`).
 * Work starts after a short delay so scrubbing through a filmstrip does not decode every file it passes.
 */
export function useHiResPreview(
  asset: AssetItem | null | undefined,
  targetWidth: number,
  enabled = true
): string | null {
  const key = asset && canUpgradePreview(asset) ? keyFor(asset, targetWidth) : '';
  const [ready, setReady] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!enabled || !asset || !key) {
      setReady(null);
      return;
    }
    const cached = peekHiResPreview(asset, targetWidth);
    if (cached) {
      setReady({ key, url: cached });
      return;
    }
    setReady(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      void getHiResPreview(asset, targetWidth).then((url) => {
        if (!cancelled && url) setReady({ key, url });
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return ready && ready.key === key ? ready.url : null;
}
