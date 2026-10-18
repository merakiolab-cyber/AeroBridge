/**
 * Fast 3D Model thumbnail extractor for STL (.stl) and Wavefront OBJ (.obj) files.
 * Generates directional-lit shaded isometric previews using 2D canvas without requiring WebGL.
 */

export interface ThreeDeeThumbResult {
  url: string;
  width: number;
  height: number;
}

/**
 * Renders an isometric shaded preview of a 3D model from triangle meshes.
 */
function renderMeshToCanvas(
  triangles: Array<{
    v1: [number, number, number];
    v2: [number, number, number];
    v3: [number, number, number];
    normal?: [number, number, number];
  }>,
  size = 400
): string | null {
  if (triangles.length === 0) return null;

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const t of triangles) {
    for (const v of [t.v1, t.v2, t.v3]) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const maxSpan = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;

  // Isometric projection angles (yaw 45 deg, pitch 30 deg)
  const cosY = Math.cos(Math.PI / 4);
  const sinY = Math.sin(Math.PI / 4);
  const cosP = Math.cos(Math.PI / 6);
  const sinP = Math.sin(Math.PI / 6);

  // Directional light vector (top-right-front)
  const lx = 0.5, ly = 0.8, lz = 0.3;
  const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);
  const nlx = lx / lLen, nly = ly / lLen, nlz = lz / lLen;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Modern studio backdrop
  ctx.fillStyle = '#14161d';
  ctx.fillRect(0, 0, size, size);

  // Subtle circular ambient glow in background
  const grad = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.6);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const scale = (size * 0.68) / maxSpan;
  const half = size / 2;

  // Project and depth-sort triangles (Painter's algorithm)
  interface ProjectedTri {
    p1: [number, number];
    p2: [number, number];
    p3: [number, number];
    depth: number;
    color: string;
  }

  const projected: ProjectedTri[] = [];

  for (const t of triangles) {
    // Normal calculation
    let nx = t.normal?.[0] ?? 0;
    let ny = t.normal?.[1] ?? 0;
    let nz = t.normal?.[2] ?? 0;

    if (!t.normal || (nx === 0 && ny === 0 && nz === 0)) {
      const ax = t.v2[0] - t.v1[0], ay = t.v2[1] - t.v1[1], az = t.v2[2] - t.v1[2];
      const bx = t.v3[0] - t.v1[0], by = t.v3[1] - t.v1[1], bz = t.v3[2] - t.v1[2];
      nx = ay * bz - az * by;
      ny = az * bx - ax * bz;
      nz = ax * by - ay * bx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) { nx /= len; ny /= len; nz /= len; }
    }

    // Diffuse lighting
    const dot = Math.max(0, nx * nlx + ny * nly + nz * nlz);
    const ambient = 0.22;
    const intensity = Math.min(1, ambient + dot * 0.78);

    // Cyan / slate studio shaded tone
    const r = Math.round(56 * intensity * 0.6 + 60 * (1 - intensity));
    const g = Math.round(189 * intensity * 0.8 + 80 * (1 - intensity));
    const b = Math.round(248 * intensity + 110 * (1 - intensity));
    const color = `rgb(${r}, ${g}, ${b})`;

    // Project vertices
    const projectVertex = (v: [number, number, number]): [number, number, number] => {
      const x = v[0] - cx;
      const y = v[1] - cy;
      const z = v[2] - cz;

      // Rotate around Y
      const rx = x * cosY - z * sinY;
      const rz = x * sinY + z * cosY;

      // Rotate around X (pitch)
      const ry = y * cosP - rz * sinP;
      const rdepth = y * sinP + rz * cosP;

      const px = half + rx * scale;
      const py = half - ry * scale;
      return [px, py, rdepth];
    };

    const p1 = projectVertex(t.v1);
    const p2 = projectVertex(t.v2);
    const p3 = projectVertex(t.v3);
    const depth = (p1[2] + p2[2] + p3[2]) / 3;

    projected.push({
      p1: [p1[0], p1[1]],
      p2: [p2[0], p2[1]],
      p3: [p3[0], p3[1]],
      depth,
      color,
    });
  }

  // Sort back-to-front
  projected.sort((a, b) => a.depth - b.depth);

  // Render shaded faces
  ctx.lineWidth = 0.5;
  for (const tri of projected) {
    ctx.beginPath();
    ctx.moveTo(tri.p1[0], tri.p1[1]);
    ctx.lineTo(tri.p2[0], tri.p2[1]);
    ctx.lineTo(tri.p3[0], tri.p3[1]);
    ctx.closePath();

    ctx.fillStyle = tri.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Extracts preview thumbnail from binary or ASCII STL file.
 */
export function extractStlThumbnail(buffer: ArrayBuffer): ThreeDeeThumbResult | null {
  try {
    if (!buffer || buffer.byteLength < 84) return null;
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    // Check if binary STL (header 80 bytes + uint32 triangle count)
    const numTriangles = view.getUint32(80, true);
    const expectedBinarySize = 84 + numTriangles * 50;

    // Binary STL
    if (numTriangles > 0 && Math.abs(expectedBinarySize - buffer.byteLength) < 1000) {
      const maxTrianglesToRender = Math.min(numTriangles, 12000);
      const stride = Math.max(1, Math.floor(numTriangles / maxTrianglesToRender));
      const triangles: Array<{
        v1: [number, number, number];
        v2: [number, number, number];
        v3: [number, number, number];
        normal?: [number, number, number];
      }> = [];

      for (let i = 0; i < numTriangles && triangles.length < maxTrianglesToRender; i += stride) {
        const offset = 84 + i * 50;
        if (offset + 50 > buffer.byteLength) break;

        const nx = view.getFloat32(offset, true);
        const ny = view.getFloat32(offset + 4, true);
        const nz = view.getFloat32(offset + 8, true);

        const v1x = view.getFloat32(offset + 12, true);
        const v1y = view.getFloat32(offset + 16, true);
        const v1z = view.getFloat32(offset + 20, true);

        const v2x = view.getFloat32(offset + 24, true);
        const v2y = view.getFloat32(offset + 28, true);
        const v2z = view.getFloat32(offset + 32, true);

        const v3x = view.getFloat32(offset + 36, true);
        const v3y = view.getFloat32(offset + 40, true);
        const v3z = view.getFloat32(offset + 44, true);

        triangles.push({
          normal: [nx, ny, nz],
          v1: [v1x, v1y, v1z],
          v2: [v2x, v2y, v2z],
          v3: [v3x, v3y, v3z],
        });
      }

      const url = renderMeshToCanvas(triangles, 400);
      return url ? { url, width: 400, height: 400 } : null;
    }

    // ASCII STL parser
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024 * 1024 * 4));
    if (text.includes('solid') && text.includes('facet')) {
      const triangles: Array<{
        v1: [number, number, number];
        v2: [number, number, number];
        v3: [number, number, number];
      }> = [];

      const vertexRegex = /vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/g;
      let m: RegExpExecArray | null;
      const vBuf: Array<[number, number, number]> = [];

      while ((m = vertexRegex.exec(text)) !== null && triangles.length < 8000) {
        vBuf.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
        if (vBuf.length === 3) {
          triangles.push({
            v1: vBuf[0],
            v2: vBuf[1],
            v3: vBuf[2],
          });
          vBuf.length = 0;
        }
      }

      if (triangles.length > 0) {
        const url = renderMeshToCanvas(triangles, 400);
        return url ? { url, width: 400, height: 400 } : null;
      }
    }
  } catch (err) {
    console.debug('[3D] STL parsing error:', err);
  }
  return null;
}

/**
 * Extracts preview thumbnail from Wavefront OBJ (.obj) file buffer.
 */
export function extractObjThumbnail(buffer: ArrayBuffer): ThreeDeeThumbResult | null {
  try {
    if (!buffer || buffer.byteLength < 16) return null;
    const scanLimit = Math.min(buffer.byteLength, 1024 * 1024 * 8);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer, 0, scanLimit));

    const vertices: Array<[number, number, number]> = [];
    const triangles: Array<{
      v1: [number, number, number];
      v2: [number, number, number];
      v3: [number, number, number];
    }> = [];

    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length && triangles.length < 10000; i++) {
      const line = lines[i].trim();
      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        }
      } else if (line.startsWith('f ')) {
        const parts = line.split(/\s+/).slice(1);
        if (parts.length >= 3) {
          const parseIdx = (p: string) => {
            const idx = parseInt(p.split('/')[0], 10);
            return idx > 0 ? idx - 1 : vertices.length + idx;
          };
          const i1 = parseIdx(parts[0]);
          const i2 = parseIdx(parts[1]);
          const i3 = parseIdx(parts[2]);

          if (vertices[i1] && vertices[i2] && vertices[i3]) {
            triangles.push({
              v1: vertices[i1],
              v2: vertices[i2],
              v3: vertices[i3],
            });
          }
          // Quad support
          if (parts.length >= 4) {
            const i4 = parseIdx(parts[3]);
            if (vertices[i1] && vertices[i3] && vertices[i4]) {
              triangles.push({
                v1: vertices[i1],
                v2: vertices[i3],
                v3: vertices[i4],
              });
            }
          }
        }
      }
    }

    if (triangles.length > 0) {
      const url = renderMeshToCanvas(triangles, 400);
      return url ? { url, width: 400, height: 400 } : null;
    }
  } catch (err) {
    console.debug('[3D] OBJ parsing error:', err);
  }
  return null;
}
