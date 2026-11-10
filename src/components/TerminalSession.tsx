import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { Terminal as XTerm, IDecoration, IMarker } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ChevronUp, ChevronDown, ArrowDownToLine } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import {
  isDesktopApp,
  ptySpawn,
  ptyWrite,
  ptyResize,
  onPtyData,
  onPtyExit,
} from '../utils/tauriBridge';

type LineRole = 'user' | 'user-cont' | 'ai-header' | 'ai-body' | 'ai-tool';

interface LineDecorationEntry {
  text: string;
  role: LineRole;
  cols: number;
  marker: IMarker;
  decoration: IDecoration;
}

const DividerPattern = /^[\s─━═╭╮╰╯┌┐└┘│┃┄┅┈┉\-=_*]{3,}$/;
const StatusHintPattern = /^\s*(?:\?\s+for\s+shortcuts|shift\+tab|esc\s+to\s+|ctrl\+|⏵|⏸|Thinking|Working)/i;

function classifyTerminalLine(rawText: string, prevRole: LineRole | null): LineRole | null {
  const trimmedRight = rawText.replace(/\s+$/, '');
  if (!trimmedRight.trim()) return null;
  if (DividerPattern.test(trimmedRight)) return null;
  if (StatusHintPattern.test(trimmedRight)) return null;

  // 1. User prompt in Claude Code (`> ...`, `❯ ...`, or boxed `│ > ...`)
  if (/^\s*(?:[│┃]\s*)?[>❯]\s+\S/.test(trimmedRight)) {
    return 'user';
  }
  // 2. User interactive answer (`✓ ...`, `✔ ...`, `Answer: ...`, `Odpověď: ...`)
  if (/^\s*[✓✔]\s+\S/.test(trimmedRight) || /^\s*(?:Odpověď|Answer|Selected|Vybráno)\s*:/i.test(trimmedRight)) {
    return 'user';
  }
  // 3. Shell prompt with typed command (PowerShell, CMD, WSL/bash)
  if (
    /^\s*PS\s+[A-Za-z]:\\[^>]*>\s+\S/.test(trimmedRight) ||
    /^\s*[A-Za-z]:\\[^>]*>\s*\S/.test(trimmedRight) ||
    /^\s*[\w.-]+@[\w.-]+:[^$#]*[$#]\s+\S/.test(trimmedRight)
  ) {
    return 'user';
  }
  // 4. Empty shell prompt without command -> resets continuation state
  if (
    /^\s*PS\s+[A-Za-z]:\\[^>]*>\s*$/.test(trimmedRight) ||
    /^\s*[A-Za-z]:\\[^>]*>\s*$/.test(trimmedRight) ||
    /^\s*[\w.-]+@[\w.-]+:[^$#]*[$#]\s*$/.test(trimmedRight) ||
    /^\s*(?:[│┃]\s*)?[>❯]\s*$/.test(trimmedRight)
  ) {
    return null;
  }

  // 5. Claude Code / AI assistant response header (`⏺ ...`, `● ...`, `✦ ...`, `◆ ...`)
  if (/^\s*[⏺●✦◆]\s+\S/.test(trimmedRight)) {
    return 'ai-header';
  }

  // 6. Claude Code tool sub-result (`⎿ ...`)
  if (/^\s*⎿/.test(trimmedRight)) {
    return 'ai-tool';
  }

  // 7. Continuations of user prompt vs AI response
  if (prevRole === 'user' || prevRole === 'user-cont') {
    return 'user-cont';
  }
  if (prevRole === 'ai-header' || prevRole === 'ai-body' || prevRole === 'ai-tool') {
    return 'ai-body';
  }

  return null;
}

const ROLE_STYLES: Record<LineRole, { bg: string; fg: string; border: string }> = {
  'user': {
    bg: '#102a42',
    fg: '#7dd3fc',
    border: '3px solid #38bdf8',
  },
  'user-cont': {
    bg: '#0e2236',
    fg: '#bae6fd',
    border: '3px solid #38bdf8',
  },
  'ai-header': {
    bg: '#0f261e',
    fg: '#6ee7b7',
    border: '3px solid #10b981',
  },
  'ai-body': {
    bg: '#0c1c17',
    fg: '#d1fae5',
    border: '2px solid rgba(16, 185, 129, 0.55)',
  },
  'ai-tool': {
    bg: '#111a24',
    fg: '#94a3b8',
    border: '2px solid rgba(56, 189, 248, 0.35)',
  },
};

export interface TerminalSessionHandle {
  focus: () => void;
  clear: () => void;
  paste: (text: string) => void;
  launchClaude: () => void;
  hasSelection: () => boolean;
  getSelection: () => string;
  clearSelection: () => void;
  fit: () => void;
}

export interface TerminalSessionProps {
  sessionId: string;
  cwd: string;
  shellType: 'powershell' | 'cmd' | 'wsl';
  fontSize: number;
  isActive: boolean;
  isVisible: boolean;
  onProcessStateChange?: (isActive: boolean, exitCode?: number | null) => void;
  onZoomChange?: (delta: number) => void;
  onZoomReset?: () => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const TerminalSession = forwardRef<TerminalSessionHandle, TerminalSessionProps>(
  (
    {
      sessionId,
      cwd,
      shellType,
      fontSize,
      isActive,
      isVisible,
      onProcessStateChange,
      onZoomChange,
      onZoomReset,
      onNotify,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const decorationsMapRef = useRef<Map<number, LineDecorationEntry>>(new Map());
    const savedViewportYRef = useRef<{ viewportY: number; wasAtBottom: boolean }>({
      viewportY: 0,
      wasAtBottom: true,
    });

    const [scrollState, setScrollState] = useState<{
      viewportY: number;
      baseY: number;
      rows: number;
    }>({ viewportY: 0, baseY: 0, rows: 24 });

    const [roleTicks, setRoleTicks] = useState<Array<{ ratio: number; kind: 'user' | 'ai' }>>([]);

    const syncScrollState = useCallback(() => {
      const term = xtermRef.current;
      if (!term) return;
      const buf = term.buffer?.active;
      if (!buf) return;
      const viewportY = buf.viewportY;
      const baseY = buf.baseY;
      const rows = term.rows || 24;
      savedViewportYRef.current = {
        viewportY,
        wasAtBottom: viewportY >= baseY,
      };
      setScrollState((prev) =>
        prev.viewportY === viewportY && prev.baseY === baseY && prev.rows === rows
          ? prev
          : { viewportY, baseY, rows }
      );
    }, []);

    // Paste text into terminal: normalize newlines and write directly to PTY for ConPTY/Claude Code reliability
    const handlePasteText = useCallback((text: string) => {
      if (!text) return;
      const normalized = text.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
      if (isDesktopApp()) {
        void ptyWrite(sessionId, normalized);
      } else if (xtermRef.current) {
        xtermRef.current.paste(text);
      }
      xtermRef.current?.focus();
    }, [sessionId]);

    // Safe fit that preserves scroll position when user has scrolled up
    const performFit = useCallback(() => {
      const term = xtermRef.current;
      const fitAddon = fitAddonRef.current;
      if (!term || !fitAddon) return;
      const saved = savedViewportYRef.current;
      try {
        fitAddon.fit();
        void ptyResize(sessionId, term.cols, term.rows);
        if (!saved.wasAtBottom && saved.viewportY < term.buffer.active.baseY) {
          term.scrollToLine(saved.viewportY);
        }
        syncScrollState();
      } catch {}
    }, [sessionId, syncScrollState]);

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        focus: () => xtermRef.current?.focus(),
        clear: () => {
          decorationsMapRef.current.forEach((entry) => {
            try {
              entry.decoration.dispose();
              entry.marker.dispose();
            } catch {}
          });
          decorationsMapRef.current.clear();
          setRoleTicks([]);
          xtermRef.current?.clear();
          syncScrollState();
        },
        paste: (text: string) => handlePasteText(text),
        launchClaude: () => {
          void ptyWrite(sessionId, 'claude\r');
          setTimeout(() => xtermRef.current?.focus(), 50);
        },
        hasSelection: () => !!xtermRef.current?.hasSelection(),
        getSelection: () => xtermRef.current?.getSelection() || '',
        clearSelection: () => xtermRef.current?.clearSelection(),
        fit: () => performFit(),
      }),
      [handlePasteText, performFit, sessionId, syncScrollState]
    );

    // Right-click: Copy selection or Paste from clipboard
    const handleContextMenu = useCallback(
      async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const term = xtermRef.current;
        if (term?.hasSelection()) {
          const sel = term.getSelection();
          if (sel) {
            try {
              await navigator.clipboard.writeText(sel);
              term.clearSelection();
              onNotify?.('Zkopírováno', 'Výběr z terminálu byl zkopírován', 'success');
            } catch {}
            return;
          }
        }

        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            handlePasteText(text);
            onNotify?.('Vloženo', 'Text ze schránky byl vložen', 'success');
          }
        } catch (err) {
          console.warn('[TerminalSession paste error]:', err);
        }
      },
      [handlePasteText, onNotify]
    );

    // Wheel zoom: Ctrl + MouseWheel
    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          onZoomChange?.(e.deltaY < 0 ? 1 : -1);
        }
      },
      [onZoomChange]
    );

    // Initialize xterm & PTY session
    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerm({
        fontFamily: "'Cascadia Code', 'Consolas', 'Fira Code', 'Lucida Console', monospace",
        fontSize,
        fontWeight: '400',
        lineHeight: 1.25,
        scrollback: 10000,
        overviewRuler: { width: 1 },
        cursorBlink: true,
        cursorStyle: 'block',
        allowProposedApi: true,
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#38bdf8',
          cursorAccent: '#0d1117',
          selectionBackground: 'rgba(56, 189, 248, 0.35)',
          black: '#484f58',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#b1bac4',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#ffffff',
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      // Key event handler for Copy, Paste, and Zoom
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        if (event.type !== 'keydown') return true;

        const keyLower = event.key.toLowerCase();

        // 1. Copy: Ctrl+Shift+C or Ctrl+C with selection
        const isCopy =
          (event.ctrlKey && event.shiftKey && keyLower === 'c') ||
          (event.ctrlKey && !event.shiftKey && !event.altKey && keyLower === 'c' && term.hasSelection()) ||
          (event.ctrlKey && event.key === 'Insert' && term.hasSelection());

        if (isCopy) {
          const sel = term.getSelection();
          if (sel) {
            void navigator.clipboard.writeText(sel).then(() => {
              onNotify?.('Zkopírováno', 'Výběr z terminálu byl zkopírován', 'success');
            });
            term.clearSelection();
          }
          return false;
        }

        // 2. Paste: Ctrl+V, Ctrl+Shift+V, Shift+Insert
        const isPaste =
          (event.ctrlKey && (keyLower === 'v' || event.code === 'KeyV')) ||
          (event.shiftKey && event.key === 'Insert');

        if (isPaste) {
          // preventDefault cancels the native paste event, otherwise xterm pastes a second time
          event.preventDefault();
          void navigator.clipboard.readText().then((txt) => {
            if (txt) handlePasteText(txt);
          }).catch((err) => {
            console.warn('[TerminalSession clipboard error]:', err);
          });
          return false;
        }

        // 3. Shift+Enter: insert newline without submitting (ESC+CR, same as Alt+Enter; Claude Code accepts it)
        if (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault();
          void ptyWrite(sessionId, '\x1b\r').catch((err) => {
            console.error('[TerminalSession ptyWrite error]:', err);
          });
          return false;
        }

        // 4. PageUp / PageDown with Shift for quick scrolling
        if (event.key === 'PageUp' && event.shiftKey) {
          event.preventDefault();
          term.scrollPages(-1);
          return false;
        }
        if (event.key === 'PageDown' && event.shiftKey) {
          event.preventDefault();
          term.scrollPages(1);
          return false;
        }

        // 5. Zoom shortcuts: Ctrl + '+', Ctrl + '-', Ctrl + '0'
        if (
          event.ctrlKey &&
          !event.altKey &&
          (event.key === '=' || event.key === '+' || event.code === 'Equal' || event.code === 'NumpadAdd')
        ) {
          onZoomChange?.(1);
          return false;
        }
        if (
          event.ctrlKey &&
          !event.altKey &&
          (event.key === '-' || event.key === '_' || event.code === 'Minus' || event.code === 'NumpadSubtract')
        ) {
          onZoomChange?.(-1);
          return false;
        }
        if (
          event.ctrlKey &&
          !event.altKey &&
          (event.key === '0' || event.code === 'Digit0' || event.code === 'Numpad0')
        ) {
          onZoomReset?.();
          return false;
        }

        return true;
      });

      containerRef.current.innerHTML = '';
      term.open(containerRef.current);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      let unlistenData: (() => void) | null = null;
      let unlistenExit: (() => void) | null = null;
      let isCleanedUp = false;
      let rafSyncId: number | null = null;

      // Scan buffer lines and apply color decorations to distinguish User Prompts/Answers vs AI Responses
      const syncDecorationsAndScroll = () => {
        if (isCleanedUp) return;
        syncScrollState();

        const buf = term.buffer?.active;
        if (!buf || buf.type === 'alternate') return;

        const totalLines = buf.baseY + term.rows;
        const startLine = Math.max(0, totalLines - 400);
        const currentCursorAbs = buf.baseY + buf.cursorY;
        const cols = term.cols || 80;
        const decMap = decorationsMapRef.current;

        // Prune disposed or out-of-range markers
        for (const [lineIdx, entry] of decMap.entries()) {
          if (entry.marker.isDisposed || entry.marker.line < startLine || entry.marker.line !== lineIdx) {
            try {
              entry.decoration.dispose();
              entry.marker.dispose();
            } catch {}
            decMap.delete(lineIdx);
          }
        }

        let prevRole: LineRole | null = null;
        let changed = false;
        const ticks: Array<{ ratio: number; kind: 'user' | 'ai' }> = [];

        for (let y = startLine; y < totalLines; y++) {
          const lineObj = buf.getLine(y);
          if (!lineObj) {
            prevRole = null;
            continue;
          }
          const text = lineObj.translateToString(true);
          const role = classifyTerminalLine(text, prevRole);
          prevRole = role;

          if (role === 'user') {
            ticks.push({ ratio: totalLines > 1 ? y / totalLines : 0, kind: 'user' });
          } else if (role === 'ai-header') {
            ticks.push({ ratio: totalLines > 1 ? y / totalLines : 0, kind: 'ai' });
          }

          const existing = decMap.get(y);
          if (!role) {
            if (existing) {
              try {
                existing.decoration.dispose();
                existing.marker.dispose();
              } catch {}
              decMap.delete(y);
              changed = true;
            }
            continue;
          }

          if (existing && existing.text === text && existing.role === role && existing.cols === cols) {
            continue;
          }

          if (existing) {
            try {
              existing.decoration.dispose();
              existing.marker.dispose();
            } catch {}
            decMap.delete(y);
          }

          const offset = y - currentCursorAbs;
          const marker = term.registerMarker(offset);
          if (!marker) continue;

          const style = ROLE_STYLES[role];
          const decoration = term.registerDecoration({
            marker,
            x: 0,
            width: cols,
            height: 1,
            backgroundColor: style.bg,
            foregroundColor: style.fg,
            layer: 'bottom',
          });

          if (decoration) {
            decoration.onRender((el) => {
              el.style.pointerEvents = 'none';
              el.style.borderLeft = style.border;
              el.style.boxSizing = 'border-box';
            });
            decMap.set(y, { text, role, cols, marker, decoration });
            changed = true;
          } else {
            marker.dispose();
          }
        }

        setRoleTicks(ticks);
        if (changed) {
          try {
            term.refresh(0, term.rows - 1);
          } catch {}
        }
      };

      const scheduleSync = () => {
        if (isCleanedUp) return;
        if (rafSyncId !== null) return;
        rafSyncId = requestAnimationFrame(() => {
          rafSyncId = null;
          syncDecorationsAndScroll();
        });
      };

      const scrollDisp = term.onScroll(() => syncScrollState());
      const writeParsedDisp = term.onWriteParsed(() => scheduleSync());
      const lineFeedDisp = term.onLineFeed(() => scheduleSync());
      const resizeDisp = term.onResize(() => scheduleSync());

      const startPty = async () => {
        if (!isDesktopApp()) {
          term.writeln('\x1b[33m[Upozornění] Plnohodnotný PTY terminál je dostupný v desktopové aplikaci.\x1b[0m\r\n');
          return;
        }

        try {
          const cols = term.cols || 80;
          const rows = term.rows || 24;

          unlistenData = await onPtyData(sessionId, (chunk) => {
            if (!isCleanedUp) term.write(chunk);
          });

          unlistenExit = await onPtyExit(sessionId, (code) => {
            if (!isCleanedUp) {
              onProcessStateChange?.(false, code);
              term.writeln(`\r\n\x1b[90m[Proces shellu byl ukončen (kód ${code ?? 0})]\x1b[0m\r\n`);
            }
          });

          // Re-attaching to a session that survived a remount/reload returns its recent output
          const replay = await ptySpawn(sessionId, cwd, shellType, cols, rows);
          if (replay && !isCleanedUp) term.write(replay);
          onProcessStateChange?.(true);

          setTimeout(() => {
            if (isCleanedUp) return;
            try {
              fitAddon.fit();
              void ptyResize(sessionId, term.cols, term.rows);
              scheduleSync();
            } catch {}
          }, 100);
        } catch (err) {
          term.writeln(`\r\n\x1b[31m[Chyba spuštění terminálu: ${String(err)}]\x1b[0m\r\n`);
          onProcessStateChange?.(false);
        }
      };

      void startPty();

      const onDataDisposable = term.onData((data) => {
        void ptyWrite(sessionId, data).catch((err) => {
          console.error('[TerminalSession ptyWrite error]:', err);
        });
      });

      // ResizeObserver inside session container
      const resizeObserver = new ResizeObserver(() => {
        if (isCleanedUp || !containerRef.current) return;
        if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) return;
        try {
          const saved = savedViewportYRef.current;
          fitAddon.fit();
          void ptyResize(sessionId, term.cols, term.rows);
          if (!saved.wasAtBottom && saved.viewportY < term.buffer.active.baseY) {
            term.scrollToLine(saved.viewportY);
          }
          scheduleSync();
        } catch {}
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        isCleanedUp = true;
        if (rafSyncId !== null) cancelAnimationFrame(rafSyncId);
        resizeObserver.disconnect();
        scrollDisp.dispose();
        writeParsedDisp.dispose();
        lineFeedDisp.dispose();
        resizeDisp.dispose();
        onDataDisposable.dispose();
        decorationsMapRef.current.forEach((entry) => {
          try {
            entry.decoration.dispose();
            entry.marker.dispose();
          } catch {}
        });
        decorationsMapRef.current.clear();
        if (unlistenData) unlistenData();
        if (unlistenExit) unlistenExit();
        // The PTY is intentionally NOT killed here: a remount must never end a running shell.
        // Tabs are terminated explicitly (close / restart / shell switch) via ptyKill in CommanderTerminal.
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }, [sessionId, cwd, shellType, syncScrollState]); // Only re-spawn if session identity changes

    // Handle visibility and active tab changes: resize and focus while preserving scroll position
    useEffect(() => {
      if (isActive && isVisible && xtermRef.current && fitAddonRef.current) {
        requestAnimationFrame(() => performFit());
        setTimeout(() => performFit(), 60);
        xtermRef.current.focus();
      }
    }, [isActive, isVisible, sessionId, performFit]);

    // Update font size when changed externally
    useEffect(() => {
      if (xtermRef.current && fitAddonRef.current) {
        xtermRef.current.options.fontSize = fontSize;
        if (isActive && isVisible) {
          requestAnimationFrame(() => performFit());
        }
      }
    }, [fontSize, isActive, isVisible, sessionId, performFit]);

    // Custom scrollbar thumb geometry calculation
    const totalBufferLines = scrollState.baseY + scrollState.rows;
    const hasScrollback = scrollState.baseY > 0;
    const thumbHeightPct = hasScrollback
      ? Math.max(8, Math.min(100, (scrollState.rows / totalBufferLines) * 100))
      : 100;
    const maxTopPct = 100 - thumbHeightPct;
    const thumbTopPct = hasScrollback
      ? Math.max(0, Math.min(maxTopPct, (scrollState.viewportY / scrollState.baseY) * maxTopPct))
      : 0;
    const isScrolledUp = hasScrollback && scrollState.viewportY < scrollState.baseY;

    // Dragging the custom scrollbar thumb
    const handleThumbPointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const term = xtermRef.current;
        const track = trackRef.current;
        if (!term || !track || scrollState.baseY <= 0) return;

        const startY = e.clientY;
        const startViewportY = term.buffer.active.viewportY;
        const trackRect = track.getBoundingClientRect();
        const thumbPx = (thumbHeightPct / 100) * trackRect.height;
        const scrollablePx = Math.max(1, trackRect.height - thumbPx);
        const baseY = term.buffer.active.baseY;

        const onPointerMove = (moveEv: PointerEvent) => {
          const deltaY = moveEv.clientY - startY;
          const deltaLines = Math.round((deltaY / scrollablePx) * baseY);
          const nextLine = Math.max(0, Math.min(baseY, startViewportY + deltaLines));
          term.scrollToLine(nextLine);
          syncScrollState();
        };

        const onPointerUp = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          term.focus();
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      },
      [scrollState.baseY, thumbHeightPct, syncScrollState]
    );

    // Clicking on the scrollbar track jumps up/down by a page or directly to position
    const handleTrackPointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        const term = xtermRef.current;
        const track = trackRef.current;
        if (!term || !track || term.buffer.active.baseY <= 0) return;

        const rect = track.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
        const targetLine = Math.round(clickRatio * term.buffer.active.baseY);
        term.scrollToLine(targetLine);
        syncScrollState();
        term.focus();
      },
      [syncScrollState]
    );

    // Wheel over the scrollbar rail
    const handleScrollbarWheel = useCallback(
      (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const term = xtermRef.current;
        if (!term) return;
        term.scrollLines(e.deltaY > 0 ? 4 : -4);
        syncScrollState();
      },
      [syncScrollState]
    );

    return (
      <div
        data-terminal-container="true"
        data-session-id={sessionId}
        tabIndex={-1}
        className={`w-full h-full bg-[#0d1117] overflow-hidden focus:outline-none relative ${
          isActive ? 'flex flex-row flex-1' : 'hidden'
        }`}
        style={{ display: isActive ? 'flex' : 'none', minHeight: 0 }}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        {/* Main XTerm Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 h-full overflow-hidden cursor-text min-w-0"
          onMouseDown={(e) => {
            e.stopPropagation();
            xtermRef.current?.focus();
          }}
          onClick={(e) => {
            e.stopPropagation();
            xtermRef.current?.focus();
          }}
        />

        {/* Floating "Jump to bottom" pill when scrolled up in history */}
        {isScrolledUp && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              xtermRef.current?.scrollToBottom();
              syncScrollState();
              xtermRef.current?.focus();
            }}
            className="absolute bottom-3 right-6 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/90 hover:bg-sky-400 text-slate-950 font-sans font-semibold text-[11px] shadow-lg shadow-black/60 transition-all cursor-pointer"
            title="Rychle přeskočit na nejnovější řádek dole"
          >
            <ArrowDownToLine className="w-3 h-3" />
            <span>Dolů ({scrollState.baseY - scrollState.viewportY} ř.)</span>
          </button>
        )}

        {/* Always-Visible Interactive Terminal Scrollbar Rail */}
        <div
          onWheel={handleScrollbarWheel}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-full bg-[#121722] border-l border-slate-700/80 flex flex-col select-none shrink-0 z-10"
          title={
            hasScrollback
              ? `Pozice: řádek ${scrollState.viewportY} z ${scrollState.baseY} (tažením posouvat, Shift+klik na šipky = začátek/konec)`
              : 'Posuvník terminálu (zatím vše na jedné obrazovce)'
          }
        >
          {/* Scroll Up Button */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) xtermRef.current?.scrollToTop();
              else xtermRef.current?.scrollLines(-5);
              syncScrollState();
              xtermRef.current?.focus();
            }}
            className="h-4 w-full flex items-center justify-center text-slate-400 hover:text-sky-300 hover:bg-slate-800 border-b border-slate-700/60 transition-colors cursor-pointer shrink-0"
            title="Posunout nahoru (Shift+klik = úplně nahoru)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Scrollbar Track */}
          <div
            ref={trackRef}
            onPointerDown={handleTrackPointerDown}
            className="flex-1 w-full relative bg-[#0f131c] cursor-pointer overflow-hidden"
          >
            {/* Overview ruler ticks for User Prompts (Sky Blue) and AI Responses (Emerald) */}
            {roleTicks.map((tick, idx) => (
              <div
                key={idx}
                style={{ top: `${Math.min(99, Math.max(0, tick.ratio * 100))}%` }}
                className={`absolute left-0 right-0 h-[2px] pointer-events-none ${
                  tick.kind === 'user' ? 'bg-sky-400/70' : 'bg-emerald-400/70'
                }`}
              />
            ))}

            {/* Draggable Scrollbar Slider Thumb */}
            <div
              onPointerDown={handleThumbPointerDown}
              style={{
                top: `${thumbTopPct}%`,
                height: `${thumbHeightPct}%`,
              }}
              className={`absolute left-[2px] right-[2px] rounded-full transition-colors ${
                hasScrollback
                  ? 'bg-sky-400/75 hover:bg-sky-300 active:bg-sky-200 border border-sky-300/40 shadow-[0_0_8px_rgba(56,189,248,0.35)] cursor-grab active:cursor-grabbing'
                  : 'bg-slate-600/50 hover:bg-slate-500/70 border border-slate-500/30 cursor-default'
              }`}
            />
          </div>

          {/* Scroll Down Button */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) xtermRef.current?.scrollToBottom();
              else xtermRef.current?.scrollLines(5);
              syncScrollState();
              xtermRef.current?.focus();
            }}
            className="h-4 w-full flex items-center justify-center text-slate-400 hover:text-sky-300 hover:bg-slate-800 border-t border-slate-700/60 transition-colors cursor-pointer shrink-0"
            title="Posunout dolů (Shift+klik = úplně dolů)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }
);
