(() => {
  const canvas = document.getElementById('overlayCanvas');
  const ctx = canvas.getContext('2d');
  const selectionBox = document.getElementById('selectionBox');
  const dimBadge = document.getElementById('dimBadge');
  const btnConfirm = document.getElementById('btnConfirmArea');
  const btnCancel = document.getElementById('btnCancelOverlay');
  const btnPresetMobile = document.getElementById('btnPresetMobile');
  const btnPreset1080 = document.getElementById('btnPreset1080');

  let isDrawing = false;
  let isMoving = false;
  let isResizing = false;
  let resizeHandle = null;

  let offsetBaseX = 0;
  let offsetBaseY = 0;
  let detectedMonitors = [];

  let mousePos = { x: -100, y: -100 };
  let startX = 0;
  let startY = 0;
  let moveOffset = { x: 0, y: 0 };

  let box = {
    x: 100,
    y: 100,
    w: 458,
    h: 812,
    active: false
  };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawMask();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function makeEven(val) {
    const v = Math.round(val);
    return v - (v % 2);
  }

  function drawMask() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dim the screen backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out the selected region if active
    if (box.active && box.w > 0 && box.h > 0) {
      ctx.clearRect(box.x, box.y, box.w, box.h);
    }

    // Draw Crosshair Guides & Reticle
    if (mousePos.x >= 0 && mousePos.y >= 0) {
      const mx = mousePos.x;
      const my = mousePos.y;

      ctx.save();
      // Fullscreen crosshair dashed lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(0, my);
      ctx.lineTo(canvas.width, my);
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, canvas.height);
      ctx.stroke();

      // Bright Solid Crosshair Reticle (+)
      ctx.setLineDash([]);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;

      const arm = 14;
      const gap = 4;

      ctx.beginPath();
      // Top arm
      ctx.moveTo(mx, my - gap);
      ctx.lineTo(mx, my - gap - arm);
      // Bottom arm
      ctx.moveTo(mx, my + gap);
      ctx.lineTo(mx, my + gap + arm);
      // Left arm
      ctx.moveTo(mx - gap, my);
      ctx.lineTo(mx - gap - arm, my);
      // Right arm
      ctx.moveTo(mx + gap, my);
      ctx.lineTo(mx + gap + arm, my);
      ctx.stroke();

      // Center ring
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Coordinates pill next to crosshair when not drawing
      if (!isDrawing && !box.active) {
        const text = `${mx}, ${my}`;
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
        ctx.shadowBlur = 0;
        const metrics = ctx.measureText(text);
        ctx.fillRect(mx + 16, my + 16, metrics.width + 12, 20);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.strokeRect(mx + 16, my + 16, metrics.width + 12, 20);
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(text, mx + 22, my + 30);
      }

      ctx.restore();
    }
  }

  function updateDomBox() {
    if (!box.active) {
      selectionBox.style.display = 'none';
      drawMask();
      return;
    }

    selectionBox.style.display = 'block';
    selectionBox.style.left = `${box.x}px`;
    selectionBox.style.top = `${box.y}px`;
    selectionBox.style.width = `${box.w}px`;
    selectionBox.style.height = `${box.h}px`;

    const actualX = Math.round(box.x + offsetBaseX);
    const actualY = Math.round(box.y + offsetBaseY);
    dimBadge.textContent = `${box.w} × ${box.h} px (X: ${actualX}, Y: ${actualY})`;
    drawMask();
  }

  // Mouse Down
  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#actionToolbar') || e.target.closest('.instruction-banner')) {
      return;
    }

    // Check if clicked on a resize handle
    if (e.target.classList.contains('handle')) {
      isResizing = true;
      resizeHandle = e.target.getAttribute('data-handle');
      startX = e.clientX;
      startY = e.clientY;
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // Check if clicked inside existing box to move it
    if (box.active &&
        e.clientX >= box.x && e.clientX <= box.x + box.w &&
        e.clientY >= box.y && e.clientY <= box.y + box.h) {
      isMoving = true;
      moveOffset.x = e.clientX - box.x;
      moveOffset.y = e.clientY - box.y;
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // Otherwise, start drawing a new rectangle
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    box.x = startX;
    box.y = startY;
    box.w = 0;
    box.h = 0;
    box.active = true;
    updateDomBox();
  });

  // Mouse Move
  window.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;

    if (isDrawing) {
      const curX = e.clientX;
      const curY = e.clientY;

      let x = Math.min(startX, curX);
      let y = Math.min(startY, curY);
      let w = Math.abs(curX - startX);
      let h = Math.abs(curY - startY);

      box.x = makeEven(x);
      box.y = makeEven(y);
      box.w = makeEven(Math.max(w, 32));
      box.h = makeEven(Math.max(h, 32));
      updateDomBox();
    } else if (isMoving) {
      let newX = e.clientX - moveOffset.x;
      let newY = e.clientY - moveOffset.y;
      box.x = Math.max(0, makeEven(newX));
      box.y = Math.max(0, makeEven(newY));
      updateDomBox();
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (resizeHandle.includes('e')) {
        box.w = Math.max(32, makeEven(box.w + dx));
        startX = e.clientX;
      }
      if (resizeHandle.includes('s')) {
        box.h = Math.max(32, makeEven(box.h + dy));
        startY = e.clientY;
      }
      if (resizeHandle.includes('w')) {
        const newW = Math.max(32, makeEven(box.w - dx));
        box.x = makeEven(box.x + (box.w - newW));
        box.w = newW;
        startX = e.clientX;
      }
      if (resizeHandle.includes('n')) {
        const newH = Math.max(32, makeEven(box.h - dy));
        box.y = makeEven(box.y + (box.h - newH));
        box.h = newH;
        startY = e.clientY;
      }
      updateDomBox();
    } else {
      drawMask();
    }
  });

  // Mouse Up
  window.addEventListener('mouseup', () => {
    isDrawing = false;
    isMoving = false;
    isResizing = false;
    resizeHandle = null;
    if (box.active && (box.w < 32 || box.h < 32)) {
      box.w = 458;
      box.h = 812;
      updateDomBox();
    }
  });

  function populateOverlayPresets(monitors) {
    const container = document.getElementById('overlayPresets');
    if (!container || !Array.isArray(monitors) || monitors.length === 0) return;

    container.innerHTML = '';

    monitors.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'action-btn action-btn-preset';
      btn.textContent = m.is_primary ? `🖥️ Main (${m.width}×${m.height})` : `🖥️ ${m.id} (${m.width}×${m.height})`;
      btn.title = `Snap selection box to ${m.label}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        box.x = m.x - offsetBaseX;
        box.y = m.y - offsetBaseY;
        box.w = m.width;
        box.h = m.height;
        box.active = true;
        updateDomBox();
      });
      container.appendChild(btn);
    });

    const btnMobile = document.createElement('button');
    btnMobile.className = 'action-btn action-btn-preset';
    btnMobile.textContent = '📱 458×812';
    btnMobile.title = 'Snap selection box to Mobile (458x812)';
    btnMobile.addEventListener('click', (e) => {
      e.stopPropagation();
      const cx = (mousePos.x >= 0 ? mousePos.x : (box.active ? box.x : 200));
      const cy = (mousePos.y >= 0 ? mousePos.y : (box.active ? box.y : 100));
      box.x = Math.max(0, cx - 229);
      box.y = Math.max(0, cy - 406);
      box.w = 458;
      box.h = 812;
      box.active = true;
      updateDomBox();
    });
    container.appendChild(btnMobile);
  }

  // Fallback initial preset buttons
  if (btnPresetMobile) {
    btnPresetMobile.addEventListener('click', (e) => {
      e.stopPropagation();
      box.w = 458;
      box.h = 812;
      box.active = true;
      updateDomBox();
    });
  }

  if (btnPreset1080) {
    btnPreset1080.addEventListener('click', (e) => {
      e.stopPropagation();
      box.w = 1920;
      box.h = 1080;
      box.active = true;
      updateDomBox();
    });
  }

  // Confirm selection
  async function confirm() {
    if (!box.active || box.w <= 0 || box.h <= 0) {
      const primary = detectedMonitors.find(m => m.is_primary) || detectedMonitors[0];
      if (primary) {
        box.x = primary.x - offsetBaseX;
        box.y = primary.y - offsetBaseY;
        box.w = primary.width;
        box.h = primary.height;
      } else {
        box.x = 100;
        box.y = 100;
        box.w = 458;
        box.h = 812;
      }
    }

    const finalX = Math.round(box.x + offsetBaseX);
    const finalY = Math.round(box.y + offsetBaseY);

    try {
      const tauri = window.__TAURI__;
      const invoke = (tauri && tauri.core && tauri.core.invoke) ? tauri.core.invoke : (window.__TAURI_INVOKE__ || null);
      if (invoke) {
        await invoke('confirm_selection', {
          x: finalX,
          y: finalY,
          width: makeEven(box.w),
          height: makeEven(box.h)
        });
      }
    } catch (err) {
      console.error("Failed to invoke confirm_selection:", err);
    }
  }

  // Cancel selection
  async function cancel() {
    try {
      const tauri = window.__TAURI__;
      const invoke = (tauri && tauri.core && tauri.core.invoke) ? tauri.core.invoke : (window.__TAURI_INVOKE__ || null);
      if (invoke) {
        await invoke('cancel_selection');
      }
    } catch (err) {
      console.error("Failed to invoke cancel_selection:", err);
    }
  }

  btnConfirm.addEventListener('click', (e) => {
    e.stopPropagation();
    confirm();
  });

  btnCancel.addEventListener('click', (e) => {
    e.stopPropagation();
    cancel();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancel();
    } else if (e.key === 'Enter') {
      confirm();
    } else if (box.active && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowUp') box.y = Math.max(0, box.y - step);
      if (e.key === 'ArrowDown') box.y = box.y + step;
      if (e.key === 'ArrowLeft') box.x = Math.max(0, box.x - step);
      if (e.key === 'ArrowRight') box.x = box.x + step;
      updateDomBox();
    }
  });

  // Reset when window opens
  window.addEventListener('focus', resizeCanvas);
  if (window.__TAURI__ && window.__TAURI__.event) {
    window.__TAURI__.event.listen('show-selector', (event) => {
      box.active = false;
      if (event.payload) {
        if (typeof event.payload.min_x === 'number') {
          offsetBaseX = event.payload.min_x;
        }
        if (typeof event.payload.min_y === 'number') {
          offsetBaseY = event.payload.min_y;
        }
        if (Array.isArray(event.payload.monitors)) {
          detectedMonitors = event.payload.monitors;
          populateOverlayPresets(detectedMonitors);
        }
      }
      resizeCanvas();
    });
  }

  drawMask();
})();
