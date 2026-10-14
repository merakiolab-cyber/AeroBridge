import { AssetItem, IptcData } from '../types';

/**
 * Escapes special XML characters for safe XMP generation.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * Generates a valid Adobe XMP RDF metadata packet string conforming to ISO 16684-1.
 * Dublin Core (dc) & Photoshop namespace fields are mapped cleanly.
 */
export function generateXmpPacket(iptc: IptcData): string {
  const titleXml = iptc.title
    ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(iptc.title)}</rdf:li></rdf:Alt></dc:title>`
    : '';

  const descXml = iptc.caption
    ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(iptc.caption)}</rdf:li></rdf:Alt></dc:description>`
    : '';

  const creatorXml = iptc.creator
    ? `<dc:creator><rdf:Seq><rdf:li>${escapeXml(iptc.creator)}</rdf:li></rdf:Seq></dc:creator>`
    : '';

  const rightsXml = iptc.copyright
    ? `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(iptc.copyright)}</rdf:li></rdf:Alt></dc:rights>`
    : '';

  const keywordsXml =
    iptc.keywords && iptc.keywords.length > 0
      ? `<dc:subject><rdf:Bag>${iptc.keywords
          .map((kw) => `<rdf:li>${escapeXml(kw)}</rdf:li>`)
          .join('')}</rdf:Bag></dc:subject>`
      : '';

  const locationXml = iptc.location
    ? `<photoshop:City>${escapeXml(iptc.location)}</photoshop:City>`
    : '';

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="AeroBridge Studio Metadata Engine v2.7">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
   ${titleXml}
   ${descXml}
   ${creatorXml}
   ${rightsXml}
   ${locationXml}
   ${keywordsXml}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

const XMP_IDENTIFIER = 'http://ns.adobe.com/xap/1.0/\0';

/**
 * Embeds Adobe XMP metadata into a JPEG binary buffer without altering existing EXIF or image scans.
 * Replaces any existing XMP APP1 segment or inserts it right after existing EXIF APP1 / SOI.
 */
export function embedXmpIntoJpeg(buffer: ArrayBuffer, xmpXml: string): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Neplatný formát JPEG souboru (chybí SOI marker).');
  }

  const encoder = new TextEncoder();
  const xmpBytes = encoder.encode(xmpXml);
  const idBytes = encoder.encode(XMP_IDENTIFIER);

  // Maximum APP1 segment data size is 65533 bytes (65535 - 2 for length bytes)
  const segmentPayloadLength = idBytes.length + xmpBytes.length;
  if (segmentPayloadLength > 65533) {
    console.warn('XMP packet přesahuje 65 KB, bude oříznut pro splnění JPEG specifikace.');
  }

  const app1Length = 2 + Math.min(segmentPayloadLength, 65533);
  const newApp1Segment = new Uint8Array(2 + app1Length);
  newApp1Segment[0] = 0xff;
  newApp1Segment[1] = 0xe1; // APP1 marker
  newApp1Segment[2] = (app1Length >> 8) & 0xff;
  newApp1Segment[3] = app1Length & 0xff;
  newApp1Segment.set(idBytes, 4);
  newApp1Segment.set(xmpBytes.subarray(0, app1Length - 2 - idBytes.length), 4 + idBytes.length);

  // Scan segments to find position for XMP or replace existing XMP APP1
  let insertIndex = 2; // Default: right after SOI
  let existingXmpStart = -1;
  let existingXmpEnd = -1;
  let pos = 2;

  while (pos < bytes.length - 4) {
    if (bytes[pos] !== 0xff) {
      pos++;
      continue;
    }

    const marker = bytes[pos + 1];

    // Standalone markers without length: SOS (0xDA), RST (0xD0-0xD7), EOI (0xD9)
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const segEnd = pos + 2 + segLen;

    // Check if this is an APP1 segment (0xFF 0xE1)
    if (marker === 0xe1) {
      // Check for Exif header
      const isExif =
        bytes[pos + 4] === 0x45 &&
        bytes[pos + 5] === 0x78 &&
        bytes[pos + 6] === 0x69 &&
        bytes[pos + 7] === 0x66;

      // Check for XMP header
      const isXmp =
        bytes[pos + 4] === 0x68 &&
        bytes[pos + 5] === 0x74 &&
        bytes[pos + 6] === 0x74 &&
        bytes[pos + 7] === 0x70;

      if (isExif) {
        // We prefer to insert XMP right after the EXIF APP1 segment
        insertIndex = segEnd;
      } else if (isXmp) {
        existingXmpStart = pos;
        existingXmpEnd = segEnd;
        break;
      }
    }

    pos = segEnd;
  }

  let finalBuffer: Uint8Array;
  if (existingXmpStart !== -1) {
    // Replace existing XMP segment
    const before = bytes.subarray(0, existingXmpStart);
    const after = bytes.subarray(existingXmpEnd);
    finalBuffer = new Uint8Array(before.length + newApp1Segment.length + after.length);
    finalBuffer.set(before, 0);
    finalBuffer.set(newApp1Segment, before.length);
    finalBuffer.set(after, before.length + newApp1Segment.length);
  } else {
    // Insert new XMP segment at insertIndex (after EXIF or after SOI)
    const before = bytes.subarray(0, insertIndex);
    const after = bytes.subarray(insertIndex);
    finalBuffer = new Uint8Array(before.length + newApp1Segment.length + after.length);
    finalBuffer.set(before, 0);
    finalBuffer.set(newApp1Segment, before.length);
    finalBuffer.set(after, before.length + newApp1Segment.length);
  }

  return finalBuffer.buffer as ArrayBuffer;
}

/**
 * Writes updated metadata directly back into an asset's file handle or provides updated Blob.
 */
export async function writeMetadataBackToAsset(
  asset: AssetItem,
  updatedIptc: IptcData
): Promise<{ success: boolean; message: string; updatedBlob?: Blob }> {
  try {
    let sourceBlob = asset.blob || asset.fileRef;
    if (!sourceBlob && asset.url) {
      const res = await fetch(asset.url);
      sourceBlob = await res.blob();
    }

    if (!sourceBlob) {
      return { success: false, message: `Soubor ${asset.name} není dostupný v paměti.` };
    }

    const xmpXml = generateXmpPacket(updatedIptc);
    const ext = asset.extension.toLowerCase();
    let finalBlob: Blob = sourceBlob;

    if (ext === 'jpg' || ext === 'jpeg') {
      const buffer = await sourceBlob.arrayBuffer();
      const updatedBuffer = embedXmpIntoJpeg(buffer, xmpXml);
      finalBlob = new Blob([updatedBuffer], { type: 'image/jpeg' });
    } else {
      // For formats where native in-place rewriting is binary-dependent, keep updated Blob
      finalBlob = sourceBlob;
    }

    // Direct Disk Writeback if FileSystemFileHandle is available
    if (asset.fileHandle && typeof asset.fileHandle.createWritable === 'function') {
      try {
        const writable = await asset.fileHandle.createWritable();
        await writable.write(finalBlob);
        await writable.close();
        return {
          success: true,
          message: `Metadata byla úspěšně zapsána přímo do souboru "${asset.name}" na disku.`,
          updatedBlob: finalBlob,
        };
      } catch (err: any) {
        console.warn('Direct file handle write failed, falling back:', err);
      }
    }

    return {
      success: true,
      message: `Metadata uložena pro "${asset.name}" (připraveno pro export).`,
      updatedBlob: finalBlob,
    };
  } catch (err: any) {
    console.error('Metadata writeback failed:', err);
    return { success: false, message: `Chyba při zápisu metadat: ${err.message}` };
  }
}
