import React, { useState } from 'react';
import { AssetItem, BatchRenameConfig } from '../types';
import { sanitizeFilename } from '../utils/localFileSystem';
import { X, Check, RefreshCw } from 'lucide-react';

interface BatchRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: AssetItem[];
  onApplyRename: (renamedMap: Record<string, string>) => void;
}

export const BatchRenameModal: React.FC<BatchRenameModalProps> = ({
  isOpen,
  onClose,
  selectedAssets,
  onApplyRename,
}) => {
  const [config, setConfig] = useState<BatchRenameConfig>({
    prefix: 'PROJECT_',
    includeDate: true,
    dateFormat: 'YYYYMMDD',
    includeSequence: true,
    sequenceStart: 1,
    sequenceDigits: 3,
    suffix: '',
    findText: '',
    replaceText: '',
    extensionCase: 'preserve',
  });

  if (!isOpen || selectedAssets.length === 0) return null;

  // Compute live preview of renamed files
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const previewList = selectedAssets.map((asset, index) => {
    const parts = asset.name.split('.');
    const ext = parts.length > 1 ? parts.pop()! : '';
    let base = parts.join('.');

    // Find & replace
    if (config.findText) {
      base = base.split(config.findText).join(config.replaceText);
    }

    let newName = '';
    if (config.prefix) newName += config.prefix;
    if (config.includeDate) newName += `${dateStr}_`;
    newName += base;
    if (config.suffix) newName += config.suffix;
    if (config.includeSequence) {
      const seqNum = config.sequenceStart + index;
      const seqStr = String(seqNum).padStart(config.sequenceDigits, '0');
      newName += `_${seqStr}`;
    }

    let finalExt = ext;
    if (config.extensionCase === 'lowercase') finalExt = ext.toLowerCase();
    if (config.extensionCase === 'uppercase') finalExt = ext.toUpperCase();

    const rawFullName = finalExt ? `${newName}.${finalExt}` : newName;
    const finalFullName = sanitizeFilename(rawFullName);
    return { id: asset.id, oldName: asset.name, newName: finalFullName };
  });

  const handleExecute = () => {
    const renameMap: Record<string, string> = {};
    previewList.forEach((item) => {
      renameMap[item.id] = item.newName;
    });
    onApplyRename(renameMap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#14161e] border border-white/10 rounded-none w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#171923]">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Hromadné přejmenování ({selectedAssets.length} souborů)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Definujte šablonu názvu a zkontrolujte náhled před provedením
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

        {/* Form Controls */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Předpona (Prefix)
              </label>
              <input
                type="text"
                value={config.prefix}
                onChange={(e) => setConfig({ ...config, prefix: e.target.value })}
                className="w-full bg-[#0c0d12] border border-white/10 rounded-none px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-[#ede8df]"
                placeholder="např. EDITORIAL_"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Přípona (Suffix)
              </label>
              <input
                type="text"
                value={config.suffix}
                onChange={(e) => setConfig({ ...config, suffix: e.target.value })}
                className="w-full bg-[#0c0d12] border border-white/10 rounded-none px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-[#ede8df]"
                placeholder="např. _FINAL"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Najít text
              </label>
              <input
                type="text"
                value={config.findText}
                onChange={(e) => setConfig({ ...config, findText: e.target.value })}
                className="w-full bg-[#0c0d12] border border-white/10 rounded-none px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-[#ede8df]"
                placeholder="Text k nahrazení..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nahradit textem
              </label>
              <input
                type="text"
                value={config.replaceText}
                onChange={(e) => setConfig({ ...config, replaceText: e.target.value })}
                className="w-full bg-[#0c0d12] border border-white/10 rounded-none px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-[#ede8df]"
                placeholder="Nový text..."
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeDate}
                onChange={(e) => setConfig({ ...config, includeDate: e.target.checked })}
                className="rounded-none border-white/20 bg-black accent-[#ede8df] focus:ring-0"
              />
              <span>Vložit datum ({dateStr})</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.includeSequence}
                onChange={(e) => setConfig({ ...config, includeSequence: e.target.checked })}
                className="rounded-none border-white/20 bg-black accent-[#ede8df] focus:ring-0"
              />
              <span>Číslování (001, 002...)</span>
            </label>
          </div>

          {/* Live Preview List */}
          <div className="pt-2">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Živý náhled změn názvů ({previewList.length}):
            </div>
            <div className="bg-[#0b0c11] border border-white/10 rounded-none max-h-48 overflow-y-auto divide-y divide-white/5 font-mono text-[11px]">
              {previewList.map((item) => (
                <div key={item.id} className="p-2 flex items-center justify-between">
                  <span className="text-slate-400 truncate max-w-[45%]">
                    {item.oldName}
                  </span>
                  <span className="text-slate-500 px-2">→</span>
                  <span className="text-[#ede8df] font-medium truncate max-w-[45%]">
                    {item.newName}
                  </span>
                </div>
              ))}
            </div>
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
            onClick={handleExecute}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#ede8df] hover:bg-white text-[#111317] text-xs font-semibold transition-colors shadow-md"
          >
            <Check className="w-3.5 h-3.5 text-[#111317]" />
            <span>Přejmenovat soubory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
