import React, { useEffect, useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  HardDrive,
  Monitor,
  Image as ImageIcon,
  FileText,
  Download,
  Video,
  Music,
} from 'lucide-react';
import {
  listNativeDrives,
  listNativePlaces,
  listNativeSubdirs,
  type NativePlace,
} from '../utils/tauriBridge';

interface NativeExplorerTreeProps {
  activePath: string | null;
  onNavigate: (path: string) => void;
}

const norm = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

/** "C:\Users\me" -> ["C:\", "C:\Users", "C:\Users\me"] */
export function pathAncestors(path: string): string[] {
  const parts = path.replace(/\//g, '\\').split('\\').filter(Boolean);
  const result: string[] = [];
  let acc = '';
  parts.forEach((part, i) => {
    acc = i === 0 ? `${part}\\` : acc.endsWith('\\') ? `${acc}${part}` : `${acc}\\${part}`;
    result.push(acc);
  });
  return result;
}

const placeIcon = (name: string) => {
  switch (name) {
    case 'Plocha':
      return Monitor;
    case 'Dokumenty':
      return FileText;
    case 'Stažené soubory':
      return Download;
    case 'Obrázky':
      return ImageIcon;
    case 'Videa':
      return Video;
    case 'Hudba':
      return Music;
    default:
      return Folder;
  }
};

export const NativeExplorerTree: React.FC<NativeExplorerTreeProps> = ({ activePath, onNavigate }) => {
  const [drives, setDrives] = useState<NativePlace[]>([]);
  const [places, setPlaces] = useState<NativePlace[]>([]);
  const [children, setChildren] = useState<Record<string, NativePlace[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    listNativeDrives().then(setDrives);
    listNativePlaces().then(setPlaces);
  }, []);

  const loadChildren = useCallback(async (path: string) => {
    const key = norm(path);
    const subs = await listNativeSubdirs(path);
    setChildren((prev) => ({
      ...prev,
      [key]: subs.map((s) => ({ name: s.name, path: s.path })),
    }));
  }, []);

  const toggle = useCallback(
    (path: string) => {
      const key = norm(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      setChildren((prev) => {
        if (!prev[key]) void loadChildren(path);
        return prev;
      });
    },
    [loadChildren]
  );

  // Keep the tree in sync with the currently opened folder (expand all ancestors)
  useEffect(() => {
    if (!activePath) return;
    const ancestors = pathAncestors(activePath);
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestors.slice(0, -1).forEach((a) => next.add(norm(a)));
      return next;
    });
    ancestors.slice(0, -1).forEach((a) => {
      if (!children[norm(a)]) void loadChildren(a);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  const renderNode = (node: NativePlace, level: number, icon?: React.ElementType) => {
    const key = norm(node.path);
    const isOpen = expanded.has(key);
    const isActive = !!activePath && norm(activePath) === key;
    const kids = children[key];
    const Icon = icon ?? (isOpen ? FolderOpen : Folder);

    return (
      <div key={`${level}-${key}`}>
        <div
          onClick={() => onNavigate(node.path)}
          className={`group flex items-center w-full py-1.5 pr-2 text-xs transition-colors border-l-2 cursor-pointer select-none ${
            isActive
              ? 'bg-white/[0.08] border-[#e2e4e9] text-[#f4f4f5] font-medium'
              : 'border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white'
          }`}
          style={{ paddingLeft: `${6 + level * 12}px` }}
          title={node.path}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.path);
            }}
            className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-white shrink-0"
            aria-label={isOpen ? 'Sbalit' : 'Rozbalit'}
          >
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <Icon className={`w-3.5 h-3.5 mx-1.5 shrink-0 ${isActive ? 'text-[#e2e4e9]' : 'text-zinc-500'}`} />
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && kids && kids.length > 0 && (
          <div>{kids.map((k) => renderNode(k, level + 1))}</div>
        )}
        {isOpen && kids && kids.length === 0 && (
          <div
            className="text-[10px] text-zinc-600 italic py-1"
            style={{ paddingLeft: `${34 + level * 12}px` }}
          >
            (žádné podsložky)
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border-b border-white/[0.06]">
      <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5">
        <Monitor className="w-3 h-3 text-[#e2e4e9]" />
        Tento počítač
      </div>
      <div className="pb-2">
        {places.map((p) => renderNode(p, 0, placeIcon(p.name)))}
        {places.length > 0 && drives.length > 0 && <div className="h-px bg-white/[0.06] mx-3 my-1.5" />}
        {drives.map((d) => renderNode(d, 0, HardDrive))}
      </div>
    </div>
  );
};
