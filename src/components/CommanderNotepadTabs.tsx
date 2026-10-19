import React, { useRef } from 'react';
import { FileText, Plus, X } from 'lucide-react';

export interface NotepadTab {
  id: string;
  title: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
}

export interface CommanderNotepadTabsProps {
  tabs: NotepadTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (e: React.MouseEvent, tabId: string) => void;
  onNewTab: () => void;
}

export const CommanderNotepadTabs: React.FC<CommanderNotepadTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center bg-[#131418] border-b border-white/[0.08] px-1 overflow-hidden shrink-0 select-none">
      {/* Horizontally scrollable tab strip */}
      <div
        ref={tabsContainerRef}
        className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5 max-w-full"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-t text-xs max-w-[180px] min-w-[90px] border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1a1c23] text-white font-medium border-[#60cdff] shadow-xs'
                  : 'bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border-transparent'
              }`}
              title={tab.filePath || tab.title}
            >
              <FileText
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-400'
                }`}
              />
              <span className="truncate flex-1 text-[11px]">{tab.title}</span>

              {/* Dirty indicator */}
              {tab.isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                  title="Neuložené změny"
                />
              )}

              {/* Close tab button */}
              <button
                type="button"
                onClick={(e) => onCloseTab(e, tab.id)}
                className={`p-0.5 rounded-full hover:bg-white/15 hover:text-rose-400 transition-colors shrink-0 ${
                  isActive ? 'opacity-70 hover:opacity-100 text-zinc-300' : 'opacity-0 group-hover:opacity-70 hover:opacity-100 text-zinc-400'
                }`}
                title="Zavřít záložku (Ctrl + W)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* New Tab Button (+) */}
        <button
          type="button"
          onClick={onNewTab}
          className="p-1 ml-1 rounded hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
          title="Nová záložka (Ctrl + T)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
