// Golden Hour Cover Studio — boot.js
// The entry point: wires the editor UI to the studio model, paints the live
// preview canvas on every change, and handles panel drag / zoom, photo
// placement and PNG export. Nothing here reaches the network: photos are
// read on the machine, fonts and samples are files under app/.

import { EXPORT_SIZES, GRADES, LAYOUTS, TITLE_STYLES, drawCover, panelsForLayout } from './render.js';
import { createStudio } from './studio.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);

function buildTray(studio) {
  const tray = $('photo-tray');
  tray.innerHTML = '';
  studio.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tray-photo${index === studio.selectedPhoto ? ' selected' : ''}`;
    button.title = `Use ${photo.label ?? photo.name} (click, then click a panel)`;
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.label ?? photo.name;
    const label = document.createElement('span');
    label.textContent = photo.label ?? photo.name;
    button.append(img, label);
    button.addEventListener('click', () => {
      studio.selectPhoto(index);
      $('hint').textContent = `Photo "${photo.label ?? photo.name}" selected — click a panel to place it, or Fill all.`;
    });
    tray.append(button);
  });
}

function buildOptionButtons(containerId, entries, current, onPick) {
  const container = $(containerId);
  container.innerHTML = '';
  for (const [key, meta] of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `option${key === current ? ' active' : ''}`;
    button.dataset.value = key;
    button.textContent = typeof meta === 'string' ? meta : meta.name;
    button.addEventListener('click', () => onPick(key));
    container.append(button);
  }
}

function paintPreview(studio) {
  const canvas = $('preview');
  if (!canvas) return;
  const size = EXPORT_SIZES[studio.state.size] ?? EXPORT_SIZES.square;
  const box = canvas.parentElement.getBoundingClientRect();
  const scale = Math.min((box.width - 8) / size.w, (box.height - 8) / size.h, 1);
  const w = Math.max(2, Math.round(size.w * scale));
  const h = Math.max(2, Math.round(size.h * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas.getContext('2d'), studio.state, studio.photos, w, h);
}

function refreshControls(studio) {
  buildTray(studio);
  buildOptionButtons('layout-options', Object.entries(LAYOUTS), studio.state.layout, (key) => studio.setLayout(key));
  buildOptionButtons('grade-options', Object.entries(GRADES), studio.state.grade, (key) => studio.setGrade(key));
  buildOptionButtons('style-options', Object.entries(TITLE_STYLES), studio.state.titleStyle, (key) => studio.setTitleStyle(key));
  buildOptionButtons(
    'size-options',
    Object.entries(EXPORT_SIZES).map(([key, size]) => [key, `${size.name} ${size.w}x${size.h}`]),
    studio.state.size,
    (key) => studio.setSize(key),
  );
  const title = $('title-input');
  if (document.activeElement !== title) title.value = studio.state.title;
  const subtitle = $('subtitle-input');
  if (document.activeElement !== subtitle) subtitle.value = studio.state.subtitle;
  const place = $('place-input');
  if (document.activeElement !== place) place.value = studio.state.place;
  for (const name of ['stars', 'est', 'pin']) {
    $(`sticker-${name}`).checked = !!studio.state.stickers[name];
  }
  $('undo-btn').disabled = !studio.canUndo();
  $('redo-btn').disabled = !studio.canRedo();
  paintPreview(studio);
}

// Which panel (if any) sits under a point on the preview canvas, in
// preview-canvas pixels.
function panelAt(studio, canvas, x, y) {
  const { panels } = panelsForLayout(studio.state.layout, canvas.width, canvas.height);
  return panels.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) ?? null;
}

function wirePointer(studio) {
  const canvas = $('preview');
  let drag = null;
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const panel = panelAt(studio, canvas, x, y);
    if (!panel) return;
    drag = { panel: panel.id, startX: x, startY: y, moved: false, rect: panel };
    studio.beginDrag();
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const dx = (x - drag.startX) / drag.rect.w;
    const dy = (y - drag.startY) / drag.rect.h;
    if (Math.abs(x - drag.startX) > 4 || Math.abs(y - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    studio.movePanel(drag.panel, dx, dy);
    drag.startX = x;
    drag.startY = y;
    paintPreview(studio);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!drag) return;
    const wasDrag = drag.moved;
    const panelId = drag.panel;
    drag = null;
    if (wasDrag) {
      studio.endDrag();
    } else {
      // A click without a drag places the selected tray photo.
      studio.history.pop();
      studio.historyIndex--;
      studio.placeInPanel(panelId);
      $('hint').textContent = `Photo placed in the ${panelId} panel. Drag inside a panel to move it, scroll to zoom.`;
    }
    refreshControls(studio);
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const panel = panelAt(studio, canvas, x, y);
    if (!panel) return;
    studio.beginDrag();
    studio.zoomPanel(panel.id, event.deltaY < 0 ? 1.12 : 1 / 1.12);
    studio.endDrag();
    refreshControls(studio);
  }, { passive: false });
}

async function exportPng(studio) {
  const size = EXPORT_SIZES[studio.state.size] ?? EXPORT_SIZES.square;
  const { renderCoverCanvas } = await import('./render.js');
  const canvas = renderCoverCanvas(studio.state, studio.photos, size.w, size.h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    $('hint').textContent = 'Export failed — the browser could not make a PNG.';
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `golden-hour-cover-${size.w}x${size.h}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  $('hint').textContent = `Exported ${size.w} x ${size.h} PNG — check your downloads.`;
}

async function boot() {
  const studio = createStudio(() => {
    if ($('preview')) refreshControls(studio);
  });
  const tookOver = await applyShot(studio, window.location);
  if (tookOver) return;

  $('title-input').addEventListener('input', (e) => studio.setCaption('title', e.target.value));
  $('subtitle-input').addEventListener('input', (e) => studio.setCaption('subtitle', e.target.value));
  $('place-input').addEventListener('input', (e) => studio.setCaption('place', e.target.value));
  for (const name of ['stars', 'est', 'pin']) {
    $(`sticker-${name}`).addEventListener('change', () => studio.toggleSticker(name));
  }
  $('undo-btn').addEventListener('click', () => studio.undo());
  $('redo-btn').addEventListener('click', () => studio.redo());
  $('fill-all-btn').addEventListener('click', () => {
    studio.fillAll(studio.selectedPhoto);
    $('hint').textContent = 'Every panel now shows the selected photo.';
  });
  $('upload-input').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await studio.addUpload(file);
      $('hint').textContent = `"${file.name}" added — click it in the tray, then click a panel.`;
    } catch {
      $('hint').textContent = 'That file could not be read as a photo.';
    }
    event.target.value = '';
  });
  $('export-btn').addEventListener('click', () => exportPng(studio));
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      studio.undo();
    } else if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
      event.preventDefault();
      studio.redo();
    }
  });
  wirePointer(studio);
  window.addEventListener('resize', () => paintPreview(studio));

  await studio.loadSamples();
  refreshControls(studio);
  $('hint').textContent = 'Two sample photos loaded. Click a photo, then click a panel — or Fill all — then export.';
}

boot();
