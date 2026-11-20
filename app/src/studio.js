// Golden Hour Cover Studio — the editor.
//
// Owns the page state (layout, grade, size, caption, the photo pool and one
// slot per panel), paints the live preview through render.js, and handles
// picking a panel, dragging it to pan, scrolling it to zoom, loading photos
// from the machine and exporting the finished cover as a PNG.

import { SIZES, GRADES, LAYOUTS, layoutById, gradeById, sizeById, drawCover, defaultPanels } from './render.js';

const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', src: 'samples/pier.jpg' },
];

export function freshState() {
  return {
    layout: 'hero-split',
    grade: 'vice-sunset',
    size: 'wide',
    title: 'GOLDEN HOUR',
    subtitle: 'A Vice City story',
    panels: defaultPanels(9, 2),
    selected: 0,
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

export function createStudio(root) {
  const state = freshState();
  const photos = []; // pool: Image objects, index = panel slot's .photo
  const photoNames = [];
  const $ = (sel) => root.querySelector(sel);
  const preview = $('#preview');
  const pctx = preview.getContext('2d');

  let ready = Promise.resolve();
  let rendered = 0;

  function panelCount() {
    return layoutById(state.layout).panels().length;
  }

  function paint() {
    const size = sizeById(state.size);
    const scale = Math.min(760 / size.w, 520 / size.h);
    preview.width = Math.round(size.w * scale);
    preview.height = Math.round(size.h * scale);
    drawCover(pctx, preview.width, preview.height, state, photos);
    rendered++;
    // Selection outline, drawn in preview pixels.
    const panels = layoutById(state.layout).panels();
    const p = panels[state.selected];
    if (p) {
      pctx.save();
      pctx.strokeStyle = '#00e5ff';
      pctx.lineWidth = 3;
      pctx.setLineDash([10, 6]);
      pctx.strokeRect(p.x * preview.width + 2, p.y * preview.height + 2, p.w * preview.width - 4, p.h * preview.height - 4);
      pctx.restore();
    }
  }

  function syncPanelControls() {
    const slot = state.panels[state.selected];
    const sel = $('#panel-photo');
    sel.innerHTML = '';
    photoNames.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${i + 1} · ${name}`;
      sel.appendChild(opt);
    });
    sel.value = String(slot.photo);
    $('#panel-zoom').value = String(slot.zoom);
    $('#panel-label').textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
  }

  function buildPickers() {
    const layoutBox = $('#layout-picker');
    LAYOUTS.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.layout = l.id;
      b.textContent = l.name;
      b.addEventListener('click', () => {
        state.layout = l.id;
        state.selected = 0;
        state.panels = defaultPanels(9, Math.max(1, photos.length));
        document.querySelectorAll('#layout-picker .pick').forEach((el) => el.classList.toggle('active', el.dataset.layout === l.id));
        syncPanelControls();
        paint();
      });
      layoutBox.appendChild(b);
    });
    layoutBox.querySelector('[data-layout="hero-split"]').classList.add('active');

    const gradeBox = $('#grade-picker');
    GRADES.forEach((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.grade = g.id;
      b.title = g.name;
      b.style.background = `linear-gradient(135deg, ${g.top} 0%, ${g.mid} 55%, ${g.deep} 100%)`;
      const label = document.createElement('span');
      label.textContent = g.name;
      b.appendChild(label);
      b.addEventListener('click', () => {
        state.grade = g.id;
        document.querySelectorAll('#grade-picker .swatch').forEach((el) => el.classList.toggle('active', el.dataset.grade === g.id));
        paint();
      });
      gradeBox.appendChild(b);
    });
    gradeBox.querySelector('[data-grade="vice-sunset"]').classList.add('active');

    const sizeBox = $('#size-picker');
    SIZES.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.size = s.id;
      b.textContent = s.name;
      b.addEventListener('click', () => {
        state.size = s.id;
        document.querySelectorAll('#size-picker .pick').forEach((el) => el.classList.toggle('active', el.dataset.size === s.id));
        paint();
      });
      sizeBox.appendChild(b);
    });
    sizeBox.querySelector('[data-size="wide"]').classList.add('active');
  }

  function bindInputs() {
    $('#title-input').addEventListener('input', (e) => { state.title = e.target.value; paint(); });
    $('#subtitle-input').addEventListener('input', (e) => { state.subtitle = e.target.value; paint(); });
    $('#panel-photo').addEventListener('change', (e) => {
      state.panels[state.selected].photo = Number(e.target.value);
      paint();
    });
    $('#panel-zoom').addEventListener('input', (e) => {
      state.panels[state.selected].zoom = Number(e.target.value);
      paint();
    });
    $('#panel-centre').addEventListener('click', () => {
      const slot = state.panels[state.selected];
      slot.dx = 0; slot.dy = 0; slot.zoom = 1;
      syncPanelControls();
      paint();
    });
    $('#photo-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        if (photos.length >= 6) { photos.shift(); photoNames.shift(); }
        photos.push(img);
        photoNames.push(file.name);
        state.panels[state.selected].photo = photos.length - 1;
        syncPanelControls();
        paint();
      } finally {
        URL.revokeObjectURL(url);
      }
      e.target.value = '';
    });
    $('#export-btn').addEventListener('click', () => exportCover());
    $('#shuffle-btn').addEventListener('click', () => {
      state.panels = defaultPanels(9, Math.max(1, photos.length)).map((s, i) => ({
        ...s,
        photo: (s.photo + i) % Math.max(1, photos.length),
      }));
      syncPanelControls();
      paint();
    });
  }

  // Pick a panel by clicking the preview; drag pans it, wheel zooms it.
  function bindPreview() {
    let dragging = false;
    let lastX = 0, lastY = 0;

    function pickPanel(clientX, clientY) {
      const r = preview.getBoundingClientRect();
      const fx = (clientX - r.left) / r.width;
      const fy = (clientY - r.top) / r.height;
      const panels = layoutById(state.layout).panels();
      let best = -1;
      panels.forEach((p, i) => {
        if (fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) best = i;
      });
      return best;
    }

    preview.addEventListener('pointerdown', (e) => {
      const i = pickPanel(e.clientX, e.clientY);
      if (i < 0) return;
      state.selected = i;
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      preview.setPointerCapture(e.pointerId);
      syncPanelControls();
      paint();
    });
    preview.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = preview.getBoundingClientRect();
      const slot = state.panels[state.selected];
      slot.dx += ((e.clientX - lastX) / r.width) * 1.2;
      slot.dy += ((e.clientY - lastY) / r.height) * 1.2;
      slot.dx = Math.max(-1, Math.min(1, slot.dx));
      slot.dy = Math.max(-1, Math.min(1, slot.dy));
      lastX = e.clientX; lastY = e.clientY;
      paint();
    });
    preview.addEventListener('pointerup', () => { dragging = false; });
    preview.addEventListener('wheel', (e) => {
      e.preventDefault();
      const slot = state.panels[state.selected];
      slot.zoom = Math.max(0.5, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      syncPanelControls();
      paint();
    }, { passive: false });
  }

  function exportCover() {
    const size = sizeById(state.size);
    const off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    drawCover(off.getContext('2d'), size.w, size.h, state, photos);
    return new Promise((resolve) => {
      off.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `golden-hour-cover-${state.size}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        resolve(blob);
      }, 'image/png');
    });
  }

  // Render a cover offscreen at full size (used by the shot driver and the
  // tests); resolves with the canvas.
  function renderOffscreen(overrides = {}) {
    const merged = { ...state, ...overrides };
    const size = sizeById(merged.size);
    const off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    drawCover(off.getContext('2d'), size.w, size.h, merged, photos);
    return off;
  }

  async function init() {
    buildPickers();
    bindInputs();
    bindPreview();
    $('#title-input').value = state.title;
    $('#subtitle-input').value = state.subtitle;
    ready = (async () => {
      for (const s of SAMPLES) {
        try {
          const img = await loadImage(s.src);
          photos.push(img);
          photoNames.push(s.name);
        } catch { /* a missing sample just leaves its slot painted */ }
      }
      await document.fonts.ready;
      syncPanelControls();
      paint();
    })();
    await ready;
  }

  return {
    state, photos, photoNames, init,
    paint, syncPanelControls, exportCover, renderOffscreen,
    get ready() { return ready; },
    get renders() { return rendered; },
  };
}
