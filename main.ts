// Neon Palm Cover Studio — a gta6-cover-art-01 entry (Node 22, standard library
// only). The app is this directory's app/ folder: plain static files a desktop
// browser loads offline (index.html, its ES modules, two OFL fonts and two sample
// photos, no network request). This program hands it in: it copies app/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// The app turns any photo and a caption into GTA-poster-style cover art: six
// multi-panel layouts, five sunset/neon colour grades, per-panel crop and
// position, three lettering styles, and PNG export at 1080x1080, 1080x1350 and
// 1920x1080. Try it with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly, before copying anything, when the hand-in is incomplete:
// the entry needs app/ and 3–4 screenshots, each a whole JPEG/PNG of at
// most 256 KiB, or the scorer refuses it and buildDossier's error says
// little about which file is at fault.
if (!existsSync(join(here, 'app'))) {
  throw new Error('app/ is missing next to main.ts');
}
const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir)) {
  throw new Error('screenshots/ is missing next to main.ts');
}
const shots = readdirSync(shotDir).filter((n) => !n.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3–4 images, found ${shots.length}`);
}
for (const name of shots) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('-')) {
    throw new Error(`screenshot name ${JSON.stringify(name)} is not allowed`);
  }
  const bytes = statSync(join(shotDir, name)).size;
  if (bytes > 262144) {
    throw new Error(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
