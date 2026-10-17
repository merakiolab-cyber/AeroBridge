/**
 * Ultra-fast binary image header parser.
 * Reads image dimensions (width, height) and resolution (DPI/PPI) from the first few kilobytes
 * of binary data in sub-millisecond time without decoding pixel data.
 */

export interface ImageHeaderMeta {
  width: number;
  height: number;
  dpi?: number;
  colorDepth?: string;
  format?: string;
}

export interface ResolutionInfo {
  megapixels: string;
  megapixelsFormatted: string;
  megapixelsNum: number;
  dpi?: number;
  standard: string;
  dpiText: string;
  shortText: string;
  fullText: string;
}

/**
 * Calculates human-readable resolution details from dimensions and DPI.
 */
export function getResolutionInfo(width: number, height: number, dpi?: number): ResolutionInfo {
  if (!width || !height || width <= 0 || height <= 0) {
    return {
      megapixels: '—',
      megapixelsFormatted: '—',
      megapixelsNum: 0,
      dpi,
      standard: '',
      dpiText: dpi && dpi > 0 ? `${dpi} DPI` : '',
      shortText: dpi && dpi > 0 ? `${dpi} DPI` : 'N/A',
      fullText: dpi && dpi > 0 ? `${dpi} DPI` : 'N/A',
    };
  }

  const mpNum = (width * height) / 1_000_000;
  const megapixels = mpNum >= 1 ? `${mpNum.toFixed(1)} MP` : `${Math.round(mpNum * 1000)} kpx`;

  // Standard display & cinema benchmarks
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  let standard = '';
  if (maxDim >= 7680 && minDim >= 4320) {
    standard = '8K UHD';
  } else if (maxDim >= 3840 && minDim >= 2160) {
    standard = '4K UHD';
  } else if (maxDim >= 2560 && minDim >= 1440) {
    standard = '2K QHD';
  } else if (maxDim >= 1920 && minDim >= 1080) {
    standard = 'Full HD';
  } else if (maxDim >= 1280 && minDim >= 720) {
    standard = 'HD 720p';
  }

  const effectiveDpi = dpi && dpi > 0 ? dpi : 72;
  const dpiText = `${effectiveDpi} DPI`;

  const parts: string[] = [megapixels];
  if (dpiText) parts.push(dpiText);
  if (standard) parts.push(`(${standard})`);

  return {
    megapixels,
    megapixelsFormatted: megapixels,
    megapixelsNum: mpNum,
    dpi,
    standard,
    dpiText,
    shortText: `${megapixels}${dpi && dpi > 0 ? ` · ${dpiText}` : ''}`,
    fullText: parts.join(' · '),
  };
}

/**
 * Parses binary header buffer to extract width, height and DPI.
 */
export function parseImageHeader(buffer: ArrayBuffer | Uint8Array): ImageHeaderMeta | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 16) return null;

  // 1. JPEG (0xFF, 0xD8, 0xFF)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return parseJpegHeader(bytes);
  }

  // 2. PNG (0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return parsePngHeader(bytes);
  }

  // 3. GIF ("GIF87a" or "GIF89a")
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return { width, height, dpi: 72, format: 'GIF Image' };
  }

  // 4. BMP ("BM")
  if (bytes[0] === 0x42 && bytes[1] === 0x4d && bytes.length >= 26) {
    return parseBmpHeader(bytes);
  }

  // 5. WebP ("RIFF" .... "WEBP")
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return parseWebpHeader(bytes);
  }

  return null;
}

function parseJpegHeader(bytes: Uint8Array): ImageHeaderMeta | null {
  let offset = 2;
  let dpi = 72;
  let width = 0;
  let height = 0;

  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    // End of Image or Start of Scan (compressed stream starts)
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (len < 2 || offset + 2 + len > bytes.length) {
      break;
    }

    // APP0: JFIF marker (DPI information)
    if (marker === 0xe0 && len >= 14) {
      const isJfif =
        bytes[offset + 4] === 0x4a && // 'J'
        bytes[offset + 5] === 0x46 && // 'F'
        bytes[offset + 6] === 0x49 && // 'I'
        bytes[offset + 7] === 0x46; // 'F'
      if (isJfif) {
        const units = bytes[offset + 11]; // 1 = dots per inch, 2 = dots per cm
        const xDensity = (bytes[offset + 12] << 8) | bytes[offset + 13];
        if (xDensity > 0) {
          dpi = units === 2 ? Math.round(xDensity * 2.54) : xDensity;
        }
      }
    }

    // APP1: Exif marker (could contain XResolution / YResolution)
    if (marker === 0xe1 && len >= 14) {
      const isExif =
        bytes[offset + 4] === 0x45 && // 'E'
        bytes[offset + 5] === 0x78 && // 'x'
        bytes[offset + 6] === 0x69 && // 'i'
        bytes[offset + 7] === 0x66; // 'f'
      if (isExif) {
        const exifDpi = parseExifDpi(bytes.subarray(offset + 10, offset + 2 + len));
        if (exifDpi > 0) dpi = exifDpi;
      }
    }

    // SOF markers (Start of Frame containing dimensions):
    // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3), SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && len >= 7) {
      height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height, dpi, format: 'JPEG Image' };
    }

    offset += 2 + len;
  }

  if (width > 0 && height > 0) {
    return { width, height, dpi, format: 'JPEG Image' };
  }
  return null;
}

function parseExifDpi(exifBytes: Uint8Array): number {
  try {
    if (exifBytes.length < 14) return 0;
    const isLittleEndian = exifBytes[0] === 0x49 && exifBytes[1] === 0x49; // 'II' vs 'MM'
    const view = new DataView(exifBytes.buffer, exifBytes.byteOffset, exifBytes.byteLength);
    const ifd0Offset = view.getUint32(4, isLittleEndian);
    if (ifd0Offset + 2 > exifBytes.length) return 0;

    const numEntries = view.getUint16(ifd0Offset, isLittleEndian);
    let xRes = 0;
    let resUnit = 2; // Default is inches

    for (let i = 0; i < numEntries; i++) {
      const entryPos = ifd0Offset + 2 + i * 12;
      if (entryPos + 12 > exifBytes.length) break;
      const tag = view.getUint16(entryPos, isLittleEndian);
      if (tag === 0x011a) {
        // XResolution
        const valOffset = view.getUint32(entryPos + 8, isLittleEndian);
        if (valOffset + 8 <= exifBytes.length) {
          const num = view.getUint32(valOffset, isLittleEndian);
          const den = view.getUint32(valOffset + 4, isLittleEndian);
          if (den > 0) xRes = Math.round(num / den);
        }
      } else if (tag === 0x0128) {
        // ResolutionUnit: 2 = inches, 3 = cm
        resUnit = view.getUint16(entryPos + 8, isLittleEndian);
      }
    }

    if (xRes > 0) {
      return resUnit === 3 ? Math.round(xRes * 2.54) : xRes;
    }
  } catch {}
  return 0;
}

function parsePngHeader(bytes: Uint8Array): ImageHeaderMeta | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  let dpi = 72;

  // Search for pHYs chunk in first 4096 bytes
  const limit = Math.min(bytes.length - 12, 4096);
  for (let i = 8; i < limit; i++) {
    // 'pHYs'
    if (bytes[i] === 0x70 && bytes[i + 1] === 0x48 && bytes[i + 2] === 0x59 && bytes[i + 3] === 0x73) {
      const ppux = view.getUint32(i + 4, false);
      const unit = bytes[i + 12]; // 1 = meter
      if (unit === 1 && ppux > 0) {
        dpi = Math.round(ppux * 0.0254);
      }
      break;
    }
  }

  return { width, height, dpi, format: 'PNG Image' };
}

function parseBmpHeader(bytes: Uint8Array): ImageHeaderMeta | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getInt32(18, true);
  const height = Math.abs(view.getInt32(22, true));
  let dpi = 72;

  if (bytes.length >= 42) {
    const xpels = view.getInt32(38, true);
    if (xpels > 0) {
      dpi = Math.round(xpels * 0.0254);
    }
  }

  return { width, height, dpi, format: 'BMP Image' };
}

function parseWebpHeader(bytes: Uint8Array): ImageHeaderMeta | null {
  if (bytes.length < 30) return null;
  // VP8 lossy
  if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
    if (bytes.length >= 30) {
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      return { width, height, dpi: 72, format: 'WebP Image' };
    }
  }
  // VP8L lossless
  if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4c) {
    if (bytes.length >= 26) {
      const b0 = bytes[21];
      const b1 = bytes[22];
      const b2 = bytes[23];
      const b3 = bytes[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height, dpi: 72, format: 'WebP Image' };
    }
  }
  // VP8X extended
  if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
    if (bytes.length >= 30) {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height, dpi: 72, format: 'WebP Image' };
    }
  }
  return null;
}
