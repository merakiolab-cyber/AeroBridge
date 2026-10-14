/**
 * Ultra-fast offline thumbnail & metadata extractor for Adobe & Media assets.
 * Extracts embedded thumbnails from InDesign (.indd), Photoshop (.psd), Illustrator (.ai),
 * RAW camera formats (CR2, CR3, NEF, ARW, DNG, RAF), generates video frames,
 * and handles SVG vectors with zero lag.
 */

export interface ExtractedMedia {
  url: string;
  width: number;
  height: number;
  format: string;
  category: 'image' | 'raw' | 'adobe-psd' | 'adobe-ai' | 'adobe-indd' | 'adobe-ae' | 'adobe-pr' | 'pdf' | 'video' | 'vector' | 'other';
  colorBadge: string;
  hasEmbeddedThumbnail: boolean;
  videoDuration?: number;
}

/**
 * Extracts base64-encoded thumbnail from XMP packet.
 * Adobe InDesign, Illustrator, and Photoshop store embedded previews in <xmpGImg:image>...</xmpGImg:image>.
 */
export function extractXmpThumbnail(buffer: ArrayBuffer, maxScanBytes = 1024 * 1024 * 8): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const scanLimit = Math.min(bytes.length, maxScanBytes);
    const textChunk = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, scanLimit));

    // Match <xmpGImg:image>...</xmpGImg:image>; Adobe writes line breaks as &#xA; entities
    const match = textChunk.match(/<x[ma]pGImg:image>([\s\S]{100,}?)<\/x[ma]pGImg:image>/i);
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
  fileName: string
): Promise<{ url: string; width: number; height: number }> {
  // Method 1: Check XMP base64 preview
  const xmpThumb = extractXmpThumbnail(buffer);
  if (xmpThumb) {
    const dims = await getImageDimensions(xmpThumb);
    return { url: xmpThumb, width: dims.width, height: dims.height };
  }

  // Method 2: Scan for embedded page preview JPEG (min 8KB)
  const embeddedJpeg = extractEmbeddedJpeg(buffer, 8192);
  if (embeddedJpeg) {
    const dims = await getImageDimensions(embeddedJpeg);
    return { url: embeddedJpeg, width: dims.width, height: dims.height };
  }

  // Fallback: Generate high-resolution Bauhaus InDesign placeholder
  const placeholder = generateDocumentPlaceholder(fileName, 'INDD', '#ff3366', 'Adobe InDesign Document');
  return { url: placeholder, width: 1200, height: 900 };
}

/**
 * Extracts embedded JFIF/JPEG thumbnail from a Photoshop (.psd) file binary buffer.
 */
export function extractPsdThumbnail(buffer: ArrayBuffer): string | null {
  try {
    if (!buffer || buffer.byteLength < 4) return null;
    const view = new DataView(buffer);
    // Check '8BPS' signature
    if (view.getUint32(0) !== 0x38425053) return null;

    // First try XMP metadata
    const xmpThumb = extractXmpThumbnail(buffer, 1024 * 1024 * 4);
    if (xmpThumb) return xmpThumb;

    // Scan for JPEG SOI marker (0xFF, 0xD8) within resource block or file
    return extractEmbeddedJpeg(buffer, 4096, 1024 * 1024 * 4);
  } catch (err) {
    console.warn('PSD thumbnail parsing skipped:', err);
  }
  return null;
}

/**
 * Extracts thumbnail from Adobe Illustrator (.ai / .eps) file.
 */
export async function extractAiThumbnail(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ url: string; width: number; height: number }> {
  // Try XMP packet first
  const xmpThumb = extractXmpThumbnail(buffer);
  if (xmpThumb) {
    const dims = await getImageDimensions(xmpThumb);
    return { url: xmpThumb, width: dims.width, height: dims.height };
  }

  // Try embedded JPEG
  const embeddedJpeg = extractEmbeddedJpeg(buffer, 4096);
  if (embeddedJpeg) {
    const dims = await getImageDimensions(embeddedJpeg);
    return { url: embeddedJpeg, width: dims.width, height: dims.height };
  }

  const isEps = fileName.toLowerCase().endsWith('.eps');
  const ext = isEps ? 'EPS' : 'AI';
  const subtitle = isEps ? 'Encapsulated PostScript Vector' : 'Adobe Illustrator Artwork';
  const placeholder = generateDocumentPlaceholder(fileName, ext, '#ff9a00', subtitle);
  return { url: placeholder, width: 1200, height: 900 };
}

/**
 * Extracts embedded full/medium preview from Camera RAW formats (CR2, CR3, NEF, ARW, DNG, RAF).
 */
export async function extractRawThumbnail(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ url: string; width: number; height: number }> {
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

  const parts = fileName.split('.');
  const ext = (parts.length > 1 ? parts.pop()! : 'RAW').toUpperCase();
  const placeholder = generateDocumentPlaceholder(fileName, ext, '#06b6d4', 'Digital Camera Raw Negative');
  return { url: placeholder, width: 1200, height: 900 };
}

/**
 * Generates a video snapshot thumbnail at 0.5s mark using offscreen HTML5 video + canvas.
 */
export function extractVideoThumbnail(
  file: File
): Promise<{ url: string; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fileUrl = URL.createObjectURL(file);
    video.src = fileUrl;

    const cleanUp = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const seekTime = Math.min(0.5, Math.max(0.1, video.duration * 0.1));
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbUrl = canvas.toDataURL('image/jpeg', 0.85);
          const duration = video.duration || 0;
          cleanUp();
          URL.revokeObjectURL(fileUrl);
          resolve({
            url: thumbUrl,
            width: canvas.width,
            height: canvas.height,
            duration,
          });
          return;
        }
      } catch (e) {
        console.warn('Video canvas extract failed:', e);
      }
      cleanUp();
      resolve({ url: fileUrl, width: video.videoWidth || 1920, height: video.videoHeight || 1080, duration: video.duration || 0 });
    };

    video.onerror = () => {
      cleanUp();
      reject(new Error('Failed to load video'));
    };

    // Timeout safety
    setTimeout(() => {
      cleanUp();
      resolve({ url: fileUrl, width: 1920, height: 1080, duration: 0 });
    }, 2500);
  });
}

/**
 * Inspects image dimensions quickly via Image object.
 */
export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 1920, height: img.naturalHeight || 1080 });
    };
    img.onerror = () => {
      resolve({ width: 1920, height: 1080 });
    };
    img.src = url;
  });
}

/**
 * Generates an elegant, high-resolution Bauhaus graphic placeholder card for files without embedded preview.
 */
export function generateDocumentPlaceholder(
  fileName: string,
  extension: string,
  colorBadge: string,
  subtitle = 'Digital Creative Asset'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - Dark studio Bauhaus
  ctx.fillStyle = '#14161e';
  ctx.fillRect(0, 0, 1200, 900);

  // Subtle geometric grid pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const step = 60;
  for (let x = 0; x < 1200; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 900);
    ctx.stroke();
  }
  for (let y = 0; y < 900; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }

  // Central Card Outline
  ctx.fillStyle = '#1a1d27';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(300, 200, 600, 500);
  ctx.fill();
  ctx.stroke();

  // Top color accent bar
  ctx.fillStyle = colorBadge;
  ctx.fillRect(300, 200, 600, 10);

  // Big Typographic Badge
  ctx.font = 'bold 120px "JetBrains Mono", monospace';
  ctx.fillStyle = colorBadge;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(extension, 600, 390);

  // File Name
  ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#e2e4e9';
  const truncatedName = fileName.length > 28 ? fileName.slice(0, 25) + '...' : fileName;
  ctx.fillText(truncatedName, 600, 520);

  // Subtitle
  ctx.font = '400 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillText(subtitle, 600, 570);

  // Bottom corner watermark
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.textAlign = 'right';
  ctx.fillText('AEROBRIDGE STUDIO', 860, 670);

  return canvas.toDataURL('image/png');
}

/**
 * Categorizes file type and assigns color identity badge for creative workflows.
 */
export function getAdobeFileType(fileName: string): {
  format: string;
  category: ExtractedMedia['category'];
  colorBadge: string;
  extension: string;
} {
  const parts = fileName.split('.');
  const ext = (parts.length > 1 ? parts.pop()! : '').toLowerCase();

  switch (ext) {
    case 'psd':
    case 'psb':
      return { format: 'Photoshop Document', category: 'adobe-psd', colorBadge: '#31a8ff', extension: ext.toUpperCase() };
    case 'ai':
      return { format: 'Adobe Illustrator', category: 'adobe-ai', colorBadge: '#ff9a00', extension: ext.toUpperCase() };
    case 'indd':
    case 'idml':
      return { format: 'Adobe InDesign', category: 'adobe-indd', colorBadge: '#ff3366', extension: ext.toUpperCase() };
    case 'aep':
    case 'aet':
      return { format: 'After Effects Project', category: 'adobe-ae', colorBadge: '#9999ff', extension: ext.toUpperCase() };
    case 'prproj':
      return { format: 'Premiere Pro Project', category: 'adobe-pr', colorBadge: '#ea77ff', extension: ext.toUpperCase() };
    case 'pdf':
      return { format: 'PDF Document', category: 'pdf', colorBadge: '#ff2d20', extension: ext.toUpperCase() };
    case 'mp4':
    case 'mov':
    case 'm4v':
    case 'webm':
    case 'mkv':
    case 'avi':
      return { format: ext.toUpperCase() + ' Video', category: 'video', colorBadge: '#8b5cf6', extension: ext.toUpperCase() };
    case 'svg':
      return { format: 'SVG Vector', category: 'vector', colorBadge: '#f59e0b', extension: ext.toUpperCase() };
    case 'eps':
      return { format: 'Encapsulated PostScript', category: 'vector', colorBadge: '#f59e0b', extension: ext.toUpperCase() };
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'gif':
    case 'bmp':
    case 'tiff':
    case 'tif':
    case 'avif':
    case 'heic':
      return { format: ext.toUpperCase() + ' Image', category: 'image', colorBadge: '#10b981', extension: ext.toUpperCase() };
    case 'cr2':
    case 'cr3':
    case 'nef':
    case 'arw':
    case 'dng':
    case 'raf':
    case 'rw2':
    case 'orf':
      return { format: ext.toUpperCase() + ' Raw Negative', category: 'raw', colorBadge: '#06b6d4', extension: ext.toUpperCase() };
    default:
      return { format: ext.toUpperCase() || 'File', category: 'other', colorBadge: '#94a3b8', extension: ext.toUpperCase() || 'FILE' };
  }
}
