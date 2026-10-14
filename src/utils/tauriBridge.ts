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
 * Reads binary file data into a Uint8Array via Tauri IPC for native RAW / Adobe parsing.
 */
export async function readNativeFileBinary(filePath: string): Promise<Uint8Array> {
  if (!isDesktopApp()) throw new Error('Native binary reading requires desktop environment');
  const buffer = await invoke<number[]>('read_file_binary', { path: filePath });
  return new Uint8Array(buffer);
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
