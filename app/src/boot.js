// Golden Hour Cover Studio — bootstrap: reads the URL, loads fonts and
// sample photos, then shows either a bare cover (?shot=cover) or the full
// editor (?shot=editor, the default).

import { readParams, loadSamplePhotos, loadFonts, renderShotCover, renderShotEditor } from './shots.js';

async function boot() {
  const params = readParams(location.search);
  await loadFonts();
  const photos = await loadSamplePhotos();
  document.body.dataset.ready = 'loading';
  if (params.shot === 'cover') {
    document.body.classList.add('cover-mode');
    const canvas = document.getElementById('cover');
    await renderShotCover(canvas, params, photos);
  } else {
    const studio = await renderShotEditor(document.getElementById('app'), params, photos);
    window.__studio = studio;
  }
  document.body.dataset.ready = 'done';
}

boot().catch((err) => {
  document.body.dataset.ready = 'error';
  const pre = document.createElement('pre');
  pre.textContent = 'Could not start Golden Hour Cover Studio: ' + err.message;
  document.body.appendChild(pre);
});
