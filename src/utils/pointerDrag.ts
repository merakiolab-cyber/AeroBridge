/**
 * AeroBridge Studio — pointer-based drag & drop for moving files inside the app (desktop)
 *
 * In-app dragging uses pointer events for smooth UX (ghost badge, folder highlighting).
 * If the user drags outside the window, moves near the window boundary, presses Alt (for Alt+Tab),
 * or switches windows (blur), the drag seamlessly hands over to the Windows OS OLE DoDragDrop
 * via `startNativeFileDrag`.
 */

import type React from 'react';
import { isDesktopApp, startNativeFileDrag, cursorOverOtherWindow } from './tauriBridge';

export interface PointerDragPayload {
  paths: string[];
  icon?: string;
}

type DropHandler = (paths: string[], targetFolder: string, isCopy: boolean) => void;

const DRAG_THRESHOLD_PX = 6;
const PROBE_INTERVAL_MS = 35;
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
  ghost.className = 'ab-drag-ghost';
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

// Global safety guard: ensure no orphan dragging state persists if window gains/regains focus
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    document.body.classList.remove('ab-dragging');
    document.querySelectorAll('.ab-drag-ghost').forEach((el) => el.remove());
  });
}

/** Call from `onPointerDown` of anything that can be dragged. No-op outside the desktop app. */
export function beginPointerDrag(e: React.PointerEvent, getPayload: () => PointerDragPayload | null): void {
  if (!isDesktopApp() || e.button !== 0 || !e.isPrimary) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const pointerId = e.pointerId;
  const source = e.currentTarget as HTMLElement;

  let active = false;
  let handedOver = false;
  let payload: PointerDragPayload | null = null;
  let ghost: HTMLDivElement | null = null;
  let hover: HTMLElement | null = null;
  let probing = false;
  let lastProbe = 0;

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
    window.removeEventListener('blur', onBlur, true);
    window.removeEventListener('lostpointercapture', onLostCapture, true);
    try {
      source.removeEventListener('lostpointercapture', onLostCapture as EventListener);
      source.releasePointerCapture(pointerId);
    } catch {
      // capture may already be gone
    }
    ghost?.remove();
    ghost = null;
    setHover(null);
    document.body.classList.remove('ab-dragging');
    document.querySelectorAll('.ab-drag-ghost').forEach((el) => el.remove());
    active = false;
  };

  const handOverToNative = () => {
    if (handedOver) return;
    handedOver = true;
    const toDrag = payload;
    const wasActive = active;
    cleanup();
    if (wasActive && toDrag && toDrag.paths.length > 0) {
      swallowNextClick();
      void startNativeFileDrag(toDrag.paths, toDrag.icon);
    }
  };

  const onLostCapture = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (active && !handedOver) {
      if (!document.hasFocus()) {
        handOverToNative();
      } else {
        cleanup();
        swallowNextClick();
      }
    } else {
      cleanup();
    }
  };

  const onBlur = () => {
    if (active && !handedOver) {
      // Window lost focus while dragging (e.g. Alt+Tab, Win+Tab, taskbar click, multi-monitor switch)
      handOverToNative();
    } else {
      cleanup();
    }
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      const wasActive = active;
      cleanup();
      if (wasActive) swallowNextClick();
      return;
    }
    // Alt pressed during active drag -> user is initiating Alt+Tab to another window!
    // Hand over immediately so Windows OLE DoDragDrop is active before the window switch completes.
    if (ev.key === 'Alt' || ev.altKey) {
      if (active) {
        handOverToNative();
      }
    }
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;

    // Safety: if the user released the mouse button (e.g. outside or desynced), don't keep dragging!
    if (active && (ev.buttons & 1) === 0) {
      cleanup();
      swallowNextClick();
      return;
    }

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
        source.addEventListener('lostpointercapture', onLostCapture as EventListener, { once: true });
      } catch {
        // not fatal: window-level listeners still receive the moves
      }
    }

    // Alt key held down (e.g. user pressing Alt+Tab or Alt-dragging)
    if (ev.altKey) {
      handOverToNative();
      return;
    }

    // Pointer near or outside the app window boundary: hand over to OS drag
    if (
      ev.clientX <= 2 ||
      ev.clientY <= 2 ||
      ev.clientX >= window.innerWidth - 3 ||
      ev.clientY >= window.innerHeight - 3
    ) {
      handOverToNative();
      return;
    }

    // Another application's window may lie over ours: ask OS what is under cursor
    const now = performance.now();
    if (!probing && now - lastProbe > PROBE_INTERVAL_MS) {
      probing = true;
      lastProbe = now;
      void cursorOverOtherWindow().then((outside) => {
        probing = false;
        if (!outside || !active || handedOver) return;
        handOverToNative();
      });
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
    if (!wasActive || handedOver) return;
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

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', onBlur, true);
  window.addEventListener('lostpointercapture', onLostCapture, true);
}
