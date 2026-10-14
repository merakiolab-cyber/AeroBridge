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
    #[cfg(windows)]
    {
        let mut drives = Vec::new();
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            if Path::new(&root).exists() {
                drives.push(NativePlace {
                    name: format!("Disk ({}:)", letter as char),
                    path: root,
                });
            }
        }
        drives
    }
    #[cfg(not(windows))]
    {
        vec![NativePlace {
            name: "/".to_string(),
            path: "/".to_string(),
        }]
    }
}

/// Quick-access places (Desktop, Documents, Pictures, ...) using OS known folders.
#[tauri::command]
fn get_user_places(app: tauri::AppHandle) -> Vec<NativePlace> {
    let resolver = app.path();
    let candidates: Vec<(&str, Result<std::path::PathBuf, tauri::Error>)> = vec![
        ("Plocha", resolver.desktop_dir()),
        ("Dokumenty", resolver.document_dir()),
        ("Stažené soubory", resolver.download_dir()),
        ("Obrázky", resolver.picture_dir()),
        ("Videa", resolver.video_dir()),
        ("Hudba", resolver.audio_dir()),
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
        let want = max_bytes.map(|m| m.min(len)).unwrap_or(len);
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

/// Streams through a file and extracts the largest <xmpGImg:image> base64 JPEG
/// (embedded preview used by InDesign, Illustrator, Photoshop and others).
fn extract_xmp_thumb_blocking(path: &str, max_scan: u64) -> Option<String> {
    const START: &[u8] = b"<xmpGImg:image>";
    const END: &[u8] = b"</xmpGImg:image>";
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
                match find_sub(&data[pos..], END) {
                    Some(i) => {
                        let mut done = collecting.take().unwrap();
                        done.extend_from_slice(&data[pos..pos + i]);
                        pos += i + END.len();
                        if done.len() > best.len() {
                            best = done;
                        }
                        found += 1;
                        if found >= 6 {
                            break 'outer;
                        }
                    }
                    None => {
                        let keep = END.len() - 1;
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
                match find_sub(&data[pos..], START) {
                    Some(i) => {
                        pos += i + START.len();
                        collecting = Some(Vec::new());
                    }
                    None => {
                        let keep = START.len() - 1;
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

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let formatted = path.replace('/', "\\");
        Command::new("explorer")
            .arg(format!("/select,\"{}\"", formatted))
            .spawn()
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
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
