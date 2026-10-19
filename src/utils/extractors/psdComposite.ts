/**
 * AeroBridge Studio — PSD / PSB flattened composite decoder
 *
 * Photoshop embeds only a ~160 px thumbnail in the image resources, which looks soft in the large
 * preview views. When a file was saved with "Maximize Compatibility", its full flattened image lives
 * in the final "Image Data" section. This module reads just that section (via ranged reads, so the
 * layer data is never loaded), decodes it and box-samples it down to the requested width.
 *
 * Supported: PSD + PSB, 8/16-bit, RGB / Grayscale / Indexed / CMYK, raw + RLE (PackBits) compression.
 * Returns `null` for anything else (ZIP-compressed, Lab, 32-bit, bitmap) or when the composite is a blank
 * placeholder (files saved without Maximize Compatibility), so callers can keep the embedded thumbnail.
 */

export type RangeReader = (offset: number, length: number) => Promise<ArrayBuffer>;

export interface PsdCompositeResult {
  url: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

const MAX_READ_BYTES = 300 * 1024 * 1024;

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** PackBits decoder writing at most `dst.length` bytes. */
function unpackBits(src: Uint8Array, start: number, length: number, dst: Uint8Array): void {
  let i = start;
  const end = Math.min(src.length, start + length);
  let o = 0;
  while (i < end && o < dst.length) {
    const n = (src[i++] << 24) >> 24;
    if (n >= 0) {
      const count = Math.min(n + 1, dst.length - o, end - i);
      dst.set(src.subarray(i, i + count), o);
      i += n + 1;
      o += count;
    } else if (n !== -128) {
      const count = Math.min(1 - n, dst.length - o);
      dst.fill(src[i++], o, o + count);
      o += count;
    }
  }
}

/** Source indices sampled for one output cell (all of them for small factors, three evenly spaced otherwise). */
function samplePositions(cell: number, factor: number): number[] {
  const base = cell * factor;
  if (factor <= 3) return Array.from({ length: factor }, (_, k) => base + k);
  return [base, base + Math.floor(factor / 2), base + factor - 1];
}

export async function decodePsdComposite(
  read: RangeReader,
  targetWidth: number
): Promise<PsdCompositeResult | null> {
  // ---- header -------------------------------------------------------------
  const headBuf = await read(0, 30);
  if (headBuf.byteLength < 30) return null;
  const head = new DataView(headBuf);
  if (head.getUint32(0, false) !== 0x38425053) return null; // '8BPS'
  const version = head.getUint16(4, false);
  if (version !== 1 && version !== 2) return null;
  const channels = head.getUint16(12, false);
  const height = head.getUint32(14, false);
  const width = head.getUint32(18, false);
  const depth = head.getUint16(22, false);
  const mode = head.getUint16(24, false);
  if (!width || !height || (depth !== 8 && depth !== 16)) return null;

  const usedChannels = mode === 3 ? 3 : mode === 4 ? 4 : mode === 1 || mode === 2 ? 1 : 0;
  if (usedChannels === 0 || channels < usedChannels) return null;

  const bps = depth / 8;
  const rowBytes = width * bps;

  // ---- walk the length-prefixed sections to the image data ------------------
  const colorModeLen = head.getUint32(26, false);
  let palette: Uint8Array | null = null;
  if (mode === 2) {
    if (colorModeLen !== 768) return null;
    palette = new Uint8Array(await read(30, 768));
  }
  let offset = 30 + colorModeLen;

  const resLen = new DataView(await read(offset, 4)).getUint32(0, false);
  offset += 4 + resLen;

  if (version === 1) {
    const layerLen = new DataView(await read(offset, 4)).getUint32(0, false);
    offset += 4 + layerLen;
  } else {
    const v = new DataView(await read(offset, 8));
    if (v.getUint32(0, false) !== 0) return null;
    offset += 8 + v.getUint32(4, false);
  }

  const compression = new DataView(await read(offset, 2)).getUint16(0, false);
  offset += 2;
  if (compression !== 0 && compression !== 1) return null;

  // ---- load the planes we need ---------------------------------------------
  let planeData: Uint8Array;
  let rowStart: Uint32Array | null = null;
  let rowLen: Uint32Array | null = null;

  if (compression === 1) {
    const countSize = version === 1 ? 2 : 4;
    const totalRows = channels * height;
    const countsBuf = new DataView(await read(offset, totalRows * countSize));
    if (countsBuf.byteLength < totalRows * countSize) return null;
    const usedRows = usedChannels * height;
    rowStart = new Uint32Array(usedRows);
    rowLen = new Uint32Array(usedRows);
    let sum = 0;
    for (let r = 0; r < usedRows; r++) {
      const n = countSize === 2 ? countsBuf.getUint16(r * 2, false) : countsBuf.getUint32(r * 4, false);
      rowStart[r] = sum;
      rowLen[r] = n;
      sum += n;
    }
    if (sum === 0 || sum > MAX_READ_BYTES) return null;
    planeData = new Uint8Array(await read(offset + totalRows * countSize, sum));
    if (planeData.byteLength < sum) return null;
  } else {
    const need = rowBytes * height * usedChannels;
    if (need > MAX_READ_BYTES) return null;
    planeData = new Uint8Array(await read(offset, need));
    if (planeData.byteLength < need) return null;
  }

  // ---- sample down to the target size ----------------------------------------
  const factor = Math.max(1, Math.floor(width / Math.max(1, Math.min(targetWidth, width))));
  const outW = Math.max(1, Math.floor(width / factor));
  const outH = Math.max(1, Math.floor(height / factor));
  const xs = Array.from({ length: outW }, (_, x) => samplePositions(x, factor));

  const out = new Uint8ClampedArray(outW * outH * 4);
  const rowBuf = Array.from({ length: usedChannels }, () => new Uint8Array(rowBytes));
  let lumMin = 255;
  let lumMax = 0;

  const loadRow = (channel: number, row: number) => {
    const dst = rowBuf[channel];
    if (compression === 1 && rowStart && rowLen) {
      const idx = channel * height + row;
      dst.fill(0);
      unpackBits(planeData, rowStart[idx], rowLen[idx], dst);
    } else {
      const at = (channel * height + row) * rowBytes;
      dst.set(planeData.subarray(at, at + rowBytes));
    }
  };

  for (let oy = 0; oy < outH; oy++) {
    const rows = samplePositions(oy, factor).filter((r) => r < height);
    const acc = new Float64Array(outW * usedChannels);

    for (const row of rows) {
      for (let c = 0; c < usedChannels; c++) loadRow(c, row);
      for (let ox = 0; ox < outW; ox++) {
        const cols = xs[ox];
        for (let c = 0; c < usedChannels; c++) {
          const buf = rowBuf[c];
          let s = 0;
          for (const col of cols) s += buf[col * bps];
          acc[ox * usedChannels + c] += s / cols.length;
        }
      }
    }

    const n = Math.max(1, rows.length);
    for (let ox = 0; ox < outW; ox++) {
      const o = (oy * outW + ox) * 4;
      const a = ox * usedChannels;
      let r: number, g: number, b: number;
      if (mode === 3) {
        r = acc[a] / n; g = acc[a + 1] / n; b = acc[a + 2] / n;
      } else if (mode === 4) {
        // PSD stores CMYK inverted (255 = no ink)
        const k = acc[a + 3] / n / 255;
        r = (acc[a] / n) * k; g = (acc[a + 1] / n) * k; b = (acc[a + 2] / n) * k;
      } else if (mode === 2 && palette) {
        const i = Math.min(255, Math.round(acc[a] / n));
        r = palette[i]; g = palette[256 + i]; b = palette[512 + i];
      } else {
        r = g = b = acc[a] / n;
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
      const lum = (r + g + b) / 3;
      if (lum < lumMin) lumMin = lum;
      if (lum > lumMax) lumMax = lum;
    }

    if ((oy & 31) === 31) await yieldToUi();
  }

  // Files saved without "Maximize Compatibility" carry a flat placeholder: keep the embedded thumbnail instead.
  if (lumMax - lumMin < 3) return null;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(out, outW, outH), 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) return null;
  return { url: URL.createObjectURL(blob), width: outW, height: outH, sourceWidth: width, sourceHeight: height };
}
