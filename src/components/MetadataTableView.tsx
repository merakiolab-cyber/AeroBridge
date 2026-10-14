import React from 'react';
import { AssetItem, SortField, SortOrder } from '../types';
import { formatBytes, formatDate } from '../utils/localFileSystem';
import { Copy, FileText, ArrowUp, ArrowDown } from 'lucide-react';

interface MetadataTableViewProps {
  assets: AssetItem[];
  selectedIds: Set<string>;
  focusedId: string | null;
  sortField?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onOpenQuickLook: (id: string) => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
}

export const MetadataTableView: React.FC<MetadataTableViewProps> = ({
  assets,
  selectedIds,
  focusedId,
  sortField,
  sortOrder,
  onSort,
  onSelect,
  onOpenQuickLook,
  onCopyPath,
  onCopyImage,
}) => {
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#e2e4e9] inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#e2e4e9] inline ml-1" />
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090a0f] select-none overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-[#0e1015] border-b border-white/[0.06] text-[11px] font-semibold text-zinc-400 z-10 backdrop-blur-md">
            <tr>
              <th
                onClick={() => onSort?.('extension')}
                className="py-3 px-4 w-16 text-center cursor-pointer hover:text-white transition-colors"
              >
                Formát {renderSortIndicator('extension')}
              </th>
              <th
                onClick={() => onSort?.('name')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
              >
                Název souboru {renderSortIndicator('name')}
              </th>
              <th
                onClick={() => onSort?.('dimensions')}
                className="py-3 px-4 w-32 cursor-pointer hover:text-white transition-colors"
              >
                Rozměry {renderSortIndicator('dimensions')}
              </th>
              <th
                onClick={() => onSort?.('size')}
                className="py-3 px-4 w-28 text-right cursor-pointer hover:text-white transition-colors"
              >
                Velikost {renderSortIndicator('size')}
              </th>
              <th className="py-3 px-4 w-36">Barevný profil</th>
              <th
                onClick={() => onSort?.('dateModified')}
                className="py-3 px-4 w-40 cursor-pointer hover:text-white transition-colors"
              >
                Datum změny {renderSortIndicator('dateModified')}
              </th>
              <th className="py-3 px-4">Zařízení / Software</th>
              <th className="py-3 px-4 w-24 text-center">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {assets.map((asset) => {
              const isSelected = selectedIds.has(asset.id);
              const isFocused = focusedId === asset.id;
              return (
                <tr
                  key={asset.id}
                  onClick={(e) => onSelect(asset.id, e)}
                  onDoubleClick={() => onOpenQuickLook(asset.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#2a2c32] text-white border-l-4 border-l-[#e2e4e9] shadow-md font-medium'
                      : isFocused
                      ? 'bg-white/[0.06] text-white'
                      : 'hover:bg-white/[0.03] text-zinc-300'
                  }`}
                >
                  {/* Badge */}
                  <td className="py-2.5 px-4 text-center">
                    <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-widest text-white/90 bg-black/80 border border-white/10 rounded-none">
                      {asset.extension}
                    </span>
                  </td>

                  {/* File Name */}
                  <td className="py-2.5 px-4 font-medium text-white/95">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={asset.url}
                        alt=""
                        className="w-7 h-7 object-cover rounded-none shrink-0 bg-black/40"
                      />
                      <span className="truncate max-w-sm">{asset.name}</span>
                    </div>
                  </td>

                  {/* Dimensions */}
                  <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400 tabular-nums">
                    {asset.dimensions.width > 0
                      ? `${asset.dimensions.width} × ${asset.dimensions.height}`
                      : 'N/A'}
                  </td>

                  {/* Size */}
                  <td className="py-2.5 px-4 font-mono text-[11px] text-right text-zinc-300 tabular-nums">
                    {formatBytes(asset.size)}
                  </td>

                  {/* Color Profile */}
                  <td className="py-2.5 px-4 font-mono text-[11px] text-[#e2e4e9] truncate">
                    {asset.exif.colorProfile || 'sRGB'}
                  </td>

                  {/* Date Modified */}
                  <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400 tabular-nums">
                    {formatDate(asset.dateModified)}
                  </td>

                  {/* Camera / Software */}
                  <td className="py-2.5 px-4 text-[11px] text-zinc-400 truncate max-w-xs">
                    {asset.exif.camera || asset.exif.software || asset.format}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyImage(asset);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                        title="Kopírovat obrázek do schránky (Ctrl+C)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyPath(asset);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                        title="Kopírovat cestu"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
