# Esperanza Screen Capture — Comprehensive User & Admin Guide

Welcome to the comprehensive instruction manual for **Esperanza Screen Capture (v2.0)**. This guide covers installation options, audio configuration, display detection, performance tuning, and troubleshooting for both end users and system administrators.

---

## Table of Contents

1. [Installation Methods](#1-installation-methods)
   - [Method A: Debian Package (.deb)](#method-a-debian-package-deb---recommended-for-ubuntudebianmint)
   - [Method B: Portable AppImage](#method-b-portable-appimage---all-linux-distributions)
   - [Method C: Direct Native Binary](#method-c-direct-native-binary)
2. [Interface & Core Features](#2-interface--core-features)
   - [Capture Region & Monitor Auto-Detection](#capture-region--monitor-auto-detection)
   - [Mouse Area Selector](#mouse-area-selector)
   - [Live Visual Guide Frame](#live-visual-guide-frame)
   - [Audio Modes (Desktop vs Microphone)](#audio-modes-desktop-vs-microphone)
   - [Framerate, Quality (CRF), and Mouse Visibility](#framerate-quality-crf-and-mouse-visibility)
3. [Managing Recordings & Output Folders](#3-managing-recordings--output-folders)
4. [Troubleshooting & Frequently Asked Questions](#4-troubleshooting--frequently-asked-questions)
   - [Why did other recorders produce unplayable MP4 files?](#why-did-other-recorders-produce-unplayable-mp4-files)
   - [AppImage does not launch (FUSE / permissions)](#appimage-does-not-launch-fuse--permissions)
   - [Desktop Audio is Silent](#desktop-audio-is-silent)
   - [Wayland vs X11 Notes](#wayland-vs-x11-notes)
5. [Developer & Build Guide](#5-developer--build-guide)

---

## 1. Installation Methods

### Method A: Debian Package (`.deb`) — Recommended for Ubuntu/Debian/Mint

The `.deb` package installs Esperanza Screen Capture system-wide into `/usr/bin/`, installs desktop menu entries, and configures application icons automatically.

#### 1. Graphical Installation
1. Locate the downloaded file: `esperanza-capture_2.0.0_amd64.deb`.
2. Double-click the file to open your system's installer (**Ubuntu Software**, **App Center**, or **GDebi**).
3. Click **Install** and enter your administrator password.

#### 2. Terminal Installation (Recommended)
Using `apt` ensures that any missing system libraries (`ffmpeg`, `zenity`, `libwebkit2gtk-4.1-0`) are fetched and installed automatically:
```bash
sudo apt update
sudo apt install ./esperanza-capture_2.0.0_amd64.deb
```

> **Note:** If you used `sudo dpkg -i esperanza-capture_2.0.0_amd64.deb` and encountered missing dependency errors, resolve them immediately by running:
> ```bash
> sudo apt install -f
> ```

#### Upgrading & Uninstalling
- **To upgrade**: Re-run `sudo apt install ./esperanza-capture_<new_version>_amd64.deb`.
- **To uninstall**:
  ```bash
  sudo apt remove esperanza-capture
  ```

---

### Method B: Portable AppImage — All Linux Distributions

The AppImage is a single self-contained executable that bundles its internal runtime dependencies. It runs on Ubuntu, Debian, Arch Linux, Fedora, Manjaro, openSUSE, and Linux Mint without needing root access.

#### 1. Making the AppImage Executable
Before running an AppImage on Linux, you must grant it execution permissions:

- **Via Terminal**:
  ```bash
  chmod +x EsperanzaScreenCapture-v2.AppImage
  ./EsperanzaScreenCapture-v2.AppImage
  ```
- **Via File Manager (GUI)**:
  1. Right-click `EsperanzaScreenCapture-v2.AppImage` and select **Properties**.
  2. Switch to the **Permissions** tab.
  3. Check the box **"Allow executing file as program"**.
  4. Double-click to launch.

#### 2. Creating a Desktop Shortcut (Optional)
If you want the AppImage to appear in your desktop application launcher menu:
1. Move the AppImage to a permanent folder, for example `~/Applications/`:
   ```bash
   mkdir -p ~/Applications
   mv EsperanzaScreenCapture-v2.AppImage ~/Applications/
   ```
2. Create a desktop launcher file:
   ```bash
   nano ~/.local/share/applications/esperanza-capture.desktop
   ```
3. Paste the following configuration:
   ```ini
   [Desktop Entry]
   Name=Esperanza Screen Capture
   Comment=Pure screen capture utility with native H.264
   Exec=/home/YOUR_USERNAME/Applications/EsperanzaScreenCapture-v2.AppImage
   Icon=video-display
   Terminal=false
   Type=Application
   Categories=AudioVideo;Recorder;
   ```
   *(Replace `YOUR_USERNAME` with your actual Linux user account).*

---

### Method C: Direct Native Binary

If you are developing or compiling locally:
```bash
./src-tauri/target/release/app
```
The raw native binary is under 11 MB and executes directly.

---

## 2. Interface & Core Features

### Capture Region & Monitor Auto-Detection

In Version 2.0, the application automatically interrogates your display hardware on launch. 
- **Auto-detected Chips**:
  - **🖥️ Primary**: Automatically highlights your primary display with its exact native resolution and X11 offset.
  - **🖥️ Secondary Displays**: Any additional monitors connected (DisplayPort, HDMI, USB-C, eDP) appear with their native resolutions.
  - **🌐 All Screens**: When multiple monitors are plugged in, an "All Screens" chip automatically computes the total combined desktop bounding box so you can record across all displays at once.
- **Aspect Ratio Presets**:
  - `🎬 1080p (1920×1080)`
  - `🎬 720p HD (1280×720)`
  - `📱 Mobile (458×812)` (centered on your active monitor)

### Mouse Area Selector
Click **"Select Area with Mouse"** to activate the interactive selector:
1. A transparent crosshair canvas appears across your screen.
2. Click and drag to draw a bounding rectangle around any app or window.
3. Use the **8 corner and edge handles** to resize the box freely.
4. Press <kbd>Enter</kbd> (or click **Confirm Selection**) to send the exact coordinates to the recorder.
5. Press <kbd>Esc</kbd> at any time to cancel.

### Live Visual Guide Frame
Enable the toggle:
> **[x] Show visual border frame around selected area on screen**

A translucent, border-only guide will float over your screen outlining the exact boundary FFmpeg will record. This ensures you never accidentally move a window out of frame while recording.

---

### Audio Modes (Desktop vs Microphone)

Esperanza Screen Capture provides two distinct recording modes:

#### 1. Mode 1: Without Sound (Silent Video)
- Ideal for silent tutorials, GIFs, code demonstrations, or screen documentation.
- Uses minimal CPU cycles as the audio encoder is completely bypassed.

#### 2. Mode 2: With Sound (Synchronized AAC)
When enabled, the app enumerates all available PulseAudio and PipeWire hardware devices and virtual monitor sinks:
- **Desktop Sound (What You Hear)**:  
  Select entries marked with `🖥️ [Desktop Sound] <device_name>.monitor`. This records YouTube playback, system alerts, Discord voices, games, and web audio.
- **Microphone**:  
  Select entries marked with `🎙️ [Microphone] alsa_input...`. This records your spoken voice.
- **Audio Refresh**:  
  If you plug in USB headphones or a microphone after launching the app, click the circular **Refresh Audio** button to reload devices immediately without restarting the app.

---

### Framerate, Quality (CRF), and Mouse Visibility

- **Framerate Options**:
  - `60 FPS`: Ultra-smooth capture (ideal for games and animations).
  - `30 FPS`: Standard fluid web and software tutorials.
  - `25 FPS`: Cinematic PAL standard.
  - `15 FPS`: Compact presentations and low-bandwidth recordings.
- **Quality / CRF**:
  - `CRF 18`: Visually lossless high-fidelity recording.
  - `CRF 20`: Recommended default (sharp text, excellent color reproduction, moderate file size).
  - `CRF 23`: Good balance for longer recordings.
  - `CRF 28`: Highly compressed for small file transfers.
- **Mouse Cursor**:
  - Toggle **Capture Cursor** or **Hide Cursor** depending on whether you want pointer movement visible.

---

## 3. Managing Recordings & Output Folders

- **Default Save Folder**: Recordings are placed in `./temp` relative to the application's base directory by default.
- **Custom Folder**: Click **Browse** to choose any folder on your disk.
- **"Always prompt where to save each time"**: When checked, a native file dialog will prompt you to choose the save destination before recording starts.
- **Recordings List**:
  - Below the controls, a live table lists recent MP4 files with file size and timestamp.
  - Click **Play** to immediately open the video in your default Linux media player (VLC, Celluloid, MPV, Totem).
  - Click **Folder** to open the containing folder in your file manager (Nautilus, Nemo, Dolphin, Thunar).

---

## 4. Troubleshooting & Frequently Asked Questions

### Why did other recorders produce unplayable MP4 files?

In standard MP4 containers, video frames are stored in an `mdat` block, and the index table is stored in a `moov` header atom. 
- If an FFmpeg process gets blocked by an unread pipe buffer, or gets forcefully terminated (`kill -9`), the `moov` atom is never written to disk. Media players will reject the file with `"moov atom not found"`.
- **Esperanza's Fix**: Unblocks all kernel pipes (`Stdio::null()`) so FFmpeg never stalls. When you click **Stop Recording**, the app sends a clean `SIGINT` signal. FFmpeg catches this signal immediately, writes the `moov` index atom, flushes the final frames, and cleanly exits in less than 100 milliseconds.

---

### AppImage does not launch (FUSE / permissions)

1. **Permission Denied**:
   Ensure executable permissions are set:
   ```bash
   chmod +x EsperanzaScreenCapture-v2.AppImage
   ```
2. **Missing FUSE 2 on Ubuntu 22.04+ / 24.04+**:
   Modern Ubuntu distributions sometimes do not have legacy `libfuse2` installed by default:
   ```bash
   sudo apt install libfuse2
   ```
   Or run the AppImage with extraction fallback:
   ```bash
   ./EsperanzaScreenCapture-v2.AppImage --appimage-extract-and-run
   ```

---

### Desktop Audio is Silent

1. Make sure you selected an audio device ending in `.monitor` (e.g., `alsa_output.pci-0000_00_1f.3.analog-stereo.monitor`).
2. If your system uses PipeWire, verify with `pactl info` that the PulseAudio compatibility layer is active.
3. Check `pavucontrol` (PulseAudio Volume Control) to ensure your output sink is unmuted.

---

### Wayland vs X11 Notes

Esperanza Screen Capture utilizes the high-speed FFmpeg `x11grab` engine.
- On standard **X11 (Xorg)** sessions, all features (mouse overlay, guide frame, recording) work out of the box.
- If you are running a **Wayland** session (e.g. default Fedora or Ubuntu on GNOME), select **"Ubuntu on Xorg"** or **"GNOME on Xorg"** at the login screen for optimal performance with `x11grab`.

---

## 5. Developer & Build Guide

### Directory Layout
```text
SCREENCAPTURE/
├── src-tauri/
│   ├── Cargo.toml          # Rust dependencies & metadata (v2.0.0)
│   ├── tauri.conf.json     # Tauri window configuration & deb bundles
│   └── src/
│       ├── main.rs         # Entrypoint
│       └── lib.rs          # Monitor detection, audio enumeration, FFmpeg process control
├── ui/
│   ├── index.html          # Main application control dashboard
│   ├── overlay.html        # Transparent area selection window
│   ├── frame.html          # Visual guide frame
│   ├── app.js              # IPC commands & dynamic monitor population
│   ├── overlay.js          # Selection box canvas & drag-and-drop math
│   └── style.css           # Obsidian dark theme styling
├── README.md               # GitHub project overview
└── INSTRUCTIONS.md         # Comprehensive user manual
```

### Compiling Bundles
```bash
# 1. Check Rust compilation
cd src-tauri && cargo check

# 2. Build Release .deb installer
cd .. && npx @tauri-apps/cli build --bundles deb

# 3. Build Release AppImage
npx @tauri-apps/cli build --bundles appimage
```

The resulting packages will be saved to:
- `src-tauri/target/release/bundle/deb/`
- `src-tauri/target/release/bundle/appimage/`
