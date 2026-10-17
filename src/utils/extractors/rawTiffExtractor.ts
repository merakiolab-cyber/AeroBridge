/**
 * Camera RAW and TIFF thumbnail & preview extractors:
 * - Camera RAW: CR2, CR3, NEF, ARW, DNG, RAF, RW2, ORF
 * - Multi-page TIFF (.tif, .tiff) using UTIF.js
 */

import { getImageDimensions } from './types';
import { extractEmbeddedJpeg } from './adobeExtractor';

interface UtifImageIfd {
  width: number;
  height: number;
  data?: Uint8Array;
}

interface UtifModule {
  decode: (buffer: ArrayBuffer) => UtifImageIfd[];
  decodeImage: (buffer: ArrayBuffer, ifd: UtifImageIfd) => void;
  toRGBA8: (ifd: UtifImageIfd) => Uint8Array;
}

/**
 * Extracts embedded full/medium preview from Camera RAW formats (CR2, CR3, NEF, ARW, DNG, RAF).
 */
export async function extractRawThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean }> {
  try {
    // TIFF-based direct tag inspection for CR2, NEF, ARW, DNG
    if (buffer.byteLength >= 8) {
      const view = new DataView(buffer);
      const isLittleEndian = view.getUint16(0) === 0x4949; // 'II'
      const isBigEndian = view.getUint16(0) === 0x4d4d; // 'MM'

      if (isLittleEndian || isBigEndian) {
        const little = isLittleEndian;
        const ifd0Offset = view.getUint32(4, little);

        if (ifd0Offset > 0 && ifd0Offset < buffer.byteLength - 2) {
          const numEntries = view.getUint16(ifd0Offset, little);
          let jpegOffset = 0;
          let jpegLength = 0;

          for (let i = 0; i < Math.min(numEntries, 100); i++) {
            const entryOffset = ifd0Offset + 2 + i * 12;
            if (entryOffset + 12 > buffer.byteLength) break;

            const tag = view.getUint16(entryOffset, little);
            // 0x0201: JPEGInterchangeFormat
            if (tag === 0x0201) {
              jpegOffset = view.getUint32(entryOffset + 8, little);
            }
            // 0x0202: JPEGInterchangeFormatLength
            if (tag === 0x0202) {
              jpegLength = view.getUint32(entryOffset + 8, little);
            }
          }

          if (jpegOffset > 0 && jpegLength > 1024 && jpegOffset + jpegLength <= buffer.byteLength) {
            const blob = new Blob([buffer.slice(jpegOffset, jpegOffset + jpegLength)], { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            const dims = await getImageDimensions(previewUrl);
            return { url: previewUrl, width: dims.width, height: dims.height };
          }
        }
      }
    }

    // Fallback: Scan buffer for embedded JPEG SOI (works for CR3, RAF, and subIFDs)
    const embeddedJpeg = extractEmbeddedJpeg(buffer, 16384, 1024 * 1024 * 16);
    if (embeddedJpeg) {
      const dims = await getImageDimensions(embeddedJpeg);
      return { url: embeddedJpeg, width: dims.width, height: dims.height };
    }
  } catch (err) {
    console.warn('RAW thumbnail extraction failed:', err);
  }

  return { url: '', width: 0, height: 0, isPlaceholder: true };
}

/**
 * Extracts embedded or rendered preview from a TIFF (.tif / .tiff) file using UTIF.js.
 * Supports uncompressed, LZW, PackBits, Deflate, JPEG-in-TIFF, and multi-page TIFFs.
 */
export async function extractTiffThumbnail(
  buffer: ArrayBuffer,
  fileName: string,
  pageIndex = 0
): Promise<{ url: string; width: number; height: number; pageCount: number } | null> {
  try {
    const rawUtif = await import('utif');
    const utifModule = ((rawUtif as unknown as { default: UtifModule }).default || rawUtif) as UtifModule;
    const ifds = utifModule.decode(buffer);
    if (!ifds || ifds.length === 0) {
      // Fallback: check for embedded JPEG stream (min 4KB)
      const embeddedJpeg = extractEmbeddedJpeg(buffer, 4096);
      if (embeddedJpeg) {
        const dims = await getImageDimensions(embeddedJpeg);
        return { url: embeddedJpeg, width: dims.width, height: dims.height, pageCount: 1 };
      }
      return null;
    }

    const page = Math.min(Math.max(0, pageIndex), ifds.length - 1);
    const ifd = ifds[page];
    utifModule.decodeImage(buffer, ifd);
    const rgba = utifModule.toRGBA8(ifd);
    const width = ifd.width;
    const height = ifd.height;
    if (!width || !height || !rgba || rgba.length === 0) {
      // Fallback: check for embedded JPEG stream
      const embeddedJpeg = extractEmbeddedJpeg(buffer, 4096);
      if (embeddedJpeg) {
        const dims = await getImageDimensions(embeddedJpeg);
        return { url: embeddedJpeg, width: dims.width, height: dims.height, pageCount: ifds.length };
      }
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);

    // If extremely large (e.g. > 1600 px), scale down to save memory
    if (width > 1600 || height > 1600) {
      const maxDim = 1600;
      const scale = Math.min(maxDim / width, maxDim / height);
      const targetW = Math.max(1, Math.round(width * scale));
      const targetH = Math.max(1, Math.round(height * scale));
      const downCanvas = document.createElement('canvas');
      downCanvas.width = targetW;
      downCanvas.height = targetH;
      const downCtx = downCanvas.getContext('2d');
      if (downCtx) {
        downCtx.drawImage(canvas, 0, 0, targetW, targetH);
        return {
          url: downCanvas.toDataURL('image/jpeg', 0.88),
          width: targetW,
          height: targetH,
          pageCount: ifds.length,
        };
      }
    }

    return {
      url: canvas.toDataURL('image/jpeg', 0.88),
      width,
      height,
      pageCount: ifds.length,
    };
  } catch (err) {
    console.warn('[TIFF] extractTiffThumbnail failed for ' + fileName + ':', err);
    const embeddedJpeg = extractEmbeddedJpeg(buffer, 4096);
    if (embeddedJpeg) {
      const dims = await getImageDimensions(embeddedJpeg);
      return { url: embeddedJpeg, width: dims.width, height: dims.height, pageCount: 1 };
    }
  }

  return null;
}
