import JSZip from 'jszip';
import { AssetItem, BatchExportConfig } from '../types';
import {
  extractPsdThumbnail,
  extractInddThumbnail,
  extractAiThumbnail,
  extractRawThumbnail,
  extractVideoThumbnail,
  getAdobeFileType,
  getImageDimensions,
  generateDocumentPlaceholder,
} from './adobeThumbnailExtractor';

/**
 * Format raw bytes into human-readable representation (e.g. 4.2 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats ISO or date string into clean studio timestamp
 */
export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('cs-CZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Sanitizes filenames to prevent Path Traversal, Zip Slip, and Windows illegal characters.
 * Windows forbidden characters: \ / : * ? " < > | and ASCII control chars.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return 'unnamed';

  // Strip null bytes and control characters
  let clean = filename.replace(/[\x00-\x1f\x80-\x9f]/g, '');

  // Prevent path traversal: strip ../ and ..\ and replace slashes
  clean = clean.replace(/\.\.+[/\\]/g, '').replace(/[/\\]+/g, '_');

  // Replace illegal Windows characters: < > : " / \ | ? *
  clean = clean.replace(/[<>:"/\\|?*]/g, '_');

  // Trim trailing periods and spaces (forbidden by Windows filesystem)
  clean = clean.replace(/[. ]+$/, '');

  // Limit filename length to 255 chars
  if (clean.length > 255) {
    const extMatch = clean.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0] : '';
    clean = clean.slice(0, 255 - ext.length) + ext;
  }

  return clean || 'unnamed';
}

/**
 * Parses files imported via Drag & Drop or HTML File Input into AssetItem list
 */
export async function parseFilesToAssets(
  files: File[] | FileList,
  folderName = 'Lokální import'
): Promise<AssetItem[]> {
  const fileArray = Array.from(files);
  const results: AssetItem[] = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const { format, category, colorBadge, extension } = getAdobeFileType(file.name);
    let previewUrl = '';
    let dimensions = { width: 1920, height: 1080 };
    let duration: number | undefined;

    try {
      if (category === 'adobe-psd') {
        const buffer = await file.slice(0, 1024 * 1024 * 6).arrayBuffer();
        const psdThumb = extractPsdThumbnail(buffer);
        if (psdThumb) {
          previewUrl = psdThumb;
          dimensions = await getImageDimensions(previewUrl);
        } else {
          previewUrl = generateDocumentPlaceholder(file.name, extension, colorBadge, format);
          dimensions = { width: 1200, height: 900 };
        }
      } else if (category === 'adobe-indd') {
        const buffer = await file.slice(0, 1024 * 1024 * 10).arrayBuffer();
        const inddRes = await extractInddThumbnail(buffer, file.name);
        previewUrl = inddRes.url;
        dimensions = { width: inddRes.width, height: inddRes.height };
      } else if (category === 'adobe-ai') {
        const buffer = await file.slice(0, 1024 * 1024 * 8).arrayBuffer();
        const aiRes = await extractAiThumbnail(buffer, file.name);
        previewUrl = aiRes.url;
        dimensions = { width: aiRes.width, height: aiRes.height };
      } else if (category === 'raw') {
        const buffer = await file.slice(0, 1024 * 1024 * 16).arrayBuffer();
        const rawRes = await extractRawThumbnail(buffer, file.name);
        previewUrl = rawRes.url;
        dimensions = { width: rawRes.width, height: rawRes.height };
      } else if (category === 'vector') {
        if (extension === 'EPS') {
          const buffer = await file.slice(0, 1024 * 1024 * 6).arrayBuffer();
          const epsRes = await extractAiThumbnail(buffer, file.name);
          previewUrl = epsRes.url;
          dimensions = { width: epsRes.width, height: epsRes.height };
        } else {
          // Standard SVG Vector
          previewUrl = URL.createObjectURL(file);
          dimensions = await getImageDimensions(previewUrl);
        }
      } else if (category === 'video') {
        try {
          const videoInfo = await extractVideoThumbnail(file);
          previewUrl = videoInfo.url;
          dimensions = { width: videoInfo.width, height: videoInfo.height };
          duration = videoInfo.duration;
        } catch {
          previewUrl = generateDocumentPlaceholder(file.name, extension, colorBadge, format);
          dimensions = { width: 1200, height: 900 };
        }
      } else if (category === 'image') {
        previewUrl = URL.createObjectURL(file);
        dimensions = await getImageDimensions(previewUrl);
      } else {
        // PDF, After Effects, Premiere, and other formats
        previewUrl = generateDocumentPlaceholder(file.name, extension, colorBadge, format);
        dimensions = { width: 1200, height: 900 };
      }
    } catch (e) {
      console.warn(`Error generating preview for ${file.name}:`, e);
      previewUrl = generateDocumentPlaceholder(file.name, extension, colorBadge, format);
      dimensions = { width: 1200, height: 900 };
    }

    const modifiedDate = new Date(file.lastModified).toISOString().replace('T', ' ').slice(0, 19);

    const asset: AssetItem = {
      id: `local-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      folder: '/local',
      fullPath: file.webkitRelativePath || `${folderName}/${file.name}`,
      url: previewUrl,
      type: category as any,
      category,
      format,
      extension,
      colorBadge,
      size: file.size,
      dimensions,
      duration,
      dateModified: modifiedDate,
      dateCreated: modifiedDate,
      rating: 0,
      label: 'none',
      flag: 'unflagged',
      exif: {
        resolutionDpi: 300,
        bitDepth: file.type || 'Neznámý typ',
        colorProfile: 'sRGB IEC61966-2.1',
      },
      iptc: {
        title: file.name.replace(/\.[^/.]+$/, ''),
        caption: `Lokální soubor ${file.name} (${formatBytes(file.size)})`,
        keywords: [extension.toLowerCase(), 'local'],
      },
      isCustomUploaded: true,
      blob: file,
      fileRef: file,
    };

    results.push(asset);
  }

  return results;
}

/**
 * Native File System Access API picker for directory
 */
export async function pickLocalDirectory(): Promise<{
  folderName: string;
  files: File[];
  handle: any;
} | null> {
  if (!('showDirectoryPicker' in window)) {
    return null;
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker();
    const files = await scanDirectoryHandle(dirHandle);
    return { folderName: dirHandle.name, files, handle: dirHandle };
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('Directory picker failed:', err);
    }
    return null;
  }
}

/**
 * Scans an existing FileSystemDirectoryHandle and returns File array
 */
export async function scanDirectoryHandle(dirHandle: any): Promise<File[]> {
  const files: File[] = [];

  async function scan(handle: any, currentPath = '') {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        Object.defineProperty(file, 'webkitRelativePath', {
          value: currentPath ? `${currentPath}/${file.name}` : file.name,
          writable: false,
        });
        files.push(file);
      } else if (entry.kind === 'directory') {
        // Scan first level subdirectories
        const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        await scan(entry, subPath);
      }
    }
  }

  await scan(dirHandle, dirHandle.name);
  return files;
}

/**
 * Copies file text (path or filename) to clipboard
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard write text failed:', err);
    return false;
  }
}

/**
 * Copies image data directly to system clipboard as bitmap
 */
export async function copyImageToClipboard(asset: AssetItem): Promise<boolean> {
  try {
    if (asset.blob) {
      if (asset.blob.type === 'image/png') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': asset.blob }),
        ]);
        return true;
      }
    }

    // Convert preview URL to canvas PNG and copy
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = asset.url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (!blob) return false;

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch (err) {
    console.warn('Clipboard image copy failed, falling back to path copy:', err);
    return copyTextToClipboard(asset.fullPath || asset.name);
  }
}

/**
 * Processes an individual asset with format conversion, resizing, and optional watermark
 */
export async function processAssetForExport(
  asset: AssetItem,
  config?: BatchExportConfig
): Promise<{ name: string; blob: Blob }> {
  if (!config || (asset.category !== 'image' && asset.category !== 'vector')) {
    if (asset.blob) return { name: asset.name, blob: asset.blob };
    const res = await fetch(asset.url);
    const blob = await res.blob();
    return { name: asset.name, blob };
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = asset.url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    let targetWidth = img.naturalWidth || 1920;
    let targetHeight = img.naturalHeight || 1080;

    if (config.resizeMode !== 'original' && config.targetSize > 0) {
      if (config.resizeMode === 'width' && targetWidth > config.targetSize) {
        const ratio = config.targetSize / targetWidth;
        targetWidth = config.targetSize;
        targetHeight = Math.round(targetHeight * ratio);
      } else if (config.resizeMode === 'height' && targetHeight > config.targetSize) {
        const ratio = config.targetSize / targetHeight;
        targetHeight = config.targetSize;
        targetWidth = Math.round(targetWidth * ratio);
      } else if (config.resizeMode === 'fit') {
        const maxDim = Math.max(targetWidth, targetHeight);
        if (maxDim > config.targetSize) {
          const ratio = config.targetSize / maxDim;
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Apply watermark if configured
    if (config.addWatermark && config.watermarkText) {
      const fontSize = Math.max(14, Math.round(targetWidth * 0.024));
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';

      // Text shadow / backing for legibility
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillText(config.watermarkText, targetWidth - 24 + 1, targetHeight - 24 + 1);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(config.watermarkText, targetWidth - 24, targetHeight - 24);
    }

    const mimeType =
      config.format === 'png'
        ? 'image/png'
        : config.format === 'jpeg'
        ? 'image/jpeg'
        : 'image/webp';

    const quality = config.format === 'png' ? undefined : config.quality;

    const exportedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );

    if (!exportedBlob) throw new Error('toBlob returned null');

    const baseName = asset.name.replace(/\.[^/.]+$/, '');
    const ext = config.format === 'jpeg' ? 'jpg' : config.format;
    return { name: `${baseName}.${ext}`, blob: exportedBlob };
  } catch (err) {
    console.warn(`Fallback to original for ${asset.name}:`, err);
    if (asset.blob) return { name: asset.name, blob: asset.blob };
    const res = await fetch(asset.url);
    const blob = await res.blob();
    return { name: asset.name, blob };
  }
}

/**
 * Exports selected assets as a ZIP bundle with optional conversion and watermark
 */
export async function downloadAssetsAsZip(
  assets: AssetItem[],
  zipFilename = 'AeroBridge_Export.zip',
  config?: BatchExportConfig
): Promise<void> {
  const safeZipFilename = sanitizeFilename(zipFilename) || 'AeroBridge_Export.zip';
  const zip = new JSZip();

  for (const asset of assets) {
    try {
      const { name, blob } = await processAssetForExport(asset, config);
      zip.file(sanitizeFilename(name), blob);
    } catch (e) {
      console.warn(`Failed to package ${asset.name} into zip:`, e);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = safeZipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

