import React from 'react';
import { AssetItem } from '../types';
import { formatBytes } from '../utils/localFileSystem';
import { ZoomableCanvas } from './ZoomableCanvas';
import { Copy, Maximize2, FileText } from 'lucide-react';

interface CompareViewProps {
  assets: AssetItem[];
  selectedIds: Set<string>;
  onOpenQuickLook: (id: string) => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  assets,
  selectedIds,
  onOpenQuickLook,
  onCopyPath,
  onCopyImage,
}) => {
  const compareAssets =
    selectedIds.size >= 2
      ? assets.filter((a) => selectedIds.has(a.id)).slice(0, 4)
      : assets.slice(0, 2);

  if (compareAssets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#090a0f] text-slate-500 text-xs">
        Vyberte alespoň 2 soubory pro porovnání
      </div>
    );
  }

  const gridColsClass =
    compareAssets.length === 2
      ? 'grid-cols-2'
      : compareAssets.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090a0f] select-none p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-slate-400">
          Porovnání <span className="text-white font-medium">{compareAssets.length} souborů</span> vedle sebe (Light Table)
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Kolečkem myši můžete zoomovat a kontrolovat ostrost detailů
        </div>
      </div>

      <div className={`grid ${gridColsClass} gap-5 flex-1 min-h-0`}>
        {compareAssets.map((asset) => (
          <div
            key={asset.id}
            className="flex flex-col bg-[#101218] rounded-none border border-white/[0.08] overflow-hidden shadow-xl"
          >
            {/* Header info */}
            <div className="p-3.5 bg-[#14161f] border-b border-white/[0.06] flex items-center justify-between">
              <div className="truncate flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-widest text-white/90 rounded-none bg-black/80 border border-white/10">
                  {asset.extension}
                </span>
                <span className="text-xs font-medium text-white truncate" title={asset.name}>
                  {asset.name}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onCopyImage(asset)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title="Kopírovat obrázek do schránky (Ctrl+C)"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onCopyPath(asset)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title="Kopírovat cestu k souboru"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenQuickLook(asset.id)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                  title="Otevřít celoobrazovkový náhled"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas with wheel zoom */}
            <div className="flex-1 bg-[#06070a] relative overflow-hidden">
              <ZoomableCanvas
                src={asset.url}
                alt={asset.name}
                enableOverlayControls={false}
              />
            </div>

            {/* Bottom Meta */}
            <div className="p-3 bg-[#12141c] border-t border-white/[0.06] flex items-center justify-between text-xs">
              <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                <span>{formatBytes(asset.size)}</span>
                <span className="mx-1.5">·</span>
                <span>{asset.dimensions.width} × {asset.dimensions.height}</span>
              </div>
              <span className="text-[11px] text-[#ede8df] font-mono font-medium">
                {asset.exif.colorProfile || 'sRGB IEC61966-2.1'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
