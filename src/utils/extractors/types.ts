/**
 * Shared types, media definitions and utility functions for thumbnail extractors.
 */

export interface ExtractedMedia {
  url: string;
  width: number;
  height: number;
  format: string;
  category:
    | 'image'
    | 'raw'
    | 'adobe-psd'
    | 'adobe-ai'
    | 'adobe-indd'
    | 'adobe-ae'
    | 'adobe-pr'
    | 'adobe-xd'
    | 'pdf'
    | 'video'
    | 'vector'
    | 'painter'
    | 'figma'
    | 'html'
    | 'krita'
    | 'blend'
    | '3d'
    | 'other';
  colorBadge: string;
  hasEmbeddedThumbnail: boolean;
  videoDuration?: number;
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
    case 'xd':
      return { format: 'Adobe XD Design', category: 'adobe-xd', colorBadge: '#ff61f6', extension: 'XD' };
    case 'fig':
      return { format: 'Figma Design', category: 'figma', colorBadge: '#a259ff', extension: 'FIG' };
    case 'rif':
    case 'riff':
      return { format: 'Corel Painter Image', category: 'painter', colorBadge: '#f97316', extension: 'RIF' };
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
      return { format: ext.toUpperCase() + ' Image', category: 'image', colorBadge: '#10b981', extension: ext.toUpperCase() };
    case 'webp':
      return { format: 'WebP Image', category: 'image', colorBadge: '#00c49f', extension: 'WEBP' };
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
    case 'html':
    case 'htm':
      return { format: 'HTML Document', category: 'html', colorBadge: '#e44d26', extension: ext.toUpperCase() };
    case 'kra':
      return { format: 'Krita Document', category: 'krita', colorBadge: '#3daee9', extension: 'KRA' };
    case 'blend':
    case 'blend1':
    case 'blend2':
      return { format: 'Blender 3D Scene', category: 'blend', colorBadge: '#ea7600', extension: 'BLEND' };
    case 'obj':
      return { format: 'Wavefront 3D Object', category: '3d', colorBadge: '#06b6d4', extension: 'OBJ' };
    case 'stl':
      return { format: 'Stereolithography 3D', category: '3d', colorBadge: '#38bdf8', extension: 'STL' };
    case '3mf':
      return { format: '3D Manufacturing Format', category: '3d', colorBadge: '#0ea5e9', extension: '3MF' };
    case 'zpr':
      return { format: 'ZBrush Project', category: '3d', colorBadge: '#e11d48', extension: 'ZPR' };
    case 'ztl':
      return { format: 'ZBrush Tool', category: '3d', colorBadge: '#f43f5e', extension: 'ZTL' };
    case 'ppt':
    case 'pptx':
    case 'pps':
    case 'ppsx':
    case 'pot':
    case 'potx':
      return { format: 'PowerPoint Presentation', category: 'other', colorBadge: '#d04423', extension: ext.toUpperCase() };
    case 'doc':
    case 'docx':
    case 'dot':
    case 'dotx':
      return { format: 'Word Document', category: 'other', colorBadge: '#2b579a', extension: ext.toUpperCase() };
    case 'xls':
    case 'xlsx':
    case 'xlsm':
    case 'xlt':
    case 'xltx':
      return { format: 'Excel Spreadsheet', category: 'other', colorBadge: '#217346', extension: ext.toUpperCase() };
    case 'odp':
      return { format: 'OpenDocument Presentation', category: 'other', colorBadge: '#e05d44', extension: 'ODP' };
    case 'odt':
      return { format: 'OpenDocument Text', category: 'other', colorBadge: '#3498db', extension: 'ODT' };
    case 'ods':
      return { format: 'OpenDocument Spreadsheet', category: 'other', colorBadge: '#2ecc71', extension: 'ODS' };
    default:
      return { format: ext.toUpperCase() || 'File', category: 'other', colorBadge: '#94a3b8', extension: ext.toUpperCase() || 'FILE' };
  }
}

/**
 * Determines whether a file is visual (image, design, vector, raw camera photo, PDF)
 * or non-visual / media for an external player/application (video, music, text, office document, archive, etc.).
 * Non-visual files open directly in the operating system's registered default application when double-clicked or opened.
 */
export function isVisualAsset(asset: { name: string; extension?: string; category?: string; isFolder?: boolean }): boolean {
  if (asset.isFolder) return false;

  const ext = (asset.extension || asset.name.split('.').pop() || '').toLowerCase().replace(/^\./, '');

  const nonVisualExtensions = new Set([
    // Video
    'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'ts', 'mts', 'vob', 'asf', 'ogv',
    // Music / Audio
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff', 'aif', 'mid', 'midi', 'opus', 'ape', 'alac',
    // Text, code, config
    'txt', 'md', 'json', 'csv', 'log', 'xml', 'css', 'js', 'ts', 'jsx', 'tsx',
    'rtf', 'ini', 'cfg', 'conf', 'yaml', 'yml', 'sql', 'bat', 'cmd', 'ps1', 'sh', 'py', 'rs', 'cpp', 'c', 'h',
    // Documents & Office
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    // Archives & Executables
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'exe', 'msi', 'apk',
  ]);

  if (nonVisualExtensions.has(ext)) {
    return false;
  }

  const visualExtensions = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg',
    'psd', 'psb', 'ai', 'eps', 'indd', 'idml', 'fig', 'kra', 'rif', 'riff',
    'tif', 'tiff', 'pdf', 'avif', 'heic', 'html', 'htm',
    'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'rw2', 'orf', 'pef',
    'blend', 'blend1', 'blend2', 'obj', 'stl', '3mf', 'zpr', 'ztl',
  ]);

  if (visualExtensions.has(ext)) {
    return true;
  }

  if (asset.category === 'video' || asset.category === 'other') {
    return false;
  }

  return ['image', 'raw', 'adobe-psd', 'adobe-ai', 'adobe-indd', 'adobe-xd', 'vector', 'painter', 'figma', 'pdf', 'html', 'krita', 'blend', '3d'].includes(asset.category || '');
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

    setTimeout(() => {
      cleanUp();
      resolve({ url: fileUrl, width: 1920, height: 1080, duration: 0 });
    }, 2500);
  });
}
