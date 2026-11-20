// Golden Hour Cover Studio — ?shot= renderer for screenshots.
// ?shot=cover  renders just the cover, full viewport, at the requested size.
// ?shot=editor renders the editor with a sample photo already loaded.
// URL params: shot, photo (pier|boulevard), caption, subcaption, tag,
// layout, grade, size (wide|portrait|square), titlestyle.

import { SIZES, renderCover, defaultPanels } from './render.js';
import { Studio, buildControls, freshState } from './studio.js';

export function readParams(search) {
  const q = new URLSearchParams(search || location.search);
  const pick = (key, fallback, allowed) => {
    const v = (q.get(key) || '').toLowerCase();
    return allowed.includes(v) ? v : fallback;
  };
  return {
    shot: pick('shot', 'editor', ['cover', 'editor']),
    photo: pick('photo', 'pier', ['pier', 'boulevard']),
    caption: q.get('caption') || 'GOLDEN HOUR',
    subcaption: q.get('subcaption') || 'chasing the sun in Palm Bay',
    tag: q.get('tag') || 'PALM BAY',
    layout: pick('layout', 'magazine', ['magazine', 'ninegrid', 'diagonal', 'strip', 'duo', 'fullbleed']),
    grade: pick('grade', 'gold', ['gold', 'tealnoir', 'peach', 'mint', 'mono', 'coral']),
    size: pick('size', 'wide', ['wide', 'portrait', 'square']),
    titleStyle: pick('titlestyle', 'outline', ['solid', 'outline', 'stamp']),
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadSamplePhotos() {
  const [pier, boulevard] = await Promise.all([
    loadImage('samples/pier.jpg'),
    loadImage('samples/boulevard.jpg'),
  ]);
  return { pier, boulevard };
}

export async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
    ]);
    await document.fonts.ready;
  } catch { /* fall back to system sans if a font fails */ }
}

// Render a bare cover into `canvas` from URL params. Returns the state used.
export async function renderShotCover(canvas, params, photos) {
  const { w, h } = SIZES[params.size];
  const state = {
    layout: params.layout,
    grade: params.grade,
    titleStyle: params.titleStyle,
    size: params.size,
    caption: params.caption,
    subcaption: params.subcaption,
    tag: params.tag,
    panels: defaultPanels(params.layout),
    selectedPanel: -1,
  };
  // The hero photo is the requested one; strip panels alternate.
  state.panels.forEach((p, i) => { p.photo = i === 0 ? params.photo : (i % 2 === 0 ? params.photo : (params.photo === 'pier' ? 'boulevard' : 'pier')); });
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), w, h, state, photos);
  return state;
}

// Build the full editor inside `appRoot` from URL params.
export async function renderShotEditor(appRoot, params, photos) {
  const state = freshState();
  state.layout = params.layout;
  state.grade = params.grade;
  state.titleStyle = params.titleStyle;
  state.size = params.size;
  state.caption = params.caption;
  state.subcaption = params.subcaption;
  state.tag = params.tag;
  state.panels = defaultPanels(params.layout);
  state.panels.forEach((p, i) => { p.photo = i === 0 ? params.photo : (i % 2 === 0 ? params.photo : (params.photo === 'pier' ? 'boulevard' : 'pier')); });

  const studio = new Studio(appRoot.querySelector('#preview'), photos);
  studio.state = state;
  studio.render();

  const controls = appRoot.querySelector('#controls');
  const photoList = [
    { key: 'pier', name: 'Pier sunset', src: 'samples/pier.jpg' },
    { key: 'boulevard', name: 'Boulevard gold', src: 'samples/boulevard.jpg' },
  ];
  studio.onChange = () => buildControls(controls, studio, photoList);
  buildControls(controls, studio, photoList);

  // Pointer wiring for drag-to-crop + click-to-select on the preview.
  const canvas = appRoot.querySelector('#preview');
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * canvas.width / r.width,
      y: (e.clientY - r.top) * canvas.height / r.height,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    if (studio.pointerDown(p.x, p.y)) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!studio.drag) return;
    const p = toCanvas(e);
    studio.pointerMove(p.x, p.y);
  });
  canvas.addEventListener('pointerup', () => studio.pointerUp());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    studio.wheelZoom(e.deltaY);
  }, { passive: false });

  // Keyboard undo/redo.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); studio.undo(); buildControls(controls, studio, photoList); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); studio.redo(); buildControls(controls, studio, photoList); }
  });
  return studio;
}
