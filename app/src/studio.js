// Golden Hour Cover Studio — editor: state, undo/redo, panel editing, export.
// Owns the live preview canvas and every control in the sidebar. Photos are
// kept in a small registry keyed by id (sample names or `upload-<n>`); the
// undo history stores only ids plus crop offsets, never image pixels.

import { paintCover, layoutPanels, LAYOUT_NAMES, GRADE_NAMES, TITLE_STYLES, EXPORT_SIZES } from './render.js';

export const SAMPLE_PHOTOS = [
  { id: 'boulevard', src: 'samples/boulevard.jpg', label: 'Boulevard' },
  { id: 'pier', src: 'samples/pier.jpg', label: 'Pier' },
];

export function freshState() {
  return {
    layout: 'magazine',
    grade: 'gold',
    titleStyle: 'outline',
    title: 'GOLDEN HOUR',
    sub: 'chasing the sun in Palm Bay',
    tag: 'PALM BAY',
    size: 'wide',
    selected: 0,
    badges: { stars: true, est: true, pin: true },
    // One slot per panel index; a slot is { photo: id, ox, oy, zoom } or null.
    slots: [null, null, null, null, null, null, null, null],
    activePhoto: 'pier',
  };
}

// Deep-clone a state snapshot for the history stack.
function snap(state) {
  return JSON.parse(JSON.stringify(state));
}

export class Studio {
  constructor(preview, statusEl) {
    this.preview = preview;
    this.status = statusEl;
    this.state = freshState();
    this.photos = new Map(); // id -> HTMLImageElement
    this.past = [];
    this.future = [];
    this.drag = null;
    this.onChange = null;
    this._bindCanvas();
  }

  async loadPhoto(id, src) {
    if (this.photos.has(id)) return this.photos.get(id);
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`cannot load ${src}`));
      im.src = src;
    });
    this.photos.set(id, img);
    return img;
  }

  async loadSamples() {
    for (const s of SAMPLE_PHOTOS) {
      try { await this.loadPhoto(s.id, s.src); } catch { /* sample missing: slot stays empty */ }
    }
  }

  // --- history ------------------------------------------------------------
  commit(label) {
    this.past.push(snap(this.state));
    if (this.past.length > 60) this.past.shift();
    this.future.length = 0;
    if (label && this.status) this.status.textContent = label;
  }

  undo() {
    if (!this.past.length) return false;
    this.future.push(snap(this.state));
    this.state = this.past.pop();
    this.render();
    if (this.status) this.status.textContent = 'Undid one step.';
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    this.past.push(snap(this.state));
    this.state = this.future.pop();
    this.render();
    if (this.status) this.status.textContent = 'Redid one step.';
    return true;
  }

  // --- edits --------------------------------------------------------------
  set(key, value, label) {
    this.commit(label || `Changed ${key}.`);
    this.state[key] = value;
    this.render();
  }

  setBadge(key, value) {
    this.commit(`${key} badge ${value ? 'on' : 'off'}.`);
    this.state.badges[key] = value;
    this.render();
  }

  setSlotText(key, value) {
    this.state[key] = value;
    this.render();
  }

  commitText(label) {
    this.commit(label);
    this.render();
  }

  placePhoto(slotIndex) {
    const id = this.state.activePhoto;
    if (!id || !this.photos.has(id)) return;
    this.commit(`Photo placed in panel ${slotIndex + 1}.`);
    this.state.slots[slotIndex] = { photo: id, ox: 0, oy: 0, zoom: 1 };
    this.state.selected = slotIndex;
    this.render();
  }

  fillAll() {
    const id = this.state.activePhoto;
    if (!id || !this.photos.has(id)) return;
    this.commit('Filled every panel with one photo.');
    const layout = layoutPanels(this.state.layout, 100, 100);
    this.state.slots = this.state.slots.map((_, i) => (i < layout.panels.length ? { photo: id, ox: 0, oy: 0, zoom: 1 } : null));
    this.render();
  }

  async addUpload(file) {
    const id = `upload-${Date.now()}`;
    const url = URL.createObjectURL(file);
    const img = await this.loadPhoto(id, url);
    this.state.activePhoto = id;
    return { id, img, name: file.name };
  }

  // --- rendering ----------------------------------------------------------
  panelImages() {
    const layout = layoutPanels(this.state.layout, this.preview.width, this.preview.height);
    return layout.panels.map((_, i) => {
      const slot = this.state.slots[i];
      if (!slot) return null;
      const img = this.photos.get(slot.photo);
      return img ? { img, ox: slot.ox, oy: slot.oy, zoom: slot.zoom } : null;
    });
  }

  render() {
    paintCover(this.preview, {
      layout: this.state.layout,
      grade: this.state.grade,
      titleStyle: this.state.titleStyle,
      title: this.state.title,
      sub: this.state.sub,
      tag: this.state.tag,
      panels: this.panelImages(),
      badges: this.state.badges,
      selected: this.state.selected,
    });
    if (this.onChange) this.onChange(this.state);
  }

  // --- export -------------------------------------------------------------
  async exportPng(sizeKey) {
    const size = EXPORT_SIZES[sizeKey || this.state.size] || EXPORT_SIZES.square;
    const off = document.createElement('canvas');
    off.width = size.w;
    off.height = size.h;
    const layout = layoutPanels(this.state.layout, size.w, size.h);
    const panels = layout.panels.map((_, i) => {
      const slot = this.state.slots[i];
      if (!slot) return null;
      const img = this.photos.get(slot.photo);
      return img ? { img, ox: slot.ox, oy: slot.oy, zoom: slot.zoom } : null;
    });
    paintCover(off, {
      layout: this.state.layout,
      grade: this.state.grade,
      titleStyle: this.state.titleStyle,
      title: this.state.title,
      sub: this.state.sub,
      tag: this.state.tag,
      panels,
      badges: this.state.badges,
      selected: -1,
    });
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `golden-hour-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    if (this.status) this.status.textContent = `Exported ${size.label} PNG.`;
    return { w: size.w, h: size.h, bytes: blob.size };
  }

  // --- pointer interaction on the preview canvas --------------------------
  _panelAt(clientX, clientY) {
    const rect = this.preview.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.preview.width;
    const y = ((clientY - rect.top) / rect.height) * this.preview.height;
    const layout = layoutPanels(this.state.layout, this.preview.width, this.preview.height);
    for (let i = 0; i < layout.panels.length; i++) {
      const p = layout.panels[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
    }
    return -1;
  }

  _bindCanvas() {
    const cv = this.preview;
    cv.addEventListener('pointerdown', (e) => {
      const i = this._panelAt(e.clientX, e.clientY);
      if (i < 0) return;
      cv.setPointerCapture(e.pointerId);
      this.drag = { panel: i, startX: e.clientX, startY: e.clientY, moved: false, before: snap(this.state) };
      if (this.state.selected !== i) {
        this.state.selected = i;
        this.render();
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const rect = cv.getBoundingClientRect();
      const dx = (e.clientX - this.drag.startX) / rect.width;
      const dy = (e.clientY - this.drag.startY) / rect.height;
      if (Math.abs(dx) + Math.abs(dy) > 0.004) this.drag.moved = true;
      const slot = this.state.slots[this.drag.panel];
      if (!slot || !this.drag.moved) return;
      const before = this.drag.before.slots[this.drag.panel];
      slot.ox = Math.max(-0.6, Math.min(0.6, (before ? before.ox : 0) + dx));
      slot.oy = Math.max(-0.6, Math.min(0.6, (before ? before.oy : 0) + dy));
      this.render();
    });
    cv.addEventListener('pointerup', (e) => {
      if (!this.drag) return;
      const d = this.drag;
      this.drag = null;
      if (d.moved) {
        this.past.push(d.before);
        this.future.length = 0;
        if (this.status) this.status.textContent = 'Moved the photo inside its panel.';
      } else {
        // A plain click places the active photo in the panel.
        this.placePhoto(d.panel);
      }
    });
    cv.addEventListener('wheel', (e) => {
      const i = this._panelAt(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      const slot = this.state.slots[i];
      if (!slot) return;
      this.commit('Zoomed the panel photo.');
      slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
      this.render();
    }, { passive: false });
  }
}

// Build the sidebar controls into `root` and wire them to a Studio.
// Returns the studio. Kept separate from the class so shots.js can drive
// the same studio without the sidebar.
export function buildControls(root, studio) {
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };

  const section = (title) => {
    const h = el('h2', title);
    root.appendChild(h);
    const div = el('div', undefined, 'group');
    root.appendChild(div);
    return div;
  };

  // Photos
  const photos = section('1 · Photos');
  const tray = el('div', undefined, 'tray');
  for (const s of SAMPLE_PHOTOS) {
    const b = el('button', s.label, 'thumb-btn');
    b.type = 'button';
    b.dataset.photo = s.id;
    b.addEventListener('click', () => {
      studio.state.activePhoto = s.id;
      studio.render();
      tray.querySelectorAll('.thumb-btn').forEach((x) => x.classList.toggle('active', x === b));
    });
    if (s.id === studio.state.activePhoto) b.classList.add('active');
    tray.appendChild(b);
  }
  photos.appendChild(tray);
  const fileLabel = el('label', 'Add your own photo ', 'file-label');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    const added = await studio.addUpload(f);
    const b = el('button', added.name.slice(0, 18), 'thumb-btn active');
    b.type = 'button';
    b.addEventListener('click', () => { studio.state.activePhoto = added.id; studio.render(); });
    tray.appendChild(b);
    studio.fillAll();
  });
  fileLabel.appendChild(file);
  photos.appendChild(fileLabel);
  const fill = el('button', 'Fill every panel with this photo', 'wide-btn');
  fill.type = 'button';
  fill.addEventListener('click', () => studio.fillAll());
  photos.appendChild(fill);
  const hint = el('p', 'Click a panel to place the photo · drag inside a panel to move it · scroll over a panel to zoom.', 'hint');
  photos.appendChild(hint);

  // Layouts
  const layouts = section('2 · Layout — 6 ways');
  for (const name of LAYOUT_NAMES) {
    const b = el('button', name, 'chip');
    b.type = 'button';
    b.addEventListener('click', () => {
      studio.set('layout', name, `Layout: ${name}.`);
      layouts.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === b));
    });
    if (name === studio.state.layout) b.classList.add('active');
    layouts.appendChild(b);
  }

  // Grades
  const grades = section('3 · Golden-hour grade — 6 looks');
  for (const name of GRADE_NAMES) {
    const b = el('button', name, 'chip grade-' + name);
    b.type = 'button';
    b.addEventListener('click', () => {
      studio.set('grade', name, `Grade: ${name}.`);
      grades.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === b));
    });
    if (name === studio.state.grade) b.classList.add('active');
    grades.appendChild(b);
  }

  // Lettering
  const letter = section('4 · Lettering');
  for (const name of TITLE_STYLES) {
    const b = el('button', name, 'chip');
    b.type = 'button';
    b.addEventListener('click', () => {
      studio.set('titleStyle', name, `Title style: ${name}.`);
      letter.querySelectorAll('.chip').forEach((x) => x.classList.toggle('active', x === b));
    });
    if (name === studio.state.titleStyle) b.classList.add('active');
    letter.appendChild(b);
  }

  // Caption
  const cap = section('5 · Caption');
  const mkField = (labelText, key, max) => {
    const lab = el('label', labelText);
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = max;
    input.value = studio.state[key];
    input.addEventListener('input', () => studio.setSlotText(key, input.value));
    input.addEventListener('change', () => studio.commitText(`Edited ${labelText.toLowerCase()}.`));
    lab.appendChild(input);
    cap.appendChild(lab);
  };
  mkField('Title', 'title', 40);
  mkField('Sub-caption', 'sub', 64);
  mkField('Place tag', 'tag', 24);

  // Badges
  const badges = section('6 · Sticker badges');
  const badgeDefs = [['stars', '★★★★★ star row'], ['est', 'EST. 2026 round badge'], ['pin', 'Location-pin tag']];
  for (const [key, labelText] of badgeDefs) {
    const lab = el('label', undefined, 'check');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = studio.state.badges[key];
    box.addEventListener('change', () => studio.setBadge(key, box.checked));
    lab.appendChild(box);
    lab.appendChild(document.createTextNode(' ' + labelText));
    badges.appendChild(lab);
  }

  // Export
  const exp = section('7 · Export PNG');
  const sizeSel = document.createElement('select');
  for (const [key, s] of Object.entries(EXPORT_SIZES)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = s.label;
    if (key === studio.state.size) o.selected = true;
    sizeSel.appendChild(o);
  }
  sizeSel.addEventListener('change', () => { studio.state.size = sizeSel.value; });
  exp.appendChild(sizeSel);
  const go = el('button', 'Export cover as PNG', 'export-btn');
  go.type = 'button';
  go.addEventListener('click', () => studio.exportPng());
  exp.appendChild(go);

  // Undo / redo
  const hist = section('History');
  const undoBtn = el('button', '↩ Undo (Ctrl+Z)', 'chip');
  undoBtn.type = 'button';
  undoBtn.addEventListener('click', () => studio.undo());
  const redoBtn = el('button', '↪ Redo (Ctrl+Y)', 'chip');
  redoBtn.type = 'button';
  redoBtn.addEventListener('click', () => studio.redo());
  hist.appendChild(undoBtn);
  hist.appendChild(redoBtn);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); studio.undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); studio.redo(); }
  });

  return studio;
}
