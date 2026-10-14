use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NativeFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub modified_ms: u64,
    pub extension: String,
}

#[tauri::command]
fn pick_folder_native() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Vyberte složku médií — AeroBridge Studio")
        .pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_folder_native(path: String) -> Result<Vec<NativeFileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() || !dir.is_dir() {
        return Err("Zadaná cesta neexistuje nebo není složkou".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir).map_err(|e| format!("Chyba při čtení složky: {}", e))?;

    for entry_res in read_dir {
        if let Ok(entry) = entry_res {
            let metadata = entry.metadata().ok();
            let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_ms = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            let file_name = entry.file_name().to_string_lossy().to_string();
            let entry_path = entry.path().to_string_lossy().to_string();
            let extension = entry
                .path()
                .extension()
                .map(|ext| ext.to_string_lossy().to_string().to_lowercase())
                .unwrap_or_default();

            entries.push(NativeFileEntry {
                name: file_name,
                path: entry_path,
                size,
                is_dir,
                modified_ms,
                extension,
            });
        }
    }

    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Nelze přečíst soubor: {}", e))
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
            scan_folder_native,
            read_file_binary,
            reveal_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
