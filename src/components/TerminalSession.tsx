import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import {
  isDesktopApp,
  ptySpawn,
  ptyWrite,
  ptyResize,
  ptyKill,
  onPtyData,
  onPtyExit,
} from '../utils/tauriBridge';

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
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

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

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        focus: () => xtermRef.current?.focus(),
        clear: () => xtermRef.current?.clear(),
        paste: (text: string) => handlePasteText(text),
        launchClaude: () => {
          void ptyWrite(sessionId, 'claude\r');
          setTimeout(() => xtermRef.current?.focus(), 50);
        },
        hasSelection: () => !!xtermRef.current?.hasSelection(),
        getSelection: () => xtermRef.current?.getSelection() || '',
        clearSelection: () => xtermRef.current?.clearSelection(),
        fit: () => {
          try {
            fitAddonRef.current?.fit();
            if (xtermRef.current) {
              void ptyResize(sessionId, xtermRef.current.cols, xtermRef.current.rows);
            }
          } catch {}
        },
      }),
      [handlePasteText, sessionId]
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
          void navigator.clipboard.readText().then((txt) => {
            if (txt) handlePasteText(txt);
          }).catch((err) => {
            console.warn('[TerminalSession clipboard error]:', err);
          });
          return false;
        }

        // 3. Zoom shortcuts: Ctrl + '+', Ctrl + '-', Ctrl + '0'
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

          await ptySpawn(sessionId, cwd, shellType, cols, rows);
          onProcessStateChange?.(true);

          setTimeout(() => {
            if (isCleanedUp) return;
            try {
              fitAddon.fit();
              void ptyResize(sessionId, term.cols, term.rows);
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
        if (isCleanedUp || !isActive || !isVisible) return;
        try {
          fitAddon.fit();
          void ptyResize(sessionId, term.cols, term.rows);
        } catch {}
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        isCleanedUp = true;
        resizeObserver.disconnect();
        onDataDisposable.dispose();
        if (unlistenData) unlistenData();
        if (unlistenExit) unlistenExit();
        void ptyKill(sessionId);
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }, [sessionId, cwd, shellType]); // Only re-spawn if session identity changes

    // Handle visibility and active tab changes: resize and focus
    useEffect(() => {
      if (isActive && isVisible && xtermRef.current && fitAddonRef.current) {
        requestAnimationFrame(() => {
          try {
            fitAddonRef.current?.fit();
            if (xtermRef.current) {
              void ptyResize(sessionId, xtermRef.current.cols, xtermRef.current.rows);
            }
          } catch {}
        });
        setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
            if (xtermRef.current) {
              void ptyResize(sessionId, xtermRef.current.cols, xtermRef.current.rows);
            }
          } catch {}
        }, 60);
        xtermRef.current.focus();
      }
    }, [isActive, isVisible, sessionId]);

    // Update font size when changed externally
    useEffect(() => {
      if (xtermRef.current && fitAddonRef.current) {
        xtermRef.current.options.fontSize = fontSize;
        if (isActive && isVisible) {
          requestAnimationFrame(() => {
            try {
              fitAddonRef.current?.fit();
              if (xtermRef.current) {
                void ptyResize(sessionId, xtermRef.current.cols, xtermRef.current.rows);
              }
            } catch {}
          });
        }
      }
    }, [fontSize, isActive, isVisible, sessionId]);

    return (
      <div
        ref={containerRef}
        data-terminal-container="true"
        data-session-id={sessionId}
        tabIndex={-1}
        className={`w-full h-full p-2 bg-[#0d1117] overflow-hidden focus:outline-none cursor-text ${
          isActive ? 'flex-1' : 'hidden'
        }`}
        style={{ display: isActive ? 'block' : 'none', minHeight: 0 }}
        onMouseDown={(e) => {
          e.stopPropagation();
          xtermRef.current?.focus();
        }}
        onClick={(e) => {
          e.stopPropagation();
          xtermRef.current?.focus();
        }}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          const isPaste =
            (e.ctrlKey && (e.key.toLowerCase() === 'v' || e.code === 'KeyV')) ||
            (e.shiftKey && e.key === 'Insert');
          if (isPaste) {
            e.preventDefault();
            e.stopPropagation();
            void navigator.clipboard.readText().then((txt) => {
              if (txt) handlePasteText(txt);
            });
          }
        }}
      />
    );
  }
);
