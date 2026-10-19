import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Save,
  Plus,
  Copy,
  Trash2,
  WrapText,
  Search,
  X,
  FileCode,
  Download,
  Eye,
  Edit3,
  Columns,
  Sparkles,
} from 'lucide-react';
import { readTextFileNative, writeTextFileNative } from '../utils/tauriBridge';
import { copyTextToClipboard } from '../utils/localFileSystem';
import { CommanderNotepadTabs, type NotepadTab } from './CommanderNotepadTabs';
import { CommanderNotepadPreview } from './CommanderNotepadPreview';

export interface CommanderNotepadProps {
  paneKey: 'left' | 'right';
  currentPath: string;
  oppositeSelectedPaths?: string[];
  initialFilePath?: string | null;
  fileToOpen?: { path: string; timestamp: number } | null;
  onCloseNotepad?: () => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onFileSaved?: (savedPath: string) => void;
}

const createDefaultTab = (title = 'Poznámka 1'): NotepadTab => ({
  id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  title,
  filePath: null,
  content: '',
  isDirty: false,
});

export const CommanderNotepad: React.FC<CommanderNotepadProps> = ({
  paneKey,
  currentPath,
  oppositeSelectedPaths = [],
  initialFilePath = null,
  fileToOpen = null,
  onNotify,
  onFileSaved,
}) => {
  const tabsStorageKey = `aerobridge_commander_notepad_tabs_${paneKey}`;
  const activeTabStorageKey = `aerobridge_commander_notepad_active_tab_${paneKey}`;

  // Tabs collection state
  const [tabs, setTabs] = useState<NotepadTab[]>(() => {
    try {
      const saved = localStorage.getItem(tabsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Migration from old single-note storage:
      const oldContent = localStorage.getItem(`aerobridge_commander_notepad_${paneKey}`);
      const oldPath = localStorage.getItem(`aerobridge_commander_notepad_path_${paneKey}`);
      if (oldContent || oldPath) {
        return [
          {
            id: `tab_${Date.now()}`,
            title: oldPath ? oldPath.split('\\').pop() || 'Poznámka 1' : 'Poznámka 1',
            filePath: oldPath || null,
            content: oldContent || '',
            isDirty: false,
          },
        ];
      }
    } catch (err) {
      console.warn('[CommanderNotepad] Error loading tabs from localStorage:', err);
    }
    return [createDefaultTab('Poznámka 1')];
  });

  // Active tab ID state
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(activeTabStorageKey);
      if (saved && tabs.some((t) => t.id === saved)) return saved;
    } catch {}
    return tabs[0]?.id || '';
  });

  // Ensure activeTab exists
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || createDefaultTab();

  // Formatting & UI states
  const [isMonospace, setIsMonospace] = useState<boolean>(true);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<number>(13);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveFileName, setSaveFileName] = useState<string>('poznamka.txt');

  // File extension & type detection
  const fileName = (activeTab.filePath ? activeTab.filePath.split('\\').pop() : activeTab.title) || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  const isMarkdown = ext === 'md' || ext === 'markdown';
  const isJson = ext === 'json';

  // View mode: 'edit' | 'preview' | 'split'
  const [editorMode, setEditorMode] = useState<'edit' | 'preview' | 'split'>('edit');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Sync tabs & activeTabId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(tabsStorageKey, JSON.stringify(tabs));
      localStorage.setItem(activeTabStorageKey, activeTabId);
    } catch (err) {
      console.warn('[CommanderNotepad] Error saving tabs to localStorage:', err);
    }
  }, [tabs, activeTabId, tabsStorageKey, activeTabStorageKey]);

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Open file in tab helper
  const openFileInTab = useCallback(
    async (path: string) => {
      const currentTabs = tabsRef.current;
      // If already open, switch to that tab
      const existing = currentTabs.find((t) => t.filePath === path);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      try {
        const text = await readTextFileNative(path);
        const title = path.split('\\').pop() || path;

        const currentActive = currentTabs.find((t) => t.id === activeTabIdRef.current);
        // If current tab is empty, untitled and not dirty, reuse it
        if (
          currentActive &&
          !currentActive.filePath &&
          !currentActive.content.trim() &&
          !currentActive.isDirty
        ) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === currentActive.id
                ? { ...t, title, filePath: path, content: text, isDirty: false }
                : t
            )
          );
        } else {
          // Create a new tab
          const newTab: NotepadTab = {
            id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title,
            filePath: path,
            content: text,
            isDirty: false,
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
        onNotify?.('Soubor načten', `${title}`, 'info');
      } catch (err) {
        console.error('[CommanderNotepad] Failed to read file:', err);
        onNotify?.('Chyba při čtení', String(err), 'error');
      }
    },
    [onNotify]
  );

  // Load requested file via fileToOpen or initialFilePath
  const lastOpenedTimestampRef = useRef<number>(0);
  useEffect(() => {
    if (fileToOpen && fileToOpen.timestamp > lastOpenedTimestampRef.current) {
      lastOpenedTimestampRef.current = fileToOpen.timestamp;
      void openFileInTab(fileToOpen.path);
    } else if (initialFilePath && !fileToOpen) {
      void openFileInTab(initialFilePath);
    }
  }, [fileToOpen, initialFilePath, openFileInTab]);

  // New Tab Handler
  const handleNewTab = useCallback(() => {
    const nextNum = tabs.length + 1;
    const newTab = createDefaultTab(`Poznámka ${nextNum}`);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [tabs.length]);

  // Close Tab Handler
  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const tabToClose = tabs.find((t) => t.id === tabId);
      if (
        tabToClose?.isDirty &&
        !window.confirm(
          `Záložka "${tabToClose.title}" obsahuje neuložené změny. Opravdu ji chcete zavřít?`
        )
      ) {
        return;
      }

      if (tabs.length <= 1) {
        // Reset single tab to blank
        const fresh = createDefaultTab('Poznámka 1');
        setTabs([fresh]);
        setActiveTabId(fresh.id);
        return;
      }

      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      const remaining = tabs.filter((t) => t.id !== tabId);
      setTabs(remaining);

      if (activeTabId === tabId) {
        const nextTab = remaining[Math.min(tabIndex, remaining.length - 1)];
        setActiveTabId(nextTab.id);
      }
    },
    [tabs, activeTabId]
  );

  // Content change in active tab
  const handleContentChange = (newText: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, content: newText, isDirty: true } : t))
    );
  };

  // Handle Save active tab
  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    if (activeTab.filePath) {
      try {
        await writeTextFileNative(activeTab.filePath, activeTab.content);
        const name = activeTab.filePath.split('\\').pop() || activeTab.title;
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false, title: name } : t))
        );
        onNotify?.('Uloženo', `${name}`, 'success');
        onFileSaved?.(activeTab.filePath);
      } catch (err) {
        console.error('[CommanderNotepad] Save error:', err);
        onNotify?.('Chyba při ukládání', String(err), 'error');
      }
    } else {
      setSaveFileName(
        activeTab.title.endsWith('.txt') || activeTab.title.includes('.')
          ? activeTab.title
          : `${activeTab.title}.txt`
      );
      setSaveModalOpen(true);
    }
  }, [activeTab, onNotify, onFileSaved]);

  // Format JSON helper
  const handleFormatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(activeTab.content);
      const formatted = JSON.stringify(parsed, null, 2);
      handleContentChange(formatted);
      onNotify?.('JSON zformátován', 'Obsah byl zarovnán se 2 mezerami odsazení', 'success');
    } catch (err) {
      onNotify?.('Chyba JSON', 'Obsah nelze zformátovat: ' + String(err), 'error');
    }
  }, [activeTab.content, onNotify]);

  // Handle Save As in current folder
  const handleSaveConfirm = useCallback(async () => {
    if (!activeTab || !saveFileName.trim()) return;
    const cleanName = saveFileName.trim();
    const targetPath = `${currentPath.replace(/\\+$/, '')}\\${cleanName}`;

    try {
      await writeTextFileNative(targetPath, activeTab.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? { ...t, filePath: targetPath, title: cleanName, isDirty: false }
            : t
        )
      );
      setSaveModalOpen(false);
      onNotify?.('Soubor vytvořen a uložen', `${cleanName}`, 'success');
      onFileSaved?.(targetPath);
    } catch (err) {
      console.error('[CommanderNotepad] SaveAs error:', err);
      onNotify?.('Chyba při ukládání', String(err), 'error');
    }
  }, [activeTab, saveFileName, currentPath, onNotify, onFileSaved]);

  // Insert selected file paths from opposite pane
  const handleInsertSelectedPaths = useCallback(() => {
    if (!oppositeSelectedPaths || oppositeSelectedPaths.length === 0) {
      onNotify?.('Vložení cest', 'V druhém panelu nejsou vybrány žádné soubory', 'warning');
      return;
    }

    const pathsText = oppositeSelectedPaths.join('\n') + '\n';
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const nextContent = activeTab.content.substring(0, start) + pathsText + activeTab.content.substring(end);
      handleContentChange(nextContent);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + pathsText.length;
        ta.focus();
      }, 0);
    } else {
      handleContentChange(
        activeTab.content + (activeTab.content.endsWith('\n') || !activeTab.content ? '' : '\n') + pathsText
      );
    }

    onNotify?.('Cesty vloženy', `${oppositeSelectedPaths.length} položek`, 'info');
  }, [oppositeSelectedPaths, activeTab.content, onNotify]);

  // Keyboard shortcut listener with Smart Indentation
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void handleSave();
    } else if (e.ctrlKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      handleNewTab();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      handleCloseTab(e as unknown as React.MouseEvent, activeTab.id);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setShowSearch((prev) => !prev);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      ta.value = val.substring(0, start) + '  ' + val.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
      handleContentChange(ta.value);
    } else if (e.key === 'Enter') {
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;

      // Find current line start
      const lastNewLine = val.lastIndexOf('\n', start - 1);
      const currentLine = val.substring(lastNewLine + 1, start);

      const match = currentLine.match(/^(\s+)/);
      let indent = match ? match[1] : '';

      // Auto indent on opening braces
      if (
        currentLine.trimEnd().endsWith('{') ||
        currentLine.trimEnd().endsWith('[') ||
        currentLine.trimEnd().endsWith('(')
      ) {
        indent += '  ';
      }

      if (indent) {
        e.preventDefault();
        const insertion = '\n' + indent;
        ta.value = val.substring(0, start) + insertion + val.substring(end);
        ta.selectionStart = ta.selectionEnd = start + insertion.length;
        handleContentChange(ta.value);
      }
    }
  };

  // Track cursor position
  const handleSelectOrKeyUp = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const pos = ta.selectionStart;
    const textBefore = ta.value.substring(0, pos);
    const lines = textBefore.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Stats calculation
  const stats = React.useMemo(() => {
    const chars = activeTab.content.length;
    const lines = activeTab.content ? activeTab.content.split('\n').length : 1;
    const words = activeTab.content.trim() ? activeTab.content.trim().split(/\s+/).length : 0;
    return { chars, lines, words };
  }, [activeTab.content]);

  // Drag & drop file onto editor opens as a new tab
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const nativeP = (file as unknown as { path?: string }).path;
        if (nativeP) {
          void openFileInTab(nativeP);
        }
      }
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDropFile}
      className="flex-1 flex flex-col min-w-0 h-full bg-[#121316] text-zinc-200 select-none overflow-hidden relative font-sans"
    >
      {/* Tab Strip */}
      <CommanderNotepadTabs
        tabs={tabs}
        activeTabId={activeTab.id}
        onSelectTab={(id) => {
          setActiveTabId(id);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {/* Action Toolbar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#171920] border-b border-white/[0.08] text-xs shrink-0 gap-2">
        {/* Document Title & Status */}
        <div className="flex items-center gap-1.5 min-w-0 truncate" title={activeTab.filePath || activeTab.title}>
          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-white truncate text-xs">{activeTab.title}</span>
          {activeTab.isDirty && (
            <span className="text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
              ● Neuloženo
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNewTab}
            className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Nová záložka (Ctrl + T)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              activeTab.isDirty
                ? 'bg-[#60cdff] text-[#111215] hover:brightness-110 shadow-xs'
                : 'bg-white/[0.06] text-zinc-300 hover:bg-white/10 hover:text-white border border-white/10'
            }`}
            title="Uložit poznámku (Ctrl + S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Uložit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSaveFileName(
                activeTab.title.endsWith('.txt') || activeTab.title.includes('.')
                  ? activeTab.title
                  : `${activeTab.title}.txt`
              );
              setSaveModalOpen(true);
            }}
            className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Uložit jako do aktuální složky"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleInsertSelectedPaths}
            disabled={oppositeSelectedPaths.length === 0}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              oppositeSelectedPaths.length > 0
                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer font-medium'
                : 'bg-white/[0.02] text-zinc-600 border border-white/[0.04] cursor-default'
            }`}
            title="Vložit cesty vybraných souborů z protějšího panelu"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vložit cesty ({oppositeSelectedPaths.length})</span>
          </button>
        </div>
      </div>

      {/* Secondary Toolbar (Formatting & Search & View Modes) */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#15171d] border-b border-white/[0.06] text-xs shrink-0 select-none">
        <div className="flex items-center gap-1">
          {/* View Mode Toggle: Editor / Rozděleno / Náhled */}
          <div className="flex items-center bg-black/40 p-0.5 rounded border border-white/10 text-[11px] mr-1">
            <button
              type="button"
              onClick={() => setEditorMode('edit')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                editorMode === 'edit'
                  ? 'bg-[#60cdff]/20 text-[#60cdff] font-bold shadow-xs ring-1 ring-[#60cdff]/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Textový editor"
            >
              <Edit3 className="w-3 h-3" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('split')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                editorMode === 'split'
                  ? 'bg-[#60cdff]/20 text-[#60cdff] font-bold shadow-xs ring-1 ring-[#60cdff]/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Rozdělený náhled (Editor + Formátovaný náhled vedle sebe)"
            >
              <Columns className="w-3 h-3" />
              <span className="hidden sm:inline">Rozděleno</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('preview')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                editorMode === 'preview'
                  ? 'bg-[#60cdff]/20 text-[#60cdff] font-bold shadow-xs ring-1 ring-[#60cdff]/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Formátovaný náhled (Markdown / JSON barevně)"
            >
              <Eye className="w-3 h-3" />
              <span className="hidden sm:inline">Náhled</span>
            </button>
          </div>

          {/* JSON Beautify button */}
          {isJson && (
            <button
              type="button"
              onClick={handleFormatJson}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-colors cursor-pointer text-[11px] font-medium"
              title="Zformátovat JSON se 2 mezerami odsazení"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Formátovat JSON</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMonospace((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              isMonospace
                ? 'bg-[#60cdff]/20 text-[#60cdff] font-bold ring-1 ring-[#60cdff]/30'
                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
            }`}
            title="Přepnout font (Monospace / Proporcionální)"
          >
            Mono
          </button>

          <button
            type="button"
            onClick={() => setShowLineNumbers((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
              showLineNumbers
                ? 'bg-white/10 text-white font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Přepnout zobrazení čísel řádků"
          >
            #
          </button>

          <button
            type="button"
            onClick={() => setWordWrap((prev) => !prev)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              wordWrap ? 'text-[#60cdff] bg-white/[0.06]' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
            }`}
            title="Zalamovat dlouhé řádky"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-0.5 ml-1 border-l border-white/10 pl-1 text-[11px] text-zinc-400">
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(10, s - 1))}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 hover:text-white"
              title="Zmenšit písmo"
            >
              A-
            </button>
            <span className="tabular-nums font-mono text-[10px] text-zinc-300">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(22, s + 1))}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 hover:text-white"
              title="Zvětšit písmo"
            >
              A+
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch((prev) => !prev)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              showSearch ? 'text-[#60cdff] bg-white/10' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Hledat v textu (Ctrl + F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              void copyTextToClipboard(activeTab.content);
              onNotify?.('Zkopírováno', 'Obsah aktivní záložky byl zkopírován do schránky', 'success');
            }}
            className="p-1 rounded text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Kopírovat text této záložky"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Opravdu chcete vymazat obsah této záložky?')) {
                handleContentChange('');
              }
            }}
            className="p-1 rounded text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
            title="Vymazat obsah záložky"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1c23] border-b border-white/10 text-xs shrink-0 animate-in slide-in-from-top-1 duration-100">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat v poznámce..."
            autoFocus
            className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-0.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[#60cdff]"
          />
          {searchQuery && (
            <span className="text-[11px] font-mono text-zinc-400">
              {(() => {
                try {
                  const matches = (
                    activeTab.content.match(
                      new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
                    ) || []
                  ).length;
                  return `${matches} výskytů`;
                } catch {
                  return '';
                }
              })()}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
            className="p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Area (Editor, Preview, or Split) */}
      <div className="flex-1 relative min-h-0 flex overflow-hidden">
        {/* Left: Textarea Editor (if edit or split) */}
        {(editorMode === 'edit' || editorMode === 'split') && (
          <div
            className={`flex-1 relative min-h-0 flex overflow-hidden ${
              editorMode === 'split' ? 'border-r border-white/10' : ''
            }`}
          >
            {showLineNumbers && (
              <div
                ref={lineNumbersRef}
                className="w-10 select-none py-3 pr-2 text-right text-zinc-600 bg-[#0e0f13] border-r border-white/[0.06] font-mono overflow-hidden shrink-0"
                style={{ fontSize: `${fontSize}px`, lineHeight: '1.6' }}
              >
                {Array.from({ length: Math.max(1, stats.lines) }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={activeTab.content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              onKeyUp={handleSelectOrKeyUp}
              onClick={handleSelectOrKeyUp}
              onScroll={handleScroll}
              placeholder="Zde pište své poznámky, kód, to-do seznam... nebo přetáhněte textový soubor ze správce souborů."
              style={{ fontSize: `${fontSize}px` }}
              className={`flex-1 w-full h-full p-3 bg-transparent text-zinc-200 resize-none outline-hidden border-none focus:outline-hidden selection:bg-[#60cdff]/30 leading-relaxed ${
                isMonospace ? 'font-mono' : 'font-sans'
              } ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'}`}
            />
          </div>
        )}

        {/* Right: Formatted Preview (if preview or split) */}
        {(editorMode === 'preview' || editorMode === 'split') && (
          <div className="flex-1 relative min-h-0 flex flex-col overflow-hidden bg-[#0d0e12]">
            <CommanderNotepadPreview
              content={activeTab.content}
              filePath={activeTab.filePath}
              title={activeTab.title}
              fontSize={fontSize}
            />
          </div>
        )}
      </div>

      {/* Footer Info & Stats */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#101115] border-t border-white/[0.04] text-[10px] text-zinc-500 font-sans select-none shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            Řádek {cursorPos.line}, Sloupec {cursorPos.col}
          </span>
          <span>·</span>
          <span>
            {stats.lines} {stats.lines === 1 ? 'řádek' : stats.lines < 5 ? 'řádky' : 'řádků'}
          </span>
          <span>·</span>
          <span>{stats.words} slov</span>
          <span>·</span>
          <span>{stats.chars} znaků</span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span>Záložek: {tabs.length}</span>
          <span>·</span>
          <span className="text-zinc-400">Ctrl+T Nová</span>
          <span>·</span>
          <span className="text-zinc-400">Ctrl+W Zavřít</span>
          <span>·</span>
          <span className="text-zinc-400">Ctrl+S Uložit</span>
        </div>
      </div>

      {/* Save As Modal Dialog */}
      {saveModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in-0 duration-150">
          <div className="bg-[#1a1c23] border border-white/15 rounded-xl shadow-2xl w-full max-w-md p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-[#60cdff]" />
                <h3 className="font-semibold text-white text-sm">Uložit soubor</h3>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Cílová složka:</label>
                <div className="font-mono text-xs text-zinc-300 bg-black/30 px-2.5 py-1.5 rounded border border-white/10 truncate">
                  {currentPath}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Název souboru:</label>
                <input
                  type="text"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveConfirm();
                    else if (e.key === 'Escape') setSaveModalOpen(false);
                  }}
                  autoFocus
                  placeholder="např. poznamky.txt nebo todo.md"
                  className="w-full bg-[#121316] border border-white/15 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-[#60cdff]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={() => void handleSaveConfirm()}
                className="px-4 py-1.5 rounded text-xs bg-[#60cdff] hover:brightness-110 text-[#111215] font-semibold transition-all shadow-xs"
              >
                Uložit soubor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
