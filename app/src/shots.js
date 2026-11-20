// Fixed scenes for screenshots: ?shot=cover draws the exported cover full
// frame; ?shot=editor shows the studio with a sample photo loaded.
// Every scene is driven by URL params so the screenshots are renders of
// the app itself, never composited. window.__shotReady is set once the
// fonts are loaded and the frame is painted.

import { EXPORT_SIZES } from './render.js';
import { SAMPLE_PHOTOS } from './studio.js';

function param(query, key, fallback) {
  const v = query.get(key);
  return v === null || v === '' ? fallback : v;
}

export async function runShotScene(studio, query) {
  const shot = param(query, 'shot', 'editor');
  const sizeKey = param(query, 'size', 'wide');
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES.wide;
  const photoId = param(query, 'photo', 'pier');
  const sample = SAMPLE_PHOTOS.find((s) => s.id === photoId) || SAMPLE_PHOTOS[1];

  document.body.classList.add('shot-' + shot);
  await document.fonts.load('16px "Anton"');
  await document.fonts.load('16px "Bebas Neue"');
  await document.fonts.ready;

  await studio.loadPhoto(sample.id, sample.src);
  studio.state.activePhoto = sample.id;
  studio.state.layout = param(query, 'layout', 'magazine');
  studio.state.grade = param(query, 'grade', 'gold');
  studio.state.titleStyle = param(query, 'titlestyle', 'outline');
  studio.state.title = param(query, 'caption', 'GOLDEN HOUR');
  studio.state.sub = param(query, 'subcaption', 'chasing the sun in Palm Bay');
  studio.state.tag = param(query, 'tag', 'PALM BAY');
  studio.state.size = sizeKey;

  // The shot fills every panel with the chosen photo, exactly as the
  // editor's "fill every panel" button does.
  studio.fillAll();
  // fillAll committed a history entry; drop it so the shot starts clean.
  studio.past.length = 0;
  studio.future.length = 0;
  // No panel selected in a screenshot: the coral selection frame is an
  // editor affordance, not part of the cover.
  studio.state.selected = -1;

  if (shot === 'cover') {
    // Full-frame cover at the export size, scaled by CSS to the viewport.
    const cv = studio.preview;
    cv.width = size.w;
    cv.height = size.h;
    studio.render();
  } else {
    // Editor scene: preview sized to the export aspect, controls visible.
    const cv = studio.preview;
    cv.width = size.w;
    cv.height = size.h;
    studio.render();
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
  document.title = 'shot-ready';
}
