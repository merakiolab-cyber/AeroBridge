import { getImageDimensions } from './types';

/**
 * Extracts embedded thumbnail or preview from OpenXML & OpenDocument office presentations/documents
 * (.pptx, .ppt, .docx, .doc, .xlsx, .xls, .odp, .odt, .ods).
 */
export async function extractOfficeThumbnail(
  buffer: ArrayBuffer,
  _fileName: string,
  ext: string
): Promise<{ url: string; width: number; height: number; isPlaceholder?: boolean } | null> {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  const zipExts = new Set(['pptx', 'potx', 'ppsx', 'docx', 'dotx', 'xlsx', 'xltx', 'odp', 'odt', 'ods']);

  if (!zipExts.has(cleanExt)) {
    return null;
  }

  try {
    const { default: JSZipModule } = await import('jszip');
    const JSZip = (JSZipModule as any)?.default || JSZipModule;
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.values(zip.files || {}) as any[];

    // 1. Standard OpenXML (docProps/thumbnail.jpeg or .png) and OpenDocument (Thumbnails/thumbnail.png)
    const thumbEntry = files.find((f: any) =>
      /(^|\/)(docProps\/thumbnail\.(jpe?g|png)|Thumbnails\/thumbnail\.png)$/i.test(f.name)
    );

    if (thumbEntry) {
      const b64 = await thumbEntry.async('base64');
      const mime = /\.png$/i.test(thumbEntry.name) ? 'image/png' : 'image/jpeg';
      const url = `data:${mime};base64,${b64}`;
      const dims = await getImageDimensions(url);
      return { url, width: dims.width, height: dims.height, isPlaceholder: false };
    }

    // 2. PowerPoint specific: Check for first slide media or embedded slide snapshot
    if (cleanExt.startsWith('ppt')) {
      const slideImg = files.find((f: any) =>
        /(^|\/)ppt\/media\/(image1|slide1)\.(jpe?g|png|webp)$/i.test(f.name)
      );
      if (slideImg) {
        const b64 = await slideImg.async('base64');
        const mime = /\.png$/i.test(slideImg.name) ? 'image/png' : 'image/jpeg';
        const url = `data:${mime};base64,${b64}`;
        const dims = await getImageDimensions(url);
        return { url, width: dims.width, height: dims.height, isPlaceholder: false };
      }
    }
  } catch (err) {
    console.debug('[OfficeExtractor] ZIP thumbnail parse failed:', err);
  }

  return null;
}
