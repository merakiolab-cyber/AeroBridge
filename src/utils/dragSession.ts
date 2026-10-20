/**
 * AeroBridge Studio — in-app drag session
 *
 * On desktop, dragging a file starts an OS-level (OLE) drag so it can be dropped into Photoshop, Explorer, Blender…
 * During such a drag WebView2 hands the page an empty DataTransfer, so in-app drop targets (folder tree, favourites,
 * folder cards) would receive nothing and no move/copy would happen. The paths of the drag in progress are therefore
 * remembered here and used as the authoritative payload for drops that originate inside the app.
 */

import type React from 'react';

let sessionPaths: string[] | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

export function beginDragSession(paths: string[]): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  sessionPaths = paths.length > 0 ? [...paths] : null;
}

/** Keeps the payload briefly after the OS drag ends: the drop event can arrive after the drag call resolves. */
export function endDragSession(graceMs = 1500): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    sessionPaths = null;
    clearTimer = null;
  }, graceMs);
}

export function hasDragSession(): boolean {
  return sessionPaths !== null && sessionPaths.length > 0;
}

const looksLikePath = (s: string) => /[\\/:]/.test(s);

/**
 * Items (absolute paths, or asset ids in web mode) carried by a drop event.
 * Order: in-app drag session → app JSON payload → plain text → dropped OS files that expose a path.
 */
export function resolveDropItems(e: React.DragEvent): string[] {
  if (sessionPaths && sessionPaths.length > 0) {
    const items = sessionPaths;
    sessionPaths = null;
    return items;
  }

  try {
    const raw = e.dataTransfer.getData('application/json');
    if (raw) {
      const parsed = JSON.parse(raw);
      const items = parsed.paths && parsed.paths.length > 0 ? parsed.paths : parsed.assetIds;
      if (Array.isArray(items) && items.length > 0) return items;
    }
  } catch {
    // fall through to the next source
  }

  const plain = e.dataTransfer.getData('text/plain');
  if (plain) {
    let items = plain.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    // Web mode joins several asset ids with commas; real paths may legitimately contain commas
    if (items.length === 1 && items[0].includes(',') && !looksLikePath(items[0])) {
      items = items[0].split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (items.length > 0) return items;
  }

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const p = (files[i] as unknown as { path?: string }).path;
      if (p) paths.push(p);
    }
    if (paths.length > 0) return paths;
  }

  return [];
}
