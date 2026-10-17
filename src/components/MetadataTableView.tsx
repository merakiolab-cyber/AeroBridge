import React, { useRef, useEffect } from 'react';
import { AssetItem, SortField, SortOrder } from '../types';
import { formatBytes, formatDate } from '../utils/localFileSystem';
import { Copy, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { getNativeFileIcon, toDesktopAssetUrl } from '../utils/tauriBridge';
import { getResolutionInfo } from '../utils/extractors';
import { Win11Folder } from './Win11Icons';
import { FileTypeBadge } from './AppIcons';

interface MetadataTableViewProps {
  assets: AssetItem[];
  selectedIds: Set<string>;
  focusedId: string | null;
  sortField?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onOpenQuickLook: (id: string) => void;
  onOpenAsset?: (asset: AssetItem) => void;
  onCopyPath: (asset: AssetItem) => void;
  onCopyImage: (asset: AssetItem) => void;
  onContextMenu?: (e: React.MouseEvent, asset?: AssetItem) => void;
  thumbnailSize?: number;
  onThumbnailSizeChange?: (size: number) => void;
  fitMode?: 'cover' | 'contain';
}

const directImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico', 'avif'];

export const MetadataTableView: React.FC<MetadataTableViewProps> = ({
  assets,
  selectedIds,
  focusedId,
  sortField,
  sortOrder,
  onSort,
  onSelect,
  onOpenQuickLook,
  onOpenAsset,
  onCopyPath,
  onCopyImage,
  onContextMenu,
  thumbnailSize = 190,
  onThumbnailSizeChange,
  fitMode = 'cover',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Map thumbnailSize (100 - 460) smoothly to table row thumbnail size (28px - 110px)
  const thumbPx = Math.max(
    28,
    Math.min(120, Math.round(28 + ((thumbnailSize - 100) / 360) * 82))
  );

  const cellPaddingClass =
    thumbPx <= 36 ? 'py-2' : thumbPx <= 54 ? 'py-2.5' : thumbPx <= 80 ? 'py-3' : 'py-3.5';

  // Ctrl + Mouse Wheel scales list thumbnails smoothly
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onThumbnailSizeChange) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 25 : -25;
        const newSize = Math.min(Math.max(thumbnailSize + step, 100), 460);
        onThumbnailSizeChange(newSize);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [thumbnailSize, onThumbnailSizeChange]);

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#e2e4e9] inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#e2e4e9] inline ml-1" />
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-[#090a0f] select-none overflow-hidden"
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, undefined);
      }}
    >
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-[#0e1015] border-b border-white/[0.06] text-[11px] font-semibold text-zinc-400 z-10 backdrop-blur-md">
            <tr>
              <th
                onClick={() => onSort?.('extension')}
                className="py-3 px-4 w-16 text-center cursor-pointer hover:text-white transition-colors align-middle"
              >
                Formát {renderSortIndicator('extension')}
              </th>
              <th
                onClick={() => onSort?.('name')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors align-middle"
              >
                Název souboru {renderSortIndicator('name')}
              </th>
              <th
                onClick={() => onSort?.('dimensions')}
                className="py-3 px-4 w-36 cursor-pointer hover:text-white transition-colors align-middle"
              >
                Rozměry & Rozlišení {renderSortIndicator('dimensions')}
              </th>
              <th
                onClick={() => onSort?.('size')}
                className="py-3 px-4 w-28 text-right cursor-pointer hover:text-white transition-colors align-middle"
              >
                Velikost {renderSortIndicator('size')}
              </th>
              <th className="py-3 px-4 w-36 align-middle">Barevný profil</th>
              <th
                onClick={() => onSort?.('dateModified')}
                className="py-3 px-4 w-40 cursor-pointer hover:text-white transition-colors align-middle"
              >
                Datum změny {renderSortIndicator('dateModified')}
              </th>
              <th className="py-3 px-4 align-middle">Zařízení / Software</th>
              <th className="py-3 px-4 w-24 text-center align-middle">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {assets.map((asset) => {
              const isSelected = selectedIds.has(asset.id);
              const isFocused = focusedId === asset.id;
              const ext = (asset.extension || '').toLowerCase().replace(/^\./, '');
              const isDirect = directImageExtensions.includes(ext);
              const resolvedSrc = isDirect && asset.fullPath ? toDesktopAssetUrl(asset.fullPath) : asset.url;

              return (
                <tr
                  key={asset.id}
                  onClick={(e) => onSelect(asset.id, e)}
                  onDoubleClick={() => {
                    if (onOpenAsset) {
                      onOpenAsset(asset);
                    } else {
                      onOpenQuickLook(asset.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onContextMenu?.(e, asset);
                  }}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#282d38] text-white shadow-sm font-medium'
                      : isFocused
                      ? 'bg-white/[0.06] text-white'
                      : 'hover:bg-white/[0.03] text-zinc-300'
                  }`}
                >
                  {/* Badge */}
                  <td className={`${cellPaddingClass} px-4 text-center align-middle`}>
                    {asset.isFolder ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 bg-amber-500/15 rounded-md shadow-sm border border-amber-500/20">
                        SLOŽKA
                      </span>
                    ) : (
                      <div className="flex items-center justify-center">
                        <FileTypeBadge
                          extension={asset.extension}
                          size={18}
                          badgeClassName="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wide text-white/90 bg-black/60 rounded-md shadow-sm"
                        />
                      </div>
                    )}
                  </td>

                  {/* File Name with scalable thumbnail */}
                  <td className={`${cellPaddingClass} px-4 font-medium text-white/95 align-middle`}>
                    <div className="flex items-center gap-3">
                      {asset.isFolder ? (
                        <div
                          style={{ width: `${thumbPx}px`, height: `${thumbPx}px` }}
                          className="flex items-center justify-center shrink-0 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                        >
                          <div
                            style={{
                              width: `${Math.round(thumbPx * 0.72)}px`,
                              height: `${Math.round(thumbPx * 0.72)}px`,
                            }}
                          >
                            <Win11Folder className="w-full h-full drop-shadow-sm" />
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{ width: `${thumbPx}px`, height: `${thumbPx}px` }}
                          className="flex items-center justify-center shrink-0 rounded-lg overflow-hidden bg-black/40 border border-white/[0.06] shadow-xs"
                        >
                          <img
                            src={resolvedSrc}
                            alt=""
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              getNativeFileIcon(asset.extension, false).then((icon) => {
                                if (icon && target.src !== icon) {
                                  target.src = icon;
                                  target.className = "w-full h-full object-contain p-1";
                                }
                              });
                            }}
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              if (img.naturalWidth > 0 && (!asset.dimensions || asset.dimensions.width === 0)) {
                                asset.dimensions = {
                                  width: img.naturalWidth,
                                  height: img.naturalHeight,
                                };
                              }
                            }}
                            className={`w-full h-full ${
                              asset.isIcon || !resolvedSrc || fitMode === 'contain'
                                ? 'object-contain p-0.5'
                                : 'object-cover'
                            } transition-transform duration-150`}
                          />
                        </div>
                      )}
                      <span className="truncate max-w-sm lg:max-w-md xl:max-w-xl text-xs">{asset.name}</span>
                    </div>
                  </td>

                  {/* Dimensions & Resolution */}
                  <td className={`${cellPaddingClass} px-4 font-mono text-[11px] tabular-nums align-middle`}>
                    {asset.dimensions.width > 0 ? (
                      <div>
                        <span className="text-zinc-300 font-medium block">
                          {asset.dimensions.width} × {asset.dimensions.height}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {(() => {
                            const res = getResolutionInfo(asset.dimensions.width, asset.dimensions.height, asset.exif?.resolutionDpi);
                            return `${res.megapixelsFormatted}${res.standard ? ` · ${res.standard}` : ''}`;
                          })()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>

                  {/* Size */}
                  <td className={`${cellPaddingClass} px-4 font-mono text-[11px] text-right text-zinc-300 tabular-nums align-middle`}>
                    {asset.isFolder ? (asset.size > 0 ? formatBytes(asset.size) : '—') : formatBytes(asset.size)}
                  </td>

                  {/* Color Profile */}
                  <td className={`${cellPaddingClass} px-4 font-mono text-[11px] text-[#e2e4e9] truncate align-middle`}>
                    {asset.exif.colorProfile || 'sRGB'}
                  </td>

                  {/* Date Modified */}
                  <td className={`${cellPaddingClass} px-4 font-mono text-[11px] text-zinc-400 tabular-nums align-middle`}>
                    {formatDate(asset.dateModified)}
                  </td>

                  {/* Camera / Software */}
                  <td className={`${cellPaddingClass} px-4 text-[11px] text-zinc-400 truncate max-w-xs align-middle`}>
                    {asset.exif.camera || asset.exif.software || asset.format}
                  </td>

                  {/* Actions */}
                  <td className={`${cellPaddingClass} px-4 text-center align-middle`}>
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
