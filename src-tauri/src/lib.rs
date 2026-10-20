mod icons;
mod pty;

use pty::{pty_spawn, pty_write, pty_resize, pty_kill, PtyManager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NativeFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified_ms: u64,
    pub extension: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NativePlace {
    pub name: String,
    pub path: String,
}

/// Windows: hidden (0x2) or system (0x4) attribute. Explorer hides these by default.
#[cfg(windows)]
fn is_hidden_or_system(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    meta.file_attributes() & 0x6 != 0
}

#[cfg(not(windows))]
fn is_hidden_or_system(_meta: &fs::Metadata) -> bool {
    false
}

#[tauri::command]
fn pick_folder_native() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Vyberte složku médií — AeroBridge Studio")
        .pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

/// Lists available drive roots (C:\, D:\, ...).
#[tauri::command]
fn list_drives() -> Vec<NativePlace> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Storage::FileSystem::{GetLogicalDrives, GetDriveTypeW, FILE_FLAGS_AND_ATTRIBUTES};
        use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_DISPLAYNAME};

        let mut drives = Vec::new();
        let mask = unsafe { GetLogicalDrives() };

        for i in 0..26 {
            if (mask & (1 << i)) == 0 {
                continue;
            }
            let letter = (b'A' + i as u8) as char;
            let root = format!("{}:\\", letter);
            let wide: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();

            let drive_type = unsafe { GetDriveTypeW(PCWSTR(wide.as_ptr())) };
            // 0 = DRIVE_UNKNOWN, 1 = DRIVE_NO_ROOT_DIR
            if drive_type <= 1 {
                continue;
            }

            let mut sfi = SHFILEINFOW::default();
            let res = unsafe {
                SHGetFileInfoW(
                    PCWSTR(wide.as_ptr()),
                    FILE_FLAGS_AND_ATTRIBUTES(0),
                    Some(&mut sfi),
                    std::mem::size_of::<SHFILEINFOW>() as u32,
                    SHGFI_DISPLAYNAME,
                )
            };

            let mut display_name = String::new();
            if res != 0 {
                let end = sfi.szDisplayName.iter().position(|&c| c == 0).unwrap_or(sfi.szDisplayName.len());
                display_name = String::from_utf16_lossy(&sfi.szDisplayName[..end]).trim().to_string();
            }

            // Fallback to GetVolumeInformationW if SHGetFileInfoW had no label
            if display_name.is_empty() {
                let mut vol_name = [0u16; 261];
                let r = unsafe {
                    windows::Win32::Storage::FileSystem::GetVolumeInformationW(
                        PCWSTR(wide.as_ptr()),
                        Some(&mut vol_name),
                        None,
                        None,
                        None,
                        None,
                    )
                };
                if r.is_ok() {
                    let end = vol_name.iter().position(|&c| c == 0).unwrap_or(vol_name.len());
                    let name_str = String::from_utf16_lossy(&vol_name[..end]).trim().to_string();
                    if !name_str.is_empty() {
                        display_name = format!("{} ({}:)", name_str, letter);
                    }
                }
            }

            // Final fallback
            if display_name.is_empty() {
                display_name = format!("Místní disk ({}:)", letter);
            }

            drives.push(NativePlace {
                name: display_name,
                path: root,
            });
        }
        drives
    }
    #[cfg(not(target_os = "windows"))]
    {
        vec![NativePlace {
            name: "/".to_string(),
            path: "/".to_string(),
        }]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_drives_exec() {
        let drives = list_drives();
        println!("Found {} drives: {:?}", drives.len(), drives);
        assert!(!drives.is_empty());
    }

    #[test]
    fn test_open_file_native() {
        let temp = std::env::temp_dir();
        assert!(temp.exists());
    }

    #[test]
    fn test_extract_embedded_jpeg() {
        let path = r#"F:\Airmed - bannery vystavy facelift\LED_stolek_vystavy_100x100cm_v01.indd"#;
        if std::path::Path::new(path).exists() {
            let res = extract_embedded_jpeg_blocking(path, 8192, 128 * 1024 * 1024);
            println!("test_extract_embedded_jpeg 1: is_some={}, len={}", res.is_some(), res.as_ref().map(|v| v.len()).unwrap_or(0));
            assert!(res.is_some());
            let b = res.unwrap();
            assert_eq!(b[0], 0xFF);
            assert_eq!(b[1], 0xD8);
            assert_eq!(b[b.len() - 2], 0xFF);
            assert_eq!(b[b.len() - 1], 0xD9);
        }

        let path2 = r#"F:\AC_Mining Operations_letak_DL\AC_Mining Operations_DL_skladacka_105x210_v01.indd"#;
        if std::path::Path::new(path2).exists() {
            let res2 = extract_embedded_jpeg_blocking(path2, 8192, 128 * 1024 * 1024);
            println!("test_extract_embedded_jpeg 2: is_some={}, len={}", res2.is_some(), res2.as_ref().map(|v| v.len()).unwrap_or(0));
            assert!(res2.is_some());
            let b = res2.unwrap();
            assert_eq!(b[0], 0xFF);
            assert_eq!(b[1], 0xD8);
            assert_eq!(b[b.len() - 2], 0xFF);
            assert_eq!(b[b.len() - 1], 0xD9);
        }
    }
}

/// Quick-access places (Desktop, Documents, Pictures, ...) using OS known folders.
#[tauri::command]
fn get_user_places(app: tauri::AppHandle) -> Vec<NativePlace> {
    let resolver = app.path();
    let candidates: Vec<(&str, Result<std::path::PathBuf, tauri::Error>)> = vec![
        ("Plocha", resolver.desktop_dir()),
        ("Stažené soubory", resolver.download_dir()),
        ("Obrázky", resolver.picture_dir()),
    ];
    candidates
        .into_iter()
        .filter_map(|(name, res)| {
            res.ok().and_then(|p| {
                if p.exists() {
                    Some(NativePlace {
                        name: name.to_string(),
                        path: p.to_string_lossy().to_string(),
                    })
                } else {
                    None
                }
            })
        })
        .collect()
}

fn scan_dir_blocking(path: String, dirs_only: bool) -> Result<Vec<NativeFileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err("Zadaná cesta neexistuje nebo není složkou".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| format!("Chyba při čtení složky: {}", e))?;

    for entry_res in read_dir {
        let Ok(entry) = entry_res else { continue };
        let Ok(metadata) = entry.metadata() else { continue };
        if is_hidden_or_system(&metadata) {
            continue;
        }
        let is_dir = metadata.is_dir();
        if dirs_only && !is_dir {
            continue;
        }
        let size = metadata.len();
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let file_name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path();
        let extension = entry_path
            .extension()
            .map(|ext| ext.to_string_lossy().to_string().to_lowercase())
            .unwrap_or_default();

        entries.push(NativeFileEntry {
            name: file_name,
            path: entry_path.to_string_lossy().to_string(),
            size,
            is_dir,
            modified_ms,
            extension: if is_dir { String::new() } else { extension },
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
async fn scan_folder_native(path: String) -> Result<Vec<NativeFileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_dir_blocking(path, false))
        .await
        .map_err(|e| e.to_string())?
}

/// Only subdirectories (used for lazy-expanding the folder tree).
#[tauri::command]
async fn list_subdirs(path: String) -> Result<Vec<NativeFileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_dir_blocking(path, true))
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FolderSizeInfo {
    pub total_bytes: u64,
    pub file_count: u64,
    pub folder_count: u64,
}

fn calculate_dir_size_blocking(path: &str) -> Result<FolderSizeInfo, String> {
    let root = Path::new(path);
    if !root.exists() || !root.is_dir() {
        return Err("Zadaná cesta neexistuje nebo není složkou".to_string());
    }

    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;
    let mut folder_count: u64 = 0;

    // Tuple of (directory_path, current_depth)
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    const MAX_DEPTH: usize = 12;
    const MAX_INSPECT_ENTRIES: u64 = 200_000;

    while let Some((current_dir, depth)) = stack.pop() {
        if file_count + folder_count >= MAX_INSPECT_ENTRIES {
            break;
        }
        let Ok(read_dir) = fs::read_dir(&current_dir) else { continue };
        for entry_res in read_dir {
            if file_count + folder_count >= MAX_INSPECT_ENTRIES {
                break;
            }
            let Ok(entry) = entry_res else { continue };
            let Ok(file_type) = entry.file_type() else { continue };

            // Skip symlinks and NTFS junction points to prevent infinite cycles
            if file_type.is_symlink() {
                continue;
            }

            let Ok(meta) = entry.metadata() else { continue };
            if is_hidden_or_system(&meta) {
                continue;
            }
            if meta.is_dir() {
                folder_count += 1;
                if depth < MAX_DEPTH {
                    stack.push((entry.path(), depth + 1));
                }
            } else {
                file_count += 1;
                total_bytes = total_bytes.saturating_add(meta.len());
            }
        }
    }

    Ok(FolderSizeInfo {
        total_bytes,
        file_count,
        folder_count,
    })
}

/// Recursively calculates folder size in bytes, file count, and folder count.
#[tauri::command]
async fn get_folder_size(path: String) -> Result<FolderSizeInfo, String> {
    tauri::async_runtime::spawn_blocking(move || calculate_dir_size_blocking(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// Returns raw bytes through Tauri's binary IPC channel (no JSON number arrays).
/// `max_bytes` limits how much of the file head is read.
#[tauri::command]
async fn read_file_binary(
    path: String,
    max_bytes: Option<u64>,
) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut file = fs::File::open(&path).map_err(|e| format!("Nelze otevřít soubor: {}", e))?;
        let len = file.metadata().map(|m| m.len()).unwrap_or(0);
        // Safety cap: Never allocate more than 300 MB without an explicit limit to avoid OOM
        const MAX_UNBOUNDED_BYTES: u64 = 300 * 1024 * 1024;
        let want = max_bytes.map(|m| m.min(len)).unwrap_or_else(|| len.min(MAX_UNBOUNDED_BYTES));
        let mut buf = Vec::with_capacity(want as usize);
        file.seek(SeekFrom::Start(0)).ok();
        file.take(want)
            .read_to_end(&mut buf)
            .map_err(|e| format!("Nelze přečíst soubor: {}", e))?;
        Ok::<_, String>(tauri::ipc::Response::new(buf))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Reads `length` bytes starting at `offset` (clamped to the end of the file).
/// Used for data that lives past the file head, e.g. the flattened composite of a PSD.
#[tauri::command]
async fn read_file_range(
    path: String,
    offset: u64,
    length: u64,
) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        const MAX_RANGE_BYTES: u64 = 400 * 1024 * 1024;
        let mut file = fs::File::open(&path).map_err(|e| format!("Nelze otevřít soubor: {}", e))?;
        let len = file.metadata().map(|m| m.len()).unwrap_or(0);
        if offset >= len {
            return Ok::<_, String>(tauri::ipc::Response::new(Vec::new()));
        }
        let want = length.min(len - offset).min(MAX_RANGE_BYTES);
        let mut buf = Vec::with_capacity(want as usize);
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| format!("Nelze se posunout v souboru: {}", e))?;
        file.take(want)
            .read_to_end(&mut buf)
            .map_err(|e| format!("Nelze přečíst soubor: {}", e))?;
        Ok(tauri::ipc::Response::new(buf))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn find_sub(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() {
        return None;
    }
    let first = needle[0];
    let last_start = hay.len() - needle.len();
    let mut i = 0;
    while i <= last_start {
        match hay[i..=last_start].iter().position(|&b| b == first) {
            Some(off) => {
                i += off;
                if &hay[i..i + needle.len()] == needle {
                    return Some(i);
                }
                i += 1;
            }
            None => return None,
        }
    }
    None
}

fn clean_base64(raw: &[u8]) -> Option<String> {
    let mut s = String::from_utf8_lossy(raw).to_string();
    for ent in [
        "&#xA;", "&#xa;", "&#x0A;", "&#x0a;", "&#xD;", "&#xd;", "&#x0D;", "&#x0d;", "&#10;",
        "&#13;", "&#x20;", "&#32;",
    ] {
        s = s.replace(ent, "");
    }
    let cleaned: String = s
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '+' || *c == '/' || *c == '=')
        .collect();
    if cleaned.len() < 100 || cleaned.len() % 4 != 0 {
        return None;
    }
    // Verify it actually decodes to a valid image (JPEG SOI FF D8 or PNG 89 50 4E 47)
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    if let Ok(bytes) = STANDARD.decode(&cleaned) {
        if bytes.len() >= 4 {
            let is_jpeg = bytes[0] == 0xFF && bytes[1] == 0xD8;
            let is_png = bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]);
            if is_jpeg || is_png {
                return Some(cleaned);
            }
        }
    }
    None
}

fn find_xmp_start(data: &[u8]) -> Option<(usize, usize)> {
    let s1 = find_sub(data, b"<xmpGImg:image");
    let s2 = find_sub(data, b"<xapGImg:image");
    let (idx, _) = match (s1, s2) {
        (Some(i1), Some(i2)) => {
            if i1 <= i2 { (i1, 14) } else { (i2, 14) }
        }
        (Some(i1), None) => (i1, 14),
        (None, Some(i2)) => (i2, 14),
        (None, None) => return None,
    };
    let max_search = data.len().min(idx + 256);
    if let Some(gt) = data[idx..max_search].iter().position(|&b| b == b'>') {
        Some((idx, gt + 1))
    } else {
        None
    }
}

fn find_xmp_end(data: &[u8]) -> Option<(usize, usize)> {
    let e1 = find_sub(data, b"</xmpGImg:image");
    let e2 = find_sub(data, b"</xapGImg:image");
    let (idx, _) = match (e1, e2) {
        (Some(i1), Some(i2)) => {
            if i1 <= i2 { (i1, 15) } else { (i2, 15) }
        }
        (Some(i1), None) => (i1, 15),
        (None, Some(i2)) => (i2, 15),
        (None, None) => return None,
    };
    let max_search = data.len().min(idx + 64);
    if let Some(gt) = data[idx..max_search].iter().position(|&b| b == b'>') {
        Some((idx, gt + 1))
    } else {
        None
    }
}

/// Streams through a file and extracts the largest <xmpGImg:image> or <xapGImg:image> base64 JPEG
/// (embedded preview used by InDesign, Illustrator, Photoshop and others).
fn extract_xmp_thumb_blocking(path: &str, max_scan: u64) -> Option<String> {
    const MAX_ENTRY: usize = 8 * 1024 * 1024;

    let mut file = fs::File::open(path).ok()?;
    let mut buf = vec![0u8; 4 * 1024 * 1024];
    let mut carry: Vec<u8> = Vec::new();
    let mut collecting: Option<Vec<u8>> = None;
    let mut best: Vec<u8> = Vec::new();
    let mut found = 0;
    let mut scanned: u64 = 0;

    'outer: loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        scanned += n as u64;
        let mut data = std::mem::take(&mut carry);
        data.extend_from_slice(&buf[..n]);
        let mut pos = 0usize;

        loop {
            if collecting.is_some() {
                match find_xmp_end(&data[pos..]) {
                    Some((i, tag_len)) => {
                        let mut done = collecting.take().unwrap();
                        done.extend_from_slice(&data[pos..pos + i]);
                        pos += i + tag_len;
                        if done.len() > best.len() {
                            best = done;
                        }
                        found += 1;
                        if found >= 6 {
                            break 'outer;
                        }
                    }
                    None => {
                        let keep = 15;
                        let safe_end = data.len().saturating_sub(keep).max(pos);
                        let col = collecting.as_mut().unwrap();
                        col.extend_from_slice(&data[pos..safe_end]);
                        if col.len() > MAX_ENTRY {
                            collecting = None;
                        }
                        carry = data[safe_end..].to_vec();
                        break;
                    }
                }
            } else {
                match find_xmp_start(&data[pos..]) {
                    Some((i, tag_len)) => {
                        pos += i + tag_len;
                        collecting = Some(Vec::new());
                    }
                    None => {
                        let keep = 14;
                        let safe = data.len().saturating_sub(keep).max(pos);
                        carry = data[safe..].to_vec();
                        break;
                    }
                }
            }
        }

        if scanned >= max_scan && collecting.is_none() {
            break;
        }
    }

    if best.is_empty() {
        None
    } else {
        clean_base64(&best)
    }
}

#[tauri::command]
async fn extract_xmp_thumbnail(path: String, max_scan_mb: u64) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract_xmp_thumb_blocking(&path, max_scan_mb.saturating_mul(1024 * 1024))
    })
    .await
    .ok()
    .flatten()
}

/// Scans a file on disk for embedded JPEG images (SOI FF D8 FF ... EOI FF D9),
/// accurately parses JPEG segments and SOF dimensions, and selects the highest resolution valid image.
/// Highly optimized for InDesign (.indd), camera RAW files, EPS, etc.
fn extract_embedded_jpeg_blocking(path: &str, min_size: usize, max_scan_bytes: u64) -> Option<Vec<u8>> {
    let mut file = fs::File::open(path).ok()?;
    let meta = file.metadata().ok()?;
    let scan_limit = meta.len().min(max_scan_bytes) as usize;

    let mut buf = vec![0u8; scan_limit.min(128 * 1024 * 1024)];
    let n = file.read(&mut buf).ok()?;
    if n < 4 {
        return None;
    }
    let data = &buf[..n];

    let mut best_slice: Option<(usize, usize)> = None;
    let mut best_score: u64 = 0; // pixel_count (width * height), fallback to length
    let mut fallback_slice: Option<(usize, usize)> = None;
    let mut fallback_len = 0usize;

    let limit = data.len().saturating_sub(4);
    let mut i = 0usize;
    while i < limit {
        // Look for JPEG SOI: 0xFF, 0xD8, 0xFF
        if data[i] == 0xFF && data[i + 1] == 0xD8 && data[i + 2] == 0xFF {
            let max_bound = data.len().min(i + 16 * 1024 * 1024);
            let mut pos = i + 2;
            let mut width: u32 = 0;
            let mut height: u32 = 0;
            let mut has_sof = false;
            let mut end_pos: Option<usize> = None;

            while pos + 1 < max_bound {
                if data[pos] != 0xFF {
                    break;
                }
                let marker = data[pos + 1];

                // EOI (End of Image)
                if marker == 0xD9 {
                    end_pos = Some(pos + 2);
                    break;
                }

                // SOS (Start of Scan) - compressed entropy data follows
                if marker == 0xDA {
                    if pos + 4 > max_bound {
                        break;
                    }
                    let sos_len = ((data[pos + 2] as usize) << 8) | (data[pos + 3] as usize);
                    let mut scan_pos = pos + 2 + sos_len;
                    while scan_pos + 1 < max_bound {
                        if data[scan_pos] == 0xFF {
                            let next = data[scan_pos + 1];
                            if next == 0xD9 {
                                end_pos = Some(scan_pos + 2);
                                break;
                            }
                            if next == 0x00 || (next >= 0xD0 && next <= 0xD7) {
                                scan_pos += 2;
                                continue;
                            }
                        }
                        scan_pos += 1;
                    }
                    break;
                }

                // Standalone markers without length payload (RST, TEM, SOI)
                if marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7) {
                    pos += 2;
                    continue;
                }

                // Variable-length markers (APPn, DQT, DHT, SOFn, etc.)
                if pos + 4 > max_bound {
                    break;
                }
                let seg_len = ((data[pos + 2] as usize) << 8) | (data[pos + 3] as usize);
                if seg_len < 2 {
                    break;
                }

                // SOF0, SOF1, SOF2 (Start of Frame: contains dimensions)
                if (marker == 0xC0 || marker == 0xC1 || marker == 0xC2) && pos + 9 <= max_bound {
                    height = ((data[pos + 5] as u32) << 8) | (data[pos + 6] as u32);
                    width = ((data[pos + 7] as u32) << 8) | (data[pos + 8] as u32);
                    has_sof = true;
                }

                pos += 2 + seg_len;
            }

            if let Some(end) = end_pos {
                let length = end - i;
                if length >= min_size {
                    if has_sof && width >= 64 && height >= 64 {
                        let score = (width as u64) * (height as u64);
                        if score > best_score {
                            best_score = score;
                            best_slice = Some((i, end));
                        }
                    } else if length > fallback_len {
                        fallback_len = length;
                        fallback_slice = Some((i, end));
                    }
                }
            }
        }
        i += 1;
    }

    best_slice
        .or(fallback_slice)
        .map(|(start, end)| data[start..end].to_vec())
}

#[tauri::command]
async fn extract_embedded_jpeg(
    path: String,
    min_size: Option<usize>,
    max_scan_mb: Option<u64>,
) -> Result<tauri::ipc::Response, String> {
    let min_sz = min_size.unwrap_or(8192);
    let max_scan = max_scan_mb.unwrap_or(128).saturating_mul(1024 * 1024);
    tauri::async_runtime::spawn_blocking(move || {
        extract_embedded_jpeg_blocking(&path, min_sz, max_scan)
    })
    .await
    .map_err(|e| e.to_string())?
    .map(tauri::ipc::Response::new)
    .ok_or_else(|| "Nenalezen žádný vložený náhled JPEG".to_string())
}

/// Windows shell icon (PNG bytes) for a file extension ("docx") or folder.
#[tauri::command]
async fn get_file_icon(ext: String, is_dir: bool) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || icons::get_icon_png(&ext, is_dir))
        .await
        .map_err(|e| e.to_string())?
        .map(tauri::ipc::Response::new)
        .ok_or_else(|| "Ikonu se nepodařilo načíst".to_string())
}

/// Windows shell thumbnail (PNG bytes) for any file path via IShellItemImageFactory.
/// Automatically handles formats with registered Windows preview/thumbnail shell extensions (e.g. Corel Painter RiffSE).
#[tauri::command]
async fn get_shell_thumbnail(path: String, size: Option<u32>) -> Result<tauri::ipc::Response, String> {
    let sz = size.unwrap_or(512);
    tauri::async_runtime::spawn_blocking(move || icons::get_shell_thumbnail_png(&path, sz))
        .await
        .map_err(|e| e.to_string())?
        .map(tauri::ipc::Response::new)
        .ok_or_else(|| "Náhled se nepodařilo načíst přes Shell API".to_string())
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let formatted = path.replace('/', "\\");
        let p = Path::new(&formatted);
        if !p.exists() {
            return Err(format!("Soubor nebo složka na zadané cestě neexistuje: {}", formatted));
        }

        let mut cmd = Command::new("explorer");
        let clean_path = formatted.replace('"', "");
        if p.is_dir() {
            let clean = if clean_path.len() > 3 {
                clean_path.trim_end_matches('\\').to_string()
            } else {
                clean_path
            };
            cmd.raw_arg(format!("\"{}\"", clean));
        } else {
            cmd.raw_arg(format!("/select,\"{}\"", clean_path));
        }

        cmd.spawn()
            .map_err(|e| format!("Nelze otevřít Průzkumník Windows: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        let _ = Command::new("true");
        Ok(())
    }
}

/// Opens a file with its default Windows application (e.g. Acrobat Reader, Edge, Photoshop, Word, default viewer)
#[tauri::command]
fn open_file_native(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW, SEE_MASK_FLAG_NO_UI};
        use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

        let formatted = path.replace('/', "\\");
        let p = Path::new(&formatted);
        if !p.exists() {
            return Err(format!("Soubor neexistuje: {}", formatted));
        }

        let co_init = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() };
        let wide_path = icons::to_wide(&formatted);

        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_FLAG_NO_UI,
            hwnd: Default::default(),
            lpVerb: PCWSTR::null(), // Invokes default action configured for this file type
            lpFile: PCWSTR(wide_path.as_ptr()),
            nShow: 1, // SW_SHOWNORMAL
            ..Default::default()
        };

        let res = unsafe { ShellExecuteExW(&mut info) };
        if co_init {
            unsafe { CoUninitialize() };
        }

        if res.is_ok() {
            return Ok(());
        }

        // Fallback: Windows Explorer command invokes the registered shell handler
        let status = Command::new("explorer")
            .arg(&formatted)
            .status()
            .map_err(|e| format!("Chyba při otevírání souboru: {}", e))?;

        if !status.success() {
            return Err(format!("Nelze spustit asociovanou aplikaci pro {}", formatted));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AssociatedApp {
    pub name: String,
    pub exe_name: String,
    pub path: Option<String>,
    pub is_default: bool,
}

#[cfg(target_os = "windows")]
fn reg_get_string(
    root: windows::Win32::System::Registry::HKEY,
    subkey: &str,
    value_name: Option<&str>,
) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{RegCloseKey, RegOpenKeyExW, RegQueryValueExW, KEY_READ};
    let wide_subkey = icons::to_wide(subkey);
    let mut hkey = windows::Win32::System::Registry::HKEY::default();
    unsafe {
        if RegOpenKeyExW(root, PCWSTR(wide_subkey.as_ptr()), Some(0), KEY_READ, &mut hkey).is_err() {
            return None;
        }
        let wide_val = value_name.map(|v| icons::to_wide(v));
        let val_ptr = wide_val
            .as_ref()
            .map(|v| PCWSTR(v.as_ptr()))
            .unwrap_or(PCWSTR::null());

        let mut buf_size: u32 = 0;
        if RegQueryValueExW(hkey, val_ptr, None, None, None, Some(&mut buf_size)).is_err()
            || buf_size == 0
        {
            let _ = RegCloseKey(hkey);
            return None;
        }

        let mut buf: Vec<u8> = vec![0u8; buf_size as usize];
        if RegQueryValueExW(
            hkey,
            val_ptr,
            None,
            None,
            Some(buf.as_mut_ptr()),
            Some(&mut buf_size),
        )
        .is_ok()
        {
            let _ = RegCloseKey(hkey);
            let u16_slice: &[u16] = std::slice::from_raw_parts(
                buf.as_ptr() as *const u16,
                (buf_size as usize) / 2,
            );
            let s = String::from_utf16_lossy(u16_slice);
            let trimmed = s.trim_matches('\0').trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        } else {
            let _ = RegCloseKey(hkey);
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn reg_enum_values(
    root: windows::Win32::System::Registry::HKEY,
    subkey: &str,
) -> Vec<(String, String)> {
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::System::Registry::{RegCloseKey, RegEnumValueW, RegOpenKeyExW, KEY_READ};
    let wide_subkey = icons::to_wide(subkey);
    let mut hkey = windows::Win32::System::Registry::HKEY::default();
    let mut results = Vec::new();
    unsafe {
        if RegOpenKeyExW(root, PCWSTR(wide_subkey.as_ptr()), Some(0), KEY_READ, &mut hkey).is_err() {
            return results;
        }
        let mut index = 0u32;
        loop {
            let mut name_buf = vec![0u16; 256];
            let mut name_len = name_buf.len() as u32;
            let mut data_buf = vec![0u8; 1024];
            let mut data_len = data_buf.len() as u32;
            let mut val_type = 0u32;

            let status = RegEnumValueW(
                hkey,
                index,
                Some(PWSTR(name_buf.as_mut_ptr())),
                &mut name_len,
                None,
                Some(&mut val_type),
                Some(data_buf.as_mut_ptr()),
                Some(&mut data_len),
            );
            if status.0 != 0 {
                break;
            }
            let name = String::from_utf16_lossy(&name_buf[..name_len as usize]);
            let u16_data = std::slice::from_raw_parts(
                data_buf.as_ptr() as *const u16,
                (data_len as usize) / 2,
            );
            let data = String::from_utf16_lossy(u16_data)
                .trim_matches('\0')
                .trim()
                .to_string();
            results.push((name, data));
            index += 1;
        }
        let _ = RegCloseKey(hkey);
    }
    results
}

fn extract_exe_from_command(cmd: &str) -> Option<String> {
    let trimmed = cmd.trim();
    if trimmed.starts_with('"') {
        if let Some(end) = trimmed[1..].find('"') {
            let path = &trimmed[1..=end];
            if Path::new(path).is_file() {
                return Some(path.to_string());
            }
        }
    }
    if let Some(token) = trimmed.split_whitespace().next() {
        let clean = token.trim_matches('"');
        if Path::new(clean).is_file() {
            return Some(clean.to_string());
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn resolve_app_path(exe: &str) -> Option<String> {
    use windows::Win32::System::Registry::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    let hklm_key = format!("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{}", exe);
    if let Some(p) = reg_get_string(HKEY_LOCAL_MACHINE, &hklm_key, None) {
        let clean = p.trim_matches('"');
        if Path::new(clean).is_file() {
            return Some(clean.to_string());
        }
    }
    if let Some(p) = reg_get_string(HKEY_CURRENT_USER, &hklm_key, None) {
        let clean = p.trim_matches('"');
        if Path::new(clean).is_file() {
            return Some(clean.to_string());
        }
    }
    let hkcr_cmd_key = format!("Applications\\{}\\shell\\open\\command", exe);
    if let Some(cmd) = reg_get_string(HKEY_CLASSES_ROOT, &hkcr_cmd_key, None) {
        if let Some(p) = extract_exe_from_command(&cmd) {
            return Some(p);
        }
    }
    let sys32 = format!("C:\\Windows\\System32\\{}", exe);
    if Path::new(&sys32).is_file() {
        return Some(sys32);
    }
    let win_root = format!("C:\\Windows\\{}", exe);
    if Path::new(&win_root).is_file() {
        return Some(win_root);
    }
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let uwp_path = format!("{}\\Microsoft\\WindowsApps\\{}", local_app_data, exe);
        if Path::new(&uwp_path).is_file() {
            return Some(uwp_path);
        }
    }
    None
}

fn get_app_friendly_name(exe: &str, full_path: Option<&str>) -> String {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Registry::HKEY_CLASSES_ROOT;
        let hkcr_key = format!("Applications\\{}", exe);
        if let Some(name) = reg_get_string(HKEY_CLASSES_ROOT, &hkcr_key, Some("FriendlyAppName")) {
            if !name.starts_with('@') && !name.is_empty() {
                return name;
            }
        }
    }
    let lower_exe = exe.to_lowercase();
    match lower_exe.as_str() {
        "photoshop.exe" => "Adobe Photoshop".to_string(),
        "illustrator.exe" => "Adobe Illustrator".to_string(),
        "indesign.exe" => "Adobe InDesign".to_string(),
        "afterfx.exe" => "Adobe After Effects".to_string(),
        "premiere.exe" => "Adobe Premiere Pro".to_string(),
        "blender.exe" | "blender-launcher.exe" => "Blender".to_string(),
        "mspaint.exe" => "Malování".to_string(),
        "notepad.exe" => "Poznámkový blok".to_string(),
        "brave.exe" => "Brave Browser".to_string(),
        "chrome.exe" => "Google Chrome".to_string(),
        "msedge.exe" => "Microsoft Edge".to_string(),
        "vlc.exe" => "VLC Media Player".to_string(),
        "acrobat.exe" => "Adobe Acrobat".to_string(),
        "lightroom.exe" => "Adobe Lightroom".to_string(),
        "code.exe" => "Visual Studio Code".to_string(),
        "cursor.exe" => "Cursor".to_string(),
        "figma.exe" => "Figma".to_string(),
        "sublime_text.exe" => "Sublime Text".to_string(),
        _ => {
            if let Some(fp) = full_path {
                let p = Path::new(fp);
                if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                    return stem.to_string();
                }
            }
            exe.trim_end_matches(".exe")
                .trim_end_matches(".EXE")
                .to_string()
        }
    }
}

/// Lists corresponding applications registered in Windows for the given file's extension.
#[tauri::command]
fn get_associated_apps_native(file_path: String) -> Vec<AssociatedApp> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Registry::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER};
        let p = Path::new(&file_path);
        let ext = match p.extension().and_then(|s| s.to_str()) {
            Some(e) => format!(".{}", e.to_lowercase()),
            None => return Vec::new(),
        };

        let mut apps: Vec<AssociatedApp> = Vec::new();
        let mut seen_exes = std::collections::HashSet::new();

        // 1. Determine default app
        let mut default_exe = String::new();
        let user_choice_key = format!(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\{}\\UserChoice",
            ext
        );
        if let Some(prog_id) = reg_get_string(HKEY_CURRENT_USER, &user_choice_key, Some("ProgId")) {
            let prog_cmd_key = format!("{}\\shell\\open\\command", prog_id);
            if let Some(cmd) = reg_get_string(HKEY_CLASSES_ROOT, &prog_cmd_key, None) {
                if let Some(fp) = extract_exe_from_command(&cmd) {
                    if let Some(file_name) = Path::new(&fp).file_name().and_then(|s| s.to_str()) {
                        default_exe = file_name.to_lowercase();
                    }
                }
            }
        }
        if default_exe.is_empty() {
            if let Some(prog_id) = reg_get_string(HKEY_CLASSES_ROOT, &ext, None) {
                let prog_cmd_key = format!("{}\\shell\\open\\command", prog_id);
                if let Some(cmd) = reg_get_string(HKEY_CLASSES_ROOT, &prog_cmd_key, None) {
                    if let Some(fp) = extract_exe_from_command(&cmd) {
                        if let Some(file_name) = Path::new(&fp).file_name().and_then(|s| s.to_str()) {
                            default_exe = file_name.to_lowercase();
                        }
                    }
                }
            }
        }

        // 2. Query OpenWithList from HKCU
        let owl_key = format!(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\{}\\OpenWithList",
            ext
        );
        let values = reg_enum_values(HKEY_CURRENT_USER, &owl_key);
        let mru = values
            .iter()
            .find(|(k, _)| k == "MRUList")
            .map(|(_, v)| v.clone())
            .unwrap_or_default();

        let mut ordered_exes = Vec::new();
        if !mru.is_empty() {
            for ch in mru.chars() {
                let key_str = ch.to_string();
                if let Some((_, val)) = values.iter().find(|(k, _)| k == &key_str) {
                    if !val.is_empty() && !val.contains('!') {
                        ordered_exes.push(val.clone());
                    }
                }
            }
        }
        for (k, v) in &values {
            if k != "MRUList" && !v.is_empty() && !v.contains('!') && !ordered_exes.contains(v) {
                ordered_exes.push(v.clone());
            }
        }

        for exe in ordered_exes {
            let lower = exe.to_lowercase();
            if seen_exes.contains(&lower) {
                continue;
            }
            seen_exes.insert(lower.clone());
            let full_path = resolve_app_path(&exe);
            let name = get_app_friendly_name(&exe, full_path.as_deref());
            let is_default = !default_exe.is_empty() && lower == default_exe;
            apps.push(AssociatedApp {
                name,
                exe_name: exe,
                path: full_path,
                is_default,
            });
        }

        // 3. Known default suites if registered or installed on the system
        let known_suite: &[(&[&str], &str, &str)] = &[
            (&[".psd", ".psb", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"], "Photoshop.exe", "Adobe Photoshop"),
            (&[".ai", ".eps", ".svg", ".pdf"], "Illustrator.exe", "Adobe Illustrator"),
            (&[".indd", ".idml"], "InDesign.exe", "Adobe InDesign"),
            (&[".blend", ".obj", ".stl", ".fbx"], "blender.exe", "Blender"),
            (&[".mp4", ".avi", ".mov", ".mkv", ".webm", ".wmv"], "vlc.exe", "VLC Media Player"),
            (&[".png", ".jpg", ".jpeg", ".bmp"], "mspaint.exe", "Malování"),
            (&[".txt", ".json", ".md", ".xml", ".log", ".yaml", ".yml"], "notepad.exe", "Poznámkový blok"),
        ];

        for (exts, exe, label) in known_suite {
            if exts.contains(&ext.as_str()) {
                let lower = exe.to_lowercase();
                if !seen_exes.contains(&lower) {
                    if let Some(fp) = resolve_app_path(exe) {
                        seen_exes.insert(lower.clone());
                        apps.push(AssociatedApp {
                            name: label.to_string(),
                            exe_name: exe.to_string(),
                            path: Some(fp),
                            is_default: !default_exe.is_empty() && lower == default_exe,
                        });
                    }
                }
            }
        }

        // Sort so that is_default is first, followed by apps with valid path, then others
        apps.sort_by(|a, b| {
            b.is_default
                .cmp(&a.is_default)
                .then_with(|| b.path.is_some().cmp(&a.path.is_some()))
        });

        apps
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        Vec::new()
    }
}

/// Opens a file with a specified application executable, or opens the native Windows "Open With" dialog.
#[tauri::command]
fn open_file_with_app_native(file_path: String, app_path: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::PCWSTR;
        use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
        use windows::Win32::UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW};

        let formatted = file_path.replace('/', "\\");
        let p = Path::new(&formatted);
        if !p.exists() {
            return Err(format!("Soubor neexistuje: {}", formatted));
        }

        // If specific app path is provided and is not "openas"
        if let Some(ref ap) = app_path {
            if !ap.is_empty() && ap != "openas" {
                let status = Command::new(ap).arg(&formatted).spawn();
                if status.is_ok() {
                    return Ok(());
                }
            }
        }

        // If app_path is None or "openas", invoke Windows Open With dialog!
        let co_init = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() };
        let wide_path = icons::to_wide(&formatted);
        let wide_verb = icons::to_wide("openas");

        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: 0,
            hwnd: Default::default(),
            lpVerb: PCWSTR(wide_verb.as_ptr()),
            lpFile: PCWSTR(wide_path.as_ptr()),
            nShow: 1, // SW_SHOWNORMAL
            ..Default::default()
        };

        let res = unsafe { ShellExecuteExW(&mut info) };
        if co_init {
            unsafe { CoUninitialize() };
        }

        if res.is_ok() {
            return Ok(());
        }

        // Fallback: rundll32 shell32.dll,OpenAs_RunDLL
        let _ = Command::new("rundll32.exe")
            .args(["shell32.dll,OpenAs_RunDLL", &formatted])
            .spawn();

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(ap) = app_path {
            Command::new(ap)
                .arg(file_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("xdg-open")
                .arg(file_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}


/// Opens a terminal (Windows Terminal / PowerShell / CMD) in the specified folder or file's parent folder.
/// Optionally executes an initial command in the terminal.
#[tauri::command]
fn open_terminal_native(path: String, command: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let formatted = path.replace('/', "\\");
        let p = Path::new(&formatted);
        if !p.exists() {
            return Err("Zadaná cesta neexistuje".to_string());
        }
        let folder_path = if p.is_file() {
            p.parent().unwrap_or(p).to_string_lossy().to_string()
        } else {
            formatted.clone()
        };
        let target_dir = Path::new(&folder_path);
        if !target_dir.is_dir() {
            return Err("Cílová složka neexistuje".to_string());
        }

        let cmd_to_run = command.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

        // 1. Try Windows Terminal wt.exe with -d <dir>
        let mut wt = Command::new("wt.exe");
        wt.args(["-d", &folder_path]);
        if let Some(cmd_str) = cmd_to_run {
            wt.args(["powershell.exe", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", cmd_str]);
        }
        if wt.spawn().is_ok() {
            return Ok(());
        }

        // 2. Fallback: PowerShell in the directory
        let mut ps_cmd = Command::new("powershell.exe");
        if let Some(cmd_str) = cmd_to_run {
            ps_cmd.args(["-NoExit", "-ExecutionPolicy", "Bypass", "-Command", cmd_str]);
        } else {
            ps_cmd.arg("-NoLogo");
        }
        ps_cmd.current_dir(&folder_path);
        if ps_cmd.spawn().is_ok() {
            return Ok(());
        }

        // 3. Fallback: cmd.exe
        let mut cmd = Command::new("cmd.exe");
        cmd.current_dir(&folder_path);
        if let Some(cmd_str) = cmd_to_run {
            cmd.args(["/K", cmd_str]);
        } else {
            cmd.raw_arg("/K");
        }
        cmd.spawn().map_err(|e| format!("Nelze otevřít terminál: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let p = Path::new(&path);
        let folder = if p.is_file() {
            p.parent().unwrap_or(p).to_string_lossy().to_string()
        } else {
            path
        };
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .args(["-a", "Terminal", &folder])
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(());
        }
        #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
        {
            Command::new("x-terminal-emulator")
                .current_dir(&folder)
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

/// Renames a file or directory. Returns the new absolute path.
#[tauri::command]
fn rename_file_native(old_path: String, new_name: String) -> Result<String, String> {
    let old_p = Path::new(&old_path);
    if !old_p.exists() {
        return Err("Původní soubor nebo složka neexistuje".to_string());
    }
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("Název nemůže být prázdný".to_string());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("Neplatný název souboru nebo složky".to_string());
    }
    if trimmed.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
        return Err("Název obsahuje nepovolené znaky (\\ / : * ? \" < > |)".to_string());
    }
    let parent = old_p
        .parent()
        .ok_or_else(|| "Nelze určit nadřazenou složku".to_string())?;
    let new_p = parent.join(trimmed);
    if new_p.exists() && new_p != old_p {
        return Err("Položka se zadaným názvem již v této složce existuje".to_string());
    }
    fs::rename(old_p, &new_p).map_err(|e| format!("Přejmenování se nezdařilo: {}", e))?;
    Ok(new_p.to_string_lossy().to_string())
}

/// Creates a new directory inside parent_path with a unique name (e.g. "Nová složka", "Nová složka (2)")
#[tauri::command]
fn create_folder_native(parent_path: String, suggested_name: Option<String>) -> Result<String, String> {
    let parent = Path::new(&parent_path);
    if !parent.is_dir() {
        return Err("Cílová složka neexistuje".to_string());
    }
    let base_name = suggested_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Nová složka".to_string());

    if base_name == "." || base_name == ".." || base_name.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
        return Err("Název složky obsahuje nepovolené znaky".to_string());
    }

    let mut candidate = parent.join(&base_name);
    let mut counter = 2;
    while candidate.exists() {
        candidate = parent.join(format!("{} ({})", base_name, counter));
        counter += 1;
    }
    fs::create_dir_all(&candidate).map_err(|e| format!("Nelze vytvořit složku: {}", e))?;
    Ok(candidate.to_string_lossy().to_string())
}

/// Moves files or directories to the Windows Recycle Bin (Koš)
#[tauri::command]
fn delete_files_native(paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::{
            SHFileOperationW, FO_DELETE, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_SILENT,
            FOF_WANTNUKEWARNING, SHFILEOPSTRUCTW,
        };

        let mut wide: Vec<u16> = Vec::new();
        for p in &paths {
            let win_p = p.replace('/', "\\");
            wide.extend(win_p.encode_utf16());
            wide.push(0);
        }
        wide.push(0); // double null terminator for SHFILEOPSTRUCTW

        let mut op = SHFILEOPSTRUCTW {
            hwnd: Default::default(),
            wFunc: FO_DELETE,
            pFrom: PCWSTR(wide.as_ptr()),
            pTo: PCWSTR::null(),
            fFlags: (FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_WANTNUKEWARNING).0 as u16,
            ..Default::default()
        };

        let res = unsafe { SHFileOperationW(&mut op) };
        if res != 0 {
            return Err(format!("Přesun do Koše selhal s kódem {}", res));
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        for p in paths {
            let pth = Path::new(&p);
            if pth.is_dir() {
                fs::remove_dir_all(pth).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(pth).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
}

/// Recursively adds `src` to the archive under `name` (forward-slash relative path).
fn zip_add_path<W: std::io::Write + Seek>(
    writer: &mut zip::ZipWriter<W>,
    src: &Path,
    name: &str,
    opts: zip::write::SimpleFileOptions,
    skip: &Path,
) -> Result<(), String> {
    if src == skip {
        return Ok(());
    }
    if src.is_dir() {
        writer
            .add_directory(format!("{}/", name), opts)
            .map_err(|e| e.to_string())?;
        let entries = fs::read_dir(src).map_err(|e| format!("Nelze číst složku '{}': {}", name, e))?;
        for entry in entries.flatten() {
            let child_name = format!("{}/{}", name, entry.file_name().to_string_lossy());
            zip_add_path(writer, &entry.path(), &child_name, opts, skip)?;
        }
    } else {
        writer.start_file(name, opts).map_err(|e| e.to_string())?;
        let mut f = fs::File::open(src).map_err(|e| format!("Nelze otevřít '{}': {}", name, e))?;
        std::io::copy(&mut f, writer).map_err(|e| format!("Nelze zabalit '{}': {}", name, e))?;
    }
    Ok(())
}

fn create_zip_blocking(sources: Vec<String>) -> Result<String, String> {
    let first = sources.first().ok_or_else(|| "Nejsou vybrány žádné položky".to_string())?;
    let first_p = Path::new(first);
    let parent = first_p
        .parent()
        .ok_or_else(|| "Nelze určit nadřazenou složku".to_string())?;
    let base = if sources.len() == 1 {
        first_p
            .file_stem()
            .or_else(|| first_p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("Archiv")
            .to_string()
    } else {
        "Archiv".to_string()
    };
    let target = generate_copy_name(parent, &format!("{}.zip", base), false);

    let file = fs::File::create(&target).map_err(|e| format!("Nelze vytvořit ZIP: {}", e))?;
    let mut writer = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let result = (|| {
        for src in &sources {
            let p = Path::new(src);
            if !p.exists() {
                continue;
            }
            let name = p
                .file_name()
                .and_then(|s| s.to_str())
                .ok_or_else(|| "Neplatný název položky".to_string())?;
            zip_add_path(&mut writer, p, name, opts, &target)?;
        }
        writer.finish().map(|_| ()).map_err(|e| e.to_string())
    })();

    if let Err(e) = result {
        let _ = fs::remove_file(&target);
        return Err(e);
    }
    Ok(target.to_string_lossy().to_string())
}

/// Packs files/folders into a new .zip next to the first item (unique name, never overwrites). Returns the zip path.
#[tauri::command]
async fn create_zip_native(sources: Vec<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || create_zip_blocking(sources))
        .await
        .map_err(|e| e.to_string())?
}

fn extract_zip_blocking(zip_path: String, dest_folder: Option<String>) -> Result<String, String> {
    let zip_p = Path::new(&zip_path);
    let file = fs::File::open(zip_p).map_err(|e| format!("Nelze otevřít archiv: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Neplatný ZIP archiv: {}", e))?;

    let dest_parent = match dest_folder {
        Some(d) => std::path::PathBuf::from(d),
        None => zip_p
            .parent()
            .ok_or_else(|| "Nelze určit nadřazenou složku".to_string())?
            .to_path_buf(),
    };
    let stem = zip_p.file_stem().and_then(|s| s.to_str()).unwrap_or("Rozbaleno");
    let dest = generate_copy_name(&dest_parent, stem, true);
    fs::create_dir_all(&dest).map_err(|e| format!("Nelze vytvořit cílovou složku: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        // enclosed_name() rejects absolute paths and `..` components (Zip Slip)
        let rel = match entry.enclosed_name() {
            Some(p) => p,
            None => continue,
        };
        let out = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
        } else {
            if let Some(dir) = out.parent() {
                fs::create_dir_all(dir).map_err(|e| e.to_string())?;
            }
            let mut f = fs::File::create(&out)
                .map_err(|e| format!("Nelze vytvořit '{}': {}", out.display(), e))?;
            std::io::copy(&mut entry, &mut f)
                .map_err(|e| format!("Nelze rozbalit '{}': {}", out.display(), e))?;
        }
    }
    Ok(dest.to_string_lossy().to_string())
}

/// Extracts a .zip into a new folder named after the archive (unique name, never overwrites). Returns the folder path.
#[tauri::command]
async fn extract_zip_native(zip_path: String, dest_folder: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || extract_zip_blocking(zip_path, dest_folder))
        .await
        .map_err(|e| e.to_string())?
}

/// True when the cursor is above a window that is not this app (e.g. a browser lying over AeroBridge).
/// In-app drags use it to hand over to the OS drag even though the pointer never crossed our own window edge.
#[tauri::command]
fn cursor_over_other_window(window: tauri::Window) -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GetCursorPos, WindowFromPoint, GA_ROOT};

        let Ok(own) = window.hwnd() else { return false };
        unsafe {
            let mut pt = POINT::default();
            if GetCursorPos(&mut pt).is_err() {
                return false;
            }
            let under = WindowFromPoint(pt);
            if under.0.is_null() {
                return false;
            }
            let root = GetAncestor(under, GA_ROOT);
            root.0 as isize != own.0 as isize
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        false
    }
}

fn generate_copy_name(dest_folder: &Path, original_name: &str, is_dir: bool) -> std::path::PathBuf {
    let mut candidate = dest_folder.join(original_name);
    if !candidate.exists() {
        return candidate;
    }

    let (stem, ext) = if is_dir {
        (original_name, "")
    } else {
        let p = Path::new(original_name);
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or(original_name);
        let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
        (stem, ext)
    };

    let ext_suffix = if ext.is_empty() {
        String::new()
    } else {
        format!(".{}", ext)
    };

    // Try "name - kopie.ext"
    let copy1 = format!("{} - kopie{}", stem, ext_suffix);
    candidate = dest_folder.join(&copy1);
    if !candidate.exists() {
        return candidate;
    }

    // Try "name - kopie (2).ext", (3), ...
    let mut i = 2;
    loop {
        let copy_n = format!("{} - kopie ({}){}", stem, i, ext_suffix);
        candidate = dest_folder.join(&copy_n);
        if !candidate.exists() {
            return candidate;
        }
        i += 1;
    }
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_child = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dest_child)?;
        } else {
            fs::copy(entry.path(), &dest_child)?;
        }
    }
    Ok(())
}

/// Copies a list of files/folders to dest_folder. Handles name collisions automatically.
#[tauri::command]
fn copy_files_native(sources: Vec<String>, dest_folder: String) -> Result<Vec<String>, String> {
    let dest_p = Path::new(&dest_folder);
    if !dest_p.is_dir() {
        return Err("Cílová složka neexistuje".to_string());
    }

    let mut created = Vec::new();
    for src in sources {
        let src_p = Path::new(&src);
        if !src_p.exists() {
            continue;
        }
        let file_name = match src_p.file_name().and_then(|s| s.to_str()) {
            Some(n) => n,
            None => continue,
        };
        let is_dir = src_p.is_dir();
        let target = generate_copy_name(dest_p, file_name, is_dir);

        if is_dir {
            // Prevent copying directory inside itself
            if dest_p.starts_with(src_p) {
                return Err("Nelze kopírovat složku do sebe samé".to_string());
            }
            copy_dir_all(src_p, &target)
                .map_err(|e| format!("Nelze zkopírovat složku '{}': {}", file_name, e))?;
        } else {
            fs::copy(src_p, &target)
                .map_err(|e| format!("Nelze zkopírovat soubor '{}': {}", file_name, e))?;
        }
        created.push(target.to_string_lossy().to_string());
    }
    Ok(created)
}

/// Moves (cuts) a list of files/folders to dest_folder.
#[tauri::command]
fn move_files_native(sources: Vec<String>, dest_folder: String) -> Result<Vec<String>, String> {
    let dest_p = Path::new(&dest_folder);
    if !dest_p.is_dir() {
        return Err("Cílová složka neexistuje".to_string());
    }

    let mut moved = Vec::new();
    for src in sources {
        let src_p = Path::new(&src);
        if !src_p.exists() {
            continue;
        }
        let file_name = match src_p.file_name().and_then(|s| s.to_str()) {
            Some(n) => n,
            None => continue,
        };
        let is_dir = src_p.is_dir();
        if is_dir && dest_p.starts_with(src_p) {
            return Err("Nelze přesunout složku do sebe samé".to_string());
        }

        let target = dest_p.join(file_name);
        // If target exists and is different from source, generate unique name
        let final_target = if target.exists() && target != src_p {
            generate_copy_name(dest_p, file_name, is_dir)
        } else {
            target
        };

        // Try fast fs::rename first
        if fs::rename(src_p, &final_target).is_err() {
            // Fallback for cross-filesystem moves: copy then delete
            if is_dir {
                copy_dir_all(src_p, &final_target)
                    .map_err(|e| format!("Nelze přesunout složku: {}", e))?;
                let _ = fs::remove_dir_all(src_p);
            } else {
                fs::copy(src_p, &final_target)
                    .map_err(|e| format!("Nelze přesunout soubor: {}", e))?;
                let _ = fs::remove_file(src_p);
            }
        }
        moved.push(final_target.to_string_lossy().to_string());
    }
    Ok(moved)
}

/// Opens the native Windows File Properties dialog
#[tauri::command]
fn show_file_properties_native(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::{w, PCWSTR};
        use windows::Win32::UI::Shell::{ShellExecuteExW, SHELLEXECUTEINFOW, SEE_MASK_INVOKEIDLIST};
        use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

        let co_init = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok() };
        let formatted = path.replace('/', "\\");
        let wide = icons::to_wide(&formatted);

        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_INVOKEIDLIST,
            hwnd: Default::default(),
            lpVerb: w!("properties"),
            lpFile: PCWSTR(wide.as_ptr()),
            nShow: 1, // SW_SHOWNORMAL
            ..Default::default()
        };

        let res = unsafe {
            ShellExecuteExW(&mut info).map_err(|e| format!("Nelze otevřít vlastnosti souboru: {}", e))
        };
        if co_init {
            unsafe { CoUninitialize() };
        }
        res?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Ok(())
    }
}

/// Reads text file content safely with UTF-8 decoding and size limit
#[tauri::command]
async fn read_text_file_native(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if !p.is_file() {
            return Err("Soubor neexistuje nebo se nejedná o běžný soubor".to_string());
        }
        let metadata = fs::metadata(p).map_err(|e| format!("Nelze načíst metadata souboru: {}", e))?;
        if metadata.len() > 20 * 1024 * 1024 {
            return Err("Textový soubor je příliš velký (maximum je 20 MB)".to_string());
        }
        fs::read_to_string(p).map_err(|e| format!("Nelze přečíst textový soubor (možná se nejedná o platný text UTF-8): {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Writes text file content safely
#[tauri::command]
async fn write_text_file_native(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if let Some(parent) = p.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| format!("Nelze vytvořit nadřazenou složku: {}", e))?;
            }
        }
        fs::write(p, content.as_bytes()).map_err(|e| format!("Nelze zapsat do souboru: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
struct CommandOutput {
    stdout: String,
    stderr: String,
    exit_code: i32,
    success: bool,
}

/// Executes a shell command inside specified directory without UI blocking
#[tauri::command]
async fn execute_shell_command_native(
    dir: String,
    command: String,
    shell: Option<String>,
) -> Result<CommandOutput, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&dir);
        let work_dir = if p.is_dir() { p } else { Path::new(".") };
        let sh = shell.as_deref().unwrap_or("powershell");

        let mut cmd = if sh == "cmd" {
            let mut c = std::process::Command::new("cmd.exe");
            c.arg("/C").arg(&command);
            c
        } else {
            let mut c = std::process::Command::new("powershell.exe");
            c.arg("-NonInteractive")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-Command")
                .arg(&command);
            c
        };

        cmd.current_dir(work_dir);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let output = cmd.output().map_err(|e| format!("Chyba při spuštění příkazu: {}", e))?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);
        let success = output.status.success();

        Ok(CommandOutput {
            stdout,
            stderr,
            exit_code,
            success,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyManager::new())
        .plugin(tauri_plugin_drag::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            pick_folder_native,
            list_drives,
            get_user_places,
            scan_folder_native,
            list_subdirs,
            read_file_binary,
            read_file_range,
            extract_xmp_thumbnail,
            extract_embedded_jpeg,
            get_file_icon,
            get_shell_thumbnail,
            reveal_in_explorer,
            open_file_native,
            rename_file_native,
            create_folder_native,
            delete_files_native,
            copy_files_native,
            move_files_native,
            create_zip_native,
            extract_zip_native,
            cursor_over_other_window,
            show_file_properties_native,
            get_folder_size,
            open_terminal_native,
            get_associated_apps_native,
            open_file_with_app_native,
            read_text_file_native,
            write_text_file_native,
            execute_shell_command_native,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
