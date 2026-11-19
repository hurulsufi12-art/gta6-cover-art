// Wires the page: photo library, six layouts, five colour grades, caption
// lettering, per-panel crop and position, undo/redo and PNG export in the three
// common post sizes. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js).
import { drawCoverArt, layoutPanels, panelCountFor, EXPORT_SIZES, LAYOUT_ORDER, GRADES, GRADE_ORDER } from './cover.js';
import { CoverHistory, PhotoLibrary, loadImage, loadSamplePhotos, cloneCoverState, normalizePanels, defaultCoverState } from './editor.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subcaptionInput = document.getElementById('subcaption');
const status = document.getElementById('status');
const libraryEl = document.getElementById('library');
const layoutsEl = document.getElementById('layouts');
const gradesEl = document.getElementById('grades');
const sizesEl = document.getElementById('sizes');
const zoomInput = document.getElementById('zoom');
const panelLabel = document.getElementById('selectedPanel');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const resetBtn = document.getElementById('reset');
const exportBtn = document.getElementById('export');
const fillAllBtn = document.getElementById('fillAll');
const letteringSelect = document.getElementById('lettering');

let library = new PhotoLibrary();
let history = new CoverHistory(defaultCoverState());
// The live state is a copy of the history's current snapshot, never the
// snapshot itself: the editor mutates the live state in place (drag, typing,
// wheel zoom), and sharing the object would rewrite history's snapshot.
let state = cloneCoverState(history.current);
let selectedPanel = 0;
let uploadCount = 0;
let drag = null;

function currentSize() {
  return EXPORT_SIZES[state.size] || EXPORT_SIZES.square;
}

function sizeCanvas() {
  const { w, h } = currentSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function redraw() {
  sizeCanvas();
  drawCoverArt(canvas, state, library.images);
  undoBtn.disabled = !history.canUndo;
  redoBtn.disabled = !history.canRedo;
  const count = panelCountFor(state.layout);
  if (selectedPanel >= count) selectedPanel = 0;
  const panel = state.panels[selectedPanel];
  panelLabel.textContent = panel
    ? `Panel ${selectedPanel + 1} of ${count} — ${library.has(panel.photoId) ? panel.photoId : 'no photo'}`
    : 'No panel';
  zoomInput.value = String(Math.round((panel ? panel.zoom : 1) * 100));
}

function commit(next) {
  state = cloneCoverState(next);
  history.commit(state);
  redraw();
}

function patch(patchFn) {
  const next = cloneCoverState(state);
  patchFn(next);
  normalizePanels(next);
  commit(next);
}

function buildPickerButtons() {
  for (const key of LAYOUT_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layout-btn';
    b.dataset.layout = key;
    b.textContent = key === 'grid4' ? '▦ Grid' : key === 'hero3' ? '▤ Hero + 3' : key === 'fullbleed' ? '▣ Full-bleed' : key === 'tilted' ? '◇ Tilted' : key === 'duo' ? '▥ Duo' : '▤ Stack';
    b.addEventListener('click', () => {
      patch((s) => { s.layout = key; });
      refreshPickers();
    });
    layoutsEl.appendChild(b);
  }
  for (const key of GRADE_ORDER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grade-btn';
    b.dataset.grade = key;
    b.title = GRADES[key];
    b.style.setProperty('--swatch', gradeSwatch(key));
    b.addEventListener('click', () => {
      patch((s) => { s.grade = key; });
      refreshPickers();
    });
    gradesEl.appendChild(b);
  }
  for (const [key, size] of Object.entries(EXPORT_SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-btn';
    b.dataset.size = key;
    b.textContent = size.label;
    b.addEventListener('click', () => {
      patch((s) => { s.size = key; });
      refreshPickers();
    });
    sizesEl.appendChild(b);
  }
}

function gradeSwatch(key) {
  return {
    sunset: 'linear-gradient(135deg,#ff5c3c,#c82060 55%,#2b1838)',
    neon: 'linear-gradient(135deg,#00e5ff,#b02ca0 55%,#ff4fd8)',
    vice: 'linear-gradient(135deg,#ff5c96,#941c6e 55%,#2b1838)',
    teal: 'linear-gradient(135deg,#2cf2e0,#0c4a54 60%,#04161c)',
    golden: 'linear-gradient(135deg,#ffd166,#e88a2c 55%,#5a2c0c)',
  }[key];
}

function refreshPickers() {
  for (const b of layoutsEl.querySelectorAll('.layout-btn')) {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  }
  for (const b of gradesEl.querySelectorAll('.grade-btn')) {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  }
  for (const b of sizesEl.querySelectorAll('.size-btn')) {
    b.classList.toggle('active', b.dataset.size === state.size);
  }
  for (const b of libraryEl.querySelectorAll('.photo-btn')) {
    b.classList.toggle('active', state.panels[selectedPanel]?.photoId === b.dataset.photo);
  }
}

function refreshLibrary() {
  libraryEl.innerHTML = '';
  for (const { id, label } of library.list()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'photo-btn';
    b.dataset.photo = id;
    b.textContent = label;
    b.title = `Use ${label} in the selected panel`;
    b.addEventListener('click', () => {
      patch((s) => { s.panels[selectedPanel].photoId = id; });
      refreshPickers();
    });
    libraryEl.appendChild(b);
  }
  refreshPickers();
}

function exportCover() {
  const { w, h } = currentSize();
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCoverArt(off, state, library.images);
  off.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved cover-${w}x${h}.png — share it.`;
  }, 'image/png');
}

function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);
  const geo = layoutPanels(canvas.width, canvas.height, state.layout);
  const count = panelCountFor(state.layout);
  for (let i = count - 1; i >= 0; i--) {
    const p = geo.panels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit < 0) return;
  selectedPanel = hit;
  const panel = state.panels[hit];
  drag = { x: e.clientX, y: e.clientY, dx: panel.dx, dy: panel.dy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  refreshPickers();
  redraw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const geo = layoutPanels(canvas.width, canvas.height, state.layout);
  const p = geo.panels[selectedPanel];
  const scaleX = canvas.width / rect.width;
  const ddx = ((e.clientX - drag.x) * scaleX) / p.w;
  const ddy = ((e.clientY - drag.y) * scaleX) / p.h;
  if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
  const panel = state.panels[selectedPanel];
  panel.dx = Math.max(-1, Math.min(1, drag.dx + ddx));
  panel.dy = Math.max(-1, Math.min(1, drag.dy + ddy));
  drawCoverArt(canvas, state, library.images);
});

canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  const wasDrag = drag.moved;
  drag = null;
  if (wasDrag) commit(state);
  redraw();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(4, panel.zoom * (1 - e.deltaY * 0.0012)));
  drawCoverArt(canvas, state, library.images);
  zoomInput.value = String(Math.round(panel.zoom * 100));
  clearTimeout(canvas._zoomTimer);
  canvas._zoomTimer = setTimeout(() => commit(state), 350);
}, { passive: false });

zoomInput.addEventListener('input', () => {
  const panel = state.panels[selectedPanel];
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(4, Number(zoomInput.value) / 100));
  drawCoverArt(canvas, state, library.images);
});
zoomInput.addEventListener('change', () => commit(state));

document.getElementById('photoFile').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    if (!file.type.startsWith('image/')) continue;
    uploadCount += 1;
    const id = `upload-${uploadCount}`;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      library.add(id, img, file.name.replace(/\.[^.]+$/, '').slice(0, 18) || `Photo ${uploadCount}`);
    } catch {
      status.textContent = `Could not read ${file.name}.`;
    }
  }
  refreshLibrary();
  redraw();
});

fillAllBtn.addEventListener('click', () => {
  const photoId = state.panels[selectedPanel]?.photoId;
  if (!photoId) return;
  patch((s) => {
    for (const p of s.panels) p.photoId = photoId;
  });
  status.textContent = 'One photo fills every panel.';
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  drawCoverArt(canvas, state, library.images);
});
captionInput.addEventListener('change', () => commit(state));
subcaptionInput.addEventListener('input', () => {
  state.subcaption = subcaptionInput.value;
  drawCoverArt(canvas, state, library.images);
});
subcaptionInput.addEventListener('change', () => commit(state));
document.getElementById('lettering').addEventListener('change', (e) => {
  patch((s) => { s.lettering = e.target.value; });
});
undoBtn.addEventListener('click', () => {
  const prev = history.undo();
  if (prev) {
    state = prev;
    captionInput.value = state.caption;
    subcaptionInput.value = state.subcaption;
    letteringSelect.value = state.lettering;
    selectedPanel = 0;
    refreshPickers();
    redraw();
  }
});
redoBtn.addEventListener('click', () => {
  const next = history.redo();
  if (next) {
    state = next;
    captionInput.value = state.caption;
    subcaptionInput.value = state.subcaption;
    letteringSelect.value = state.lettering;
    selectedPanel = 0;
    refreshPickers();
    redraw();
  }
});
resetBtn.addEventListener('click', () => {
  history = new CoverHistory(defaultCoverState());
  state = cloneCoverState(history.current);
  selectedPanel = 0;
  captionInput.value = state.caption;
  subcaptionInput.value = state.subcaption;
  letteringSelect.value = state.lettering;
  refreshLibrary();
  redraw();
  status.textContent = 'Cover reset to the Neon Shore starting point.';
});
exportBtn.addEventListener('click', exportCover);

buildPickerButtons();

const shot = new URLSearchParams(location.search).get('shot');
await loadSamplePhotos(library);
refreshLibrary();

if (shot) {
  await runShot(shot, new URLSearchParams(location.search), async (scene) => {
    patchSilent(scene);
  });
  refreshPickers();
  redraw();
} else {
  redraw();
}
document.fonts.ready.then(() => redraw());

/** Applies a screenshot scene without touching the undo history. */
function patchSilent(scene) {
  const next = cloneCoverState(state);
  next.layout = scene.layout;
  next.grade = scene.grade;
  next.caption = scene.caption;
  next.subcaption = scene.subcaption;
  next.size = scene.size;
  normalizePanels(next);
  // Alternate the two sample photos across panels so the scene shows the
  // multi-photo look instead of one photo repeated.
  const other = scene.photo === 'pier' ? 'boulevard' : 'pier';
  next.panels.forEach((p, i) => { p.photoId = i % 2 === 0 ? scene.photo : other; });
  state = next;
  captionInput.value = state.caption;
  subcaptionInput.value = state.subcaption;
}
