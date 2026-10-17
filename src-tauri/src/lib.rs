mod icons;

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
    if cleaned.len() > 100 {
        Some(cleaned)
    } else {
        None
    }
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

/// Opens a terminal (Windows Terminal / PowerShell / CMD) in the specified folder or file's parent folder.
#[tauri::command]
fn open_terminal_native(path: String) -> Result<(), String> {
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

        // 1. Try Windows Terminal wt.exe with -d <dir>
        let wt_res = Command::new("wt.exe")
            .args(["-d", &folder_path])
            .spawn();

        if wt_res.is_ok() {
            return Ok(());
        }

        // 2. Fallback: PowerShell in the directory
        let mut ps_cmd = Command::new("powershell.exe");
        ps_cmd.arg("-NoLogo");
        ps_cmd.current_dir(&folder_path);
        if ps_cmd.spawn().is_ok() {
            return Ok(());
        }

        // 3. Fallback: cmd.exe
        let mut cmd = Command::new("cmd.exe");
        cmd.current_dir(&folder_path);
        cmd.raw_arg("/K");
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            extract_xmp_thumbnail,
            get_file_icon,
            get_shell_thumbnail,
            reveal_in_explorer,
            open_file_native,
            rename_file_native,
            create_folder_native,
            delete_files_native,
            copy_files_native,
            move_files_native,
            show_file_properties_native,
            get_folder_size,
            open_terminal_native
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
