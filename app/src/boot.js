// Golden Hour Cover Studio — bootstrap.
// Wires the modules together: a Studio for the live preview, the sidebar
// controls, and the ?shot= scene renderer used for screenshots.

import { Studio, buildControls } from './studio.js';
import { runShotScene } from './shots.js';

const preview = document.getElementById('preview');
const status = document.getElementById('status');
const controls = document.getElementById('controls');

const studio = new Studio(preview, status);
buildControls(controls, studio);

const query = new URLSearchParams(location.search);
const shot = query.get('shot');

if (shot) {
  runShotScene(studio, query).catch((err) => {
    if (status) status.textContent = `Shot failed: ${err.message}`;
    window.__shotReady = true;
  });
} else {
  studio.loadSamples().then(() => {
    studio.fillAll();
    studio.past.length = 0;
    studio.future.length = 0;
    studio.render();
  });
  studio.render();
}
