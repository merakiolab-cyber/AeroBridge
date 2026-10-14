export type WorkspaceView = 'essentials' | 'filmstrip' | 'compare' | 'table';
export type AssetType = 'image' | 'raw' | 'vector' | 'document' | 'video' | 'adobe-psd' | 'adobe-ai' | 'adobe-indd' | 'adobe-ae' | 'adobe-pr' | 'pdf' | 'other';

export interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  colorProfile?: string;
  bitDepth?: string;
  resolutionDpi?: number;
  exposureCompensation?: string;
  whiteBalance?: string;
  software?: string;
}

export interface IptcData {
  title?: string;
  caption?: string;
  creator?: string;
  copyright?: string;
  keywords: string[];
  location?: string;
}

export interface AssetItem {
  id: string;
  name: string;
  folder: string;
  fullPath?: string;
  url: string;
  type: AssetType;
  category: 'image' | 'raw' | 'adobe-psd' | 'adobe-ai' | 'adobe-indd' | 'adobe-ae' | 'adobe-pr' | 'pdf' | 'video' | 'vector' | 'other';
  format: string;
  extension: string;
  colorBadge: string;
  size: number; // in bytes
  dimensions: {
    width: number;
    height: number;
  };
  duration?: number; // for videos (seconds)
  dateModified: string;
  dateCreated: string;
  rating?: number;
  label?: string;
  flag?: string; // deprecated
  exif: ExifData;
  iptc: IptcData;
  colorPalette?: string[];
  isCustomUploaded?: boolean;
  blob?: Blob;
  fileRef?: File;
}

export interface FilterState {
  searchQuery: string;
  formatFilter: string | null;
  orientationFilter: 'all' | 'landscape' | 'portrait' | 'square';
  keywordFilter: string | null;
}

export type SortField = 'name' | 'dateModified' | 'size' | 'extension' | 'dimensions';
export type SortOrder = 'asc' | 'desc';

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  itemCount: number;
  icon?: string;
  subfolders?: FolderNode[];
}

export interface BatchRenameConfig {
  prefix: string;
  includeDate: boolean;
  dateFormat: 'YYYYMMDD' | 'YYYY-MM-DD';
  includeSequence: boolean;
  sequenceStart: number;
  sequenceDigits: number;
  suffix: string;
  findText: string;
  replaceText: string;
  extensionCase: 'preserve' | 'lowercase' | 'uppercase';
}

export interface BatchExportConfig {
  format: 'jpeg' | 'png' | 'webp';
  quality: number;
  resizeMode: 'original' | 'width' | 'height' | 'fit';
  targetSize: number;
  addWatermark: boolean;
  watermarkText: string;
}

export interface BatchIptcConfig {
  updateTitle: boolean;
  title: string;
  updateCaption: boolean;
  captionMode: 'replace' | 'append';
  caption: string;
  updateCreator: boolean;
  creator: string;
  updateCopyright: boolean;
  copyright: string;
  updateLocation: boolean;
  location: string;
  updateKeywords: boolean;
  keywordsMode: 'append' | 'replace' | 'remove';
  keywords: string[];
}
