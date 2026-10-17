import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  HardDrive,
  Cpu,
  Trash2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Info,
  ShieldCheck,
  FolderSync,
} from 'lucide-react';
import {
  getAppCacheOverview,
  purgeFolderCache,
  purgeEntireAppCache,
  getMaxThumbCacheLimit,
  setMaxThumbCacheLimit,
  type AppCacheStats,
} from '../utils/cacheManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFolder: string | null;
  onPurgeActiveFolder: () => void;
  onPurgeAll: () => void;
  onNotify?: (title: string, desc: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeFolder,
  onPurgeActiveFolder,
  onPurgeAll,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'cache' | 'about'>('cache');
  const [stats, setStats] = useState<AppCacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState<string | null>(null);
  const [cacheLimit, setCacheLimit] = useState<number>(getMaxThumbCacheLimit());

  const refreshStats = useCallback(async () => {
    try {
      const data = await getAppCacheOverview();
      setStats(data);
    } catch (e) {
      console.warn('Failed to fetch cache stats:', e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refreshStats();
    }
  }, [isOpen, refreshStats]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handlePurgeFolder = async () => {
    if (!activeFolder) return;
    setPurging('folder');
    try {
      const result = purgeFolderCache(activeFolder);
      onPurgeActiveFolder();
      await refreshStats();
      onNotify?.(
        'Mezipaměť složky vymazána',
        `Uvolněno ${result.deletedThumbnails} miniatur. Náhledy se znovu načítají z disku.`,
        'success'
      );
    } finally {
      setPurging(null);
    }
  };

  const handlePurgeEntireCache = async () => {
    setPurging('all');
    try {
      await purgeEntireAppCache();
      onPurgeAll();
      await refreshStats();
      onNotify?.(
        'Veškerá mezipaměť vymazána',
        'Paměť RAM byla uvolněna a databáze náhledů byla zresetována.',
        'success'
      );
    } finally {
      setPurging(null);
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setMaxThumbCacheLimit(newLimit);
    setCacheLimit(newLimit);
    void refreshStats();
    onNotify?.(
      'Limit mezipaměti upraven',
      `Maximální kapacita nastavena na ${newLimit.toLocaleString()} miniatur.`,
      'info'
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-2xl bg-[#171920] border border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-zinc-200 select-none z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#1a1c24]/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-sky-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  Nastavení a správa mezipaměti
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Optimalizace výkonu a správa paměti ve stylu Adobe Bridge
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Zavřít (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-white/[0.06] bg-[#15161d] text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('cache')}
              className={`flex items-center gap-2 px-3 py-2 font-medium transition-colors border-b-2 cursor-pointer ${
                activeTab === 'cache'
                  ? 'border-sky-400 text-white font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Mezipaměť (Cache)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-2 px-3 py-2 font-medium transition-colors border-b-2 cursor-pointer ${
                activeTab === 'about'
                  ? 'border-sky-400 text-white font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>O aplikaci & Systém</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            {activeTab === 'cache' && (
              <>
                {/* Section 1: Real-Time Cache Overview */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Aktuální stav paměťových úložišť
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshStats()}
                      className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white hover:underline cursor-pointer"
                      title="Aktualizovat statistiky"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Obnovit čísla</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Stat 1: Thumbnails */}
                    <div className="bg-[#121318] p-3 rounded-xl border border-white/[0.05]">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
                        Miniatury v RAM
                      </span>
                      <div className="text-base font-bold text-white font-mono">
                        {stats?.thumbnails.count ?? 0}
                        <span className="text-xs text-zinc-500 font-normal">
                          {' '}/ {stats?.thumbnails.maxLimit ?? 2500}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        Rychlé 0ms načtení
                      </span>
                    </div>

                    {/* Stat 2: PDF Page Renders */}
                    <div className="bg-[#121318] p-3 rounded-xl border border-white/[0.05]">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
                        PDF Stránky
                      </span>
                      <div className="text-base font-bold text-white font-mono">
                        {stats?.pdf.pageCount ?? 0}
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        {stats?.pdf.docCount ?? 0} otevřených PDF
                      </span>
                    </div>

                    {/* Stat 3: Windows Shell Icons */}
                    <div className="bg-[#121318] p-3 rounded-xl border border-white/[0.05]">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
                        Ikony systému
                      </span>
                      <div className="text-base font-bold text-white font-mono">
                        {stats?.nativeIcons.iconCount ?? 0}
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        Explorer formáty
                      </span>
                    </div>

                    {/* Stat 4: IndexedDB */}
                    <div className="bg-[#121318] p-3 rounded-xl border border-white/[0.05]">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">
                        IndexedDB
                      </span>
                      <div className="text-base font-bold text-white font-mono">
                        {stats?.indexedDb.assetCount ?? 0}
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        ~{stats?.indexedDb.estimatedSizeMb ?? 0} MB disku
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Cache Actions */}
                <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                    Akce promazání mezipaměti
                  </span>

                  {/* Action 1: Purge Current Folder */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#13151b] border border-white/[0.06]">
                    <div className="flex items-start gap-3 max-w-md">
                      <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5 shrink-0">
                        <FolderSync className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-xs">
                          Vymazat mezipaměť pro tuto složku
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                          Smaže náhledy patřící pouze k právě otevřenému adresáři a vynutí
                          jejich čerstvé přegenerování ze skutečných souborů na disku.
                        </p>
                        {activeFolder && (
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-black/40 text-[10px] font-mono text-zinc-400 border border-white/[0.05] truncate max-w-sm">
                            {activeFolder}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!activeFolder || purging !== null}
                      onClick={handlePurgeFolder}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      {purging === 'folder' ? 'Promazávám...' : 'Promazat složku'}
                    </button>
                  </div>

                  {/* Action 2: Purge Entire Cache */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#13151b] border border-white/[0.06]">
                    <div className="flex items-start gap-3 max-w-md">
                      <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-xs">
                          Vymazat veškerou mezipaměť (Purge Entire Cache)
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                          Uvolní celou paměť RAM (všechny miniatury, vyrenderované stránky PDF
                          a systémové ikony) a promaže tabulku vlastních médií v IndexedDB.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={purging !== null}
                      onClick={handlePurgeEntireCache}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      {purging === 'all' ? 'Čistím vše...' : 'Vyčistit vše'}
                    </button>
                  </div>
                </div>

                {/* Section 3: Cache Capacity Configuration */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                    Kapacita paměťové mezipaměti miniatur (LRU)
                  </span>
                  <div className="flex items-center gap-2">
                    {[1000, 2500, 5000].map((limit) => (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => handleLimitChange(limit)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer text-center ${
                          cacheLimit === limit
                            ? 'bg-[#e2e4e9] text-[#111215] font-bold border-[#e2e4e9] shadow-sm'
                            : 'bg-[#121318] text-zinc-300 hover:text-white border-white/[0.08] hover:bg-white/[0.05]'
                        }`}
                      >
                        {limit.toLocaleString()} položek
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2">
                    Vyšší limit zrychluje procházení dříve navštívených velkých složek bez nutnosti
                    znovunačítání, ale spotřebovává více operační paměti RAM.
                  </p>
                </div>
              </>
            )}

            {activeTab === 'about' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#121318] border border-white/[0.06] flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                    AB
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">AeroBridge Studio</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Verze 3.27.24 (Windows 11 x64 Native Desktop Application)
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> 100% Offline & Private
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] border border-white/10 text-zinc-300 text-[10px] font-mono">
                        Tauri v2 + Rust
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-zinc-300 text-[11px] leading-relaxed">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] flex justify-between">
                    <span className="text-zinc-400">Výchozí pracovní disk:</span>
                    <span className="font-mono font-semibold text-white">F:\ (Working)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] flex justify-between">
                    <span className="text-zinc-400">Podporované formáty náhledů:</span>
                    <span className="text-white">PDF, PSD, AI, INDD, RAW, FIG, SVG, TIFF, RIF, Videa</span>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] flex justify-between">
                    <span className="text-zinc-400">Architektura okna:</span>
                    <span className="text-white">Windows 11 Fluent UX + Mica/Acrylic styling</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3.5 border-t border-white/[0.08] bg-[#14151c]/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              Zavřít
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
