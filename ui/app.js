(() => {
  // DOM Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const areaSummary = document.getElementById('areaSummary');
  const presetsContainer = document.getElementById('presetsContainer');
  const btnSelectArea = document.getElementById('btnSelectArea');

  const inputX = document.getElementById('inputX');
  const inputY = document.getElementById('inputY');
  const inputW = document.getElementById('inputW');
  const inputH = document.getElementById('inputH');

  const btnNudgeMinus50 = document.getElementById('btnNudgeMinus50');
  const btnNudgeMinus10 = document.getElementById('btnNudgeMinus10');
  const btnNudgePlus10 = document.getElementById('btnNudgePlus10');
  const btnNudgePlus50 = document.getElementById('btnNudgePlus50');

  const checkShowFrame = document.getElementById('checkShowFrame');

  const modeNoSound = document.getElementById('modeNoSound');
  const modeWithSound = document.getElementById('modeWithSound');
  const audioDeviceRow = document.getElementById('audioDeviceRow');
  const selectAudioSource = document.getElementById('selectAudioSource');
  const btnRefreshAudio = document.getElementById('btnRefreshAudio');

  const selectFps = document.getElementById('selectFps');
  const selectQuality = document.getElementById('selectQuality');
  const selectMouse = document.getElementById('selectMouse');
  const inputOutputDir = document.getElementById('inputOutputDir');
  const checkAskWhereToSave = document.getElementById('checkAskWhereToSave');
  const btnBrowseFolder = document.getElementById('btnBrowseFolder');
  const btnOpenFolder = document.getElementById('btnOpenFolder');

  const btnRefreshRecs = document.getElementById('btnRefreshRecs');
  const recordingsList = document.getElementById('recordingsList');

  const timerDisplay = document.getElementById('timerDisplay');
  const timerSub = document.getElementById('timerSub');
  const btnMainRecord = document.getElementById('btnMainRecord');
  const recBtnLabel = document.getElementById('recBtnLabel');
  const recIcon = document.getElementById('recIcon');

  // State
  let isRecording = false;
  let recordingStartTime = null;
  let timerInterval = null;
  let withSound = true;

  function makeEven(val) {
    const v = Math.round(Number(val) || 0);
    return v - (v % 2);
  }

  function updateSummary() {
    const x = Math.max(0, Math.round(Number(inputX.value) || 0));
    const y = Math.max(0, Math.round(Number(inputY.value) || 0));
    const w = makeEven(inputW.value);
    const h = makeEven(inputH.value);

    inputW.value = w;
    inputH.value = h;
    areaSummary.textContent = `${w} × ${h} at (${x}, ${y})`;

    if (checkShowFrame.checked) {
      updateGuideFrame(true);
    }
  }

  // Input listeners
  [inputX, inputY, inputW, inputH].forEach(input => {
    input.addEventListener('input', updateSummary);
    input.addEventListener('change', updateSummary);
  });

  // Preset chips delegation
  if (presetsContainer) {
    presetsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.preset-chip');
      if (!chip) return;

      presetsContainer.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      inputX.value = chip.getAttribute('data-x');
      inputY.value = chip.getAttribute('data-y');
      inputW.value = chip.getAttribute('data-w');
      inputH.value = chip.getAttribute('data-h');
      updateSummary();
    });
  }

  // Nudge buttons for Width and Height
  function nudgeSize(amount) {
    let w = Math.max(64, makeEven(Number(inputW.value) + amount));
    let h = Math.max(64, makeEven(Number(inputH.value) + amount));
    inputW.value = w;
    inputH.value = h;
    updateSummary();
  }

  btnNudgeMinus50.addEventListener('click', () => nudgeSize(-50));
  btnNudgeMinus10.addEventListener('click', () => nudgeSize(-10));
  btnNudgePlus10.addEventListener('click', () => nudgeSize(10));
  btnNudgePlus50.addEventListener('click', () => nudgeSize(50));

  function getTauriInvoke() {
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      return window.__TAURI__.core.invoke;
    }
    if (typeof window.__TAURI_INVOKE__ === 'function') {
      return window.__TAURI_INVOKE__;
    }
    return null;
  }

  // Audio mode toggle
  modeNoSound.addEventListener('click', () => {
    withSound = false;
    modeNoSound.classList.add('selected');
    modeWithSound.classList.remove('selected');
    audioDeviceRow.style.display = 'none';
  });

  modeWithSound.addEventListener('click', () => {
    withSound = true;
    modeWithSound.classList.add('selected');
    modeNoSound.classList.remove('selected');
    audioDeviceRow.style.display = 'flex';
  });

  // Select Area with Mouse
  btnSelectArea.addEventListener('click', async () => {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        await invoke('open_area_selector');
      } else {
        alert("Tauri IPC not connected. Please make sure the app was launched with Tauri.");
      }
    } catch (err) {
      alert("Failed to open area selector: " + err);
      console.error("Failed to open area selector:", err);
    }
  });

  // Listen to Tauri events from Rust backend
  if (window.__TAURI__ && window.__TAURI__.event) {
    window.__TAURI__.event.listen('area-selected', (event) => {
      const payload = event.payload;
      if (payload) {
        inputX.value = payload.x;
        inputY.value = payload.y;
        inputW.value = makeEven(payload.width);
        inputH.value = makeEven(payload.height);
        updateSummary();
      }
    });

    window.__TAURI__.event.listen('recording-stopped-auto', () => {
      handleRecordingStopped();
    });
  }

  // Guide frame toggle
  async function updateGuideFrame(show) {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        await invoke('toggle_frame_guide', {
          show: Boolean(show),
          x: Math.round(Number(inputX.value) || 0),
          y: Math.round(Number(inputY.value) || 0),
          width: makeEven(inputW.value),
          height: makeEven(inputH.value)
        });
      }
    } catch (err) {
      console.error("Failed to toggle guide frame:", err);
    }
  }

  checkShowFrame.addEventListener('change', (e) => {
    updateGuideFrame(e.target.checked);
  });

  // Audio Sources list
  async function loadAudioSources() {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        const sources = await invoke('get_audio_sources');
        if (Array.isArray(sources) && sources.length > 0) {
          selectAudioSource.innerHTML = '';
          // Add default
          const defaultOpt = document.createElement('option');
          defaultOpt.value = 'default';
          defaultOpt.textContent = '⚙️ Default System Audio';
          selectAudioSource.appendChild(defaultOpt);

          sources.forEach(src => {
            const opt = document.createElement('option');
            opt.value = src.name;
            const isMonitor = src.name.endsWith('.monitor');
            opt.textContent = `${isMonitor ? '🖥️ [Desktop Sound]' : '🎙️ [Microphone]'} ${src.description || src.name}`;
            selectAudioSource.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.warn("Could not load pulse audio sources:", err);
    }
  }

  btnRefreshAudio.addEventListener('click', loadAudioSources);

  // Folder browse & open
  btnBrowseFolder.addEventListener('click', async () => {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        const dir = await invoke('select_output_directory', {
          current: inputOutputDir.value
        });
        if (dir) {
          inputOutputDir.value = dir;
          loadRecordings();
        }
      }
    } catch (err) {
      console.error("Browse folder error:", err);
    }
  });

  btnOpenFolder.addEventListener('click', async () => {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        await invoke('open_folder', {
          path: inputOutputDir.value
        });
      }
    } catch (err) {
      console.error("Open folder error:", err);
    }
  });

  // Timer formatting
  function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  function startTimer() {
    recordingStartTime = Date.now();
    timerDisplay.textContent = "00:00:00";
    timerSub.textContent = "Recording in progress...";
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      timerDisplay.textContent = formatTime(elapsed);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerSub.textContent = "Finished & Saved";
  }

  // Record Button Click
  btnMainRecord.addEventListener('click', async () => {
    if (!isRecording) {
      // Start Recording
      let targetDir = inputOutputDir.value.trim() || './temp';
      const invoke = getTauriInvoke();
      if (checkAskWhereToSave.checked) {
        try {
          if (invoke) {
            const chosen = await invoke('select_output_directory', {
              current: targetDir
            });
            if (chosen) {
              targetDir = chosen;
              inputOutputDir.value = chosen;
            }
          }
        } catch (e) {
          console.warn("Folder dialog dismissed or error:", e);
        }
      }

      const config = {
        x: Math.max(0, Math.round(Number(inputX.value) || 0)),
        y: Math.max(0, Math.round(Number(inputY.value) || 0)),
        width: makeEven(inputW.value),
        height: makeEven(inputH.value),
        fps: Number(selectFps.value) || 25,
        crf: Number(selectQuality.value) || 20,
        draw_mouse: selectMouse.value === '1',
        with_sound: withSound,
        audio_source: selectAudioSource.value || 'default',
        output_dir: targetDir
      };

      try {
        btnMainRecord.disabled = true;
        if (invoke) {
          await invoke('start_recording', { config });
        }

        isRecording = true;
        btnMainRecord.disabled = false;
        btnMainRecord.classList.add('is-recording');
        recBtnLabel.textContent = "Stop & Save Video";
        recIcon.innerHTML = `<rect x="6" y="6" width="12" height="12" rx="2"></rect>`;

        statusBadge.classList.add('recording');
        statusText.textContent = "RECORDING";

        startTimer();
      } catch (err) {
        btnMainRecord.disabled = false;
        alert("Failed to start recording: " + err);
      }
    } else {
      // Stop Recording
      try {
        btnMainRecord.disabled = true;
        recBtnLabel.textContent = "Finalizing video...";
        const invoke = getTauriInvoke();
        if (invoke) {
          await invoke('stop_recording');
        }
        handleRecordingStopped();
      } catch (err) {
        btnMainRecord.disabled = false;
        alert("Failed to stop recording: " + err);
      }
    }
  });

  function handleRecordingStopped() {
    isRecording = false;
    btnMainRecord.disabled = false;
    btnMainRecord.classList.remove('is-recording');
    recBtnLabel.textContent = "Start Recording";
    recIcon.innerHTML = `<circle cx="12" cy="12" r="9"></circle>`;

    statusBadge.classList.remove('recording');
    statusText.textContent = "Ready";

    stopTimer();
    loadRecordings();
  }

  // Recordings list
  async function loadRecordings() {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        const list = await invoke('list_recordings', {
          dir: inputOutputDir.value
        });

        if (Array.isArray(list) && list.length > 0) {
          recordingsList.innerHTML = '';
          list.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recording-item';
            item.innerHTML = `
              <div class="rec-info">
                <div class="rec-name" title="${rec.name}">${rec.name}</div>
                <div class="rec-meta">${rec.size} • ${rec.date}</div>
              </div>
              <div class="rec-actions">
                <button class="btn-sm btn-play" title="Play with system player">▶ Play</button>
                <button class="btn-sm btn-folder" title="Show file in folder">📁 Folder</button>
              </div>
            `;

            item.querySelector('.btn-play').addEventListener('click', async () => {
              await invoke('open_file', { path: rec.path });
            });

            item.querySelector('.btn-folder').addEventListener('click', async () => {
              await invoke('open_folder', { path: rec.path });
            });

            recordingsList.appendChild(item);
          });
        } else {
          recordingsList.innerHTML = `
            <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px;">
              No MP4 captures in folder yet.
            </div>
          `;
        }
      }
    } catch (err) {
      console.warn("Could not list recordings:", err);
    }
  }

  btnRefreshRecs.addEventListener('click', loadRecordings);

  // Keyboard shortcut: Space to Start/Stop recording when not focused on an input
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
      e.preventDefault();
      btnMainRecord.click();
    }
  });

  async function loadScreenSetup() {
    try {
      const invoke = getTauriInvoke();
      if (!invoke) return;

      const setup = await invoke('get_screen_setup');
      if (!setup || !presetsContainer) return;

      presetsContainer.innerHTML = '';

      // 1. Detected Monitors
      let activated = false;
      if (Array.isArray(setup.monitors) && setup.monitors.length > 0) {
        setup.monitors.forEach((m, idx) => {
          const isPrimaryMatch = (m.x === setup.default_x && m.y === setup.default_y && m.width === setup.default_width && m.height === setup.default_height) || (m.is_primary && !activated) || (idx === 0 && !activated);
          if (isPrimaryMatch) activated = true;

          const chip = document.createElement('button');
          chip.className = `preset-chip ${isPrimaryMatch ? 'active' : ''}`;
          chip.setAttribute('data-x', m.x);
          chip.setAttribute('data-y', m.y);
          chip.setAttribute('data-w', m.width);
          chip.setAttribute('data-h', m.height);
          chip.textContent = m.label;
          presetsContainer.appendChild(chip);
        });
      }

      // 2. All Screens (if multiple monitors detected)
      if (setup.all_screens) {
        const chip = document.createElement('button');
        chip.className = 'preset-chip';
        chip.setAttribute('data-x', setup.all_screens.x);
        chip.setAttribute('data-y', setup.all_screens.y);
        chip.setAttribute('data-w', setup.all_screens.width);
        chip.setAttribute('data-h', setup.all_screens.height);
        chip.textContent = setup.all_screens.label;
        presetsContainer.appendChild(chip);
      }

      // 3. Common Video Standard Presets (aligned to primary screen's offset)
      const baseX = setup.default_x || 0;
      const baseY = setup.default_y || 0;

      const standardPresets = [
        { label: '🎬 1080p (1920×1080)', w: 1920, h: 1080 },
        { label: '🎬 720p HD (1280×720)', w: 1280, h: 720 },
        { label: '📱 Mobile (458×812)', w: 458, h: 812 }
      ];

      standardPresets.forEach(p => {
        const chip = document.createElement('button');
        chip.className = 'preset-chip';
        chip.setAttribute('data-x', baseX);
        chip.setAttribute('data-y', baseY);
        chip.setAttribute('data-w', p.w);
        chip.setAttribute('data-h', p.h);
        chip.textContent = p.label;
        presetsContainer.appendChild(chip);
      });

      // Initialize inputs with auto-detected primary monitor coordinates
      inputX.value = setup.default_x;
      inputY.value = setup.default_y;
      inputW.value = setup.default_width;
      inputH.value = setup.default_height;
      updateSummary();
    } catch (err) {
      console.warn("Could not load screen setup:", err);
    }
  }

  async function initDefaultSaveDir() {
    try {
      const invoke = getTauriInvoke();
      if (invoke) {
        const defaultDir = await invoke('get_default_save_dir');
        if (defaultDir) {
          inputOutputDir.value = defaultDir;
        }
      }
    } catch (e) {
      console.warn("Could not fetch default save dir:", e);
    }
    loadRecordings();
  }

  // Initialize
  updateSummary();
  loadScreenSetup();
  loadAudioSources();
  initDefaultSaveDir();
})();
