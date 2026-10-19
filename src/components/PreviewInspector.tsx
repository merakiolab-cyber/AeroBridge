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
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { isVisualAsset } from '../utils/adobeThumbnailExtractor';
import { getPdfDocInfo, renderPdfPage } from '../utils/pdfPreview';
import { getNativeFolderSize, getNativeFileIcon, toDesktopAssetUrl, type FolderSizeInfo } from '../utils/tauriBridge';
import { getResolutionInfo } from '../utils/extractors';
import { useHiResPreview, previewReflectsDocumentSize } from '../utils/hiResPreview';
import { Win11Folder } from './Win11Icons';
import { FileTypeBadge } from './AppIcons';

interface PreviewInspectorProps {
  asset: AssetItem | null;
  width?: number;
  selectedCount?: number;
  onOpenQuickLook: () => void;
  onCopyPath: () => void;
  onCopyImage: () => void;
  onDownload: () => void;
  onRevealInExplorer?: () => void;
  onOpenFile?: (asset: AssetItem) => void;
  onUpdateKeywords?: (keywords: string[]) => void;
  onOpenBatchIptc?: () => void;
  onOpenFolder?: (path: string) => void;
  onPageChange?: (assetId: string, pageNum: number, url: string) => void;
}

export const PreviewInspector: React.FC<PreviewInspectorProps> = ({
  asset,
  width = 440,
  selectedCount = 1,
  onOpenQuickLook,
  onCopyPath,
  onCopyImage,
  onDownload,
  onRevealInExplorer,
  onOpenFile,
  onUpdateKeywords,
  onOpenBatchIptc,
  onOpenFolder,
  onPageChange,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata'>('preview');
  const [newKeyword, setNewKeyword] = useState('');

  const isPdf = !!asset && (
    asset.category === 'pdf' ||
    asset.extension.toLowerCase() === 'pdf' ||
    asset.format.toLowerCase().includes('pdf') ||
    (asset.extension.toLowerCase() === 'ai' && (asset.pageCount || 1) > 1) ||
    ((asset.extension.toLowerCase() === 'tif' || asset.extension.toLowerCase() === 'tiff') && (asset.pageCount || 1) > 1)
  );

  const [pdfPage, setPdfPage] = useState<number>(asset?.currentPage || 1);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(asset?.pageCount || 1);
  const [previewUrl, setPreviewUrl] = useState<string>(asset?.url || '');
  // The inspector pane is ~400 px wide; 1200 px keeps it sharp on high-DPI screens without a heavy decode
  const hiResRaw = useHiResPreview(asset, 1200);
  // Never let a page-1 rendition shadow a page the user navigated to
  const hiRes = asset && pdfPage !== (asset.currentPage || 1) ? null : hiResRaw;
  const [isPageRendering, setIsPageRendering] = useState(false);
  const [folderSize, setFolderSize] = useState<FolderSizeInfo | null>(null);
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);

  React.useEffect(() => {
    if (!asset || !asset.isFolder || !asset.fullPath) {
      setFolderSize(null);
      setIsCalculatingSize(false);
      return;
    }

    let active = true;
    setIsCalculatingSize(true);
    getNativeFolderSize(asset.fullPath).then((info) => {
      if (!active) return;
      setFolderSize(info);
      setIsCalculatingSize(false);
    });

    return () => {
      active = false;
    };
  }, [asset?.id, asset?.isFolder, asset?.fullPath]);

  const [hasImgError, setHasImgError] = useState(false);
  const [fallbackIcon, setFallbackIcon] = useState<string | null>(null);
  const [renderedDimensions, setRenderedDimensions] = useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    if (!asset) return;
    setPdfPage(asset.currentPage || 1);
    const ext = asset.extension ? asset.extension.toLowerCase().replace(/^\./, '') : '';
    const isDirect = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'].includes(ext);
    const fullResUrl = isDirect && asset.fullPath ? toDesktopAssetUrl(asset.fullPath) : asset.url;
    setPreviewUrl(fullResUrl);
    setHasImgError(false);
    setFallbackIcon(null);
    setRenderedDimensions(null);

    if (isPdf) {
      getPdfDocInfo(asset).then((info) => {
        if (info && info.numPages) {
          setPdfTotalPages(info.numPages);
        }
      });
    }

    if (asset.isIcon || !asset.url) {
      getNativeFileIcon(asset.extension, !!asset.isFolder).then((icon) => {
        if (icon) setFallbackIcon(icon);
      });
    }
  }, [asset?.id, asset?.url, asset?.isIcon, asset?.extension, isPdf]);

  const handleImgError = () => {
    if (hasImgError || !asset) return;
    setHasImgError(true);
    getNativeFileIcon(asset.extension, !!asset.isFolder).then((icon) => {
      if (icon) setFallbackIcon(icon);
    });
  };

  const goToPdfPage = async (page: number) => {
    if (!asset || !isPdf || page < 1 || page > pdfTotalPages || isPageRendering) return;
    setIsPageRendering(true);
    setPdfPage(page);
    try {
      const res = await renderPdfPage(asset, page, 1000);
      if (res) {
        setPreviewUrl(res.url);
        onPageChange?.(asset.id, page, res.url);
      }
    } finally {
      setIsPageRendering(false);
    }
  };

  if (!asset) {
    return (
      <aside
        style={{ width: `${width}px` }}
        className="bg-[#16171a] border-l border-white/[0.06] flex flex-col h-full shrink-0 items-center justify-center p-6 text-center text-zinc-500 select-none"
      >
        <Layers className="w-8 h-8 mb-2 opacity-40 text-zinc-400" />
        <p className="text-xs">Vyberte soubor pro zobrazení detailu</p>
      </aside>
    );
  }

  const previewMaxHeight = Math.max(350, Math.min(850, Math.round(width * 1.05)));

  const activeWidth = asset.dimensions.width > 0
    ? asset.dimensions.width
    : (renderedDimensions?.width || 0);
  const activeHeight = asset.dimensions.height > 0
    ? asset.dimensions.height
    : (renderedDimensions?.height || 0);
  const resInfo = activeWidth > 0
    ? getResolutionInfo(activeWidth, activeHeight, asset.exif?.resolutionDpi)
    : null;

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
    <aside
      style={{ width: `${width}px` }}
      className="bg-[#16171a] border-l border-white/[0.06] flex flex-col h-full shrink-0 select-none overflow-hidden"
    >
      {/* Header Tabs */}
      <div className="flex items-center bg-[#131418] p-3">
        <div className="flex items-center bg-[#1a1b22] p-1 rounded-xl w-full">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'preview'
                ? 'bg-[#292c37] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Náhled
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'metadata'
                ? 'bg-[#292c37] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Podrobnosti & EXIF
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' ? (
          <div className="p-4 space-y-4">
            {asset.isFolder ? (
              <div className="relative bg-[#121318] rounded-2xl overflow-hidden flex flex-col items-center justify-center min-h-[300px] p-6 shadow-md">
                <div className="w-20 h-20 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
                  <Win11Folder className="w-14 h-14 drop-shadow-md" isOpen={true} />
                </div>
                <h4 className="text-sm font-semibold text-white truncate max-w-xs">{asset.name}</h4>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  {folderSize !== null
                    ? `${formatBytes(folderSize.total_bytes)} · ${folderSize.file_count} ${
                        folderSize.file_count === 1 ? 'položka' : folderSize.file_count < 5 ? 'položky' : 'položek'
                      }`
                    : isCalculatingSize
                    ? 'Počítám velikost…'
                    : asset.size > 0
                    ? formatBytes(asset.size)
                    : 'Složka souborů'}
                </p>
                {onOpenFolder && asset.fullPath && (
                  <button
                    type="button"
                    onClick={() => onOpenFolder(asset.fullPath!)}
                    className="mt-4 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-full transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Otevřít složku (Enter)
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div
                  style={{ maxHeight: `${previewMaxHeight}px` }}
                  className={`relative bg-[#0f1014] rounded-2xl overflow-hidden flex items-center justify-center min-h-[300px] cursor-pointer group shadow-lg ${
                    asset.extension.toLowerCase() === 'svg' ? 'bg-checkerboard' : ''
                  }`}
                  onClick={() => {
                    if (!isVisualAsset(asset) && onOpenFile) {
                      onOpenFile(asset);
                    } else {
                      onOpenQuickLook();
                    }
                  }}
                >
                  {asset.isIcon || hasImgError || !previewUrl ? (
                    <div className="flex flex-col items-center justify-center p-8 select-none">
                      {fallbackIcon || (previewUrl && !hasImgError) ? (
                        <img
                          src={fallbackIcon || previewUrl}
                          alt={asset.name}
                          draggable={false}
                          className="w-24 h-24 object-contain drop-shadow-2xl mb-3"
                          onError={handleImgError}
                        />
                      ) : null}
                      <span className="text-xs text-zinc-400 font-mono font-medium">
                        {asset.format || asset.extension}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={hiRes ?? previewUrl}
                      alt={asset.name}
                      referrerPolicy="no-referrer"
                      onError={handleImgError}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        // A downsampled hi-res rendition must not overwrite the asset's real dimensions
                        if (!hiRes && previewReflectsDocumentSize(asset) && img.naturalWidth > 0) {
                          if (asset.dimensions.width !== img.naturalWidth || asset.dimensions.height !== img.naturalHeight) {
                            asset.dimensions = {
                              width: img.naturalWidth,
                              height: img.naturalHeight,
                            };
                          }
                          setRenderedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                        }
                      }}
                      style={{ maxHeight: `${previewMaxHeight - 20}px` }}
                      className="w-auto max-w-full object-contain p-2 rounded-none transition-transform duration-200 group-hover:scale-101"
                    />
                  )}

                  {/* Quick Look Fullscreen / Open Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isVisualAsset(asset) && onOpenFile) {
                        onOpenFile(asset);
                      } else {
                        onOpenQuickLook();
                      }
                    }}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black text-white text-xs backdrop-blur-md opacity-80 hover:opacity-100 transition-all shadow-lg"
                    title={!isVisualAsset(asset) ? "Otevřít ve výchozí aplikaci (Enter)" : "Celoobrazovkový náhled se zoomem (Mezerník)"}
                  >
                    {!isVisualAsset(asset) ? (
                      <ExternalLink className="w-3.5 h-3.5 text-[#e2e4e9]" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5 text-[#e2e4e9]" />
                    )}
                  </button>

                  <div className="absolute top-2 left-2 pointer-events-none">
                    <FileTypeBadge
                      extension={asset.extension}
                      size={20}
                      badgeClassName="px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-widest text-white/90 rounded-none bg-black/80 backdrop-blur-md border border-white/15"
                    />
                  </div>
                </div>

                {/* PDF Multi-Page Scrubber Toolbar in Inspector */}
                {isPdf && pdfTotalPages > 1 && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between px-3 py-2 bg-[#141518] border border-white/10 rounded-none text-xs select-none"
                  >
                    <button
                      type="button"
                      disabled={pdfPage <= 1 || isPageRendering}
                      onClick={() => goToPdfPage(pdfPage - 1)}
                      className="p-1 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Předchozí stránka PDF"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                      {isPageRendering ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#e2e4e9] animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-[#e2e4e9]" />
                      )}
                      <span>Stránka</span>
                      <span className="font-bold text-white px-2 py-0.5 bg-black/60 border border-white/15">
                        {pdfPage}
                      </span>
                      <span className="text-zinc-500">z</span>
                      <span className="font-semibold text-white">{pdfTotalPages}</span>
                    </div>

                    <button
                      type="button"
                      disabled={pdfPage >= pdfTotalPages || isPageRendering}
                      onClick={() => goToPdfPage(pdfPage + 1)}
                      className="p-1 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      title="Další stránka PDF"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Primary Open in Default App Button */}
                {onOpenFile && (
                  <button
                    type="button"
                    onClick={() => onOpenFile(asset)}
                    className="w-full py-2.5 px-3 bg-[#e2e4e9] hover:bg-white text-[#111215] font-semibold text-xs rounded-full flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                    title="Otevřít soubor v jeho výchozí aplikaci (Enter)"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Otevřít ve výchozí aplikaci (Enter)</span>
                  </button>
                )}
              </div>
            )}

            {/* Action Buttons Row */}
            <div className={`grid ${onRevealInExplorer ? 'grid-cols-4 gap-1.5' : 'grid-cols-3 gap-2'}`}>
              <button
                type="button"
                onClick={onCopyImage}
                className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 rounded-full text-xs transition-all border border-white/[0.06]"
                title="Kopírovat obrázek do schránky (Ctrl+C)"
              >
                <Copy className="w-3.5 h-3.5 text-[#e2e4e9]" />
                <span className="truncate">Kopírovat</span>
              </button>
              <button
                type="button"
                onClick={onCopyPath}
                className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 rounded-full text-xs transition-all border border-white/[0.06]"
                title="Kopírovat cestu k souboru"
              >
                <FileText className="w-3.5 h-3.5 text-zinc-300" />
                <span className="truncate">Cesta</span>
              </button>
              {onRevealInExplorer && (
                <button
                  type="button"
                  onClick={onRevealInExplorer}
                  className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 rounded-full text-xs transition-all border border-white/[0.06]"
                  title="Otevřít a označit soubor v Průzkumníku Windows"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="truncate">Složka</span>
                </button>
              )}
              <button
                type="button"
                onClick={onDownload}
                className="flex items-center justify-center gap-1.5 py-2 px-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 rounded-full text-xs transition-all border border-white/[0.06]"
                title="Stáhnout kopii souboru"
              >
                <Download className="w-3.5 h-3.5 text-zinc-300" />
                <span className="truncate">Uložit</span>
              </button>
            </div>

            {/* Quick File Summary Card — Bauhaus Rectilinear Card in Warm Neutral Gray */}
            <div className="bg-[#1e2024] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
              <div className="font-semibold text-white break-all leading-snug">
                {asset.name}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] pt-1 border-t border-white/[0.06]">
                <div>
                  <span className="block text-zinc-400 mb-0.5">Velikost:</span>
                  <span className="text-zinc-300 font-mono tabular-nums">
                    {asset.isFolder
                      ? folderSize !== null
                        ? `${formatBytes(folderSize.total_bytes)} (${folderSize.file_count} ${
                            folderSize.file_count === 1 ? 'položka' : folderSize.file_count < 5 ? 'položky' : 'položek'
                          })`
                        : isCalculatingSize
                        ? 'Počítám…'
                        : asset.size > 0
                        ? formatBytes(asset.size)
                        : 'Složka'
                      : formatBytes(asset.size)}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-0.5">
                    {asset.isFolder ? 'Obsah složky:' : 'Rozměry:'}
                  </span>
                  <span className="text-zinc-300 font-mono tabular-nums">
                    {asset.isFolder
                      ? folderSize !== null
                        ? `${folderSize.file_count} souborů, ${folderSize.folder_count} podsložek`
                        : isCalculatingSize
                        ? 'Zjišťuji…'
                        : 'Složka souborů'
                      : activeWidth > 0
                      ? `${activeWidth} × ${activeHeight} px`
                      : '—'}
                  </span>
                </div>
                {!asset.isFolder && (
                  <div>
                    <span className="block text-zinc-400 mb-0.5">Rozlišení:</span>
                    <span className="text-[#e2e4e9] font-mono tabular-nums font-medium">
                      {resInfo ? resInfo.fullText : '—'}
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-zinc-400 mb-0.5">Formát:</span>
                  <span className="text-zinc-300">{asset.format}</span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-0.5">Barevný profil:</span>
                  <span className="text-[#e2e4e9] font-mono font-medium">
                    {asset.exif.colorProfile || 'sRGB IEC61966-2.1'}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-0.5">Bitová hloubka:</span>
                  <span className="text-zinc-300 font-mono text-[10px]">
                    {asset.exif.bitDepth || '8-bit'}
                  </span>
                </div>
                <div>
                  <span className="block text-zinc-400 mb-0.5">Změněno:</span>
                  <span className="text-zinc-300 font-mono tabular-nums text-[10px]">
                    {formatDate(asset.dateModified)}
                  </span>
                </div>
              </div>

              {asset.fullPath && (
                <div
                  onClick={onRevealInExplorer}
                  className="pt-2 border-t border-white/[0.06] text-[10px] text-zinc-400 hover:text-white break-all font-mono cursor-pointer transition-colors flex items-center gap-1.5 group"
                  title="Kliknutím otevřete a označte soubor v Průzkumníku Windows"
                >
                  <FolderOpen className="w-3 h-3 text-zinc-500 group-hover:text-emerald-300 shrink-0" />
                  <span className="group-hover:underline underline-offset-2">{asset.fullPath}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Details & EXIF Tab */
          <div className="p-4 space-y-4">
            {/* Resolution & Dimensions Specs Card */}
            {!asset.isFolder && activeWidth > 0 && (
              <div className="bg-[#1e2024] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Maximize2 className="w-4 h-4 text-[#e2e4e9]" />
                  <span>Rozlišení & Rozměry</span>
                </div>
                <div className="space-y-2 text-[11px] pt-1">
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-zinc-400">Rozměry (Š × V):</span>
                    <span className="text-zinc-200 font-mono font-medium text-right">
                      {activeWidth} × {activeHeight} px
                    </span>
                  </div>
                  {resInfo && (
                    <>
                      <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                        <span className="text-zinc-400">Celkové rozlišení:</span>
                        <span className="text-zinc-200 font-mono font-medium text-right">
                          {resInfo.megapixelsFormatted} ({Math.round(activeWidth * activeHeight).toLocaleString()} px)
                        </span>
                      </div>
                      {resInfo.standard && (
                        <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                          <span className="text-zinc-400">Standard zobrazení:</span>
                          <span className="text-[#e2e4e9] font-medium text-right">
                            {resInfo.standard}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                        <span className="text-zinc-400">Hustota pixelů (DPI):</span>
                        <span className="text-zinc-200 font-mono font-medium text-right">
                          {resInfo.dpi ? `${resInfo.dpi} DPI` : (asset.exif.resolutionDpi ? `${asset.exif.resolutionDpi} DPI` : '72 DPI (výchozí)')}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                        <span className="text-zinc-400">Poměr stran:</span>
                        <span className="text-zinc-200 font-mono font-medium text-right">
                          {(() => {
                            const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
                            const divisor = gcd(activeWidth, activeHeight);
                            const rW = activeWidth / divisor;
                            const rH = activeHeight / divisor;
                            if (rW <= 21 && rH <= 21) {
                              return `${rW}:${rH} (${(activeWidth / activeHeight).toFixed(2)}:1)`;
                            }
                            return `${(activeWidth / activeHeight).toFixed(2)}:1`;
                          })()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Camera Specs */}
            <div className="bg-[#1e2024] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Camera className="w-4 h-4 text-[#e2e4e9]" />
                <span>Hardware / Software</span>
              </div>

              <div className="space-y-2 text-[11px] pt-1">
                {asset.exif.camera && (
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-zinc-400">Tělo:</span>
                    <span className="text-zinc-200 font-medium text-right">
                      {asset.exif.camera}
                    </span>
                  </div>
                )}
                {asset.exif.lens && (
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-zinc-400">Objektiv:</span>
                    <span className="text-zinc-200 font-medium text-right">
                      {asset.exif.lens}
                    </span>
                  </div>
                )}
                {asset.exif.software && (
                  <div className="flex justify-between py-0.5 border-b border-white/[0.04]">
                    <span className="text-zinc-400">Software:</span>
                    <span className="text-zinc-200 font-medium text-right">
                      {asset.exif.software}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                  {asset.exif.focalLength && (
                    <div>
                      <span className="text-zinc-400 block">Ohnisko:</span>
                      <span className="text-zinc-300">{asset.exif.focalLength}</span>
                    </div>
                  )}
                  {asset.exif.aperture && (
                    <div>
                      <span className="text-zinc-400 block">Clona:</span>
                      <span className="text-zinc-300">{asset.exif.aperture}</span>
                    </div>
                  )}
                  {asset.exif.shutterSpeed && (
                    <div>
                      <span className="text-zinc-400 block">Závěrka:</span>
                      <span className="text-zinc-300">{asset.exif.shutterSpeed}</span>
                    </div>
                  )}
                  {asset.exif.iso && (
                    <div>
                      <span className="text-zinc-400 block">ISO:</span>
                      <span className="text-zinc-300">{asset.exif.iso}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* IPTC / Description */}
            <div className="bg-[#1e2024] rounded-none p-4 border border-white/[0.06] space-y-2 text-xs shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white block">
                  Popis & Autor (IPTC)
                </span>
                {onOpenBatchIptc && (
                  <button
                    type="button"
                    onClick={onOpenBatchIptc}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-[#e2e4e9] transition-colors"
                  >
                    <Tag className="w-2.5 h-2.5 text-emerald-300" />
                    <span>{selectedCount > 1 ? `Upravit (${selectedCount})` : 'Upravit IPTC'}</span>
                  </button>
                )}
              </div>
              {asset.iptc.title && (
                <div>
                  <span className="text-[10px] text-zinc-400 block">Název:</span>
                  <span className="text-zinc-300">{asset.iptc.title}</span>
                </div>
              )}
              {asset.iptc.creator && (
                <div>
                  <span className="text-[10px] text-zinc-400 block">Autor:</span>
                  <span className="text-zinc-300">{asset.iptc.creator}</span>
                </div>
              )}
              {asset.iptc.copyright && (
                <div>
                  <span className="text-[10px] text-zinc-400 block">Copyright:</span>
                  <span className="text-zinc-300 text-[11px] font-mono">{asset.iptc.copyright}</span>
                </div>
              )}
            </div>

            {/* Keywords Tag Manager */}
            <div className="bg-[#1e2024] rounded-none p-4 border border-white/[0.06] space-y-3 text-xs shadow-sm">
              <span className="font-semibold text-white block">
                Klíčová slova
              </span>

              <div className="flex flex-wrap gap-1.5">
                {asset.iptc.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-white/[0.05] text-zinc-300 border border-white/[0.06]"
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
                  className="flex-1 bg-[#131416] border border-white/[0.08] rounded-none px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-[#e2e4e9]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#e2e4e9] hover:bg-white text-[#111215] text-xs rounded-full transition-colors font-semibold"
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
