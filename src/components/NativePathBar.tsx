import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw, ChevronRight, Folder } from 'lucide-react';
import type { NativeFileEntry } from '../utils/tauriBridge';
import { pathAncestors } from './NativeExplorerTree';

interface NativePathBarProps {
  path: string;
  subdirs: NativeFileEntry[];
  canBack: boolean;
  canForward: boolean;
  isLoading: boolean;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
}

const segmentLabel = (full: string) => {
  const parts = full.replace(/\\+$/, '').split('\\');
  return parts[parts.length - 1] || full;
};

export const NativePathBar: React.FC<NativePathBarProps> = ({
  path,
  subdirs,
  canBack,
  canForward,
  isLoading,
  onBack,
  onForward,
  onUp,
  onRefresh,
  onNavigate,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(path);

  useEffect(() => {
    setDraft(path);
    setEditing(false);
  }, [path]);

  const crumbs = pathAncestors(path);
  const btn =
    'p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors';

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-[#16171a]">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" className={btn} onClick={onBack} disabled={!canBack} title="Zpět (Alt+←)">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button type="button" className={btn} onClick={onForward} disabled={!canForward} title="Vpřed (Alt+→)">
          <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" className={btn} onClick={onUp} disabled={crumbs.length <= 1} title="O úroveň výš (Alt+↑)">
          <ArrowUp className="w-4 h-4" />
        </button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = draft.trim();
                if (v) onNavigate(v);
                setEditing(false);
              } else if (e.key === 'Escape') {
                setEditing(false);
              }
            }}
            className="flex-1 min-w-0 bg-[#0e0f11] border border-white/15 px-2.5 py-1 text-xs font-mono text-zinc-100 outline-none focus:border-[#e2e4e9]/60"
            spellCheck={false}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            className="flex-1 min-w-0 flex items-center overflow-x-auto bg-[#0e0f11] border border-white/[0.08] px-1.5 py-1 cursor-text no-scrollbar"
            title="Klikněte pro ruční zadání cesty"
          >
            {crumbs.map((c, i) => (
              <React.Fragment key={c}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(c);
                  }}
                  className={`px-1.5 py-0.5 text-xs whitespace-nowrap hover:bg-white/[0.08] transition-colors ${
                    i === crumbs.length - 1 ? 'text-zinc-100 font-medium' : 'text-zinc-400'
                  }`}
                >
                  {i === 0 ? c.replace(/\\$/, '') : segmentLabel(c)}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        <button type="button" className={btn} onClick={onRefresh} title="Obnovit (F5)">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {subdirs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-2 max-h-[84px] overflow-y-auto">
          {subdirs.map((d) => (
            <button
              key={d.path}
              type="button"
              onClick={() => onNavigate(d.path)}
              className="flex items-center gap-1.5 max-w-[220px] px-2 py-1 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.1] hover:border-white/20 hover:text-white transition-colors"
              title={d.path}
            >
              <Folder className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{d.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
