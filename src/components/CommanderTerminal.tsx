import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  ClipboardPaste,
  Plus,
  X,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import { openTerminalNative } from '../utils/tauriBridge';
import { TerminalSession, TerminalSessionHandle } from './TerminalSession';

export interface TerminalTabItem {
  id: string;
  title: string;
  cwd: string;
  shell: 'powershell' | 'cmd' | 'wsl';
  isProcessActive: boolean;
  createdAt: number;
}

export interface CommanderTerminalProps {
  paneKey: 'left' | 'right';
  currentPath: string;
  oppositePath?: string;
  oppositeSelectedPaths?: string[];
  isVisible?: boolean;
  requestedNewTabPath?: { path: string; timestamp: number } | null;
  onCloseTerminal?: () => void;
  onActiveProcessCountChange?: (count: number) => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

function getBaseName(pathStr: string): string {
  if (!pathStr) return 'Terminál';
  const clean = pathStr.replace(/[/\\]+$/, '');
  const parts = clean.split(/[/\\]/);
  return parts.pop() || clean;
}

export const CommanderTerminal: React.FC<CommanderTerminalProps> = ({
  paneKey,
  currentPath,
  oppositePath,
  isVisible = true,
  requestedNewTabPath,
  onCloseTerminal,
  onActiveProcessCountChange,
  onNotify,
}) => {
  const [fontSize, setFontSize] = useState<number>(13);
  const sessionHandlesRef = useRef<Record<string, TerminalSessionHandle | null>>({});

  // Initialize tabs state
  const [tabs, setTabs] = useState<TerminalTabItem[]>(() => {
    const initialId = `pty-${paneKey}-${Date.now()}`;
    return [
      {
        id: initialId,
        title: getBaseName(currentPath),
        cwd: currentPath,
        shell: 'powershell',
        isProcessActive: true,
        createdAt: Date.now(),
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || '');

  // Report active background processes count
  const activeCount = useMemo(() => {
    return tabs.filter((t) => t.isProcessActive).length;
  }, [tabs]);

  useEffect(() => {
    onActiveProcessCountChange?.(activeCount);
  }, [activeCount, onActiveProcessCountChange]);

  // Handle external request to open a new tab for a specific path
  const lastRequestedTimestamp = useRef<number>(0);
  useEffect(() => {
    if (requestedNewTabPath && requestedNewTabPath.timestamp !== lastRequestedTimestamp.current) {
      lastRequestedTimestamp.current = requestedNewTabPath.timestamp;
      const newId = `pty-${paneKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newTab: TerminalTabItem = {
        id: newId,
        title: getBaseName(requestedNewTabPath.path),
        cwd: requestedNewTabPath.path,
        shell: 'powershell',
        isProcessActive: true,
        createdAt: Date.now(),
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      onNotify?.('Nový terminál', `Otevřena nová záložka: ${newTab.title}`, 'info');
    }
  }, [requestedNewTabPath, paneKey, onNotify]);

  // Get active tab object
  const activeTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  // Open new terminal tab
  const handleAddNewTab = useCallback(
    (targetPath?: string, shell: 'powershell' | 'cmd' | 'wsl' = 'powershell') => {
      const p = targetPath || currentPath;
      const newId = `pty-${paneKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newTab: TerminalTabItem = {
        id: newId,
        title: getBaseName(p),
        cwd: p,
        shell,
        isProcessActive: true,
        createdAt: Date.now(),
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      onNotify?.('Nový terminál', `Spuštěna záložka v: ${p}`, 'info');
    },
    [currentPath, paneKey, onNotify]
  );

  // Close a specific tab
  const handleCloseTab = useCallback(
    (idToClose: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== idToClose);
        delete sessionHandlesRef.current[idToClose];

        if (remaining.length === 0) {
          // If no tabs remain, close terminal view and switch back to files
          onCloseTerminal?.();
          return [];
        }

        // If closed tab was active, switch to adjacent tab
        if (activeTabId === idToClose) {
          const idx = prev.findIndex((t) => t.id === idToClose);
          const nextActive = remaining[Math.max(0, idx - 1)] || remaining[0];
          if (nextActive) setActiveTabId(nextActive.id);
        }

        return remaining;
      });
    },
    [activeTabId, onCloseTerminal]
  );

  // Switch shell type for active tab
  const handleSwitchShell = useCallback(
    (newShell: 'powershell' | 'cmd' | 'wsl') => {
      if (!activeTab || activeTab.shell === newShell) {
        sessionHandlesRef.current[activeTabId]?.focus();
        return;
      }
      // Re-spawn with new shell by creating fresh ID for this tab
      const newId = `pty-${paneKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, id: newId, shell: newShell, isProcessActive: true }
            : t
        )
      );
      setActiveTabId(newId);
    },
    [activeTab, activeTabId, paneKey]
  );

  // Restart active tab
  const handleRestartActive = useCallback(() => {
    if (!activeTab) return;
    const newId = `pty-${paneKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, id: newId, isProcessActive: true } : t
      )
    );
    setActiveTabId(newId);
    onNotify?.('Restart', 'Terminálová relace byla restartována', 'info');
  }, [activeTab, activeTabId, paneKey, onNotify]);

  // Zoom controls
  const handleZoomChange = useCallback((delta: number) => {
    setFontSize((prev) => Math.max(9, Math.min(26, prev + delta)));
  }, []);

  const handleZoomReset = useCallback(() => {
    setFontSize(13);
  }, []);

  // Toolbar Actions forwarded to active session handle
  const handleLaunchClaude = useCallback(() => {
    sessionHandlesRef.current[activeTabId]?.launchClaude();
    onNotify?.('Claude Code spuštěn', 'Spouštím claude v aktivním terminálu', 'info');
  }, [activeTabId, onNotify]);

  const handleClear = useCallback(() => {
    sessionHandlesRef.current[activeTabId]?.clear();
  }, [activeTabId]);

  const handleCopy = useCallback(() => {
    const handle = sessionHandlesRef.current[activeTabId];
    if (handle?.hasSelection()) {
      const text = handle.getSelection();
      void navigator.clipboard.writeText(text);
      onNotify?.('Zkopírováno', 'Výběr z terminálu byl zkopírován', 'success');
    }
  }, [activeTabId, onNotify]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sessionHandlesRef.current[activeTabId]?.paste(text);
        onNotify?.('Vloženo', 'Text ze schránky byl vložen', 'success');
      }
    } catch (err) {
      console.warn('[CommanderTerminal paste error]:', err);
    }
  }, [activeTabId, onNotify]);

  const handleOpenExternal = useCallback(() => {
    const p = activeTab?.cwd || currentPath;
    void openTerminalNative(p);
    onNotify?.('Externí terminál', 'Otevřeno samostatné okno konzole', 'info');
  }, [activeTab?.cwd, currentPath, onNotify]);

  // Update tab process state
  const handleTabProcessStateChange = useCallback((id: string, isProcActive: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isProcessActive: isProcActive } : t))
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3] font-mono select-none overflow-hidden border-t border-slate-700/50">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-2 pt-1 bg-[#12161f] border-b border-slate-700/60 text-xs shrink-0 select-none overflow-x-auto gap-1">
        {/* Left: Tab list */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[calc(100%-140px)]">
          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs font-sans transition-all cursor-pointer border-t border-x ${
                  isTabActive
                    ? 'bg-[#161b22] text-sky-200 border-slate-600 font-semibold shadow-xs'
                    : 'bg-[#161b22]/50 text-slate-400 border-transparent hover:bg-[#161b22]/80 hover:text-slate-200'
                }`}
                title={`${tab.title} (${tab.shell})\n${tab.cwd}`}
              >
                {/* Active indicator dot */}
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    tab.isProcessActive
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-rose-400'
                  }`}
                  title={tab.isProcessActive ? 'Proces běží' : 'Proces ukončen'}
                />

                <span className="truncate max-w-[120px]">{tab.title}</span>

                {/* Shell badge */}
                <span className="px-1 py-0.2 rounded text-[9px] font-mono uppercase bg-slate-800 text-slate-400 shrink-0">
                  {tab.shell === 'powershell' ? 'pwsh' : tab.shell}
                </span>

                {/* Close tab button */}
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  title="Ukončit a zavřít tento terminál"
                  className="p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Add new tab buttons */}
          <button
            type="button"
            onClick={() => handleAddNewTab(currentPath)}
            title={`Otevřít novou záložku v této složce: ${currentPath}`}
            className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-sky-300 hover:bg-[#21262d] rounded transition-colors text-xs cursor-pointer font-sans shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nová</span>
          </button>

          {/* Quick open opposite pane path if different */}
          {oppositePath && oppositePath !== currentPath && (
            <button
              type="button"
              onClick={() => handleAddNewTab(oppositePath)}
              title={`Otevřít záložku v protější složce: ${oppositePath}`}
              className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-amber-300 hover:bg-[#21262d] rounded transition-colors text-xs cursor-pointer font-sans shrink-0"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span className="hidden md:inline">Z druhé strany</span>
            </button>
          )}
        </div>

        {/* Right: Active processes badge & Close all button */}
        <div className="flex items-center gap-2 shrink-0 py-0.5 font-sans">
          {activeCount > 0 && (
            <span
              className="hidden lg:flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] rounded-full font-mono"
              title="Aktivní PTY procesy běžící na pozadí"
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>{activeCount} {activeCount === 1 ? 'proces' : activeCount < 5 ? 'procesy' : 'procesů'}</span>
            </span>
          )}

          <button
            type="button"
            onClick={onCloseTerminal}
            title="Přepnout zpět na soubory (procesy terminálu zůstanou bezpečně běžet na pozadí)"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-[#21262d] transition-colors cursor-pointer"
          >
            <span>Zavřít</span>
          </button>
        </div>
      </div>

      {/* Main Terminal Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-slate-700/60 text-xs shrink-0 select-none">
        {/* Left: Shell selector & current tab directory */}
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />

          {/* Shell type switcher for active tab */}
          <div className="flex items-center bg-[#21262d] p-0.5 rounded border border-slate-700/60 font-sans">
            <button
              type="button"
              onClick={() => handleSwitchShell('powershell')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                activeTab?.shell === 'powershell'
                  ? 'bg-sky-500/25 text-sky-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Aktivovat PowerShell"
            >
              PowerShell
            </button>
            <button
              type="button"
              onClick={() => handleSwitchShell('cmd')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                activeTab?.shell === 'cmd'
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
                activeTab?.shell === 'wsl'
                  ? 'bg-sky-500/25 text-sky-300 font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Aktivovat Windows Subsystem for Linux"
            >
              WSL
            </button>
          </div>

          {/* Directory path indicator */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-[#21262d] px-2 py-0.5 rounded border border-slate-700/50 max-w-[260px] truncate font-sans">
            <Folder className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate" title={activeTab?.cwd || currentPath}>
              {activeTab?.cwd || currentPath}
            </span>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-1.5 font-sans">
          {/* Claude Code quick start button */}
          <button
            onClick={handleLaunchClaude}
            title="Spustit Claude Code (c) v tomto terminálu"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Claude Code</span>
          </button>

          <div className="h-3.5 w-px bg-slate-700 mx-0.5" />

          {/* Zoom controls */}
          <div className="flex items-center bg-[#21262d] px-1 py-0.5 rounded border border-slate-700/60 gap-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleZoomChange(-1)}
              title="Zmenšit písmo (Ctrl -)"
              className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleZoomReset}
              title="Resetovat velikost písma na 13px (Ctrl 0)"
              className="px-1 text-[11px] font-mono text-slate-300 hover:text-sky-300 transition-colors cursor-pointer select-none"
            >
              {fontSize}px
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleZoomChange(1)}
              title="Zvětšit písmo (Ctrl +)"
              className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy selection */}
          <button
            onClick={handleCopy}
            title="Kopírovat označený text (Ctrl+C / Ctrl+Shift+C)"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Paste from clipboard */}
          <button
            onClick={() => void handlePaste()}
            title="Vložit ze schránky (Ctrl+V / Shift+Insert / Pravé tlačítko myši)"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>

          {/* Clear screen */}
          <button
            onClick={handleClear}
            title="Vymazat obrazovku"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Restart shell */}
          <button
            onClick={handleRestartActive}
            title="Restartovat aktuální terminál"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* External window */}
          <button
            onClick={handleOpenExternal}
            title="Otevřít v samostatném okně Windows Terminal"
            className="p-1 hover:bg-[#30363d] rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Terminal Sessions Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden" style={{ minHeight: 0 }}>
        {tabs.map((tab) => (
          <TerminalSession
            key={tab.id}
            ref={(handle) => {
              sessionHandlesRef.current[tab.id] = handle;
            }}
            sessionId={tab.id}
            cwd={tab.cwd}
            shellType={tab.shell}
            fontSize={fontSize}
            isActive={tab.id === activeTabId}
            isVisible={isVisible}
            onProcessStateChange={(isProcActive) => handleTabProcessStateChange(tab.id, isProcActive)}
            onZoomChange={handleZoomChange}
            onZoomReset={handleZoomReset}
            onNotify={onNotify}
          />
        ))}
      </div>
    </div>
  );
};
