import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Folder,
  Play,
  Trash2,
  Copy,
  ExternalLink,
  FileCode,
  CornerDownLeft,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  executeShellCommandNative,
  openTerminalNative,
  type ShellCommandResult,
} from '../utils/tauriBridge';
import { copyTextToClipboard } from '../utils/localFileSystem';

export interface CommanderTerminalProps {
  paneKey: 'left' | 'right';
  currentPath: string;
  oppositeSelectedPaths?: string[];
  onCloseTerminal: () => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface CommandHistoryItem {
  id: string;
  command: string;
  timestamp: string;
  durationMs?: number;
  result?: ShellCommandResult;
  loading?: boolean;
}

export const CommanderTerminal: React.FC<CommanderTerminalProps> = ({
  paneKey,
  currentPath,
  oppositeSelectedPaths = [],
  onCloseTerminal,
  onNotify,
}) => {
  const [shellType, setShellType] = useState<'powershell' | 'cmd'>('powershell');
  const [inputCommand, setInputCommand] = useState<string>('');
  const [history, setHistory] = useState<CommandHistoryItem[]>(() => [
    {
      id: 'init-msg',
      command: '# Integrovaný terminál AeroBridge Commander',
      timestamp: new Date().toLocaleTimeString(),
      result: {
        stdout: `Pracovní adresář: ${currentPath}\nZadejte libovolný příkaz (např. dir, git status, npm run...) nebo stiskněte šipku nahoru pro historii.`,
        stderr: '',
        exit_code: 0,
        success: true,
      },
    },
  ]);

  // History navigation with Arrow Up / Arrow Down
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [executedCommands, setExecutedCommands] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever history updates
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Execute command
  const handleExecute = useCallback(async (cmdToRun?: string) => {
    const raw = (cmdToRun !== undefined ? cmdToRun : inputCommand).trim();
    if (!raw) return;

    // Built-in cls / clear
    if (raw.toLowerCase() === 'cls' || raw.toLowerCase() === 'clear') {
      setHistory([]);
      setInputCommand('');
      setHistoryIndex(-1);
      return;
    }

    const id = `${Date.now()}-${Math.random()}`;
    const startTime = performance.now();

    const newItem: CommandHistoryItem = {
      id,
      command: raw,
      timestamp: new Date().toLocaleTimeString(),
      loading: true,
    };

    setHistory((prev) => [...prev, newItem]);
    setExecutedCommands((prev) => [raw, ...prev.filter((c) => c !== raw)]);
    setHistoryIndex(-1);
    setInputCommand('');
    setIsRunning(true);

    try {
      const res = await executeShellCommandNative(currentPath, raw, shellType);
      const durationMs = Math.round(performance.now() - startTime);

      setHistory((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, loading: false, result: res, durationMs } : item
        )
      );
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      setHistory((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                loading: false,
                durationMs,
                result: {
                  stdout: '',
                  stderr: String(err),
                  exit_code: 1,
                  success: false,
                },
              }
            : item
        )
      );
      onNotify?.('Chyba příkazu', String(err), 'error');
    } finally {
      setIsRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputCommand, currentPath, shellType, onNotify]);

  // Handle KeyDown in Command Input (History, Execution, Clear)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (executedCommands.length === 0) return;
      const nextIdx = Math.min(executedCommands.length - 1, historyIndex + 1);
      setHistoryIndex(nextIdx);
      setInputCommand(executedCommands[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInputCommand('');
      } else {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputCommand(executedCommands[nextIdx]);
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setHistory([]);
    }
  };

  // Insert selected file paths from opposite pane into input
  const handleInsertSelectedPaths = () => {
    if (oppositeSelectedPaths.length === 0) {
      onNotify?.('Vložení cest', 'V druhém panelu nejsou vybrány žádné soubory', 'warning');
      return;
    }
    const formatted = oppositeSelectedPaths.map((p) => `"${p}"`).join(' ');
    setInputCommand((prev) => (prev ? `${prev} ${formatted}` : formatted));
    inputRef.current?.focus();
  };

  // Open in External Windows Terminal / PowerShell
  const handleOpenExternal = () => {
    void openTerminalNative(currentPath);
    onNotify?.('Terminál', 'Otevřeno v externím okně Windows', 'info');
  };

  // Copy full terminal log to clipboard
  const handleCopyLog = () => {
    const text = history
      .map((item) => {
        let out = `[${item.timestamp}] ${item.command}\n`;
        if (item.result?.stdout) out += `${item.result.stdout}\n`;
        if (item.result?.stderr) out += `[ERROR] ${item.result.stderr}\n`;
        return out;
      })
      .join('\n');
    void copyTextToClipboard(text);
    onNotify?.('Zkopírováno', 'Výstup terminálu byl zkopírován do schránky', 'success');
  };

  const folderName = currentPath.split('\\').pop() || currentPath;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#0d0e12] text-zinc-200 select-none overflow-hidden relative font-mono text-xs">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#171920] border-b border-white/[0.08] text-xs shrink-0 gap-2 font-sans">
        {/* Left: Close & Active Folder */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onCloseTerminal}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px] font-medium border border-white/10 shrink-0"
            title="Přepnout zpět do správce souborů"
          >
            <Folder className="w-3.5 h-3.5 text-[#60cdff]" />
            <span>Zpět k souborům</span>
          </button>

          <div className="flex items-center gap-1.5 min-w-0 truncate" title={currentPath}>
            <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-white truncate text-xs">Terminál: {folderName}</span>
          </div>
        </div>

        {/* Right: Shell Switcher & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Shell Toggle (PowerShell / CMD) */}
          <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10 text-[11px]">
            <button
              type="button"
              onClick={() => setShellType('powershell')}
              className={`px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                shellType === 'powershell'
                  ? 'bg-[#60cdff]/20 text-[#60cdff] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              PowerShell
            </button>
            <button
              type="button"
              onClick={() => setShellType('cmd')}
              className={`px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                shellType === 'cmd'
                  ? 'bg-[#60cdff]/20 text-[#60cdff] font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              CMD
            </button>
          </div>

          <button
            type="button"
            onClick={handleInsertSelectedPaths}
            disabled={oppositeSelectedPaths.length === 0}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              oppositeSelectedPaths.length > 0
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer font-medium'
                : 'bg-white/[0.02] text-zinc-600 border border-white/[0.04] cursor-default'
            }`}
            title="Vložit cesty vybraných souborů z protějšího panelu do příkazové řádky"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vložit cesty ({oppositeSelectedPaths.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.06] transition-colors cursor-pointer text-[11px]"
            title="Otevřít v externím okně Windows Terminal / PowerShell"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Externí okno</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLog}
            className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Kopírovat výstup"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setHistory([])}
            className="p-1.5 rounded bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 transition-colors cursor-pointer"
            title="Vymazat výstup (Ctrl + L)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[12px] leading-relaxed selection:bg-[#60cdff]/30">
        {history.map((item) => (
          <div key={item.id} className="space-y-1">
            {/* Command Header */}
            <div className="flex items-center justify-between text-zinc-500 text-[11px] select-none border-b border-white/[0.03] pb-0.5">
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold">
                <span className="text-[#60cdff]">
                  {shellType === 'powershell' ? 'PS' : 'CMD'}
                </span>
                <span className="text-zinc-500">›</span>
                <span className="text-white">{item.command}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.durationMs !== undefined && (
                  <span className="text-zinc-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.durationMs}ms
                  </span>
                )}
                {item.loading ? (
                  <span className="flex items-center gap-1 text-[#60cdff]">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    Běží...
                  </span>
                ) : item.result?.success ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    0
                  </span>
                ) : item.result && item.result.exit_code !== 0 ? (
                  <span className="text-rose-400 flex items-center gap-1 font-bold">
                    <XCircle className="w-3 h-3" />
                    exit {item.result.exit_code}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Standard Output */}
            {item.result?.stdout && (
              <pre className="text-zinc-300 whitespace-pre-wrap break-all pl-2">
                {item.result.stdout}
              </pre>
            )}

            {/* Error Output */}
            {item.result?.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap break-all pl-2 bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                {item.result.stderr}
              </pre>
            )}
          </div>
        ))}

        <div ref={outputEndRef} />
      </div>

      {/* Interactive Command Input Line */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#14151b] border-t border-white/[0.08] shrink-0">
        <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs shrink-0 select-none">
          <span>{shellType === 'powershell' ? 'PS' : 'CMD'}</span>
          <span className="text-zinc-500">›</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? 'Čekejte na dokončení příkazu...' : 'Zadejte příkaz (např. dir, git status)...'}
          className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs placeholder-zinc-600 focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void handleExecute()}
          disabled={isRunning || !inputCommand.trim()}
          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
            inputCommand.trim() && !isRunning
              ? 'bg-[#60cdff] text-[#111215] hover:brightness-110 shadow-xs'
              : 'bg-white/[0.04] text-zinc-600 cursor-default'
          }`}
          title="Spustit příkaz (Enter)"
        >
          {isRunning ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Spustit</span>
        </button>
      </div>

      {/* Terminal Footer Info */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#101115] border-t border-white/[0.04] text-[10px] text-zinc-500 font-sans select-none shrink-0">
        <div className="flex items-center gap-2 font-mono">
          <span>Enter: Spustit</span>
          <span>·</span>
          <span>Šipky Nahoru/Dolů: Historie</span>
          <span>·</span>
          <span>Ctrl + L: Vymazat</span>
        </div>
        <div className="truncate max-w-[240px] font-mono text-zinc-400" title={currentPath}>
          {currentPath}
        </div>
      </div>
    </div>
  );
};
