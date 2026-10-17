/**
 * Vector, HTML, and creative design software extractors:
 * - SVG vector (.svg)
 * - HTML webpage preview (.html, .htm)
 * - Figma documents (.fig)
 * - Krita documents (.kra)
 * - Corel Painter (.rif, .riff)
 * - RIFF chunk walker, DIB converter, and embedded PNG scanner
 */

import { getImageDimensions } from './types';
import { extractXmpThumbnail, extractEmbeddedJpeg } from './adobeExtractor';

/**
 * Converts a raw Windows DIB (starting with BITMAPINFOHEADER) to a standard 14-byte headed BMP file.
 */
export function dibToBmp(dibBytes: Uint8Array): Uint8Array | null {
  if (dibBytes.length < 40) return null;
  const view = new DataView(dibBytes.buffer, dibBytes.byteOffset, dibBytes.byteLength);
  const biSize = view.getUint32(0, true);
  if (biSize !== 40) return null;

  const biBitCount = view.getUint16(14, true);
  const biCompression = view.getUint32(16, true);
  const biClrUsed = view.getUint32(32, true);

  let extraHeader = 0;
  if (biCompression === 3) {
    extraHeader = 12; // BI_BITFIELDS (3 RGB masks)
  }

  let paletteSize = 0;
  if (biClrUsed > 0) {
    paletteSize = biClrUsed * 4;
  } else if (biBitCount <= 8) {
    paletteSize = (1 << biBitCount) * 4;
  }

  const offsetToPixels = 14 + biSize + extraHeader + paletteSize;
  const totalBmpSize = 14 + dibBytes.length;

  const bmp = new Uint8Array(totalBmpSize);
  const bmpView = new DataView(bmp.buffer);

  // BITMAPFILEHEADER (14 bytes)
  bmp[0] = 0x42; // 'B'
  bmp[1] = 0x4d; // 'M'
  bmpView.setUint32(2, totalBmpSize, true);
  bmpView.setUint16(6, 0, true);
  bmpView.setUint16(8, 0, true);
  bmpView.setUint32(10, offsetToPixels, true);

  // Copy DIB bytes after header
  bmp.set(dibBytes, 14);
  return bmp;
}

/**
 * Scans a binary buffer for an embedded PNG stream (89 50 4E 47 ... IEND).
 */
export function extractEmbeddedPng(
  buffer: ArrayBuffer,
  minSize = 1024,
  maxScan = 1024 * 1024 * 32
): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const limit = Math.min(bytes.length - 8, maxScan);
    let bestBlob: Blob | null = null;
    let bestLength = 0;

    for (let i = 0; i < limit; i++) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47 &&
        bytes[i + 4] === 0x0d &&
        bytes[i + 5] === 0x0a &&
        bytes[i + 6] === 0x1a &&
        bytes[i + 7] === 0x0a
      ) {
        // Search for IEND: 49 45 4E 44
        const searchMax = Math.min(bytes.length - 4, i + 1024 * 1024 * 16);
        for (let j = i + minSize; j < searchMax; j++) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            const end = j + 8; // IEND + 4-byte CRC
            const length = end - i;
            if (length > bestLength) {
              bestLength = length;
              bestBlob = new Blob([bytes.subarray(i, end)], { type: 'image/png' });
            }
            i = end - 1; // Skip past this PNG
            break;
          }
        }
      }
    }

    if (bestBlob) {
      return URL.createObjectURL(bestBlob);
    }
  } catch (err) {
    console.warn('Embedded PNG scan failed:', err);
  }
  return null;
}

/**
 * Scans buffer for an embedded DIB (BITMAPINFOHEADER where biSize == 40).
 */
export function extractEmbeddedDib(buffer: ArrayBuffer, maxScan = 1024 * 1024 * 16): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const limit = Math.min(bytes.length - 40, maxScan);

    for (let i = 0; i < limit; i += 2) {
      if (view.getUint32(i, true) === 40) {
        const width = view.getInt32(i + 4, true);
        const height = Math.abs(view.getInt32(i + 8, true));
        const planes = view.getUint16(i + 12, true);
        const bitCount = view.getUint16(i + 14, true);
        const compression = view.getUint32(i + 16, true);

        if (
          planes === 1 &&
          width >= 32 &&
          width <= 4096 &&
          height >= 32 &&
          height <= 4096 &&
          (bitCount === 24 || bitCount === 32 || bitCount === 8) &&
          (compression === 0 || compression === 3)
        ) {
          const rowBytes = Math.floor(((width * bitCount + 31) & ~31) / 8);
          const dibSize = 40 + (bitCount <= 8 ? 1024 : 0) + rowBytes * height;
          if (i + dibSize <= bytes.length) {
            const dibSlice = bytes.subarray(i, i + dibSize);
            const bmp = dibToBmp(dibSlice);
            if (bmp) {
              const blob = new Blob([bmp.buffer as ArrayBuffer], { type: 'image/bmp' });
              return URL.createObjectURL(blob);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Embedded DIB scan failed:', err);
  }
  return null;
}

/**
 * Walks RIFF container chunks to find embedded preview (RDIB / DIB / THMB / JPEG / PNG / PREV).
 * Supports little-endian RIFF and big-endian RIFX, and traverses nested LIST chunks.
 */
export function extractFromRiffChunks(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 12) return null;
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Check 'RIFF' or 'RIFX'
  const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // 'RIFF'
  const isRifx = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x58; // 'RIFX'
  if (!isRiff && !isRifx) return null;

  const little = isRiff;
  const queue: Array<[number, number]> = [[12, Math.min(buffer.byteLength, 1024 * 1024 * 32)]];

  while (queue.length > 0) {
    const [start, end] = queue.shift()!;
    let offset = start;

    while (offset + 8 <= end) {
      const chunkId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      const chunkSize = view.getUint32(offset + 4, little);
      const chunkDataOffset = offset + 8;
      const upperId = chunkId.toUpperCase();

      if (chunkSize > 0 && chunkDataOffset + chunkSize <= buffer.byteLength) {
        if (upperId === 'LIST' && chunkSize >= 4) {
          queue.push([chunkDataOffset + 4, Math.min(end, chunkDataOffset + chunkSize)]);
        } else if (['RDIB', 'DIB ', 'THMB', 'PREV'].includes(upperId)) {
          const chunkSlice = bytes.subarray(chunkDataOffset, chunkDataOffset + chunkSize);
          if (chunkSlice[0] === 0xff && chunkSlice[1] === 0xd8 && chunkSlice[2] === 0xff) {
            const blob = new Blob([chunkSlice], { type: 'image/jpeg' });
            return URL.createObjectURL(blob);
          }
          if (
            chunkSlice[0] === 0x89 &&
            chunkSlice[1] === 0x50 &&
            chunkSlice[2] === 0x4e &&
            chunkSlice[3] === 0x47
          ) {
            const blob = new Blob([chunkSlice], { type: 'image/png' });
            return URL.createObjectURL(blob);
          }
          const searchLimit = Math.min(chunkSize - 40, 128);
          for (let k = 0; k <= searchLimit; k += 2) {
            if (view.getUint32(chunkDataOffset + k, true) === 40) {
              const dibSlice = bytes.subarray(chunkDataOffset + k, chunkDataOffset + chunkSize);
              const bmpData = dibToBmp(dibSlice);
              if (bmpData) {
                const blob = new Blob([bmpData.buffer as ArrayBuffer], { type: 'image/bmp' });
                return URL.createObjectURL(blob);
              }
              break;
            }
          }
        } else if (['JPEG', 'JPE '].includes(upperId)) {
          const chunkSlice = bytes.subarray(chunkDataOffset, chunkDataOffset + chunkSize);
          const blob = new Blob([chunkSlice], { type: 'image/jpeg' });
          return URL.createObjectURL(blob);
        } else if (upperId === 'PNG ') {
          const chunkSlice = bytes.subarray(chunkDataOffset, chunkDataOffset + chunkSize);
          const blob = new Blob([chunkSlice], { type: 'image/png' });
          return URL.createObjectURL(blob);
        }
      }

      const advance = 8 + chunkSize + (chunkSize % 2);
      if (advance <= 8) break;
      offset += advance;
    }
  }

  return null;
}

/**
 * Extracts embedded thumbnail or preview from a Corel Painter (.rif / .riff) file.
 */
export async function extractPainterThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean }> {
  try {
    const xmpThumb = extractXmpThumbnail(buffer);
    if (xmpThumb) {
      const dims = await getImageDimensions(xmpThumb);
      return { url: xmpThumb, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    const riffThumb = extractFromRiffChunks(buffer);
    if (riffThumb) {
      const dims = await getImageDimensions(riffThumb);
      return { url: riffThumb, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    const embeddedJpeg = extractEmbeddedJpeg(buffer, 1500, 1024 * 1024 * 24);
    if (embeddedJpeg) {
      const dims = await getImageDimensions(embeddedJpeg);
      return { url: embeddedJpeg, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    const embeddedPng = extractEmbeddedPng(buffer, 1024, 1024 * 1024 * 24);
    if (embeddedPng) {
      const dims = await getImageDimensions(embeddedPng);
      return { url: embeddedPng, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    const embeddedDib = extractEmbeddedDib(buffer, 1024 * 1024 * 24);
    if (embeddedDib) {
      const dims = await getImageDimensions(embeddedDib);
      return { url: embeddedDib, width: dims.width, height: dims.height, isPlaceholder: false };
    }
  } catch (err) {
    console.warn('Corel Painter thumbnail extraction failed:', err);
  }

  return { url: '', width: 0, height: 0, isPlaceholder: true };
}

interface ZipEntryWithInternalData {
  async: (type: 'blob' | 'arraybuffer' | 'string' | 'base64') => Promise<any>;
  _data?: { uncompressedSize?: number };
}

/**
 * Extracts embedded preview or thumbnail from a Figma (.fig) file.
 */
export async function extractFigmaThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean }> {
  try {
    const bytes = new Uint8Array(buffer);

    // Method 1: If file is a ZIP archive or contains a ZIP payload (modern .fig package)
    let zipOffset = -1;
    const maxZipSearch = Math.min(bytes.length - 4, 1024 * 1024 * 4);
    for (let i = 0; i < maxZipSearch; i++) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
        zipOffset = i;
        break;
      }
    }

    if (zipOffset !== -1) {
      try {
        const { default: JSZipModule } = await import('jszip');
        const JSZip = (JSZipModule as any)?.default || JSZipModule;
        const zipData = zipOffset === 0 ? buffer : buffer.slice(zipOffset);
        const zip = await JSZip.loadAsync(zipData);

        const entries: { path: string; file: ZipEntryWithInternalData }[] = [];
        zip.forEach((path: string, entry: any) => {
          if (!entry.dir) {
            entries.push({ path, file: entry as unknown as ZipEntryWithInternalData });
          }
        });

        const thumbFile =
          entries.find((e) => /(^|\/)(thumbnail|preview|cover|canvas)\.(png|jpe?g|webp)$/i.test(e.path)) ||
          entries.find((e) => /(thumbnail|preview|cover).*\.(png|jpe?g|webp)$/i.test(e.path));

        if (thumbFile) {
          const b64 = await thumbFile.file.async('base64');
          const mime = /\.png$/i.test(thumbFile.path) ? 'image/png' : /\.webp$/i.test(thumbFile.path) ? 'image/webp' : 'image/jpeg';
          const url = `data:${mime};base64,${b64}`;
          const dims = await getImageDimensions(url);
          return { url, width: dims.width, height: dims.height, isPlaceholder: false };
        }

        const imageCandidates = entries.filter((e) => e.path.startsWith('images/'));
        imageCandidates.sort(
          (a, b) => (b.file._data?.uncompressedSize || 0) - (a.file._data?.uncompressedSize || 0)
        );

        for (const cand of imageCandidates) {
          const buf = (await cand.file.async('arraybuffer')) as ArrayBuffer;
          const u8 = new Uint8Array(buf);
          if (u8.length >= 8) {
            if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) {
              const b64 = await cand.file.async('base64');
              const url = `data:image/png;base64,${b64}`;
              const dims = await getImageDimensions(url);
              return { url, width: dims.width, height: dims.height, isPlaceholder: false };
            }
            if (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
              const b64 = await cand.file.async('base64');
              const url = `data:image/jpeg;base64,${b64}`;
              const dims = await getImageDimensions(url);
              return { url, width: dims.width, height: dims.height, isPlaceholder: false };
            }
            if (
              u8[0] === 0x52 &&
              u8[1] === 0x49 &&
              u8[2] === 0x46 &&
              u8[3] === 0x46 &&
              u8[8] === 0x57 &&
              u8[9] === 0x45 &&
              u8[10] === 0x42 &&
              u8[11] === 0x50
            ) {
              const b64 = await cand.file.async('base64');
              const url = `data:image/webp;base64,${b64}`;
              const dims = await getImageDimensions(url);
              return { url, width: dims.width, height: dims.height, isPlaceholder: false };
            }
          }
        }
      } catch (zipErr) {
        console.debug('Figma zip chunk parse failed, falling back to stream scan:', zipErr);
      }
    }

    // Method 2: Scan for embedded PNG stream (monolithic fig-kiwi binary payload)
    const embeddedPng = extractEmbeddedPng(buffer, 256, 1024 * 1024 * 64);
    if (embeddedPng) {
      const dims = await getImageDimensions(embeddedPng);
      return { url: embeddedPng, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    // Method 3: Scan for embedded JPEG stream
    const embeddedJpeg = extractEmbeddedJpeg(buffer, 256, 1024 * 1024 * 64);
    if (embeddedJpeg) {
      const dims = await getImageDimensions(embeddedJpeg);
      return { url: embeddedJpeg, width: dims.width, height: dims.height, isPlaceholder: false };
    }
  } catch (err) {
    console.warn('Figma thumbnail extraction failed:', err);
  }

  return { url: '', width: 0, height: 0, isPlaceholder: true };
}

/**
 * Extracts embedded preview or thumbnail from a Krita (.kra) file.
 */
export async function extractKritaThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean }> {
  try {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);

      const candidateFiles = [
        zip.file('mergedimage.png'),
        zip.file('preview.png'),
        zip.file('Thumbnails/thumbnail.png'),
        zip.file('thumbnails/thumbnail.png'),
        ...zip.file(/^Thumbnails\/thumbnail\.(png|jpe?g|webp)$/i),
        ...zip.file(/^thumbnails\/thumbnail\.(png|jpe?g|webp)$/i),
        ...zip.file(/^(mergedimage|preview).*\.(png|jpe?g|webp)$/i),
        ...zip.file(/thumbnail.*\.png$/i),
      ].filter(Boolean);

      let docW = 0;
      let docH = 0;
      try {
        const mainDocEntry = zip.file('maindoc.xml');
        if (mainDocEntry) {
          const mainDocText = await mainDocEntry.async('string');
          const wMatch = mainDocText.match(/<IMAGE[^>]*width=["'](\d+)["']/i);
          const hMatch = mainDocText.match(/<IMAGE[^>]*height=["'](\d+)["']/i);
          if (wMatch && hMatch) {
            docW = parseInt(wMatch[1], 10);
            docH = parseInt(hMatch[1], 10);
          }
        }
      } catch {}

      const target = candidateFiles[0];
      if (target) {
        const blob = await target.async('blob');
        const url = URL.createObjectURL(blob);
        const dims = await getImageDimensions(url);
        return {
          url,
          width: docW > 0 ? docW : dims.width,
          height: docH > 0 ? docH : dims.height,
          isPlaceholder: false,
        };
      }
    }

    const embeddedPng = extractEmbeddedPng(buffer, 2048, 1024 * 1024 * 32);
    if (embeddedPng) {
      const dims = await getImageDimensions(embeddedPng);
      return { url: embeddedPng, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    const embeddedJpeg = extractEmbeddedJpeg(buffer, 2048, 1024 * 1024 * 32);
    if (embeddedJpeg) {
      const dims = await getImageDimensions(embeddedJpeg);
      return { url: embeddedJpeg, width: dims.width, height: dims.height, isPlaceholder: false };
    }
  } catch (err) {
    console.warn('Krita thumbnail extraction failed:', err);
  }

  return { url: '', width: 0, height: 0, isPlaceholder: true };
}

/**
 * Ultra-fast offline SVG vector thumbnail and dimensions extractor.
 */
export async function extractSvgThumbnail(
  source: ArrayBuffer | string,
  fileName: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean }> {
  try {
    let svgText = '';
    if (typeof source === 'string') {
      svgText = source;
    } else {
      svgText = new TextDecoder('utf-8', { fatal: false }).decode(source);
    }

    svgText = svgText.replace(/^\uFEFF/, '').trim();

    if (!svgText.includes('<svg') && !svgText.includes('</svg>')) {
      return { url: '', width: 0, height: 0, isPlaceholder: true };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    let svgEl = doc.querySelector('svg');

    if (!svgEl || doc.querySelector('parsererror')) {
      const match = svgText.match(/<svg[\s\S]*?<\/svg>/i);
      if (match) {
        const fallbackDoc = parser.parseFromString(match[0], 'image/svg+xml');
        svgEl = fallbackDoc.querySelector('svg');
      }
    }

    if (svgEl) {
      svgEl.querySelectorAll('script, foreignObject, iframe, embed, object').forEach((s) => s.remove());
      svgEl.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const lowerName = attr.name.toLowerCase();
          const lowerVal = attr.value.toLowerCase();
          if (lowerName.startsWith('on') || lowerVal.includes('javascript:') || lowerVal.includes('data:text/html')) {
            el.removeAttribute(attr.name);
          }
        }
      });

      if (!svgEl.getAttribute('xmlns')) {
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }

      let width = 0;
      let height = 0;

      const vb = svgEl.getAttribute('viewBox');
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/).map(parseFloat);
        if (parts.length === 4 && !isNaN(parts[2]) && !isNaN(parts[3]) && parts[2] > 0 && parts[3] > 0) {
          width = Math.round(parts[2]);
          height = Math.round(parts[3]);
        }
      }

      const rawW = svgEl.getAttribute('width');
      const rawH = svgEl.getAttribute('height');
      if (rawW && !rawW.includes('%')) {
        const parsedW = parseFloat(rawW);
        if (!isNaN(parsedW) && parsedW > 0) width = Math.round(parsedW);
      }
      if (rawH && !rawH.includes('%')) {
        const parsedH = parseFloat(rawH);
        if (!isNaN(parsedH) && parsedH > 0) height = Math.round(parsedH);
      }

      if (width <= 0 || height <= 0) {
        width = 800;
        height = 800;
      }

      const serializer = new XMLSerializer();
      const cleanXml = serializer.serializeToString(svgEl);

      const blob = new Blob([cleanXml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      return {
        url,
        width,
        height,
        isPlaceholder: false,
      };
    }
  } catch (err) {
    console.warn('[SVG] Thumbnail extraction failed for', fileName, err);
  }

  return { url: '', width: 0, height: 0, isPlaceholder: true };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders an HTML (.html / .htm) file into an authentic desktop webpage preview snapshot.
 */
export async function extractHtmlThumbnail(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ url: string; width: number; height: number; title?: string; isPlaceholder?: boolean }> {
  try {
    const bytes = new Uint8Array(buffer);
    const htmlText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!htmlText || htmlText.trim().length === 0) {
      throw new Error('Empty HTML content');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const pageTitle = doc.title?.trim() || fileName.replace(/\.[^/.]+$/, '');

    let customStyles = '';
    doc.querySelectorAll('style').forEach((el) => {
      customStyles += (el.textContent || '') + '\n';
    });

    let bodyXhtml = '';
    if (doc.body) {
      const cloneBody = doc.body.cloneNode(true) as HTMLElement;
      cloneBody.querySelectorAll('script, iframe, object, embed').forEach((s) => s.remove());
      cloneBody.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const lowerName = attr.name.toLowerCase();
          const lowerVal = attr.value.toLowerCase();
          if (lowerName.startsWith('on') || lowerVal.includes('javascript:') || lowerVal.includes('data:text/html')) {
            el.removeAttribute(attr.name);
          }
        }
      });
      const serializer = new XMLSerializer();
      bodyXhtml = serializer.serializeToString(cloneBody);
    } else {
      bodyXhtml = '<div>' + escapeXml(pageTitle) + '</div>';
    }

    const canvasWidth = 1280;
    const canvasHeight = 960;
    const headerHeight = 44;
    const contentHeight = canvasHeight - headerHeight;

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <defs>
    <linearGradient id="hdrGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#26282f"/>
      <stop offset="100%" stop-color="#181a1f"/>
    </linearGradient>
  </defs>

  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff"/>

  <rect width="${canvasWidth}" height="${headerHeight}" fill="url(#hdrGrad)"/>
  <line x1="0" y1="${headerHeight}" x2="${canvasWidth}" y2="${headerHeight}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <circle cx="22" cy="${headerHeight / 2}" r="5.5" fill="#ff5f56"/>
  <circle cx="40" cy="${headerHeight / 2}" r="5.5" fill="#ffbd2e"/>
  <circle cx="58" cy="${headerHeight / 2}" r="5.5" fill="#27c93f"/>

  <rect x="80" y="8" width="${canvasWidth - 160}" height="28" rx="6" ry="6" fill="#141518" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="${canvasWidth / 2}" y="26" fill="#a1a1aa" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" text-anchor="middle" font-weight="500">
    ${escapeXml(fileName)}
  </text>

  <g transform="translate(0, ${headerHeight})">
    <foreignObject width="${canvasWidth}" height="${contentHeight}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${canvasWidth}px;height:${contentHeight}px;overflow:hidden;background:#ffffff;color:#111827;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.5;box-sizing:border-box;">
        <style>
          ${customStyles}
        </style>
        ${bodyXhtml}
      </div>
    </foreignObject>
  </g>
</svg>
`.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const rasterResult = await new Promise<{ url: string; width: number; height: number } | null>((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 1200);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            URL.revokeObjectURL(blobUrl);
            resolve({ url: dataUrl, width: canvasWidth, height: canvasHeight });
            return;
          }
        } catch {
          // Canvas tainting fallback
        }
        resolve(null);
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      img.src = blobUrl;
    });

    if (rasterResult) {
      return { ...rasterResult, title: pageTitle };
    }

    return {
      url: blobUrl,
      width: canvasWidth,
      height: canvasHeight,
      title: pageTitle,
    };
  } catch (err) {
    console.warn('[HTML] Thumbnail extraction failed for ' + fileName + ':', err);
    return { url: '', width: 0, height: 0, isPlaceholder: true };
  }
}
