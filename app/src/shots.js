// Golden Hour Cover Studio — shots.js
// The ?shot= scenes that shots.json drives, and the ?test=1 self-test.
// A cover scene hides the editor and paints one exported cover full-frame,
// exactly as the app's own export draws it. An editor scene opens the
// editor with a sample photo loaded and every panel filled.

import { EXPORT_SIZES, drawCover, renderCoverCanvas } from './render.js';
import { ensurePanels } from './studio.js';

function paramsOf(location) {
  return new URLSearchParams(location.search);
}

function stateFromParams(studio, params) {
  const state = studio.state;
  if (params.get('layout')) state.layout = params.get('layout');
  if (params.get('grade')) state.grade = params.get('grade');
  if (params.get('caption')) state.title = params.get('caption');
  if (params.get('size')) state.size = params.get('size');
  if (params.get('style')) state.titleStyle = params.get('style');
  ensurePanels(state, studio.photos.length);
  return state;
}

async function loadNamedPhoto(studio, name) {
  const wanted = name || 'pier';
  const found = studio.photos.find((p) => p.name === wanted);
  if (found) return found;
  const known = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };
  return studio.loadPhoto(known[wanted] ?? known.pier, wanted);
}

// ?shot=cover — one exported cover, full-frame, at the window's size.
export async function runCoverShot(studio, location) {
  const params = paramsOf(location);
  const photo = await loadNamedPhoto(studio, params.get('photo'));
  const state = stateFromParams(studio, params);
  studio.fillAll(studio.photos.indexOf(photo), false);
  document.body.classList.add('shot-cover');
  const canvas = document.createElement('canvas');
  canvas.id = 'shot-canvas';
  // Headless Chrome's screenshot is the window, not the viewport: the
  // viewport is shorter by the window chrome, so size the canvas from the
  // window's outer size — that is the exact size of the screenshot file.
  canvas.width = window.outerWidth || window.innerWidth;
  canvas.height = window.outerHeight || window.innerHeight;
  // Exact pixel sizing: the canvas is the whole shot, never stretched by
  // viewport units, so the cover bleeds to the screenshot's edges.
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  document.body.append(canvas);
  drawCover(canvas.getContext('2d'), state, studio.photos, canvas.width, canvas.height);
  document.title = `Golden Hour Cover Studio — ${state.title}`;
}

// ?shot=editor — the editor with a photo loaded and panels filled.
export async function runEditorShot(studio, location) {
  const params = paramsOf(location);
  await loadNamedPhoto(studio, params.get('photo') || 'boulevard');
  stateFromParams(studio, params);
  studio.fillAll(0, false);
  studio.resetHistory();
  studio.onChange();
  document.title = 'Golden Hour Cover Studio — editor';
}

// ?test=1 — the headless self-test: layouts, grades, photo ops, caption,
// stickers, all three export sizes and undo / redo. Results go into
// #test-results and document.title, so a headless run can read them.
export async function runSelfTest(studio) {
  const results = [];
  const check = (name, ok) => results.push({ name, ok: !!ok });
  try {
    await studio.loadSamples();
    const state = studio.state;

    // All six layouts switch and paint a non-blank cover.
    for (const layout of ['magazine', 'ninegrid', 'diagonal', 'filmstrip', 'duo', 'fullbleed']) {
      studio.setLayout(layout);
      const canvas = renderCoverCanvas(studio.state, studio.photos, 540, 540);
      const data = canvas.getContext('2d').getImageData(0, 0, 540, 540).data;
      let varied = 0;
      for (let i = 0; i < data.length; i += 400) {
        if (data[i] !== data[0] || data[i + 1] !== data[1]) varied++;
      }
      check(`layout ${layout} paints`, varied > 50);
    }

    // All six grades apply: each grade's pixels differ from gold's.
    studio.setLayout('magazine');
    const gold = renderCoverCanvas({ ...studio.state, grade: 'gold' }, studio.photos, 270, 270);
    const goldPx = gold.getContext('2d').getImageData(0, 0, 270, 270).data;
    for (const grade of ['teal', 'peach', 'mint', 'mono', 'coral']) {
      const other = renderCoverCanvas({ ...studio.state, grade }, studio.photos, 270, 270);
      const otherPx = other.getContext('2d').getImageData(0, 0, 270, 270).data;
      let diff = 0;
      for (let i = 0; i < goldPx.length; i += 16) {
        if (Math.abs(goldPx[i] - otherPx[i]) > 12) diff++;
      }
      check(`grade ${grade} differs from gold`, diff > 200);
    }

    // Photo place, drag and zoom.
    studio.setLayout('magazine');
    const before = JSON.stringify(studio.state.panels);
    studio.selectPhoto(1);
    check('place photo in hero panel', studio.placeInPanel('hero') && studio.state.panels.hero.photo === 1);
    studio.beginDrag();
    studio.movePanel('hero', 0.2, -0.1);
    studio.endDrag();
    check('drag moves photo', studio.state.panels.hero.ox === 0.2 && studio.state.panels.hero.oy === -0.1);
    studio.zoomPanel('hero', 1.5);
    check('zoom scales photo', studio.state.panels.hero.zoom === 1.5);
    check('fill all panels', studio.fillAll(1) && Object.values(studio.state.panels).every((p) => p.photo === 1));
    check('drag changed state', JSON.stringify(studio.state.panels) !== before);

    // Caption editing and sticker toggles.
    studio.setCaption('title', 'PIER PRESSURE');
    check('caption edit', studio.state.title === 'PIER PRESSURE');
    studio.setCaption('subtitle', 'Neon nights');
    check('subtitle edit', studio.state.subtitle === 'Neon nights');
    const starsBefore = studio.state.stickers.stars;
    studio.toggleSticker('stars');
    check('stars sticker toggles', studio.state.stickers.stars === !starsBefore);
    studio.toggleSticker('stars');
    check('stars sticker toggles back', studio.state.stickers.stars === starsBefore);

    // Title styles paint.
    for (const style of ['solid', 'outline', 'stamp']) {
      studio.setTitleStyle(style);
      const canvas = renderCoverCanvas(studio.state, studio.photos, 270, 270);
      check(`title style ${style} paints`, canvas.toDataURL('image/png').length > 1000);
    }

    // Export produces a PNG in all three sizes.
    for (const [key, size] of Object.entries(EXPORT_SIZES)) {
      const canvas = renderCoverCanvas(studio.state, studio.photos, size.w, size.h);
      const url = canvas.toDataURL('image/png');
      check(`export ${key} ${size.w}x${size.h} is PNG`, canvas.width === size.w && canvas.height === size.h && url.startsWith('data:image/png'));
    }

    // Undo / redo round-trip.
    studio.setCaption('title', 'UNDO CHECK');
    const afterEdit = studio.state.title;
    check('undo steps back', studio.undo() && studio.state.title !== afterEdit);
    check('redo steps forward', studio.redo() && studio.state.title === afterEdit);
    check('undo then new edit drops redo', (() => {
      studio.undo();
      studio.setCaption('title', 'BRANCHED');
      return !studio.canRedo();
    })());
  } catch (err) {
    results.push({ name: `self-test threw: ${err.message}`, ok: false });
  }
  const passed = results.filter((r) => r.ok).length;
  const pre = document.createElement('pre');
  pre.id = 'test-results';
  pre.textContent = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}`).join('\n');
  document.body.append(pre);
  document.title = `TESTS ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'}`;
  return { passed, total: results.length };
}

// Pick the scene (if any) from the URL and run it. Returns true when a
// scene took over the page, so boot.js can skip the normal editor setup.
export async function applyShot(studio, location) {
  const params = paramsOf(location);
  if (params.get('test') === '1') {
    await runSelfTest(studio);
    return true;
  }
  if (params.get('shot') === 'cover') {
    await runCoverShot(studio, location);
    return true;
  }
  if (params.get('shot') === 'editor') {
    await runEditorShot(studio, location);
    return false; // the editor still needs its normal setup
  }
  return false;
}
