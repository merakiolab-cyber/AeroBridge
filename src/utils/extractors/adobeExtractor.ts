/**
 * Adobe format thumbnail & preview extractors:
 * - Adobe InDesign (.indd, .idml)
 * - Adobe Photoshop (.psd, .psb)
 * - Adobe Illustrator (.ai, .eps)
 * - Adobe XMP metadata preview streams
 */

import { getImageDimensions } from './types';

/**
 * Extracts base64-encoded thumbnail from XMP packet.
 * Adobe InDesign, Illustrator, and Photoshop store embedded previews in <xmpGImg:image>...</xmpGImg:image>.
 */
export function extractXmpThumbnail(buffer: ArrayBuffer, maxScanBytes = 1024 * 1024 * 32): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const scanLimit = Math.min(bytes.length, maxScanBytes);
    const textChunk = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, scanLimit));

    // Match <xmpGImg:image...>...</xmpGImg:image>; Adobe writes line breaks as &#xA; entities
    const match = textChunk.match(/<x[ma]pGImg:image[^>]*>([\s\S]{100,}?)<\/x[ma]pGImg:image>/i);
    if (match && match[1]) {
      const cleanBase64 = match[1]
        .replace(/&#x?[0-9a-f]+;/gi, '')
        .replace(/[^A-Za-z0-9+/=]/g, '');
      if (cleanBase64.length > 100) {
        return `data:image/jpeg;base64,${cleanBase64}`;
      }
    }
  } catch (err) {
    console.warn('XMP thumbnail extraction failed:', err);
  }
  return null;
}

/**
 * Scans a binary buffer for the largest embedded JPEG image (SOI 0xFF 0xD8 ... EOI 0xFF 0xD9).
 * Used for InDesign documents, camera RAW files (CR2, NEF, ARW, DNG), and EPS files.
 */
export function extractEmbeddedJpeg(
  buffer: ArrayBuffer,
  minSize = 4096,
  maxScan = 1024 * 1024 * 12
): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const limit = Math.min(bytes.length - 4, maxScan);
    let bestBlob: Blob | null = null;
    let bestLength = 0;

    for (let i = 0; i < limit; i++) {
      // Check for JPEG SOI (0xFF, 0xD8, 0xFF)
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        // Look for matching EOI (0xFF, 0xD9)
        const maxSearch = Math.min(bytes.length - 1, i + 1024 * 1024 * 10);
        for (let j = i + minSize; j < maxSearch; j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const length = j + 2 - i;
            if (length > bestLength) {
              bestLength = length;
              bestBlob = new Blob([bytes.subarray(i, j + 2)], { type: 'image/jpeg' });
            }
            i = j + 1; // Skip past this JPEG
            break;
          }
        }
      }
    }

    if (bestBlob) {
      return URL.createObjectURL(bestBlob);
    }
  } catch (err) {
    console.warn('Embedded JPEG search failed:', err);
  }
  return null;
}

/**
 * Extracts embedded thumbnail from Adobe InDesign (.indd / .idml) file.
 * InDesign documents store previews in XMP packets or as embedded page stream JPEGs.
 */
export async function extractInddThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean }> {
  // Method 1: Scan for embedded page preview JPEG (min 8KB) - InDesign embeds 512-1024px full page renders
  const embeddedJpeg = extractEmbeddedJpeg(buffer, 8192, 64 * 1024 * 1024);
  if (embeddedJpeg) {
    const dims = await getImageDimensions(embeddedJpeg);
    return { url: embeddedJpeg, width: dims.width, height: dims.height };
  }

  // Method 2: Check XMP base64 preview
  const xmpThumb = extractXmpThumbnail(buffer);
  if (xmpThumb) {
    const dims = await getImageDimensions(xmpThumb);
    return { url: xmpThumb, width: dims.width, height: dims.height };
  }

  // Fallback: No embedded preview available
  return { url: '', width: 0, height: 0, isPlaceholder: true };
}

/**
 * Extracts embedded JFIF/JPEG thumbnail from a Photoshop (.psd) file binary buffer.
 */
export function extractPsdThumbnail(buffer: ArrayBuffer): string | null {
  try {
    if (!buffer || buffer.byteLength < 26) return null;
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // 1. Verify PSD ('8BPS') signature
    if (view.getUint32(0, false) !== 0x38425053) return null;

    // 2. Parse Image Resources Section (where Photoshop stores embedded thumbnails 1036 and 1033)
    try {
      const colorModeLength = view.getUint32(26, false);
      let offset = 26 + 4 + colorModeLength;

      if (offset + 4 <= buffer.byteLength) {
        const imgResLength = view.getUint32(offset, false);
        offset += 4;
        const imgResEnd = Math.min(buffer.byteLength, offset + imgResLength);

        while (offset + 12 <= imgResEnd) {
          // Signature '8BIM' or 'MeSa'
          const sig = view.getUint32(offset, false);
          if (sig !== 0x3842494D && sig !== 0x4D655361) {
            break;
          }
          offset += 4;

          const resId = view.getUint16(offset, false);
          offset += 2;

          // Pascal string name (length byte + chars + padded to even)
          const nameLen = bytes[offset];
          offset += 1 + nameLen;
          if (offset % 2 !== 0) offset++; // Pad to even

          if (offset + 4 > imgResEnd) break;
          const resDataSize = view.getUint32(offset, false);
          offset += 4;

          if (offset + resDataSize > buffer.byteLength) break;

          // Resource ID 0x040C (1036): Photoshop 5.0+ Thumbnail Resource
          // Resource ID 0x0409 (1033): Photoshop 4.0 Thumbnail Resource
          if (resId === 0x040C || resId === 0x0409) {
            if (resDataSize > 28) {
              const format = view.getUint32(offset, false);
              if (format === 1) { // 1 = kJpegRGB
                const jpegStart = offset + 28;
                if (bytes[jpegStart] === 0xFF && bytes[jpegStart + 1] === 0xD8) {
                  const jpegBytes = bytes.subarray(jpegStart, offset + resDataSize);
                  let binary = '';
                  const chunkLen = 8192;
                  for (let c = 0; c < jpegBytes.length; c += chunkLen) {
                    binary += String.fromCharCode.apply(null, Array.from(jpegBytes.subarray(c, c + chunkLen)));
                  }
                  return `data:image/jpeg;base64,${btoa(binary)}`;
                }
              }
            }
          }

          // Resource ID 0x0424 (1060): XMP Metadata
          if (resId === 0x0424 && resDataSize > 100) {
            const xmpThumb = extractXmpThumbnail(buffer.slice(offset, offset + resDataSize), resDataSize);
            if (xmpThumb) return xmpThumb;
          }

          offset += resDataSize;
          if (offset % 2 !== 0) offset++; // Pad to even
        }
      }
    } catch (e) {
      console.debug('PSD structured resource parsing exception:', e);
    }

    // 3. Fallback: Search for XMP metadata packet anywhere in the buffer
    const xmpThumb = extractXmpThumbnail(buffer, Math.min(buffer.byteLength, 16 * 1024 * 1024));
    if (xmpThumb) return xmpThumb;

    // 4. Fallback: Scan for embedded JPEG marker (with minSize=2048 to catch small thumbnails too)
    return extractEmbeddedJpeg(buffer, 2048, Math.min(buffer.byteLength, 16 * 1024 * 1024));
  } catch (err) {
    console.warn('PSD thumbnail parsing skipped:', err);
  }
  return null;
}

/**
 * Locates the starting offset of %PDF- inside a binary buffer (e.g. for Illustrator .ai files).
 */
export function findPdfOffset(bytes: Uint8Array, maxSearch = 1024 * 1024 * 8): number {
  const limit = Math.min(bytes.length - 5, maxSearch);
  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d    // -
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Decodes PostScript %%BeginThumbnail or %AI7_Thumbnail hex data from .ai / .eps files
 */
export function extractPostScriptThumbnail(buffer: ArrayBuffer, maxScan = 1024 * 1024 * 8): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const limit = Math.min(bytes.length, maxScan);
    const text = new TextDecoder('latin1').decode(bytes.subarray(0, limit));

    // Look for %%BeginThumbnail: <width> <height> <depth>
    // or %AI7_Thumbnail: <width> <height> <depth>
    // or %%BeginPreview: <width> <height> <depth>
    const match = text.match(/(?:%%BeginThumbnail:|%AI7_Thumbnail:|%%BeginPreview:)\s*(\d+)\s+(\d+)\s+(\d+)/i);
    if (!match) return null;

    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    const depth = parseInt(match[3], 10);
    if (!width || !height || width <= 0 || height <= 0 || width > 2000 || height > 2000) return null;

    const startIndex = match.index! + match[0].length;
    const endMatch = text.slice(startIndex).match(/(?:%%EndThumbnail|%%EndPreview|%AI7_ThumbnailEnd|%%EndComments)/i);
    const endIndex = endMatch ? startIndex + endMatch.index! : text.length;

    const hexSection = text.slice(startIndex, endIndex);
    const cleanHex = hexSection.replace(/%[^\r\n]*[\r\n]+/g, '').replace(/[^0-9A-Fa-f]/g, '');
    if (cleanHex.length < width * height * 2) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    let hexIdx = 0;
    let pixelIdx = 0;
    const totalPixels = width * height;

    if (depth === 24 || cleanHex.length >= totalPixels * 6) {
      for (let p = 0; p < totalPixels && hexIdx + 5 < cleanHex.length; p++) {
        data[pixelIdx] = parseInt(cleanHex.substring(hexIdx, hexIdx + 2), 16);
        data[pixelIdx + 1] = parseInt(cleanHex.substring(hexIdx + 2, hexIdx + 4), 16);
        data[pixelIdx + 2] = parseInt(cleanHex.substring(hexIdx + 4, hexIdx + 6), 16);
        data[pixelIdx + 3] = 255;
        hexIdx += 6;
        pixelIdx += 4;
      }
    } else {
      for (let p = 0; p < totalPixels && hexIdx + 1 < cleanHex.length; p++) {
        const gray = parseInt(cleanHex.substring(hexIdx, hexIdx + 2), 16);
        data[pixelIdx] = gray;
        data[pixelIdx + 1] = gray;
        data[pixelIdx + 2] = gray;
        data[pixelIdx + 3] = 255;
        hexIdx += 2;
        pixelIdx += 4;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('PostScript thumbnail extraction failed:', err);
    return null;
  }
}

/**
 * Extracts thumbnail from Adobe Illustrator (.ai / .eps) file.
 * Handles modern PDF-compatible Illustrator streams, XMP packets, PostScript hex thumbnails, and embedded JPEGs.
 */
export async function extractAiThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): Promise<{ url: string; width: number; height: number; pageCount?: number; isPlaceholder?: boolean }> {
  // Method 1: Check for embedded PDF stream (Illustrator PDF-compatible file)
  const bytes = new Uint8Array(buffer);
  const pdfOffset = findPdfOffset(bytes, 1024 * 1024 * 8);
  if (pdfOffset !== -1) {
    try {
      const { renderPdfBufferFirstPage } = await import('../pdfPreview');
      const pdfBuffer = pdfOffset === 0 ? buffer : buffer.slice(pdfOffset);
      const rendered = await renderPdfBufferFirstPage(pdfBuffer);
      if (rendered) {
        return {
          url: rendered.url,
          width: rendered.width,
          height: rendered.height,
          pageCount: rendered.pageCount,
        };
      }
    } catch (err) {
      console.warn('PDF stream extraction from AI failed:', err);
    }
  }

  // Method 2: Check XMP packet (<xmpGImg:image> / <xapGImg:image>)
  const xmpThumb = extractXmpThumbnail(buffer);
  if (xmpThumb) {
    const dims = await getImageDimensions(xmpThumb);
    return { url: xmpThumb, width: dims.width, height: dims.height };
  }

  // Method 3: PostScript embedded hex raster thumbnail (%%BeginThumbnail / %AI7_Thumbnail / %%BeginPreview)
  const psThumb = extractPostScriptThumbnail(buffer);
  if (psThumb) {
    const dims = await getImageDimensions(psThumb);
    return { url: psThumb, width: dims.width, height: dims.height };
  }

  // Method 4: Scan for embedded JPEG SOI
  const embeddedJpeg = extractEmbeddedJpeg(buffer, 4096);
  if (embeddedJpeg) {
    const dims = await getImageDimensions(embeddedJpeg);
    return { url: embeddedJpeg, width: dims.width, height: dims.height };
  }

  // Fallback: No embedded preview available
  return { url: '', width: 0, height: 0, isPlaceholder: true };
}
