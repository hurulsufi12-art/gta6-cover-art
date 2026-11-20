// Golden Hour Cover Studio — entry point.
//
// With a ?shot= query the page stages a headless scene for screenshots;
// otherwise it starts the interactive studio.

import { createStudio } from './studio.js';
import { runShotScene } from './shots.js';

const shot = new URLSearchParams(window.location.search).get('shot');

if (shot) {
  runShotScene().catch((err) => {
    document.title = `shot-error: ${err.message}`;
    window.__shotError = String(err);
  });
} else {
  const studio = createStudio(document);
  window.__studio = studio;
  studio.init().catch((err) => {
    document.getElementById('studio-error').textContent = `Could not start the studio: ${err.message}`;
  });
}
