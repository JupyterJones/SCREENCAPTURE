use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct MonitorDevice {
    pub id: String,
    pub label: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ScreenSetup {
    pub monitors: Vec<MonitorDevice>,
    pub all_screens: Option<MonitorDevice>,
    pub default_x: i32,
    pub default_y: i32,
    pub default_width: u32,
    pub default_height: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RecordingConfig {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub crf: u32,
    pub draw_mouse: bool,
    pub with_sound: bool,
    pub audio_source: String,
    pub output_dir: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AudioSource {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RecordingItem {
    pub name: String,
    pub path: String,
    pub size: String,
    pub date: String,
}

pub struct AppState {
    pub recording_child: Mutex<Option<Child>>,
    pub recording_file: Mutex<Option<PathBuf>>,
    pub start_time: Mutex<Option<std::time::Instant>>,
}

fn parse_geometry_str(s: &str) -> Option<(u32, u32, i32, i32)> {
    let plus_parts: Vec<&str> = s.split('+').collect();
    if plus_parts.len() == 3 {
        let x: i32 = plus_parts[1].parse().ok()?;
        let y: i32 = plus_parts[2].parse().ok()?;
        let wh: Vec<&str> = plus_parts[0].split('x').collect();
        if wh.len() == 2 {
            let w: u32 = wh[0].parse().ok()?;
            let h: u32 = wh[1].parse().ok()?;
            return Some((w, h, x, y));
        }
    }
    None
}

fn detect_monitors_xrandr() -> Option<Vec<MonitorDevice>> {
    let output = Command::new("xrandr").arg("--query").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut monitors = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[1] == "connected" {
            let name = parts[0].to_string();
            let is_primary = parts.contains(&"primary");

            for part in &parts[2..] {
                if let Some((w, h, x, y)) = parse_geometry_str(part) {
                    let label = if is_primary {
                        format!("🖥️ Primary: {} ({}×{})", name, w, h)
                    } else {
                        format!("🖥️ {} ({}×{})", name, w, h)
                    };
                    monitors.push(MonitorDevice {
                        id: name,
                        label,
                        x,
                        y,
                        width: w,
                        height: h,
                        is_primary,
                    });
                    break;
                }
            }
        }
    }

    if monitors.is_empty() {
        None
    } else {
        Some(monitors)
    }
}

fn detect_monitors_tauri(app: &AppHandle) -> Vec<MonitorDevice> {
    let mut devices = Vec::new();
    let primary_opt = app.primary_monitor().ok().flatten();

    if let Ok(monitors) = app.available_monitors() {
        for (idx, m) in monitors.into_iter().enumerate() {
            let pos = m.position();
            let size = m.size();
            let name = m.name().cloned().unwrap_or_else(|| format!("Monitor {}", idx + 1));
            let is_primary = if let Some(ref p) = primary_opt {
                p.position() == pos && p.size() == size
            } else {
                idx == 0
            };

            let label = if is_primary {
                format!("🖥️ Primary: {} ({}×{})", name, size.width, size.height)
            } else {
                format!("🖥️ {} ({}×{})", name, size.width, size.height)
            };

            devices.push(MonitorDevice {
                id: name,
                label,
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                is_primary,
            });
        }
    }
    devices
}

#[tauri::command]
fn get_screen_setup(app: AppHandle) -> Result<ScreenSetup, String> {
    let mut monitors = detect_monitors_xrandr()
        .unwrap_or_else(|| detect_monitors_tauri(&app));

    if monitors.is_empty() {
        monitors.push(MonitorDevice {
            id: "default".into(),
            label: "🖥️ Default Screen (1920×1080)".into(),
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            is_primary: true,
        });
    }

    monitors.sort_by(|a, b| {
        b.is_primary.cmp(&a.is_primary).then_with(|| a.x.cmp(&b.x))
    });

    let all_screens = if monitors.len() > 1 {
        let min_x = monitors.iter().map(|m| m.x).min().unwrap_or(0);
        let min_y = monitors.iter().map(|m| m.y).min().unwrap_or(0);
        let max_x = monitors.iter().map(|m| m.x + m.width as i32).max().unwrap_or(1920);
        let max_y = monitors.iter().map(|m| m.y + m.height as i32).max().unwrap_or(1080);
        let total_w = (max_x - min_x).max(64) as u32;
        let total_h = (max_y - min_y).max(64) as u32;

        Some(MonitorDevice {
            id: "all_screens".into(),
            label: format!("🌐 All Screens ({}×{})", total_w, total_h),
            x: min_x,
            y: min_y,
            width: total_w,
            height: total_h,
            is_primary: false,
        })
    } else {
        None
    };

    let primary = monitors.iter().find(|m| m.is_primary).unwrap_or(&monitors[0]);
    let default_x = primary.x;
    let default_y = primary.y;
    let default_width = primary.width;
    let default_height = primary.height;

    Ok(ScreenSetup {
        monitors,
        all_screens,
        default_x,
        default_y,
        default_width,
        default_height,
    })
}

fn get_virtual_desktop_bounds(app: &AppHandle) -> (i32, i32, u32, u32, Vec<MonitorDevice>) {
    let monitors = detect_monitors_xrandr()
        .unwrap_or_else(|| detect_monitors_tauri(app));

    if monitors.is_empty() {
        return (0, 0, 1920, 1080, vec![MonitorDevice {
            id: "default".into(),
            label: "🖥️ Default Screen (1920×1080)".into(),
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            is_primary: true,
        }]);
    }

    let min_x = monitors.iter().map(|m| m.x).min().unwrap_or(0);
    let min_y = monitors.iter().map(|m| m.y).min().unwrap_or(0);
    let max_x = monitors.iter().map(|m| m.x + m.width as i32).max().unwrap_or(1920);
    let max_y = monitors.iter().map(|m| m.y + m.height as i32).max().unwrap_or(1080);

    let total_w = (max_x - min_x).max(100) as u32;
    let total_h = (max_y - min_y).max(100) as u32;

    (min_x, min_y, total_w, total_h, monitors)
}

#[tauri::command]
fn open_area_selector(app: AppHandle) -> Result<(), String> {
    let (min_x, min_y, total_w, total_h, monitors) = get_virtual_desktop_bounds(&app);

    let payload = serde_json::json!({
        "min_x": min_x,
        "min_y": min_y,
        "width": total_w,
        "height": total_h,
        "monitors": monitors,
    });

    if let Some(win) = app.get_webview_window("selector") {
        let _ = win.set_fullscreen(false);
        let _ = win.set_always_on_top(true);
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: min_x,
            y: min_y,
        }));
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: total_w,
            height: total_h,
        }));
        let _ = win.show();
        let _ = win.set_focus();

        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: min_x,
            y: min_y,
        }));
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: total_w,
            height: total_h,
        }));

        let _ = app.emit("show-selector", payload);

        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(60));
            let _ = Command::new("xdotool")
                .args(["search", "--name", "Select Area"])
                .output()
                .map(|out| {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    for line in stdout.lines() {
                        let wid = line.trim();
                        if !wid.is_empty() {
                            let _ = Command::new("xdotool")
                                .args(["windowmove", wid, &min_x.to_string(), &min_y.to_string()])
                                .status();
                            let _ = Command::new("xdotool")
                                .args(["windowsize", wid, &total_w.to_string(), &total_h.to_string()])
                                .status();
                        }
                    }
                });
        });

        return Ok(());
    }

    let selector = tauri::WebviewWindowBuilder::new(
        &app,
        "selector",
        tauri::WebviewUrl::App("overlay.html".into()),
    )
    .title("Select Area")
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .fullscreen(false)
    .resizable(true)
    .position(min_x as f64, min_y as f64)
    .inner_size(total_w as f64, total_h as f64)
    .build()
    .map_err(|e| format!("Failed to create selector window: {}", e))?;

    let _ = selector.set_focus();
    let _ = app.emit("show-selector", payload);

    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(60));
        let _ = Command::new("xdotool")
            .args(["search", "--name", "Select Area"])
            .output()
            .map(|out| {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let wid = line.trim();
                    if !wid.is_empty() {
                        let _ = Command::new("xdotool")
                            .args(["windowmove", wid, &min_x.to_string(), &min_y.to_string()])
                            .status();
                        let _ = Command::new("xdotool")
                            .args(["windowsize", wid, &total_w.to_string(), &total_h.to_string()])
                            .status();
                    }
                }
            });
    });

    Ok(())
}

#[tauri::command]
fn confirm_selection(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("selector") {
        let _ = win.hide();
    }

    let payload = serde_json::json!({
        "x": x,
        "y": y,
        "width": width,
        "height": height
    });

    app.emit("area-selected", payload)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn cancel_selection(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("selector") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn toggle_frame_guide(
    app: AppHandle,
    show: bool,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Result<(), String> {
    if !show {
        if let Some(win) = app.get_webview_window("guide-frame") {
            let _ = win.hide();
        }
        return Ok(());
    }

    let px = (x - 2).max(0);
    let py = (y - 2).max(0);
    let pw = width + 4;
    let ph = height + 4;

    if let Some(win) = app.get_webview_window("guide-frame") {
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: px,
            y: py,
        }));
        let _ = win.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: pw,
            height: ph,
        }));
        let _ = win.show();
        return Ok(());
    }

    let _guide = tauri::WebviewWindowBuilder::new(
        &app,
        "guide-frame",
        tauri::WebviewUrl::App("frame.html".into()),
    )
    .title("Guide Frame")
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .position(px as f64, py as f64)
    .inner_size(pw as f64, ph as f64)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn get_audio_sources() -> Result<Vec<AudioSource>, String> {
    let output = Command::new("pactl")
        .args(["-f", "json", "list", "sources"])
        .output()
        .map_err(|e| format!("Failed to run pactl: {}", e))?;

    if !output.status.success() {
        return Ok(vec![AudioSource {
            name: "default".into(),
            description: "Default System Audio".into(),
        }]);
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse pactl json: {}", e))?;

    let mut sources = Vec::new();
    if let Some(arr) = json_val.as_array() {
        for item in arr {
            let name = item["name"].as_str().unwrap_or("").to_string();
            let desc = item["description"].as_str().unwrap_or(&name).to_string();
            if !name.is_empty() {
                sources.push(AudioSource {
                    name,
                    description: desc,
                });
            }
        }
    }

    if sources.is_empty() {
        sources.push(AudioSource {
            name: "default".into(),
            description: "Default System Audio".into(),
        });
    }

    Ok(sources)
}

fn get_base_dir() -> PathBuf {
    if let Ok(appimage_path) = std::env::var("APPIMAGE") {
        if let Some(parent) = Path::new(&appimage_path).parent() {
            let s = parent.to_string_lossy();
            if parent.exists() && !s.starts_with("/tmp") && !s.starts_with("/temp") {
                return parent.to_path_buf();
            }
        }
    }

    if let Ok(owd) = std::env::var("OWD") {
        let p = PathBuf::from(&owd);
        let s = p.to_string_lossy();
        if p.exists() && !s.starts_with("/tmp") && !s.starts_with("/temp") {
            return p;
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        let s = cwd.to_string_lossy();
        if !s.starts_with("/tmp") && !s.starts_with("/temp") {
            return cwd;
        }
    }

    PathBuf::from("/home/jack/Desktop/SCREENCAPTURE")
}

fn resolve_dir(dir_str: &str) -> PathBuf {
    let trimmed = dir_str.trim();
    if trimmed.is_empty() {
        return get_base_dir().join("temp");
    }

    // Never write to /temp or /tmp root paths - redirect to this directory's temp
    if trimmed == "/temp" || trimmed == "/tmp" || trimmed.starts_with("/tmp/") || trimmed.starts_with("/temp/") {
        let sub = trimmed
            .trim_start_matches("/temp")
            .trim_start_matches("/tmp")
            .trim_start_matches('/');
        if sub.is_empty() {
            return get_base_dir().join("temp");
        } else {
            return get_base_dir().join(sub);
        }
    }

    let p = Path::new(trimmed);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        let clean = trimmed.trim_start_matches("./");
        get_base_dir().join(clean)
    }
}

#[tauri::command]
fn get_default_save_dir() -> String {
    resolve_dir("./temp").to_string_lossy().to_string()
}

#[tauri::command]
fn start_recording(
    state: State<'_, AppState>,
    config: RecordingConfig,
) -> Result<String, String> {
    let mut lock = state.recording_child.lock().unwrap();
    if lock.is_some() {
        return Err("A recording is already active".into());
    }

    let out_dir = resolve_dir(&config.output_dir);
    if !out_dir.exists() {
        fs::create_dir_all(&out_dir)
            .map_err(|e| format!("Failed to create output directory {}: {}", out_dir.display(), e))?;
    }

    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let sound_tag = if config.with_sound { "audio" } else { "nosound" };
    let filename = format!("Capture_{}_{}.mp4", timestamp, sound_tag);
    let output_path = out_dir.join(filename);

    let w = config.width - (config.width % 2);
    let h = config.height - (config.height % 2);

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y");
    cmd.arg("-thread_queue_size").arg("1024");
    cmd.arg("-f").arg("x11grab");
    cmd.arg("-draw_mouse")
        .arg(if config.draw_mouse { "1" } else { "0" });
    cmd.arg("-framerate").arg(config.fps.to_string());
    cmd.arg("-video_size").arg(format!("{}x{}", w, h));
    cmd.arg("-i").arg(format!(":0.0+{},{}", config.x, config.y));

    if config.with_sound {
        cmd.arg("-thread_queue_size").arg("1024");
        cmd.arg("-f").arg("pulse");
        cmd.arg("-ac").arg("2");
        cmd.arg("-ar").arg("44100");
        let src = if config.audio_source.is_empty() {
            "default"
        } else {
            &config.audio_source
        };
        cmd.arg("-i").arg(src);
    }

    // Video encoding: pure screen capture H.264
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("veryfast");
    cmd.arg("-crf").arg(config.crf.to_string());
    cmd.arg("-pix_fmt").arg("yuv420p");

    if config.with_sound {
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("128k");
        cmd.arg("-ar").arg("44100");
        cmd.arg("-af").arg("aresample=async=1000");
    }

    cmd.arg(&output_path);

    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    *lock = Some(child);
    *state.recording_file.lock().unwrap() = Some(output_path.clone());
    *state.start_time.lock().unwrap() = Some(std::time::Instant::now());

    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
fn stop_recording(state: State<'_, AppState>) -> Result<String, String> {
    let mut child = {
        let mut lock = state.recording_child.lock().unwrap();
        lock.take().ok_or("No recording is currently in progress")?
    };

    let pid = child.id() as i32;

    // Send SIGINT - standard graceful interrupt for FFmpeg
    unsafe {
        libc::kill(pid, libc::SIGINT);
    }

    // Wait up to 5 seconds for clean exit and moov atom writing
    let start = std::time::Instant::now();
    let mut finished = false;
    while start.elapsed() < Duration::from_secs(5) {
        if let Ok(Some(_)) = child.try_wait() {
            finished = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    if !finished {
        let _ = child.kill();
        let _ = child.wait();
    }

    let file_path = state
        .recording_file
        .lock()
        .unwrap()
        .take()
        .unwrap_or_else(|| PathBuf::from("capture.mp4"));

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_recordings(dir: String) -> Result<Vec<RecordingItem>, String> {
    let path = resolve_dir(&dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension() {
                if ext == "mp4" {
                    let name = p
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let metadata = entry.metadata().ok();
                    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                    let size_str = if size_bytes > 1024 * 1024 {
                        format!("{:.1} MB", size_bytes as f64 / (1024.0 * 1024.0))
                    } else {
                        format!("{:.0} KB", size_bytes as f64 / 1024.0)
                    };

                    let date_str = metadata
                        .and_then(|m| m.modified().ok())
                        .map(|t| {
                            let dt: chrono::DateTime<Local> = t.into();
                            dt.format("%Y-%m-%d %H:%M").to_string()
                        })
                        .unwrap_or_else(|| "Unknown".into());

                    items.push(RecordingItem {
                        name,
                        path: p.to_string_lossy().to_string(),
                        size: size_str,
                        date: date_str,
                    });
                }
            }
        }
    }

    // Sort newest first
    items.sort_by(|a, b| b.date.cmp(&a.date));

    Ok(items)
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let resolved = resolve_dir(&path);
    let target_dir = if resolved.is_dir() {
        resolved
    } else {
        resolved.parent().unwrap_or(Path::new(".")).to_path_buf()
    };

    Command::new("xdg-open")
        .arg(&target_dir)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;
    Ok(())
}

#[tauri::command]
fn select_output_directory(current: String) -> Result<String, String> {
    let mut cmd = Command::new("zenity");
    cmd.args(["--file-selection", "--directory", "--title=Select Output Directory"]);
    if !current.is_empty() {
        cmd.arg(format!("--filename={}/", current));
    }

    let output = cmd.output().map_err(|e| format!("Failed to run zenity: {}", e))?;
    if output.status.success() {
        let chosen = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !chosen.is_empty() {
            return Ok(chosen);
        }
    }

    Ok(current)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            recording_child: Mutex::new(None),
            recording_file: Mutex::new(None),
            start_time: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            open_area_selector,
            confirm_selection,
            cancel_selection,
            toggle_frame_guide,
            get_screen_setup,
            get_audio_sources,
            get_default_save_dir,
            start_recording,
            stop_recording,
            list_recordings,
            open_file,
            open_folder,
            select_output_directory,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
