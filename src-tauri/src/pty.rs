use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize, Child};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    /// Recent output, replayed when the frontend re-attaches to a still-running session.
    scrollback: Arc<Mutex<Vec<u8>>>,
}

/// Keep roughly the last 512 KiB of output per session.
const SCROLLBACK_LIMIT: usize = 512 * 1024;

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Terminates every running shell (called when the app exits).
    pub fn kill_all(&self) {
        if let Ok(mut map) = self.sessions.lock() {
            for (_, mut session) in map.drain() {
                let _ = session.child.kill();
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PtyOutputPayload {
    pub data: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PtyExitPayload {
    pub exit_code: Option<u32>,
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    id: String,
    cwd: Option<String>,
    shell: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    manager: State<'_, PtyManager>,
) -> Result<String, String> {
    // A session with this id is already running (e.g. the webview was reloaded): re-attach and replay its output
    // instead of spawning a second shell.
    {
        let map = manager.sessions.lock().unwrap();
        if let Some(existing) = map.get(&id) {
            let buf = existing.scrollback.lock().unwrap();
            return Ok(String::from_utf8_lossy(&buf).to_string());
        }
    }

    let pty_system = native_pty_system();
    let pty_size = PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(pty_size)
        .map_err(|e| format!("Nepodařilo se otevřít PTY: {}", e))?;

    let shell_choice = shell.unwrap_or_else(|| "powershell".to_string()).to_lowercase();
    let mut cmd = match shell_choice.as_str() {
        "cmd" => CommandBuilder::new("cmd.exe"),
        "wsl" => CommandBuilder::new("wsl.exe"),
        _ => {
            let mut c = CommandBuilder::new("powershell.exe");
            c.arg("-NoLogo");
            c
        }
    };

    if let Some(dir) = cwd {
        if !dir.is_empty() {
            cmd.cwd(dir);
        }
    }

    // Set standard terminal environment variables
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Nepodařilo se spustit proces shellu: {}", e))?;

    // Drop slave in parent process to avoid keeping PTY open
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Nepodařilo se získat PTY reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Nepodařilo se získat PTY writer: {}", e))?;

    let scrollback: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
    let session = PtySession {
        master: pair.master,
        writer,
        child,
        scrollback: Arc::clone(&scrollback),
    };

    {
        let mut map = manager.sessions.lock().unwrap();
        map.insert(id.clone(), session);
    }

    // Spawn reader thread
    let app_clone = app.clone();
    let session_id = id.clone();
    let sessions_ref = Arc::clone(&manager.sessions);
    let scrollback_ref = Arc::clone(&scrollback);

    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let event_data_name = format!("pty-data-{}", session_id);
        let event_exit_name = format!("pty-exit-{}", session_id);

        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // EOF - process terminated
                    break;
                }
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    // Append and emit under one lock so a re-attaching snapshot never misses a chunk
                    if let Ok(mut sb) = scrollback_ref.lock() {
                        sb.extend_from_slice(&buf[..n]);
                        if sb.len() > SCROLLBACK_LIMIT {
                            let excess = sb.len() - SCROLLBACK_LIMIT;
                            sb.drain(..excess);
                        }
                        let _ = app_clone.emit(&event_data_name, PtyOutputPayload { data: text });
                    }
                }
                Err(_) => {
                    // Read error (e.g. broken pipe when child exits)
                    break;
                }
            }
        }

        // Clean up session and emit exit event
        let sess_opt = if let Ok(mut map) = sessions_ref.lock() {
            map.remove(&session_id)
        } else {
            None
        };

        let mut exit_code = None;
        if let Some(mut sess) = sess_opt {
            if let Ok(status) = sess.child.wait() {
                exit_code = Some(status.exit_code());
            }
        }

        let _ = app_clone.emit(&event_exit_name, PtyExitPayload { exit_code });
    });

    Ok(String::new())
}

#[tauri::command]
pub fn pty_write(
    id: String,
    data: String,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let mut map = manager.sessions.lock().unwrap();
    if let Some(session) = map.get_mut(&id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Chyba zápisu do PTY: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Chyba flush PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("PTY relace {} nebyla nalezena", id))
    }
}

#[tauri::command]
pub fn pty_resize(
    id: String,
    cols: u16,
    rows: u16,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let mut map = manager.sessions.lock().unwrap();
    if let Some(session) = map.get_mut(&id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Chyba změny velikosti PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("PTY relace {} nebyla nalezena", id))
    }
}

#[tauri::command]
pub fn pty_kill(
    id: String,
    manager: State<'_, PtyManager>,
) -> Result<(), String> {
    let mut map = manager.sessions.lock().unwrap();
    if let Some(mut session) = map.remove(&id) {
        let _ = session.child.kill();
        Ok(())
    } else {
        Ok(())
    }
}
