/**
 * AeroBridge Studio — pointer-based drag & drop for moving files inside the app (desktop)
 *
 * HTML5 drag & drop is unreliable in WebView2 once an OS-level drag (needed to drop files into Photoshop, Explorer,
 * Blender…) is involved: in-app drop targets do not get usable events. Moving files between folders therefore uses
 * plain pointer events:
 *   - a press + move past a small threshold starts a drag with a ghost label;
 *   - targets are any elements carrying `data-drop-path="<folder path>"` (tree rows, favourites, folder cards…);
 *   - releasing over a target runs the registered drop handler (Ctrl = copy);
 *   - leaving the application window hands the drag over to the OS drag, so dropping into other apps still works.
 */

import type React from 'react';
import { isDesktopApp, startNativeFileDrag } from './tauriBridge';

export interface PointerDragPayload {
  paths: string[];
  icon?: string;
}

type DropHandler = (paths: string[], targetFolder: string, isCopy: boolean) => void;

const DRAG_THRESHOLD_PX = 6;
const HOVER_ATTR = 'data-drop-hover';

let dropHandler: DropHandler | null = null;

export function setPointerDropHandler(handler: DropHandler | null): void {
  dropHandler = handler;
}

const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
const parentOf = (p: string) => norm(p).replace(/\\[^\\]*$/, '');

/** Drops that would do nothing useful: onto itself, into its own subfolder, or into the folder it already lives in. */
function movablePaths(paths: string[], target: string): string[] {
  const t = norm(target);
  return paths.filter((p) => {
    const n = norm(p);
    return n !== t && parentOf(p) !== t && !t.startsWith(n + '\\');
  });
}

function createGhost(payload: PointerDragPayload): HTMLDivElement {
  const ghost = document.createElement('div');
  const count = payload.paths.length;
  const first = payload.paths[0].split(/[\\/]/).pop() || payload.paths[0];
  ghost.textContent = count > 1 ? `${count} položek` : first;
  ghost.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'z-index:2147483647', 'pointer-events:none',
    'max-width:260px', 'overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap',
    'padding:6px 12px', 'border-radius:8px', 'font:600 12px "Plus Jakarta Sans",system-ui,sans-serif',
    'color:#e2e4e9', 'background:rgba(26,29,39,.94)', 'border:1px solid rgba(96,205,255,.55)',
    'box-shadow:0 8px 24px rgba(0,0,0,.5)', 'will-change:transform',
  ].join(';');
  return ghost;
}

/** Call from `onPointerDown` of anything that can be dragged. No-op outside the desktop app. */
export function beginPointerDrag(e: React.PointerEvent, getPayload: () => PointerDragPayload | null): void {
  if (!isDesktopApp() || e.button !== 0 || !e.isPrimary) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const pointerId = e.pointerId;
  const source = e.currentTarget as HTMLElement;

  let active = false;
  let payload: PointerDragPayload | null = null;
  let ghost: HTMLDivElement | null = null;
  let hover: HTMLElement | null = null;

  const setHover = (next: HTMLElement | null) => {
    if (next === hover) return;
    hover?.removeAttribute(HOVER_ATTR);
    next?.setAttribute(HOVER_ATTR, 'true');
    hover = next;
  };

  const swallowNextClick = () => {
    const handler = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', handler, { capture: true, once: true });
    // If no click follows (pointer released elsewhere) do not leave the guard armed
    setTimeout(() => window.removeEventListener('click', handler, { capture: true }), 250);
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
    window.removeEventListener('keydown', onKey, true);
    ghost?.remove();
    ghost = null;
    setHover(null);
    document.body.classList.remove('ab-dragging');
    try {
      source.releasePointerCapture(pointerId);
    } catch {
      // capture may already be gone
    }
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;

    if (!active) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
      payload = getPayload();
      if (!payload || payload.paths.length === 0) {
        cleanup();
        return;
      }
      active = true;
      ghost = createGhost(payload);
      document.body.appendChild(ghost);
      document.body.classList.add('ab-dragging');
      try {
        source.setPointerCapture(pointerId);
      } catch {
        // not fatal: window-level listeners still receive the moves
      }
    }

    // Pointer left the app window: continue as an OS drag so the files can be dropped into other applications
    if (ev.clientX <= 0 || ev.clientY <= 0 || ev.clientX >= window.innerWidth - 1 || ev.clientY >= window.innerHeight - 1) {
      const handOver = payload!;
      cleanup();
      swallowNextClick();
      void startNativeFileDrag(handOver.paths, handOver.icon);
      return;
    }

    if (ghost) ghost.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    setHover((under?.closest('[data-drop-path]') as HTMLElement | null) ?? null);
  };

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const wasActive = active;
    const target = hover?.getAttribute('data-drop-path') ?? null;
    const dragged = payload;
    cleanup();
    if (!wasActive) return;
    swallowNextClick();
    if (target && dragged && dropHandler) {
      const paths = movablePaths(dragged.paths, target);
      if (paths.length > 0) dropHandler(paths, target, ev.ctrlKey);
    }
  };

  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const wasActive = active;
    cleanup();
    if (wasActive) swallowNextClick();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return;
    ev.stopPropagation();
    const wasActive = active;
    cleanup();
    if (wasActive) swallowNextClick();
  };

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('keydown', onKey, true);
}
