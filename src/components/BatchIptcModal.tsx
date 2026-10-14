import React, { useState } from 'react';
import { AssetItem, BatchIptcConfig } from '../types';
import {
  X,
  Check,
  Tag,
  FileText,
  User,
  Shield,
  MapPin,
  Sparkles,
  Plus,
  Trash2,
  HelpCircle,
} from 'lucide-react';

interface BatchIptcModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: AssetItem[];
  onApplyBatchIptc: (
    assetIds: string[],
    config: BatchIptcConfig
  ) => void;
}

export const BatchIptcModal: React.FC<BatchIptcModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onApplyBatchIptc,
}) => {
  const [config, setConfig] = useState<BatchIptcConfig>({
    updateTitle: false,
    title: '',
    updateCaption: false,
    captionMode: 'replace',
    caption: '',
    updateCreator: false,
    creator: '',
    updateCopyright: false,
    copyright: '© 2026 AeroBridge Studio. Všechna práva vyhrazena.',
    updateLocation: false,
    location: '',
    updateKeywords: false,
    keywordsMode: 'append',
    keywords: [],
  });

  const [keywordInput, setKeywordInput] = useState('');

  if (!isOpen || selectedAssets.length === 0) return null;

  // Handle adding tag
  const handleAddKeyword = (val: string) => {
    const raw = val.trim();
    if (!raw) return;
    const split = raw
      .split(/[,;]/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    setConfig((prev) => {
      const merged = Array.from(new Set([...prev.keywords, ...split]));
      return {
        ...prev,
        updateKeywords: true,
        keywords: merged,
      };
    });
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setConfig((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== kw),
    }));
  };

  // Presets
  const applyPreset = (presetKey: 'studio' | 'copyrightOnly' | 'photography') => {
    if (presetKey === 'studio') {
      setConfig((prev) => ({
        ...prev,
        updateCreator: true,
        creator: 'AeroBridge Creative Studio',
        updateCopyright: true,
        copyright: '© 2026 AeroBridge Studio. All rights reserved.',
        updateLocation: true,
        location: 'Praha, Česká republika',
        updateKeywords: true,
        keywordsMode: 'append',
        keywords: ['design', 'bauhaus', 'studio', 'portfolio'],
      }));
    } else if (presetKey === 'copyrightOnly') {
      setConfig((prev) => ({
        ...prev,
        updateCopyright: true,
        copyright: `© ${new Date().getFullYear()} AeroBridge Media. Všechna autorská práva vyhrazena.`,
      }));
    } else if (presetKey === 'photography') {
      setConfig((prev) => ({
        ...prev,
        updateCreator: true,
        creator: 'Merakio Photography',
        updateCopyright: true,
        copyright: `© ${new Date().getFullYear()} Merakio Lab. All rights reserved.`,
        updateLocation: true,
        location: 'Outdoor / Architektura',
        updateKeywords: true,
        keywordsMode: 'append',
        keywords: ['architektura', 'exteriér', 'fotografie', 'high-res'],
      }));
    }
  };

  const handleExecute = () => {
    const assetIds = selectedAssets.map((a) => a.id);
    onApplyBatchIptc(assetIds, config);
    onClose();
  };

  const activeUpdatesCount = [
    config.updateTitle,
    config.updateCaption,
    config.updateCreator,
    config.updateCopyright,
    config.updateLocation,
    config.updateKeywords,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#14161e] border border-white/10 rounded-none w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#171923]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider font-bold bg-[#ede8df] text-[#111317]">
                IPTC Editor
              </span>
              <h3 className="text-sm font-semibold text-white">
                Dávková úprava IPTC metadat ({selectedAssets.length} souborů)
              </h3>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Vyberte pole, která chcete změnit. Nezaškrtnutá pole zůstanou u souborů beze změny.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-none hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-2.5 bg-[#0e1017] border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 text-stone-400 shrink-0 font-medium text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-[#ede8df]" />
            <span>Rychlé šablony:</span>
          </div>
          <button
            type="button"
            onClick={() => applyPreset('studio')}
            className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 hover:text-white border border-white/10 rounded-none text-[11px] transition-colors whitespace-nowrap"
          >
            AeroBridge Studio 2026
          </button>
          <button
            type="button"
            onClick={() => applyPreset('copyrightOnly')}
            className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 hover:text-white border border-white/10 rounded-none text-[11px] transition-colors whitespace-nowrap"
          >
            Pouze Copyright 2026
          </button>
          <button
            type="button"
            onClick={() => applyPreset('photography')}
            className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 hover:text-white border border-white/10 rounded-none text-[11px] transition-colors whitespace-nowrap"
          >
            Fotografie & Architektura
          </button>
        </div>

        {/* Content Body: Split view (Form controls + Live Preview) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-white/[0.08]">
          {/* Form Editor Fields (7 cols) */}
          <div className="md:col-span-7 p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-170px)]">
            {/* 1. Titulek */}
            <div
              className={`p-3.5 border transition-all ${
                config.updateTitle
                  ? 'bg-white/[0.03] border-[#ede8df]/40'
                  : 'bg-black/20 border-white/[0.06] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                  <input
                    type="checkbox"
                    checked={config.updateTitle}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, updateTitle: e.target.checked }))
                    }
                    className="rounded-none border-stone-600 bg-stone-900 text-[#ede8df] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    Titulek (Title / Object Name)
                  </span>
                </label>
                <span className="text-[10px] text-stone-500 font-mono">IPTC: 2:05</span>
              </div>
              <input
                type="text"
                disabled={!config.updateTitle}
                value={config.title}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Zadejte společný titulek pro vybrané položky..."
                className="w-full bg-[#0a0c10] border border-white/10 rounded-none px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-hidden focus:border-[#ede8df] disabled:opacity-40"
              />
            </div>

            {/* 2. Popis / Popisek */}
            <div
              className={`p-3.5 border transition-all ${
                config.updateCaption
                  ? 'bg-white/[0.03] border-[#ede8df]/40'
                  : 'bg-black/20 border-white/[0.06] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                  <input
                    type="checkbox"
                    checked={config.updateCaption}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, updateCaption: e.target.checked }))
                    }
                    className="rounded-none border-stone-600 bg-stone-900 text-[#ede8df] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-stone-400" />
                    Popis / Anotace (Caption / Description)
                  </span>
                </label>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    disabled={!config.updateCaption}
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, captionMode: 'replace' }))
                    }
                    className={`px-2 py-0.5 rounded-none font-medium transition-colors ${
                      config.captionMode === 'replace'
                        ? 'bg-[#ede8df] text-[#111317]'
                        : 'text-stone-400 hover:text-white bg-white/5'
                    }`}
                  >
                    Nahradit
                  </button>
                  <button
                    type="button"
                    disabled={!config.updateCaption}
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, captionMode: 'append' }))
                    }
                    className={`px-2 py-0.5 rounded-none font-medium transition-colors ${
                      config.captionMode === 'append'
                        ? 'bg-[#ede8df] text-[#111317]'
                        : 'text-stone-400 hover:text-white bg-white/5'
                    }`}
                  >
                    Připojit na konec
                  </button>
                </div>
              </div>
              <textarea
                rows={2}
                disabled={!config.updateCaption}
                value={config.caption}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, caption: e.target.value }))
                }
                placeholder="Detailní textový popis obsahu..."
                className="w-full bg-[#0a0c10] border border-white/10 rounded-none px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-hidden focus:border-[#ede8df] disabled:opacity-40 resize-none"
              />
            </div>

            {/* 3. Tvůrce & Copyright (2 sloupce) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Autor */}
              <div
                className={`p-3.5 border transition-all ${
                  config.updateCreator
                    ? 'bg-white/[0.03] border-[#ede8df]/40'
                    : 'bg-black/20 border-white/[0.06] opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                    <input
                      type="checkbox"
                      checked={config.updateCreator}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          updateCreator: e.target.checked,
                        }))
                      }
                      className="rounded-none border-stone-600 bg-stone-900 text-[#ede8df] focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-stone-400" />
                      Autor / Fotograf
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!config.updateCreator}
                  value={config.creator}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, creator: e.target.value }))
                  }
                  placeholder="Jméno autora nebo ateliéru"
                  className="w-full bg-[#0a0c10] border border-white/10 rounded-none px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-hidden focus:border-[#ede8df] disabled:opacity-40"
                />
              </div>

              {/* Copyright */}
              <div
                className={`p-3.5 border transition-all ${
                  config.updateCopyright
                    ? 'bg-white/[0.03] border-[#ede8df]/40'
                    : 'bg-black/20 border-white/[0.06] opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                    <input
                      type="checkbox"
                      checked={config.updateCopyright}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          updateCopyright: e.target.checked,
                        }))
                      }
                      className="rounded-none border-stone-600 bg-stone-900 text-[#ede8df] focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-stone-400" />
                      Autorská práva
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!config.updateCopyright}
                  value={config.copyright}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, copyright: e.target.value }))
                  }
                  placeholder="© 2026 Studio. All rights reserved."
                  className="w-full bg-[#0a0c10] border border-white/10 rounded-none px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-hidden focus:border-[#ede8df] disabled:opacity-40"
                />
              </div>
            </div>

            {/* 4. Lokalita */}
            <div
              className={`p-3.5 border transition-all ${
                config.updateLocation
                  ? 'bg-white/[0.03] border-[#ede8df]/40'
                  : 'bg-black/20 border-white/[0.06] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                  <input
                    type="checkbox"
                    checked={config.updateLocation}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        updateLocation: e.target.checked,
                      }))
                    }
                    className="rounded-none border-stone-600 bg-stone-900 text-[#ede8df] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    Lokalita / Místo pořízení (Location)
                  </span>
                </label>
              </div>
              <input
                type="text"
                disabled={!config.updateLocation}
                value={config.location}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, location: e.target.value }))
                }
                placeholder="Město, země nebo název ateliéru..."
                className="w-full bg-[#0a0c10] border border-white/10 rounded-none px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-hidden focus:border-[#ede8df] disabled:opacity-40"
              />
            </div>

            {/* 5. Klíčová slova (Keywords Tag Manager) */}
            <div
              className={`p-3.5 border transition-all ${
                config.updateKeywords
                  ? 'bg-white/[0.03] border-[#ede8df]/40'
                  : 'bg-black/20 border-white/[0.06] opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-white">
                  <input
                    type="checkbox"
                    checked={config.updateKeywords}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        updateKeywords: e.target.checked,
                      }))
                    }
                    className="rounded-none border-stone-600 bg-stone-900 text-[#ede8df] focus:ring-0 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#ede8df]" />
                    Klíčová slova (Keywords)
                  </span>
                </label>

                {/* Keyword mode selection */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    disabled={!config.updateKeywords}
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, keywordsMode: 'append' }))
                    }
                    className={`px-2 py-0.5 rounded-none font-medium transition-colors ${
                      config.keywordsMode === 'append'
                        ? 'bg-[#ede8df] text-[#111317]'
                        : 'text-stone-400 hover:text-white bg-white/5'
                    }`}
                    title="Přidá slova k existujícím bez duplicit"
                  >
                    Sloučit (přidat)
                  </button>
                  <button
                    type="button"
                    disabled={!config.updateKeywords}
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, keywordsMode: 'replace' }))
                    }
                    className={`px-2 py-0.5 rounded-none font-medium transition-colors ${
                      config.keywordsMode === 'replace'
                        ? 'bg-[#ede8df] text-[#111317]'
                        : 'text-stone-400 hover:text-white bg-white/5'
                    }`}
                    title="Přepíše všechna klíčová slova těmito novými"
                  >
                    Přepsat vše
                  </button>
                  <button
                    type="button"
                    disabled={!config.updateKeywords}
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, keywordsMode: 'remove' }))
                    }
                    className={`px-2 py-0.5 rounded-none font-medium transition-colors ${
                      config.keywordsMode === 'remove'
                        ? 'bg-rose-500 text-white'
                        : 'text-stone-400 hover:text-white bg-white/5'
                    }`}
                    title="Odstraní tato slova ze všech vybraných souborů"
                  >
                    Odebrat tato
                  </button>
                </div>
              </div>

              {/* Tags Container */}
              <div className="min-h-[50px] p-2 bg-[#0a0c10] border border-white/10 rounded-none mb-2 flex flex-wrap gap-1.5 items-center">
                {config.keywords.map((kw) => (
                  <span
                    key={kw}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-xs font-mono border ${
                      config.keywordsMode === 'remove'
                        ? 'bg-rose-950/40 text-rose-200 border-rose-800/40'
                        : 'bg-white/[0.08] text-[#ede8df] border-white/10'
                    }`}
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                {config.keywords.length === 0 && (
                  <span className="text-[11px] text-stone-600 italic">
                    Žádná klíčová slova nebyla zadána. Zadejte slovo a stiskněte Enter nebo čárku.
                  </span>
                )}
              </div>

              {/* Keyword input */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  disabled={!config.updateKeywords}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddKeyword(keywordInput);
                    }
                  }}
                  placeholder="Přidat klíčové slovo (oddělujte čárkou nebo Enterem)..."
                  className="flex-1 bg-[#0a0c10] border border-white/10 rounded-none px-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-hidden focus:border-[#ede8df] disabled:opacity-40 font-mono"
                />
                <button
                  type="button"
                  disabled={!config.updateKeywords || !keywordInput.trim()}
                  onClick={() => handleAddKeyword(keywordInput)}
                  className="px-3 py-1.5 bg-[#ede8df] hover:bg-white text-[#111317] text-xs font-semibold rounded-none disabled:opacity-40 transition-colors"
                >
                  Přidat
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Target Preview (5 cols) */}
          <div className="md:col-span-5 p-5 bg-[#0b0d13] flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h4 className="text-xs font-semibold text-white tracking-wide uppercase font-mono">
                  Náhled aplikace na soubory
                </h4>
                <span className="text-[11px] text-stone-400 font-mono">
                  {selectedAssets.length} položek
                </span>
              </div>

              {/* Summary of what will be modified */}
              <div className="my-3 p-3 bg-white/[0.02] border border-white/[0.06] text-xs space-y-1.5">
                <div className="text-[11px] font-semibold text-stone-300">
                  {activeUpdatesCount > 0 ? (
                    <span className="text-[#ede8df]">
                      Bude modifikováno {activeUpdatesCount} IPTC polí:
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      Není zaškrtnuto žádné pole k úpravě
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                  {config.updateTitle && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-stone-200">
                      Titulek: "{config.title || '(prázdný)'}"
                    </span>
                  )}
                  {config.updateCaption && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-stone-200">
                      Popis ({config.captionMode === 'replace' ? 'přepsat' : 'připojit'})
                    </span>
                  )}
                  {config.updateCreator && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-stone-200">
                      Autor: {config.creator || '(prázdný)'}
                    </span>
                  )}
                  {config.updateCopyright && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-stone-200">
                      Copyright
                    </span>
                  )}
                  {config.updateLocation && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-stone-200">
                      Lokalita: {config.location || '(prázdný)'}
                    </span>
                  )}
                  {config.updateKeywords && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-stone-200">
                      Klíčová slova ({config.keywordsMode}): {config.keywords.length} slov
                    </span>
                  )}
                </div>
              </div>

              {/* List of target assets */}
              <div className="space-y-2 overflow-y-auto max-h-[calc(90vh-340px)] pr-1">
                {selectedAssets.map((asset) => {
                  return (
                    <div
                      key={asset.id}
                      className="p-2 bg-[#14161e] border border-white/[0.06] flex items-center gap-3 text-xs"
                    >
                      <img
                        src={asset.url}
                        alt=""
                        className="w-10 h-10 object-cover bg-black/60 rounded-none shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate text-[11px]">
                          {asset.name}
                        </div>
                        <div className="text-[10px] text-stone-400 truncate flex items-center gap-2 mt-0.5">
                          <span>
                            Stávající autor: {asset.iptc.creator || '(neuveden)'}
                          </span>
                          <span>•</span>
                          <span>{asset.iptc.keywords.length} klíčových slov</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.08] text-[11px] text-stone-500">
              Změny se okamžitě projeví v aplikaci a v metadatovém inspektoru pro všechny vybrané položky.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-[#171923]">
          <div className="text-xs text-stone-400">
            {activeUpdatesCount > 0 ? (
              <span>
                Připraveno k aplikaci na{' '}
                <strong className="text-white font-mono">{selectedAssets.length}</strong>{' '}
                {selectedAssets.length === 1 ? 'soubor' : 'souborů'}
              </span>
            ) : (
              <span className="text-stone-500">
                Zaškrtněte alespoň jedno pole, které chcete upravit
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white hover:bg-white/10 rounded-none transition-colors"
            >
              Zrušit
            </button>
            <button
              type="button"
              disabled={activeUpdatesCount === 0}
              onClick={handleExecute}
              className={`flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-none transition-all ${
                activeUpdatesCount > 0
                  ? 'bg-[#ede8df] hover:bg-white text-[#111317] shadow-lg cursor-pointer'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed opacity-50'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Použít IPTC metadata</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
