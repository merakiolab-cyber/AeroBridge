import React, { useState } from 'react';
import { AssetItem } from '../types';
import { formatBytes, formatDate } from '../utils/localFileSystem';
import {
  Copy,
  Maximize2,
  FileText,
  Download,
  Camera,
  Layers,
  Tag,
  FolderOpen,
} from 'lucide-react';

interface PreviewInspectorProps {
  asset: AssetItem | null;
  selectedCount?: number;
  onOpenQuickLook: () => void;
  onCopyPath: () => void;
  onCopyImage: () => void;
  onDownload: () => void;
  onRevealInExplorer?: () => void;
  onUpdateKeywords?: (keywords: string[]) => void;
  onOpenBatchIptc?: () => void;
}

export const PreviewInspector: React.FC<PreviewInspectorProps> = ({
  asset,
  selectedCount = 1,
  onOpenQuickLook,
  onCopyPath,
  onCopyImage,
  onDownload,
  onRevealInExplorer,
  onUpdateKeywords,
  onOpenBatchIptc,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata'>('preview');
  const [newKeyword, setNewKeyword] = useState('');

  if (!asset) {
    return (
      <aside className="w-[440px] bg-[#181715] border-l border-white/[0.06] flex flex-col h-full shrink-0 items-center justify-center p-6 text-center text-stone-500 select-none">
        <Layers className="w-8 h-8 mb-2 opacity-40 text-stone-400" />
        <p className="text-xs">Vyberte soubor pro zobrazení detailu</p>
      </aside>
    );
  }

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !onUpdateKeywords) return;
    const trimmed = newKeyword.trim().toLowerCase();
    if (!asset.iptc.keywords.includes(trimmed)) {
      onUpdateKeywords([...asset.iptc.keywords, trimmed]);
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw: string) => {
    if (!onUpdateKeywords) return;
    onUpdateKeywords(asset.iptc.keywords.filter((k) => k !== kw));
  };

  return (
    <aside className="w-[440px] bg-[#181715] border-l border-white/[0.06] flex flex-col h-full shrink-0 select-none overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center border-b border-white/[0.06] bg-[#141311] px-3 pt-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-none border-b-2 transition-all ${
            activeTab === 'preview'
              ? 'bg-[#181715] border-[#ede8df] text-[#f5f2ea]'
              : 'border-transparent text-stone-400 hover:text-white'
          }`}
        >
          Náhled
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('metadata')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-none border-b-2 transition-all ${
            activeTab === 'metadata'
              ? 'bg-[#181715] border-[#ede8df] text-[#f5f2ea]'
              : 'border-transparent text-stone-400 hover:text-white'
          }`}
        >
          Podrobnosti & EXIF
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' ? (
          <div className="p-4 space-y-4">
            {/* High-Res Preview Canvas (Enlarged by >25%) */}
            <div
              className="relative bg-[#0f0e0d] rounded-none border border-white/[0.08] overflow-hidden flex items-center justify-center min-h-[350px] max-h-[500px] cursor-pointer group shadow-xl"
              onClick={onOpenQuickLook}
            >
              <img
                src={asset.url}
                alt={asset.name}
                referrerPolicy="no-referrer"
                className="max-h-[460px] w-auto max-w-full object-contain p-2 rounded-none transition-transform duration-200 group-hover:scale-101"
              />

              {/* Quick Look Fullscreen Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenQuickLook();
                }}
                className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black text-white text-xs backdrop-blur-md opacity-80 hover:opacity-100 transition-all shadow-lg"
                title="Celoobrazovkový náhled se zoomem (Mezerník)"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#ede8df]" />
              </button>

              <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-widest text-white/90 rounded-none bg-black/80 backdrop-blur-md border border-white/15">
                {asset.extension}
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className={`grid ${onRevealInExplorer ? 'grid-cols-4 gap-1.5' : 'grid-cols-3 gap-2'}`}>
              <button
                type="button"
                onClick={onCopyImage}
                className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 rounded-full text-xs transition-all border border-white/[0.06]"
                title="Kopírovat obrázek do schránky (Ctrl+C)"
              >
                <Copy className="w-3.5 h-3.5 text-[#ede8df]" />
                <span className="truncate">Kopírovat</span>
              </button>
              <button
                type="button"
                onClick={onCopyPath}
                className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 rounded-full text-xs transition-all border border-white/[0.06]"
                title="Kopírovat cestu k souboru"
              >
                <FileText className="w-3.5 h-3.5 text-stone-300" />
                <span className="truncate">Cesta</span>
              </button>
              {onRevealInExplorer && (
                <button
                  type="button"
                  onClick={onRevealInExplorer}
                  className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 rounded-full text-xs transition-all border border-white/[0.06]"
                  title="Otevřít a označit soubor v Průzkumníku Windows"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="truncate">Složka</span>
                </button>
              )}
              <button
                type="button"
                onClick={onDownload}
                className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-stone-200 rounded-full text-xs transition-all border border-white/[0.06]"
                title="Stáhnout kopii souboru"
              >
                <Download className="w-3.5 h-3.5 text-stone-300" />
                <span className="truncate">Uložit</span>
              </button>
            </div>

            {/* Quick File Summary Card — Bauhaus Rectilinear Card in Warm Neutral Gray */}
            <div className="bg-[#1e1d1a] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
              <div className="font-semibold text-white break-all leading-snug">
                {asset.name}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] pt-1 border-t border-white/[0.06]">
                <div>
                  <span className="block text-stone-400 mb-0.5">Velikost:</span>
                  <span className="text-stone-300 font-mono tabular-nums">
                    {formatBytes(asset.size)}
                  </span>
                </div>
                <div>
                  <span className="block text-stone-400 mb-0.5">Rozměry:</span>
                  <span className="text-stone-300 font-mono tabular-nums">
                    {asset.dimensions.width > 0
                      ? `${asset.dimensions.width} × ${asset.dimensions.height}`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-stone-400 mb-0.5">Formát:</span>
                  <span className="text-stone-300">{asset.format}</span>
                </div>
                <div>
                  <span className="block text-stone-400 mb-0.5">Barevný profil:</span>
                  <span className="text-[#ede8df] font-mono font-medium">
                    {asset.exif.colorProfile || 'sRGB IEC61966-2.1'}
                  </span>
                </div>
                <div>
                  <span className="block text-stone-400 mb-0.5">Bitová hloubka:</span>
                  <span className="text-stone-300 font-mono text-[10px]">
                    {asset.exif.bitDepth || '8-bit'}
                  </span>
                </div>
                <div>
                  <span className="block text-stone-400 mb-0.5">Změněno:</span>
                  <span className="text-stone-300 font-mono tabular-nums text-[10px]">
                    {formatDate(asset.dateModified)}
                  </span>
                </div>
              </div>

              {asset.fullPath && (
                <div className="pt-2 border-t border-white/[0.06] text-[10px] text-stone-400 break-all font-mono">
                  {asset.fullPath}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Details & EXIF Tab */
          <div className="p-4 space-y-4">
            {/* Camera Specs */}
            <div className="bg-[#1e1d1a] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Camera className="w-4 h-4 text-[#ede8df]" />
                <span>Hardware / Software</span>
              </div>

              <div className="space-y-2 text-[11px] pt-1">
                {asset.exif.camera && (
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-stone-400">Tělo:</span>
                    <span className="text-stone-200 font-medium text-right">
                      {asset.exif.camera}
                    </span>
                  </div>
                )}
                {asset.exif.lens && (
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-stone-400">Objektiv:</span>
                    <span className="text-stone-200 font-medium text-right">
                      {asset.exif.lens}
                    </span>
                  </div>
                )}
                {asset.exif.software && (
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-stone-400">Software:</span>
                    <span className="text-stone-200 font-medium text-right">
                      {asset.exif.software}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                  {asset.exif.focalLength && (
                    <div>
                      <span className="text-stone-400 block">Ohnisko:</span>
                      <span className="text-stone-300">{asset.exif.focalLength}</span>
                    </div>
                  )}
                  {asset.exif.aperture && (
                    <div>
                      <span className="text-stone-400 block">Clona:</span>
                      <span className="text-stone-300">{asset.exif.aperture}</span>
                    </div>
                  )}
                  {asset.exif.shutterSpeed && (
                    <div>
                      <span className="text-stone-400 block">Závěrka:</span>
                      <span className="text-stone-300">{asset.exif.shutterSpeed}</span>
                    </div>
                  )}
                  {asset.exif.iso && (
                    <div>
                      <span className="text-stone-400 block">ISO:</span>
                      <span className="text-stone-300">{asset.exif.iso}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* IPTC / Description */}
            <div className="bg-[#1e1d1a] rounded-none p-4 border border-white/[0.06] space-y-2 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white block">
                  Popis & Autor (IPTC)
                </span>
                {onOpenBatchIptc && (
                  <button
                    type="button"
                    onClick={onOpenBatchIptc}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-[#ede8df] transition-colors"
                  >
                    <Tag className="w-2.5 h-2.5 text-emerald-300" />
                    <span>{selectedCount > 1 ? `Upravit (${selectedCount})` : 'Upravit IPTC'}</span>
                  </button>
                )}
              </div>
              {asset.iptc.title && (
                <div>
                  <span className="text-[10px] text-stone-400 block">Název:</span>
                  <span className="text-stone-300">{asset.iptc.title}</span>
                </div>
              )}
              {asset.iptc.creator && (
                <div>
                  <span className="text-[10px] text-stone-400 block">Autor:</span>
                  <span className="text-stone-300">{asset.iptc.creator}</span>
                </div>
              )}
              {asset.iptc.copyright && (
                <div>
                  <span className="text-[10px] text-stone-400 block">Copyright:</span>
                  <span className="text-stone-300 text-[11px] font-mono">{asset.iptc.copyright}</span>
                </div>
              )}
            </div>

            {/* Keywords Tag Manager */}
            <div className="bg-[#1e1d1a] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
              <span className="font-semibold text-white block">
                Klíčová slova
              </span>

              <div className="flex flex-wrap gap-1.5">
                {asset.iptc.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-white/[0.05] text-stone-300 border border-white/[0.06]"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="hover:text-rose-400 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Keyword Form */}
              <form onSubmit={handleAddKeyword} className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Přidat klíčové slovo..."
                  className="flex-1 bg-[#141311] border border-white/[0.08] rounded-none px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-hidden focus:border-[#ede8df]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#ede8df] hover:bg-white text-[#111317] text-xs rounded-full transition-colors font-semibold"
                >
                  +
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
