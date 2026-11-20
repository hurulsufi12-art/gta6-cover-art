// Golden Hour Cover Studio — headless scene driver.
//
// Reads the page query (?shot=cover or ?shot=editor, plus layout, grade,
// photo, caption, subtitle, size) and stages that scene, then sets
// window.__shotReady so a screenshot runner knows the frame is done.
// Cover scenes render the exported cover full-frame at the viewport's own
// pixel size; editor scenes show the whole studio with a photo loaded.

import { layoutById, gradeById, sizeById, drawCover, defaultPanels } from './render.js';
import { createStudio, loadImage } from './studio.js';

const PHOTOS = {
  boulevard: 'samples/boulevard.jpg',
  pier: 'samples/pier.jpg',
};

function params() {
  return new URLSearchParams(window.location.search);
}

async function stageCover(q) {
  document.body.classList.add('shot-cover');
  const layout = layoutById(q.get('layout') || 'hero-split');
  const grade = gradeById(q.get('grade') || 'vice-sunset');
  const size = sizeById(q.get('size') || 'wide');
  const wanted = (q.get('photo') || 'boulevard').split(',').map((s) => s.trim());
  const photos = [];
  for (const key of wanted) {
    try {
      photos.push(await loadImage(PHOTOS[key] || PHOTOS.boulevard));
    } catch { /* a missing sample leaves a painted panel */ }
  }
  const state = {
    layout: layout.id,
    grade: grade.id,
    size: size.id,
    title: q.get('caption') || 'GOLDEN HOUR',
    subtitle: q.get('subtitle') || 'A Vice City story',
    panels: defaultPanels(9, Math.max(1, photos.length)),
    selected: 0,
  };
  await document.fonts.ready;
  const canvas = document.getElementById('shot-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  drawCover(canvas.getContext('2d'), canvas.width, canvas.height, state, photos);
  document.title = 'shot-ready';
  window.__shotReady = true;
  window.__shotInfo = { mode: 'cover', layout: layout.id, grade: grade.id, size: size.id };
}

async function stageEditor(q) {
  const studio = createStudio(document);
  await studio.init();
  const st = studio.state;
  if (q.get('layout')) st.layout = layoutById(q.get('layout')).id;
  if (q.get('grade')) st.grade = gradeById(q.get('grade')).id;
  if (q.get('size')) st.size = sizeById(q.get('size')).id;
  if (q.get('caption')) { st.title = q.get('caption'); document.getElementById('title-input').value = st.title; }
  if (q.get('subtitle')) { st.subtitle = q.get('subtitle'); document.getElementById('subtitle-input').value = st.subtitle; }
  // Keep the pickers honest with the staged state.
  document.querySelectorAll('#layout-picker .pick').forEach((el) => el.classList.toggle('active', el.dataset.layout === st.layout));
  document.querySelectorAll('#grade-picker .swatch').forEach((el) => el.classList.toggle('active', el.dataset.grade === st.grade));
  document.querySelectorAll('#size-picker .pick').forEach((el) => el.classList.toggle('active', el.dataset.size === st.size));
  studio.paint();
  document.title = 'shot-ready';
  window.__shotReady = true;
  window.__shotInfo = { mode: 'editor', layout: st.layout, grade: st.grade, size: st.size };
  window.__studio = studio;
}

export async function runShotScene() {
  const q = params();
  const mode = q.get('shot') || 'editor';
  if (mode === 'cover') await stageCover(q);
  else await stageEditor(q);
}
