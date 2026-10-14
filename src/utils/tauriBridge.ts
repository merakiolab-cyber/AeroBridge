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
  } catch {
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
  } catch {
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
