/**
 * AeroBridge Studio — Tauri v2 Native Desktop Bridge
 * Seamless integration with Windows 11 filesystem, native dialogs, and Explorer.
 * Works seamlessly both in native desktop (Tauri) and web browser (fallback).
 */

import { isTauri, invoke, convertFileSrc } from '@tauri-apps/api/core';

export interface NativeFileEntry {
  name: string;
  path: string;
  size: u64number;
  is_dir: boolean;
  modified_ms: number;
  extension: string;
}

type u64number = number;

/**
 * Returns true if the application is running inside the native Tauri Windows desktop wrapper.
 */
export function isDesktopApp(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/**
 * Opens the native Windows 11 common folder dialog without browser permission popups.
 */
export async function pickNativeFolder(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  try {
    const selected = await invoke<string | null>('pick_folder_native');
    return selected;
  } catch (err) {
    console.warn('[TauriBridge] Native folder pick failed:', err);
    return null;
  }
}

/**
 * Scans a folder directly via high-speed Rust std::fs with native Windows performance.
 */
export async function scanNativeFolder(dirPath: string): Promise<NativeFileEntry[]> {
  if (!isDesktopApp()) return [];
  try {
    return await invoke<NativeFileEntry[]>('scan_folder_native', { path: dirPath });
  } catch (err) {
    console.error('[TauriBridge] Error scanning native folder:', err);
    throw err;
  }
}

/**
 * Reads (the head of) a file as an ArrayBuffer through Tauri's binary IPC channel.
 */
export async function readNativeFileBinary(filePath: string, maxBytes?: number): Promise<ArrayBuffer> {
  if (!isDesktopApp()) throw new Error('Native binary reading requires desktop environment');
  const res = await invoke<ArrayBuffer>('read_file_binary', {
    path: filePath,
    maxBytes: maxBytes ?? null,
  });
  return res instanceof ArrayBuffer ? res : new Uint8Array(res as unknown as number[]).buffer;
}

export interface NativePlace {
  name: string;
  path: string;
}

/** Lists available drives (C:\, D:\, ...). */
export async function listNativeDrives(): Promise<NativePlace[]> {
  if (!isDesktopApp()) return [];
  try {
    return await invoke<NativePlace[]>('list_drives');
  } catch (err) {
    console.warn('[TauriBridge] list_drives failed:', err);
    return [];
  }
}

/** Quick access folders: Desktop, Documents, Downloads, Pictures, ... */
export async function listNativePlaces(): Promise<NativePlace[]> {
  if (!isDesktopApp()) return [];
  try {
    return await invoke<NativePlace[]>('get_user_places');
  } catch (err) {
    console.warn('[TauriBridge] get_user_places failed:', err);
    return [];
  }
}

/** Lists only subdirectories of a folder (for lazy tree expansion). */
export async function listNativeSubdirs(dirPath: string): Promise<NativeFileEntry[]> {
  if (!isDesktopApp()) return [];
  try {
    return await invoke<NativeFileEntry[]>('list_subdirs', { path: dirPath });
  } catch (err) {
    console.debug('[TauriBridge] list_subdirs failed for:', dirPath, err);
    return [];
  }
}

/**
 * Extracts the embedded XMP JPEG preview (InDesign / Illustrator / Photoshop) in Rust.
 * Returns a data URL or null.
 */
export async function extractNativeXmpThumbnail(filePath: string, maxScanMb: number): Promise<string | null> {
  if (!isDesktopApp()) return null;
  try {
    const b64 = await invoke<string | null>('extract_xmp_thumbnail', {
      path: filePath,
      maxScanMb,
    });
    return b64 ? `data:image/jpeg;base64,${b64}` : null;
  } catch (err) {
    console.debug('[TauriBridge] extractNativeXmpThumbnail failed for:', filePath, err);
    return null;
  }
}


const iconCache = new Map<string, Promise<string | null>>();
const iconUrlCache = new Map<string, string>();

/**
 * Returns a cached blob URL for a file extension immediately if already loaded.
 */
export function getCachedNativeFileIcon(ext: string, isDir = false): string | null {
  const key = isDir ? '<dir>' : ext.toLowerCase().replace(/^\./, '');
  return iconUrlCache.get(key) || null;
}

/**
 * Checks whether a given URL belongs to the shared icon cache (and thus shouldn't be revoked).
 */
export function isSharedIconUrl(url: string): boolean {
  for (const cached of iconUrlCache.values()) {
    if (cached === url) return true;
  }
  return false;
}

/**
 * Returns a blob URL with the native Windows shell icon (same as in Explorer)
 * for a file extension (e.g. "docx") or a folder. Cached per extension.
 */
export function getNativeFileIcon(ext: string, isDir = false): Promise<string | null> {
  if (!isDesktopApp()) return Promise.resolve(null);
  const key = isDir ? '<dir>' : ext.toLowerCase().replace(/^\./, '');
  const cached = iconUrlCache.get(key);
  if (cached) return Promise.resolve(cached);

  let p = iconCache.get(key);
  if (!p) {
    p = invoke<ArrayBuffer>('get_file_icon', { ext: isDir ? '' : key, isDir })
      .then((res) => {
        const bytes = res instanceof ArrayBuffer ? new Uint8Array(res) : new Uint8Array(res as unknown as number[]);
        if (!bytes || bytes.length === 0) return null;
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
        iconUrlCache.set(key, url);
        return url;
      })
      .catch(() => null);
    iconCache.set(key, p);
  }
  return p;
}

/**
 * Extracts Windows shell thumbnail via IShellItemImageFactory.
 * Used for formats with registered Windows thumbnail handlers (like Corel Painter .rif, CDR, etc.).
 */
export async function getNativeShellThumbnail(filePath: string, size = 512): Promise<string | null> {
  if (!isDesktopApp()) return null;
  try {
    const res = await invoke<ArrayBuffer>('get_shell_thumbnail', { path: filePath, size });
    const bytes = res instanceof ArrayBuffer ? new Uint8Array(res) : new Uint8Array(res as unknown as number[]);
    if (!bytes || bytes.length === 0) return null;
    return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  } catch (err) {
    console.debug('[TauriBridge] getNativeShellThumbnail failed for:', filePath, err);
    return null;
  }
}

/**
 * Reveals a file or folder in Windows File Explorer (equivalent to Right Click -> Show in Explorer).
 */
export async function revealInWindowsExplorer(filePath: string): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    await invoke('reveal_in_explorer', { path: filePath });
  } catch (err) {
    console.warn('[TauriBridge] Error revealing in explorer:', err);
  }
}

/**
 * Opens a file with its default Windows application (Photoshop, Word, Video Player, etc.)
 */
export async function openFileNative(filePath: string): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    await invoke('open_file_native', { path: filePath });
  } catch (err) {
    console.error('[TauriBridge] Error opening file:', err);
    throw err;
  }
}

/**
 * Opens a terminal (Windows Terminal, PowerShell, CMD) in the specified folder or file's parent folder.
 */
export async function openTerminalNative(folderOrFilePath: string): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    await invoke('open_terminal_native', { path: folderOrFilePath });
  } catch (err) {
    console.error('[TauriBridge] Error opening terminal:', err);
    throw err;
  }
}

/**
 * Renames a file or folder on the local filesystem. Returns new absolute path.
 */
export async function renameFileNative(oldPath: string, newName: string): Promise<string> {
  if (!isDesktopApp()) throw new Error('Native rename requires desktop app');
  return await invoke<string>('rename_file_native', { oldPath, newName });
}

/**
 * Creates a new directory in parentPath.
 */
export async function createFolderNative(parentPath: string, suggestedName?: string): Promise<string> {
  if (!isDesktopApp()) throw new Error('Native create folder requires desktop app');
  return await invoke<string>('create_folder_native', { parentPath, suggestedName: suggestedName ?? null });
}

/**
 * Moves files or directories to the Windows Recycle Bin (Koš).
 */
export async function deleteFilesNative(paths: string[]): Promise<void> {
  if (!isDesktopApp() || paths.length === 0) return;
  await invoke('delete_files_native', { paths });
}

/**
 * Copies source files/directories into destFolder.
 */
export async function copyFilesNative(sources: string[], destFolder: string): Promise<string[]> {
  if (!isDesktopApp() || sources.length === 0) return [];
  return await invoke<string[]>('copy_files_native', { sources, destFolder });
}

/**
 * Moves (cuts) source files/directories into destFolder.
 */
export async function moveFilesNative(sources: string[], destFolder: string): Promise<string[]> {
  if (!isDesktopApp() || sources.length === 0) return [];
  return await invoke<string[]>('move_files_native', { sources, destFolder });
}

/**
 * Opens the native Windows File Properties dialog.
 */
export async function showFilePropertiesNative(filePath: string): Promise<void> {
  if (!isDesktopApp()) return;
  try {
    await invoke('show_file_properties_native', { path: filePath });
  } catch (err) {
    console.warn('[TauriBridge] Error showing properties:', err);
  }
}

/**
 * Converts a Windows absolute file path into a safe WebView2 asset URL for <img>, <video>, and canvas.
 */
export function toDesktopAssetUrl(filePath: string): string {
  if (!isDesktopApp()) return filePath;
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

export interface FolderSizeInfo {
  total_bytes: number;
  file_count: number;
  folder_count: number;
}

const folderSizeCache = new Map<string, Promise<FolderSizeInfo | null>>();

/**
 * Calculates real folder size recursively (bytes, files count, subfolders count).
 * Cached per directory path.
 */
export function getNativeFolderSize(dirPath: string): Promise<FolderSizeInfo | null> {
  if (!isDesktopApp()) return Promise.resolve(null);
  let p = folderSizeCache.get(dirPath);
  if (!p) {
    p = invoke<FolderSizeInfo>('get_folder_size', { path: dirPath }).catch((err) => {
      console.warn('[TauriBridge] Failed to get folder size for', dirPath, err);
      return null;
    });
    folderSizeCache.set(dirPath, p);
  }
  return p;
}


