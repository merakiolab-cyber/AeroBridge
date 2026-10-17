import React, { useState, useRef, useEffect } from 'react';
import { WorkspaceView, BrowserViewMode, SortField, SortOrder } from '../types';
import {
  FolderOpen,
  Folder,
  Search,
  Filter,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ZoomIn,
  ZoomOut,
  Edit3,
  Download,
  X,
  MoreHorizontal,
  Info,
  CheckSquare,
  Tag,
  Monitor,
  FileText,
  LayoutGrid,
  List,
  Columns2,
  Settings,
  FolderSync,
  Trash2,
} from 'lucide-react';

interface TopBarProps {
  currentView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  browserViewMode?: BrowserViewMode;
  onBrowserViewModeChange?: (mode: BrowserViewMode) => void;
  onOpenFolder: () => void;
  selectedCount: number;
  activeFolder: string;
  totalFilteredCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  formatFilter?: string | null;
  onFormatFilterChange?: (format: string | null) => void;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortOrder: SortOrder;
  onSortOrderToggle: () => void;
  thumbnailSize: number;
  onThumbnailSizeChange: (size: number) => void;
  fitMode: 'cover' | 'contain';
  onFitModeToggle: () => void;
  onBatchRename: () => void;
  onBatchExport: () => void;
  onBatchIptc?: () => void;
  showAllInfo?: boolean;
  onToggleShowAllInfo?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onOpenSettings?: () => void;
  onPurgeFolderCache?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onViewChange,
  browserViewMode = 'grid',
  onBrowserViewModeChange,
  onOpenFolder,
  selectedCount,
  activeFolder,
  totalFilteredCount,
  searchQuery,
  onSearchChange,
  formatFilter = null,
  onFormatFilterChange,
  sortField,
  onSortFieldChange,
  sortOrder,
  onSortOrderToggle,
  thumbnailSize,
  onThumbnailSizeChange,
  fitMode,
  onFitModeToggle,
  onBatchRename,
  onBatchExport,
  onBatchIptc,
  showAllInfo = false,
  onToggleShowAllInfo,
  onSelectAll,
  onClearSelection,
  onOpenSettings,
  onPurgeFolderCache,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on click outside or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setFilterOpen(false);
      }
    };

    if (menuOpen || filterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, filterOpen]);

  const mediaCategories: { id: string | null; label: string; color?: string }[] = [
    { id: null, label: 'Všechna média' },
    { id: 'jpg', label: 'JPG (.jpg, .jpeg)', color: '#10b981' },
    { id: 'png', label: 'PNG (.png)', color: '#06b6d4' },
    { id: 'webp', label: 'WebP (.webp)', color: '#00c49f' },
    { id: 'pptx', label: 'PowerPoint (.pptx)', color: '#d04423' },
    { id: 'adobe-psd', label: 'Photoshop (.psd)', color: '#31a8ff' },
    { id: 'adobe-ai', label: 'Illustrator (.ai)', color: '#ff9a00' },
    { id: 'adobe-indd', label: 'InDesign (.indd)', color: '#ff3366' },
    { id: 'adobe-ae', label: 'After Effects (.aep)', color: '#9999ff' },
    { id: 'figma', label: 'Figma Design (.fig)', color: '#a259ff' },
    { id: 'krita', label: 'Krita malba (.kra)', color: '#3daee9' },
    { id: 'vector', label: 'SVG a vektory (.svg)', color: '#f59e0b' },
    { id: 'html', label: 'HTML dokumenty (.html)', color: '#e44d26' },
    { id: 'painter', label: 'Corel Painter (.rif)', color: '#f97316' },
    { id: 'tiff', label: 'TIFF snímky (.tif)', color: '#14b8a6' },
    { id: 'pdf', label: 'PDF dokumenty', color: '#ff2d20' },
    { id: 'image', label: 'Všechny obrázky a foto', color: '#84cc16' },
    { id: 'video', label: 'Videa a klipy', color: '#8b5cf6' },
  ];

  const activeCategory = mediaCategories.find((c) => c.id === formatFilter) || mediaCategories[0];

  const sortOptions: { id: SortField; label: string }[] = [
    { id: 'name', label: 'Název' },
    { id: 'dateModified', label: 'Datum' },
    { id: 'size', label: 'Velikost' },
    { id: 'extension', label: 'Formát' },
    { id: 'dimensions', label: 'Rozměry' },
  ];

  const presets = [
    { label: 'S', size: 130 },
    { label: 'M', size: 190 },
    { label: 'L', size: 280 },
    { label: 'XL', size: 400 },
  ];

  return (
    <header className="flex flex-col bg-[#16171a] border-b border-white/[0.06] shrink-0 select-none">
      {/* ROW 1: Brand, Breadcrumbs, Views & 3-Dots Menu */}
      <div className="flex items-center justify-between gap-6 px-6 py-2.5 border-b border-white/[0.04]">
        {/* Left: Brand Wordmark + Breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            className="text-xs font-semibold tracking-wider text-white whitespace-nowrap flex items-center gap-2 uppercase"
          >
            <span className="w-1.5 h-1.5 bg-[#e2e4e9] shadow-[0_0_8px_rgba(237,232,223,0.8)]" />
            <span className="tracking-widest">AeroBridge</span>
          </a>

          <span className="text-white/20">/</span>

          <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate max-w-xs sm:max-w-md">
            <Folder className="w-3.5 h-3.5 text-[#e2e4e9] shrink-0" />
            <span className="text-[#e2e4e9] font-medium truncate">
              {activeFolder === '/'
                ? 'Všechna média'
                : activeFolder.startsWith('native:')
                ? activeFolder.slice(7)
                : activeFolder.replace(/^\//, '').replace(/\//g, ' / ')}
            </span>
            <span className="text-zinc-500 font-mono text-[11px] tabular-nums">
              ({totalFilteredCount})
            </span>
          </div>
        </div>

        {/* Center: Workspace View Selector */}
        <nav className="flex items-center gap-1 bg-[#121316] p-0.5 rounded-full border border-white/[0.08] shadow-xs">
          <button
            type="button"
            onClick={() => onViewChange('browser')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              currentView === 'browser' || currentView === 'essentials' || currentView === 'table'
                ? 'bg-[#e2e4e9] text-[#111215] font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Prohlížeč médií (Mřížka / Seznam)"
          >
            {browserViewMode === 'table' ? (
              <List className="w-3.5 h-3.5" />
            ) : (
              <LayoutGrid className="w-3.5 h-3.5" />
            )}
            <span>Prohlížeč</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange('filmstrip')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
              currentView === 'filmstrip'
                ? 'bg-[#e2e4e9] text-[#111215] font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Filmstrip
          </button>
          <button
            type="button"
            onClick={() => onViewChange('compare')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
              currentView === 'compare'
                ? 'bg-[#e2e4e9] text-[#111215] font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Porovnat
          </button>
          <button
            type="button"
            onClick={() => onViewChange('commander')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
              currentView === 'commander'
                ? 'bg-[#e2e4e9] text-[#111215] font-semibold shadow-xs'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Dvoupanelový správce souborů (a la Total Commander)"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Commander</span>
          </button>
        </nav>

        {/* Right: Select All, Clear Selection, and Consolidated Three-Dots Menu (...) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Select all button */}
          {onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.1] border border-white/10 transition-colors"
              title="Vybrat vše (Ctrl+A)"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#e2e4e9]" />
              <span className="hidden sm:inline">Vybrat vše</span>
            </button>
          )}

          {/* Clear selection button */}
          {selectedCount > 0 && onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.1] border border-white/10 transition-colors"
              title="Zrušit výběr"
            >
              <X className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Zrušit výběr</span>
            </button>
          )}

          {selectedCount > 0 && (
            <span className="text-[11px] font-mono text-[#e2e4e9] px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 tabular-nums">
              {selectedCount} vybráno
            </span>
          )}

          {/* Settings & Cache Management Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1.5 rounded-full transition-all border bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.1] border-white/10 cursor-pointer"
              title="Nastavení a správa mezipaměti (Ctrl+,)"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Three dots button and dropdown menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className={`p-1.5 rounded-full transition-all border ${
                menuOpen
                  ? 'bg-[#e2e4e9] text-[#111215] border-[#e2e4e9]'
                  : 'bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.1] border-white/10'
              }`}
              title="Nabídka akcí (Přejmenovat, ZIP, IPTC, Otevřít složku...)"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Bauhaus Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#222429] border border-white/15 shadow-2xl z-50 py-1.5 backdrop-blur-md">
                <div className="px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider text-zinc-400 border-b border-white/[0.08]">
                  Akce & Správa souborů
                </div>

              {/* 1. Otevřít složku */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenFolder();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left text-white hover:bg-white/[0.08] transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#e2e4e9]" />
                <div className="flex flex-col">
                  <span className="font-medium">Otevřít složku...</span>
                  <span className="text-[10px] text-zinc-400">Načíst z disku počítače</span>
                </div>
              </button>

              {/* 2. Přejmenovat */}
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  setMenuOpen(false);
                  onBatchRename();
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left transition-colors ${
                  selectedCount > 0
                    ? 'text-white hover:bg-white/[0.08] cursor-pointer'
                    : 'text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    Přejmenovat {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {selectedCount > 0 ? 'Dávkové přejmenování výběru' : 'Nejprve vyberte soubory'}
                  </span>
                </div>
              </button>

              {/* 3. Exportovat ZIP */}
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  setMenuOpen(false);
                  onBatchExport();
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left transition-colors ${
                  selectedCount > 0
                    ? 'text-white hover:bg-white/[0.08] cursor-pointer'
                    : 'text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-[#e2e4e9]" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    Exportovat ZIP {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {selectedCount > 0 ? 'Stáhnout archiv vybraných souborů' : 'Nejprve vyberte soubory'}
                  </span>
                </div>
              </button>

              {/* 4. Dávková úprava IPTC */}
              {onBatchIptc && (
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={() => {
                    setMenuOpen(false);
                    onBatchIptc();
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left transition-colors ${
                    selectedCount > 0
                      ? 'text-white hover:bg-white/[0.08] cursor-pointer'
                      : 'text-zinc-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-300" />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      Upravit IPTC metadata {selectedCount > 0 ? `(${selectedCount})` : ''}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {selectedCount > 0
                        ? 'Popisky, autor, copyright, klíčová slova'
                        : 'Nejprve vyberte soubory'}
                    </span>
                  </div>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.08]" />

              {/* 4. Toggle file info */}
              {onToggleShowAllInfo && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleShowAllInfo();
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-left text-white hover:bg-white/[0.08] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="w-3.5 h-3.5 text-[#e2e4e9]" />
                    <div className="flex flex-col">
                      <span className="font-medium">Názvy a přípony pod obrázky</span>
                      <span className="text-[10px] text-zinc-400">
                        {showAllInfo ? 'Skrýt podrobnosti (pouze miniatury)' : 'Zobrazit trvale pod obrázky'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                    Ctrl+T
                  </span>
                </button>
              )}

              <div className="my-1 border-t border-white/[0.08]" />

              {/* 5. Purge Folder Cache (Adobe Bridge style) */}
              {onPurgeFolderCache && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPurgeFolderCache();
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-left text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FolderSync className="w-3.5 h-3.5 text-sky-400" />
                    <div className="flex flex-col">
                      <span className="font-medium">Vymazat mezipaměť složky</span>
                      <span className="text-[10px] text-zinc-400">
                        Znovunačíst miniatury z disku
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                    Ctrl+F5
                  </span>
                </button>
              )}

              {/* 6. Settings and Cache Dialog */}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs text-left text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-3.5 h-3.5 text-amber-300" />
                    <div className="flex flex-col">
                      <span className="font-medium">Nastavení a mezipaměť...</span>
                      <span className="text-[10px] text-zinc-400">
                        Statistiky RAM, uvolnění cache
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                    Ctrl+,
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ROW 2: Minimalist Studio Controls (Search, Sort, Zoom Scale) - Hidden in Commander view */}
      {currentView !== 'commander' && (
        <div className="flex items-center justify-between gap-6 px-6 py-2 bg-[#1b1c20] text-xs">
        {/* Left & Center: Filter by media on the left + Search input placed to the right towards the center */}
        <div className="flex items-center gap-3 flex-1 max-w-2xl min-w-0">
          {/* Media Filter Selector (placed where search bar used to be) */}
          <div className="relative shrink-0" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border select-none ${
                formatFilter !== null
                  ? 'bg-[#e2e4e9] text-[#111215] border-[#e2e4e9] font-semibold shadow-xs'
                  : 'bg-[#222429] hover:bg-[#2a2c33] text-zinc-300 hover:text-white border-white/[0.08]'
              }`}
              title="Filtrovat podle formátu médií"
            >
              {activeCategory.color ? (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeCategory.color }}
                />
              ) : (
                <Filter className={`w-3.5 h-3.5 shrink-0 ${formatFilter !== null ? 'text-[#111215]' : 'text-zinc-400'}`} />
              )}
              <span className="whitespace-nowrap max-w-[140px] truncate">
                {activeCategory.label}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                  filterOpen ? 'rotate-180' : ''
                } ${formatFilter !== null ? 'text-[#111215]' : 'text-zinc-400'}`}
              />
            </button>

            {/* Clear active filter badge */}
            {formatFilter !== null && onFormatFilterChange && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFormatFilterChange(null);
                }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#16171a] border border-white/25 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                title="Zrušit filtr médií"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}

            {/* Dropdown Menu */}
            {filterOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-[#18191d] border border-white/10 shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-zinc-500 tracking-wider border-b border-white/[0.06] flex items-center justify-between">
                  <span>Filtrovat podle médií</span>
                  {formatFilter !== null && onFormatFilterChange && (
                    <button
                      type="button"
                      onClick={() => {
                        onFormatFilterChange(null);
                        setFilterOpen(false);
                      }}
                      className="text-[10px] text-[#e2e4e9] hover:underline cursor-pointer lowercase"
                    >
                      vše
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {mediaCategories.map((cat) => {
                    const isSelected = formatFilter === cat.id;
                    return (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => {
                          onFormatFilterChange?.(cat.id);
                          setFilterOpen(false);
                        }}
                        className={`flex items-center justify-between w-full px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.1] text-white font-semibold'
                            : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {cat.color ? (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full border border-zinc-500 shrink-0" />
                          )}
                          <span className="truncate">{cat.label}</span>
                        </div>
                        {isSelected && <span className="w-1.5 h-1.5 bg-[#e2e4e9] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Search Input (located next to filter, to the right, towards the center) */}
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Hledat soubor, formát, software..."
              className="w-full bg-[#222429] border border-white/[0.07] rounded-none pl-8 pr-8 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[#e2e4e9]/80 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
                title="Vymazat hledání"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Sorting + Zoom Sizing */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Sorting Controls */}
          <div className="flex items-center gap-1.5 bg-[#222429] px-2.5 py-1 rounded-full border border-white/[0.07]">
            <span className="text-[11px] text-zinc-400 font-medium mr-1">
              Řadit:
            </span>
            <div className="flex items-center gap-1">
              {sortOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSortFieldChange(opt.id)}
                  className={`px-2 py-0.5 text-[11px] rounded-full transition-all ${
                    sortField === opt.id
                      ? 'bg-[#e2e4e9] text-[#111215] font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort Order Toggle Button */}
            <button
              type="button"
              onClick={onSortOrderToggle}
              className="p-1 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-1"
              title={`Řadit: ${sortOrder === 'asc' ? 'Vzestupně (A-Z)' : 'Sestupně (Z-A)'}`}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-[#e2e4e9]" />
              ) : (
                <ArrowDown className="w-3 h-3 text-[#e2e4e9]" />
              )}
            </button>
          </div>

          {/* Grid / List Mode Toggle (v rámci sekce Prohlížeč) */}
          {(currentView === 'browser' || currentView === 'essentials' || currentView === 'table') && onBrowserViewModeChange && (
            <div className="flex items-center bg-[#222429] p-0.5 rounded-full border border-white/[0.07] shadow-xs">
              <button
                type="button"
                onClick={() => onBrowserViewModeChange('grid')}
                className={`p-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  browserViewMode === 'grid'
                    ? 'bg-[#e2e4e9] text-[#111215] font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
                title="Zobrazení: Mřížka náhledů (Tab / Ctrl+1)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px] pr-1 font-medium">Mřížka</span>
              </button>
              <button
                type="button"
                onClick={() => onBrowserViewModeChange('table')}
                className={`p-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  browserViewMode === 'table'
                    ? 'bg-[#e2e4e9] text-[#111215] font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
                title="Zobrazení: Seznam s metadaty (Tab / Ctrl+2)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-[11px] pr-1 font-medium">Seznam</span>
              </button>
            </div>
          )}

          {/* Thumbnail Size Controls (Grid & List Views) */}
          {(currentView === 'browser' || currentView === 'essentials' || currentView === 'table') && (
            <div className="flex items-center gap-2.5 bg-[#222429] px-2.5 py-1 rounded-full border border-white/[0.07]">
              {/* Presets S/M/L/XL */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-white/10">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onThumbnailSizeChange(p.size)}
                    className={`w-5 h-5 rounded-md text-[10px] font-mono font-medium transition-all ${
                      Math.abs(thumbnailSize - p.size) < 30
                        ? 'bg-[#e2e4e9] text-[#111215] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title={`Velikost ${p.label} (${p.size}px)`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div className="flex items-center gap-1.5">
                <ZoomOut
                  className="w-3 h-3 text-zinc-500 cursor-pointer hover:text-white"
                  onClick={() => onThumbnailSizeChange(Math.max(thumbnailSize - 30, 100))}
                />
                <input
                  type="range"
                  min="100"
                  max="460"
                  step="10"
                  value={thumbnailSize}
                  onChange={(e) => onThumbnailSizeChange(parseInt(e.target.value, 10))}
                  className="w-16 accent-[#e2e4e9] cursor-pointer h-1 bg-white/10 rounded-lg"
                  title={`Velikost: ${thumbnailSize}px`}
                />
                <ZoomIn
                  className="w-3 h-3 text-zinc-500 cursor-pointer hover:text-white"
                  onClick={() => onThumbnailSizeChange(Math.min(thumbnailSize + 30, 460))}
                />
                <span className="text-[10px] font-mono text-zinc-400 w-9 text-right tabular-nums">
                  {thumbnailSize}px
                </span>
              </div>

              {/* Fit Mode Toggle */}
              <button
                type="button"
                onClick={onFitModeToggle}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ml-1 border ${
                  fitMode === 'cover'
                    ? 'bg-white/10 text-white border-white/10'
                    : 'bg-[#e2e4e9]/20 text-[#e2e4e9] border-[#e2e4e9]/40 font-semibold'
                }`}
                title="Přepnout oříznutí vs celý náhled"
              >
                {fitMode === 'cover' ? 'Oříznout' : 'Celý'}
              </button>

              {/* Direct Toggle for File Names & Extensions (Ctrl+T) */}
              {onToggleShowAllInfo && (
                <button
                  type="button"
                  onClick={onToggleShowAllInfo}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ml-1 border ${
                    showAllInfo
                      ? 'bg-[#e2e4e9] text-[#111215] border-[#e2e4e9] font-semibold shadow-xs'
                      : 'bg-white/5 text-zinc-400 hover:text-white border-white/10 hover:bg-white/10'
                  }`}
                  title="Zobrazit / skrýt jména a přípony souborů pod obrázky (Ctrl+T)"
                >
                  <FileText className="w-3 h-3" />
                  <span>{showAllInfo ? 'Názvy zapnuty' : 'Pouze miniatury'}</span>
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                      showAllInfo
                        ? 'bg-black/20 text-[#111215]'
                        : 'bg-white/10 text-zinc-300'
                    }`}
                  >
                    Ctrl+T
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </header>
  );
};
