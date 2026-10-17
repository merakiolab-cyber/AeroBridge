/**
 * Blender 3D scene (.blend) embedded thumbnail extractor.
 * Reads the TEST block containing width, height, and uncompressed bottom-up RGBA pixels.
 */

export function extractBlendThumbnail(
  buffer: ArrayBuffer,
  _fileName: string
): { url: string; width: number; height: number; isPlaceholder?: boolean } | null {
  try {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 32) return null;

    // Check Blender header: "BLENDER-v" (64-bit) or "BLENDER_v" (32-bit)
    if (
      bytes[0] !== 0x42 || bytes[1] !== 0x4C || bytes[2] !== 0x45 ||
      bytes[3] !== 0x4E || bytes[4] !== 0x44 || bytes[5] !== 0x45 || bytes[6] !== 0x52
    ) {
      return null;
    }

    const is64Bit = bytes[7] === 0x2D; // '-' = 64-bit, '_' = 32-bit
    const headerSize = is64Bit ? 24 : 20;

    // Search for 'TEST' block code within the first 256KB
    const searchLimit = Math.min(bytes.length - 24, 262144);
    let testIdx = -1;
    for (let i = 12; i < searchLimit; i++) {
      if (
        bytes[i] === 0x54 &&     // 'T'
        bytes[i + 1] === 0x45 && // 'E'
        bytes[i + 2] === 0x53 && // 'S'
        bytes[i + 3] === 0x54    // 'T'
      ) {
        testIdx = i;
        break;
      }
    }
    if (testIdx === -1) return null;

    const view = new DataView(buffer, testIdx, 8);
    const blockSize = view.getUint32(4, true);
    if (blockSize < 8 || testIdx + headerSize + blockSize > bytes.length) return null;

    const dataView = new DataView(buffer, testIdx + headerSize, 8);
    const width = dataView.getUint32(0, true);
    const height = dataView.getUint32(4, true);
    if (width === 0 || height === 0 || width > 2048 || height > 2048) return null;

    const pixelBytes = width * height * 4;
    if (blockSize < 8 + pixelBytes) return null;

    const rawRgba = new Uint8ClampedArray(buffer, testIdx + headerSize + 8, pixelBytes);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    // Blender stores pixels bottom-to-top (row 0 is bottom)
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * 4;
      const dstRow = y * width * 4;
      imgData.data.set(rawRgba.subarray(srcRow, srcRow + width * 4), dstRow);
    }
    ctx.putImageData(imgData, 0, 0);

    return {
      url: canvas.toDataURL('image/png'),
      width,
      height,
    };
  } catch (err) {
    console.warn('[Blend] Failed to extract thumbnail:', err);
    return null;
  }
}
