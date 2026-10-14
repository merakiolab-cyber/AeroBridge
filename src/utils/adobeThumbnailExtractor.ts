/**
 * Ultra-fast offline thumbnail & metadata extractor for Adobe & Media assets.
 * Extracts embedded thumbnails from PSD, generates canvas frames from video,
 * parses vector SVGs, and reads image dimensions with zero lag.
 */

export interface ExtractedMedia {
  url: string;
  width: number;
  height: number;
  format: string;
  category: 'image' | 'adobe-psd' | 'adobe-ai' | 'adobe-indd' | 'adobe-ae' | 'adobe-pr' | 'pdf' | 'video' | 'vector' | 'other';
  colorBadge: string;
  hasEmbeddedThumbnail: boolean;
  videoDuration?: number;
}

/**
 * Extracts embedded JFIF/JPEG thumbnail from a Photoshop (.psd) file binary buffer.
 * Photoshop stores a 160x160 or larger preview in Image Resource block ID 0x0409 (1033) or 0x0424 (1036).
 */
export function extractPsdThumbnail(buffer: ArrayBuffer): string | null {
  try {
    if (!buffer || buffer.byteLength < 4) return null;
    const view = new DataView(buffer);
    // Check '8BPS' signature
    if (view.getUint32(0) !== 0x38425053) return null;

    // Scan for JPEG SOI marker (0xFF, 0xD8) within resource block or file
    const bytes = new Uint8Array(buffer);
    const limit = Math.min(bytes.length - 4, 1024 * 1024 * 4); // scan first 4MB

    for (let i = 0; i < limit; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        // Look for EOI marker (0xFF, 0xD9)
        for (let j = i + 100; j < Math.min(bytes.length - 1, i + 1024 * 512); j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const jpegBlob = new Blob([bytes.subarray(i, j + 2)], { type: 'image/jpeg' });
            return URL.createObjectURL(jpegBlob);
          }
        }
      }
    }
  } catch (err) {
    console.warn('PSD thumbnail parsing skipped:', err);
  }
  return null;
}

/**
 * Generates a video snapshot thumbnail at 0.5s mark using offscreen HTML5 video + canvas.
 */
export function extractVideoThumbnail(file: File): Promise<{ url: string; width: number; height: number; duration: number }> {
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
      // Seek to 0.5s or 10%
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
      return { format: ext.toUpperCase() + ' Raw Negative', category: 'image', colorBadge: '#06b6d4', extension: ext.toUpperCase() };
    default:
      return { format: ext.toUpperCase() || 'File', category: 'other', colorBadge: '#94a3b8', extension: ext.toUpperCase() || 'FILE' };
  }
}
