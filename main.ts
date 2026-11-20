// Golden Hour Cover Studio — the entry program (Node 22, standard library
// only). It hands the app in: copies this repository's app/ and screenshots/
// beside it into the output directory and writes /output/dossier.json with
// the vendored make.fun library, so the scorer can rebuild the same dossier
// byte for byte. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: same files in, same bytes out, every time.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): text_max_bytes is the only
// one that shapes the dossier's bytes; the rest refuse an entry the scorer
// would refuse anyway (more than 4 screenshots, one over 256 KiB, more than
// 993 files or 48 MiB under app/, or a path over 1000 bytes — app/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
