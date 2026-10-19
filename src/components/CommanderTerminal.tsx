import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  RotateCw,
  Trash2,
  Copy,
  Sparkles,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Folder,
} from 'lucide-react';
import {
  isDesktopApp,
  ptySpawn,
  ptyWrite,
  ptyResize,
  ptyKill,
  onPtyData,
  onPtyExit,
  openTerminalNative,
} from '../utils/tauriBridge';

export interface CommanderTerminalProps {
  paneKey: 'left' | 'right';
  currentPath: string;
  oppositeSelectedPaths?: string[];
  onCloseTerminal?: () => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const CommanderTerminal: React.FC<CommanderTerminalProps> = ({
  paneKey,
  currentPath,
  onCloseTerminal: _onCloseTerminal,
  onNotify,
}) => {
  const [shellType, setShellType] = useState<'powershell' | 'cmd' | 'wsl'>('powershell');
  const [fontSize, setFontSize] = useState<number>(13);
  const [sessionCount, setSessionCount] = useState<number>(1);
  const [isProcessActive, setIsProcessActive] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string>(`pty-${paneKey}-${Date.now()}`);
  const spawnPathRef = useRef<string>(currentPath);

  // Switch shell handler without breaking running session if clicking same shell
  const handleSwitchShell = useCallback(
    (newShell: 'powershell' | 'cmd' | 'wsl') => {
      if (newShell === shellType) {
        // Already active: do NOT kill session, just refocus terminal
        xtermRef.current?.focus();
        return;
      }
      setShellType(newShell);
      setTimeout(() => xtermRef.current?.focus(), 80);
    },
    [shellType]
  );

  // Ensure xterm receives focus when user begins typing while looking at terminal
  useEffect(() => {
    const handleGlobalTyping = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        (target?.tagName === 'TEXTAREA' && !target.classList.contains('xterm-helper-textarea')) ||
        target?.isContentEditable
      ) {
        return;
      }

      // If user presses standard keys and xterm isn't focused, bring focus into xterm
      if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')) {
        xtermRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalTyping);
    return () => window.removeEventListener('keydown', handleGlobalTyping);
  }, []);

  // Restart session
  const restartSession = useCallback(() => {
    spawnPathRef.current = currentPath;
    setSessionCount((prev) => prev + 1);
  }, [currentPath]);

  // Quick run Claude Code
  const handleLaunchClaude = useCallback(() => {
    if (!sessionIdRef.current) return;
    // Send 'claude' command followed by Enter (\r)
    void ptyWrite(sessionIdRef.current, 'claude\r').catch((err) => {
      console.error('[Terminal launch Claude error]:', err);
    });
    setTimeout(() => {
      xtermRef.current?.focus();
    }, 50);
    onNotify?.('Claude Code spuštěn', 'Spouštím claude přímo v terminálu', 'info');
  }, [onNotify]);

  // Clear terminal buffer
  const handleClear = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  // Copy selection
  const handleCopySelection = useCallback(() => {
    const sel = xtermRef.current?.getSelection();
    if (sel) {
      void navigator.clipboard.writeText(sel);
      onNotify?.('Zkopírováno', 'Výběr z terminálu byl zkopírován do schránky', 'success');
    }
  }, [onNotify]);

  // Open external terminal window fallback
  const handleOpenExternal = useCallback(() => {
    void openTerminalNative(currentPath);
    onNotify?.('Externí terminál', 'Otevřeno samostatné okno konzole', 'info');
  }, [currentPath, onNotify]);

  // Zoom controls
  const handleZoom = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.max(10, Math.min(22, prev + delta));
      if (xtermRef.current) {
        xtermRef.current.options.fontSize = next;
        setTimeout(() => fitAddonRef.current?.fit(), 50);
      }
      return next;
    });
  }, []);

  // Initialize PTY and xterm
  useEffect(() => {
    if (!containerRef.current) return;

    const id = `pty-${paneKey}-${Date.now()}-${sessionCount}`;
    sessionIdRef.current = id;
    setIsProcessActive(true);

    // Create xterm instance with Windows 11 Fluent dark palette
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

    // Custom key event handler for copy/paste
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
        const sel = term.getSelection();
        if (sel) void navigator.clipboard.writeText(sel);
        return false;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'v') {
        void navigator.clipboard.readText().then((txt) => {
          if (txt) void ptyWrite(id, txt);
        });
        return false;
      }
      return true;
    });

    // Clear previous children
    containerRef.current.innerHTML = '';
    term.open(containerRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {}
    });

    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let isCleanedUp = false;

    // Connect to PTY
    const startPty = async () => {
      if (!isDesktopApp()) {
        term.writeln('\x1b[33m[Upozornění] Plnohodnotný PTY terminál je dostupný v desktopové aplikaci AeroBridge.\x1b[0m\r\n');
        return;
      }

      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;

        unlistenData = await onPtyData(id, (chunk) => {
          if (!isCleanedUp) {
            term.write(chunk);
          }
        });

        unlistenExit = await onPtyExit(id, (code) => {
          if (!isCleanedUp) {
            setIsProcessActive(false);
            term.writeln(`\r\n\x1b[90m[Proces shellu byl ukončen (kód ${code ?? 0})]\x1b[0m\r\n`);
          }
        });

        await ptySpawn(id, spawnPathRef.current, shellType, cols, rows);

        // Immediate fit & resize sync
        setTimeout(() => {
          if (isCleanedUp) return;
          try {
            fitAddon.fit();
            void ptyResize(id, term.cols, term.rows);
          } catch {}
        }, 100);
      } catch (err) {
        term.writeln(`\r\n\x1b[31m[Chyba spuštění terminálu: ${String(err)}]\x1b[0m\r\n`);
      }
    };

    void startPty();

    // Stream user keystrokes into PTY
    const onDataDisposable = term.onData((data) => {
      void ptyWrite(id, data).catch((err) => {
        console.error('[Terminal ptyWrite error]:', err);
      });
    });

    // Auto-fit on container resize with ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (isCleanedUp) return;
      try {
        fitAddon.fit();
        void ptyResize(id, term.cols, term.rows);
      } catch {}
    });

    resizeObserver.observe(containerRef.current);

    // Focus terminal
    term.focus();

    return () => {
      isCleanedUp = true;
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      void ptyKill(id);
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [paneKey, shellType, sessionCount]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3] font-mono select-none overflow-hidden border-t border-slate-700/50">
      {/* Top Terminal Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-slate-700/60 text-xs shrink-0 select-none">
        {/* Left: Shell selector & Status */}
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
          <div className="flex items-center bg-[#21262d] p-0.5 rounded border border-slate-700/60 font-sans">
            <button
              type="button"
              onClick={() => handleSwitchShell('powershell')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                shellType === 'powershell'
                  ? 'bg-sky-500/25 text-sky-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Aktivovat PowerShell shell"
            >
              PowerShell
            </button>
            <button
              type="button"
              onClick={() => handleSwitchShell('cmd')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                shellType === 'cmd'
                  ? 'bg-sky-500/25 text-sky-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Aktivovat Command Prompt (cmd.exe)"
            >
              CMD
            </button>
            <button
              type="button"
              onClick={() => handleSwitchShell('wsl')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                shellType === 'wsl'
                  ? 'bg-sky-500/25 text-sky-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Aktivovat Windows Subsystem for Linux"
            >
              WSL
            </button>
          </div>

          <span
            className={`w-2 h-2 rounded-full ${
              isProcessActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
            }`}
            title={isProcessActive ? 'Terminál aktivní' : 'Proces ukončen'}
          />

          {/* Directory path indicator */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-[#21262d] px-2 py-0.5 rounded border border-slate-700/50 max-w-[280px] truncate">
            <Folder className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate" title={currentPath}>
              {currentPath}
            </span>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-1.5">
          {/* Claude Code quick start button */}
          <button
            onClick={handleLaunchClaude}
            title="Spustit Claude Code (c) v tomto terminálu"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer font-sans"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Claude Code</span>
          </button>

          <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

          {/* Zoom controls */}
          <button
            onClick={() => handleZoom(1)}
            onMouseUp={() => setTimeout(() => xtermRef.current?.focus(), 30)}
            title="Zvětšit písmo (Ctrl +)"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            onMouseUp={() => setTimeout(() => xtermRef.current?.focus(), 30)}
            title="Zmenšit písmo (Ctrl -)"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Copy selection */}
          <button
            onClick={handleCopySelection}
            onMouseUp={() => setTimeout(() => xtermRef.current?.focus(), 30)}
            title="Kopírovat označený text"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Clear screen */}
          <button
            onClick={handleClear}
            onMouseUp={() => setTimeout(() => xtermRef.current?.focus(), 30)}
            title="Vymazat obrazovku"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Restart shell */}
          <button
            onClick={restartSession}
            onMouseUp={() => setTimeout(() => xtermRef.current?.focus(), 50)}
            title="Restartovat terminál"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* External window */}
          <button
            onClick={handleOpenExternal}
            onMouseUp={() => setTimeout(() => xtermRef.current?.focus(), 50)}
            title="Otevřít v samostatném okně Windows Terminal"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main xterm container */}
      <div
        ref={containerRef}
        data-terminal-container="true"
        className="flex-1 w-full h-full p-2 bg-[#0d1117] overflow-hidden focus:outline-none cursor-text"
        style={{ minHeight: 0 }}
        onMouseDown={() => {
          xtermRef.current?.focus();
        }}
        onClick={() => {
          xtermRef.current?.focus();
        }}
      />
    </div>
  );
};
