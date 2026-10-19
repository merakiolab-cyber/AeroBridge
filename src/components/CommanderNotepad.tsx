import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Save,
  FolderOpen,
  Plus,
  Copy,
  Trash2,
  WrapText,
  Type,
  Folder,
  Check,
  Search,
  X,
  FileCode,
  Download,
} from 'lucide-react';
import { readTextFileNative, writeTextFileNative, isDesktopApp } from '../utils/tauriBridge';
import { copyTextToClipboard } from '../utils/localFileSystem';

export interface CommanderNotepadProps {
  paneKey: 'left' | 'right';
  currentPath: string;
  oppositeSelectedPaths?: string[];
  initialFilePath?: string | null;
  onCloseNotepad: () => void;
  onNotify?: (title: string, message?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onFileSaved?: (savedPath: string) => void;
}

export const CommanderNotepad: React.FC<CommanderNotepadProps> = ({
  paneKey,
  currentPath,
  oppositeSelectedPaths = [],
  initialFilePath = null,
  onCloseNotepad,
  onNotify,
  onFileSaved,
}) => {
  const storageKey = `aerobridge_commander_notepad_${paneKey}`;
  const pathStorageKey = `aerobridge_commander_notepad_path_${paneKey}`;

  // Content state
  const [content, setContent] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  // Current open file path (if loaded from disk)
  const [activeFilePath, setActiveFilePath] = useState<string | null>(() => {
    try {
      return initialFilePath || localStorage.getItem(pathStorageKey) || null;
    } catch {
      return initialFilePath || null;
    }
  });

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isMonospace, setIsMonospace] = useState<boolean>(true);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<number>(13);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [saveFileName, setSaveFileName] = useState<string>('poznamka.txt');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load initial file if requested via props
  useEffect(() => {
    if (initialFilePath) {
      loadFile(initialFilePath);
    }
  }, [initialFilePath]);

  // Persist draft notes in localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, content);
      if (activeFilePath) {
        localStorage.setItem(pathStorageKey, activeFilePath);
      } else {
        localStorage.removeItem(pathStorageKey);
      }
    } catch {}
  }, [content, activeFilePath, storageKey, pathStorageKey]);

  // Load a file from disk
  const loadFile = useCallback(async (path: string) => {
    try {
      const text = await readTextFileNative(path);
      setContent(text);
      setActiveFilePath(path);
      setIsDirty(false);
      const name = path.split('\\').pop() || path;
      onNotify?.('Soubor načten', `${name}`, 'info');
    } catch (err) {
      console.error('[CommanderNotepad] Failed to read file:', err);
      onNotify?.('Chyba při čtení', String(err), 'error');
    }
  }, [onNotify]);

  // Handle Save (Ctrl+S or click)
  const handleSave = useCallback(async () => {
    if (activeFilePath) {
      try {
        await writeTextFileNative(activeFilePath, content);
        setIsDirty(false);
        const name = activeFilePath.split('\\').pop() || activeFilePath;
        onNotify?.('Uloženo', `${name}`, 'success');
        onFileSaved?.(activeFilePath);
      } catch (err) {
        console.error('[CommanderNotepad] Save error:', err);
        onNotify?.('Chyba při ukládání', String(err), 'error');
      }
    } else {
      // Prompt for filename in current directory
      setSaveFileName(saveFileName || 'poznamka.txt');
      setSaveModalOpen(true);
    }
  }, [activeFilePath, content, onNotify, onFileSaved, saveFileName]);

  // Execute Save As in current folder
  const handleSaveConfirm = useCallback(async () => {
    if (!saveFileName.trim()) return;
    const cleanName = saveFileName.trim();
    const targetPath = `${currentPath.replace(/\\+$/, '')}\\${cleanName}`;

    try {
      await writeTextFileNative(targetPath, content);
      setActiveFilePath(targetPath);
      setIsDirty(false);
      setSaveModalOpen(false);
      onNotify?.('Soubor vytvořen a uložen', `${cleanName}`, 'success');
      onFileSaved?.(targetPath);
    } catch (err) {
      console.error('[CommanderNotepad] SaveAs error:', err);
      onNotify?.('Chyba při ukládání', String(err), 'error');
    }
  }, [saveFileName, currentPath, content, onNotify, onFileSaved]);

  // New Note
  const handleNewNote = useCallback(() => {
    if (isDirty && !window.confirm('Máte neuložené změny. Opravdu chcete vytvořit novou poznámku?')) {
      return;
    }
    setContent('');
    setActiveFilePath(null);
    setIsDirty(false);
    textareaRef.current?.focus();
  }, [isDirty]);

  // Paste selected file paths from opposite pane
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
      const nextContent = content.substring(0, start) + pathsText + content.substring(end);
      setContent(nextContent);
      setIsDirty(true);
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + pathsText.length;
        ta.focus();
      }, 0);
    } else {
      setContent((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + pathsText);
      setIsDirty(true);
    }

    onNotify?.('Cesty vloženy', `${oppositeSelectedPaths.length} položek`, 'info');
  }, [oppositeSelectedPaths, content, onNotify]);

  // Keyboard shortcut listener (Ctrl+S, Ctrl+F, Escape)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void handleSave();
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
      setContent(ta.value);
      setIsDirty(true);
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
    const chars = content.length;
    const lines = content ? content.split('\n').length : 1;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return { chars, lines, words };
  }, [content]);

  // Handle Drag & Drop of text files directly onto Notepad
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const nativeP = (file as unknown as { path?: string }).path;
      if (nativeP) {
        void loadFile(nativeP);
      }
    }
  };

  const fileNameDisplay = activeFilePath
    ? activeFilePath.split('\\').pop() || activeFilePath
    : 'Poznámkový blok (nepojmenováno)';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDropFile}
      className="flex-1 flex flex-col min-w-0 h-full bg-[#121316] text-zinc-200 select-none overflow-hidden relative font-sans"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#171920] border-b border-white/[0.08] text-xs shrink-0 gap-2">
        {/* Document Title & Mode Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onCloseNotepad}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px] font-medium border border-white/10 shrink-0"
            title="Přepnout zpět do správce souborů"
          >
            <Folder className="w-3.5 h-3.5 text-[#60cdff]" />
            <span>Zpět k souborům</span>
          </button>

          <div className="flex items-center gap-1.5 min-w-0 truncate" title={activeFilePath || 'Dočasná poznámka'}>
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-white truncate text-xs">{fileNameDisplay}</span>
            {isDirty && (
              <span className="text-[10px] text-amber-400 bg-amber-500/15 px-1.5 py-0.2 rounded font-mono font-medium shrink-0">
                ● Neuloženo
              </span>
            )}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNewNote}
            className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Nová poznámka"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              isDirty
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
            onClick={() => setSaveModalOpen(true)}
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

      {/* Secondary Toolbar (Formatting & Search) */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#15171d] border-b border-white/[0.06] text-xs shrink-0 select-none">
        <div className="flex items-center gap-1">
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
              void copyTextToClipboard(content);
              onNotify?.('Zkopírováno', 'Celý obsah zápisníku byl zkopírován do schránky', 'success');
            }}
            className="p-1 rounded text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Kopírovat celý text"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Opravdu chcete vymazat celý obsah zápisníku?')) {
                setContent('');
                setIsDirty(true);
              }
            }}
            className="p-1 rounded text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
            title="Vymazat obsah"
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
                  const matches = (content.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
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

      {/* Main Textarea Editor */}
      <div className="flex-1 relative min-h-0 flex overflow-hidden">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setIsDirty(true);
          }}
          onKeyDown={handleTextareaKeyDown}
          onKeyUp={handleSelectOrKeyUp}
          onClick={handleSelectOrKeyUp}
          placeholder="Zde můžete psát poznámky, instrukce, seznamy souborů nebo přetahovat textové soubory..."
          spellCheck={false}
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: isMonospace ? '"Cascadia Code", "Consolas", monospace' : 'inherit',
            whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
          }}
          className="flex-1 h-full w-full bg-[#121316] text-zinc-100 p-3 resize-none border-none outline-none focus:outline-none selection:bg-[#60cdff]/30 leading-relaxed overflow-auto"
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#171920] border-t border-white/[0.08] text-[11px] text-zinc-400 font-mono select-none shrink-0">
        <div className="flex items-center gap-3">
          <span>Řádek {cursorPos.line}, Sloupec {cursorPos.col}</span>
          <span>·</span>
          <span>{stats.lines} řádků</span>
          <span>·</span>
          <span>{stats.words} slov</span>
          <span>·</span>
          <span>{stats.chars} znaků</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="text-[10px] uppercase font-bold text-[#60cdff]/80">UTF-8</span>
          <span>·</span>
          <span className="truncate max-w-[200px]" title={currentPath}>
            {currentPath.split('\\').pop() || currentPath}
          </span>
        </div>
      </div>

      {/* Save As Modal Dialog */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-100">
          <div className="bg-[#181a20] border border-white/15 rounded-xl shadow-2xl w-full max-w-md p-5 text-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-[#60cdff]" />
                <h3 className="text-sm font-semibold text-white">Uložit poznámku do souboru</h3>
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
