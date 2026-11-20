// Golden Hour Cover Studio — editor UI: state, undo/redo, drag-to-crop,
// photo tray, layout / grade / title-style pickers, PNG export.
// All state lives in one object; every change pushes the old state onto the
// undo stack so Ctrl+Z / the Undo button can step back through the session.

import { LAYOUTS, GRADES, TITLE_STYLES, SIZES, renderCover, defaultPanels, layoutPanels } from './render.js';

export const LAYOUT_LABELS = {
  magazine: 'Magazine', ninegrid: 'Nine Grid', diagonal: 'Diagonal',
  strip: 'Film Strip', duo: 'Duo', fullbleed: 'Full Bleed',
};
export const GRADE_LABELS = {
  gold: 'Gold', tealnoir: 'Teal Noir', peach: 'Peach',
  mint: 'Mint', mono: 'Mono', coral: 'Coral',
};
export const GRADE_SWATCHES = {
  gold: '#c98a2e', tealnoir: '#1f6f6b', peach: '#e07856',
  mint: '#4fae8a', mono: '#555555', coral: '#e14b5a',
};
export const TITLE_STYLE_LABELS = { solid: 'Solid', outline: 'Outline', stamp: 'Stamp' };
export const SIZE_LABELS = { square: '1080 × 1080', portrait: '1080 × 1350', wide: '1920 × 1080' };

export function freshState() {
  return {
    layout: 'magazine',
    grade: 'gold',
    titleStyle: 'outline',
    size: 'wide',
    caption: 'GOLDEN HOUR',
    subcaption: 'chasing the sun in Palm Bay',
    tag: 'PALM BAY',
    panels: defaultPanels('magazine'),
    selectedPanel: 0,
  };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

// Keep the panel list in step when the layout changes: reuse crops where a
// panel index still exists, otherwise start from the layout default.
export function syncPanelsForLayout(state) {
  const fresh = defaultPanels(state.layout);
  const old = state.panels || [];
  state.panels = fresh.map((p, i) => old[i] ? { ...p, ...old[i] } : p);
  state.selectedPanel = 0;
}

export class Studio {
  constructor(canvas, photos) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.photos = photos; // { pier: img, boulevard: img, ...user photos }
    this.state = freshState();
    this.undoStack = [];
    this.redoStack = [];
    this.drag = null; // { panel, startX, startY, cx, cy }
    this.onChange = null;
  }

  get size() { return SIZES[this.state.size] || SIZES.wide; }

  pushHistory() {
    this.undoStack.push(cloneState(this.state));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(cloneState(this.state));
    this.state = this.undoStack.pop();
    this.render();
    if (this.onChange) this.onChange();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(cloneState(this.state));
    this.state = this.redoStack.pop();
    this.render();
    if (this.onChange) this.onChange();
  }

  // Apply a state change (records history, re-renders, refreshes controls).
  update(fn) {
    this.pushHistory();
    fn(this.state);
    this.render();
    if (this.onChange) this.onChange();
  }

  setLayout(layout) {
    this.update((s) => { s.layout = layout; syncPanelsForLayout(s); });
  }

  setGrade(grade) { this.update((s) => { s.grade = grade; }); }
  setTitleStyle(style) { this.update((s) => { s.titleStyle = style; }); }
  setSize(size) { this.update((s) => { s.size = size; }); }

  setCaption(text) { this.update((s) => { s.caption = text; }); }
  setSubcaption(text) { this.update((s) => { s.subcaption = text; }); }
  setTag(text) { this.update((s) => { s.tag = text; }); }

  // Put a photo into the selected panel.
  assignPhoto(photoKey) {
    this.update((s) => {
      const p = s.panels[s.selectedPanel];
      if (p) { p.photo = photoKey; p.cx = 0.5; p.cy = 0.5; p.zoom = 1; }
    });
  }

  // Fill every panel with the same photo.
  fillAll(photoKey) {
    this.update((s) => {
      s.panels.forEach((p) => { p.photo = photoKey; p.cx = 0.5; p.cy = 0.5; p.zoom = 1; });
    });
  }

  selectPanel(index) {
    this.state.selectedPanel = index;
    this.render();
    if (this.onChange) this.onChange();
  }

  render() {
    const { w, h } = this.size;
    this.canvas.width = w;
    this.canvas.height = h;
    renderCover(this.ctx, w, h, this.state, this.photos);
    // Outline the selected panel so the user sees which one they are cropping.
    const { panels } = layoutPanels(this.state.layout, w, h);
    const sel = panels[this.state.selectedPanel];
    if (sel) {
      this.ctx.save();
      this.ctx.strokeStyle = '#b3541e';
      this.ctx.lineWidth = Math.max(4, w * 0.004);
      this.ctx.setLineDash([18, 10]);
      this.ctx.strokeRect(sel.x + 3, sel.y + 3, sel.w - 6, sel.h - 6);
      this.ctx.restore();
    }
  }

  // Which panel (if any) sits under a point in canvas pixels.
  panelAt(px, py) {
    const { w, h } = this.size;
    const { panels } = layoutPanels(this.state.layout, w, h);
    for (let i = panels.length - 1; i >= 0; i--) {
      const r = panels[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
  }

  // Begin a drag-to-crop on the panel under the pointer.
  pointerDown(px, py) {
    const i = this.panelAt(px, py);
    if (i < 0) return false;
    this.pushHistory();
    const p = this.state.panels[i];
    this.state.selectedPanel = i;
    this.drag = { panel: i, startX: px, startY: py, cx: p.cx, cy: p.cy };
    this.render();
    if (this.onChange) this.onChange();
    return true;
  }

  pointerMove(px, py) {
    if (!this.drag) return;
    const { w, h } = this.size;
    const { panels } = layoutPanels(this.state.layout, w, h);
    const rect = panels[this.drag.panel];
    const p = this.state.panels[this.drag.panel];
    if (!rect || !p) return;
    // Dragging the photo moves the crop window the opposite way.
    p.cx = clamp(this.drag.cx - (px - this.drag.startX) / rect.w, 0, 1);
    p.cy = clamp(this.drag.cy - (py - this.drag.startY) / rect.h, 0, 1);
    this.render();
  }

  pointerUp() { this.drag = null; }

  // Scroll to zoom the selected panel's photo.
  wheelZoom(deltaY) {
    const p = this.state.panels[this.state.selectedPanel];
    if (!p) return;
    this.pushHistory();
    p.zoom = clamp((p.zoom || 1) * (deltaY < 0 ? 1.12 : 0.89), 1, 3);
    this.render();
  }

  // Render the cover at a post size and trigger a PNG download.
  exportPng(sizeKey) {
    const { w, h } = SIZES[sizeKey] || SIZES.square;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    renderCover(ctx, w, h, this.state, this.photos);
    const a = document.createElement('a');
    const slug = (this.state.caption || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
    a.download = `golden-hour-${slug}-${w}x${h}.png`;
    a.href = off.toDataURL('image/png');
    a.click();
  }
}

export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Build the control column (photo tray, layout / grade / title-style pickers,
// caption fields, export buttons) inside `root`, wired to a Studio.
export function buildControls(root, studio, photoList) {
  root.innerHTML = '';
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const section = (title) => {
    const s = el('section', 'panel');
    s.appendChild(el('h2', 'panel-title', title));
    root.appendChild(s);
    return s;
  };

  // 1 — Photos.
  const photos = section('1 · Photos');
  const addBtn = el('label', 'btn btn-outline', '＋ Add your photos');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.hidden = true;
  fileInput.addEventListener('change', () => {
    for (const file of fileInput.files) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const key = 'user-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
        studio.photos[key] = img;
        photoList.push({ key, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Your photo', src: url });
        buildControls(root, studio, photoList);
        studio.render();
      };
      img.src = url;
    }
    fileInput.value = '';
  });
  addBtn.appendChild(fileInput);
  photos.appendChild(addBtn);
  const tray = el('div', 'tray');
  photoList.forEach((ph) => {
    const b = el('button', 'thumb', ph.name);
    b.style.backgroundImage = `url("${ph.src}")`;
    b.title = 'Click to put this photo in the selected panel';
    b.addEventListener('click', () => studio.assignPhoto(ph.key));
    tray.appendChild(b);
  });
  photos.appendChild(tray);
  const hint = el('p', 'hint', 'Click a photo to put it in the selected panel. Click a panel in the preview to select it, drag to move the photo, scroll to zoom.');
  photos.appendChild(hint);
  const fillBtn = el('button', 'btn btn-outline', 'Fill every panel with this photo');
  fillBtn.addEventListener('click', () => {
    const p = studio.state.panels[studio.state.selectedPanel];
    if (p) studio.fillAll(p.photo);
  });
  photos.appendChild(fillBtn);

  // 2 — Layout.
  const layoutSec = section('2 · Layout');
  const layoutGrid = el('div', 'chip-grid');
  LAYOUTS.forEach((l) => {
    const b = el('button', 'chip' + (studio.state.layout === l ? ' active' : ''), LAYOUT_LABELS[l]);
    b.addEventListener('click', () => { studio.setLayout(l); buildControls(root, studio, photoList); });
    layoutGrid.appendChild(b);
  });
  layoutSec.appendChild(layoutGrid);

  // 3 — Colour grade.
  const gradeSec = section('3 · Colour grade');
  const gradeGrid = el('div', 'chip-grid');
  GRADES.forEach((g) => {
    const b = el('button', 'chip swatch' + (studio.state.grade === g ? ' active' : ''), GRADE_LABELS[g]);
    b.style.setProperty('--sw', GRADE_SWATCHES[g]);
    b.addEventListener('click', () => { studio.setGrade(g); buildControls(root, studio, photoList); });
    gradeGrid.appendChild(b);
  });
  gradeSec.appendChild(gradeGrid);

  // 4 — Title style.
  const styleSec = section('4 · Title style');
  const styleGrid = el('div', 'chip-grid');
  TITLE_STYLES.forEach((t) => {
    const b = el('button', 'chip' + (studio.state.titleStyle === t ? ' active' : ''), TITLE_STYLE_LABELS[t]);
    b.addEventListener('click', () => { studio.setTitleStyle(t); buildControls(root, studio, photoList); });
    styleGrid.appendChild(b);
  });
  styleSec.appendChild(styleGrid);

  // 5 — Caption.
  const capSec = section('5 · Caption');
  const capLabel = el('label', 'field-label', 'Title');
  const capInput = document.createElement('input');
  capInput.className = 'field';
  capInput.value = studio.state.caption;
  capInput.maxLength = 28;
  capInput.addEventListener('input', () => studio.setCaption(capInput.value));
  capSec.appendChild(capLabel);
  capSec.appendChild(capInput);
  const subLabel = el('label', 'field-label', 'Sub-caption');
  const subInput = document.createElement('input');
  subInput.className = 'field';
  subInput.value = studio.state.subcaption;
  subInput.maxLength = 60;
  subInput.addEventListener('input', () => studio.setSubcaption(subInput.value));
  capSec.appendChild(subLabel);
  capSec.appendChild(subInput);
  const tagLabel = el('label', 'field-label', 'Place tag');
  const tagInput = document.createElement('input');
  tagInput.className = 'field';
  tagInput.value = studio.state.tag;
  tagInput.maxLength = 20;
  tagInput.addEventListener('input', () => studio.setTag(tagInput.value));
  capSec.appendChild(tagLabel);
  capSec.appendChild(tagInput);

  // 6 — Size + export.
  const expSec = section('6 · Export PNG');
  const sizeGrid = el('div', 'chip-grid');
  Object.keys(SIZES).forEach((k) => {
    const b = el('button', 'chip' + (studio.state.size === k ? ' active' : ''), SIZE_LABELS[k]);
    b.addEventListener('click', () => { studio.setSize(k); buildControls(root, studio, photoList); });
    sizeGrid.appendChild(b);
  });
  expSec.appendChild(sizeGrid);
  const dl = el('button', 'btn btn-primary', '⬇ Download cover PNG');
  dl.addEventListener('click', () => studio.exportPng(studio.state.size));
  expSec.appendChild(dl);
  const undoRow = el('div', 'row');
  const undoBtn = el('button', 'btn btn-outline', '↩ Undo');
  undoBtn.addEventListener('click', () => { studio.undo(); buildControls(root, studio, photoList); });
  const redoBtn = el('button', 'btn btn-outline', '↪ Redo');
  redoBtn.addEventListener('click', () => { studio.redo(); buildControls(root, studio, photoList); });
  undoRow.appendChild(undoBtn);
  undoRow.appendChild(redoBtn);
  expSec.appendChild(undoRow);
}
