import React, { useState } from 'react';
import { AssetItem, BatchExportConfig } from '../types';
import { downloadAssetsAsZip } from '../utils/localFileSystem';
import { X, Download, Loader2 } from 'lucide-react';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: AssetItem[];
  onNotify: (title: string, desc?: string) => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onNotify,
}) => {
  const [config, setConfig] = useState<BatchExportConfig>({
    format: 'webp',
    quality: 0.85,
    resizeMode: 'original',
    targetSize: 1920,
    addWatermark: false,
    watermarkText: '© Studio Master',
  });
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || selectedAssets.length === 0) return null;

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      await downloadAssetsAsZip(
        selectedAssets,
        `AeroBridge_Export_${selectedAssets.length}_files.zip`,
        config
      );
      onNotify('Export dokončen', `Stáhnut balíček se ${selectedAssets.length} soubory`);
      onClose();
    } catch (e) {
      console.error('Export ZIP error:', e);
      onNotify('Chyba při exportu', 'Nepodařilo se vytvořit ZIP balíček');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#14161e] border border-white/10 rounded-none w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#171923]">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Hromadný export ({selectedAssets.length} souborů)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Rychlý offline export s kompresí a stažením v ZIP archivu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Cílový formát
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['webp', 'jpeg', 'png'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setConfig({ ...config, format: fmt })}
                  className={`py-2 px-3 rounded-full text-xs font-medium uppercase border transition-all ${
                    config.format === fmt
                      ? 'bg-[#ede8df] text-[#111317] border-[#ede8df] font-semibold shadow-xs'
                      : 'bg-[#0c0d12] text-slate-300 border-white/10 hover:border-white/20'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Kvalita komprese</span>
              <span className="font-mono text-[#ede8df]">
                {Math.round(config.quality * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={config.quality}
              onChange={(e) =>
                setConfig({ ...config, quality: parseFloat(e.target.value) })
              }
              className="w-full accent-[#ede8df] cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={config.addWatermark}
                onChange={(e) =>
                  setConfig({ ...config, addWatermark: e.target.checked })
                }
                className="rounded-none border-white/20 bg-black accent-[#ede8df] focus:ring-0"
              />
              <span>Přidat copyright vodoznak</span>
            </label>

            {config.addWatermark && (
              <input
                type="text"
                value={config.watermarkText}
                onChange={(e) =>
                  setConfig({ ...config, watermarkText: e.target.value })
                }
                className="w-full bg-[#0c0d12] border border-white/10 rounded-none px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-[#ede8df]"
                placeholder="Text vodoznaku..."
              />
            )}
          </div>

          <div className="p-3 bg-[#0c0d12] rounded-none border border-white/5 text-[11px] text-stone-400">
            Export probíhá přímo ve vašem prohlížeči v plné rychlosti CPU bez odesílání dat na jakýkoliv server.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 bg-[#11131a] border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleExportZip}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#ede8df] hover:bg-white text-[#111317] text-xs font-semibold transition-colors shadow-md disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Balím ZIP...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Stáhnout jako ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
