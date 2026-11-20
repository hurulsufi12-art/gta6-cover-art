# Golden Hour Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns any photo and caption into GTA 6-style
multi-panel cover art, and exports it as a PNG to share.

## What it does

- **6 layouts** — Hero Split, Four Grid, Full Bleed, Strip Stack,
  Tilted Snapshots and Nine Grid — each a different multi-panel poster
  arrangement with white gutters and a framed title block.
- **6 colour grades** — Vice Sunset, Neon Nights, Golden Hour, Palm Teal,
  Heat Haze and Mono Noir — gradient-map sunset / neon treatments with
  vignette and film grain, drawn on canvas.
- **Any photo** — load your own photos from your machine (or use the two
  bundled samples), put one photo across several panels or a different
  photo in each panel, drag to position and scroll to zoom every panel.
- **Caption** — a big Anton title and a Bebas Neue subtitle, edited live.
- **Export** — one click writes a PNG in 1080 x 1080, 1080 x 1350 or
  1920 x 1080.

Everything runs offline from static files under `app/`: no network
request, no upload, no build step. Photos never leave the machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Files

- `app/index.html`, `app/style.css` — the studio page and its styling.
- `app/src/boot.js` — entry point: starts the studio, or a headless
  `?shot=` scene for screenshots.
- `app/src/render.js` — the cover engine: layouts, grades, title block,
  grain and vignette, drawn on a 2D canvas.
- `app/src/studio.js` — the editor: photo pool, panel picking, drag to
  pan, wheel to zoom, live preview, PNG export.
- `app/src/shots.js` — headless scene driver used to take the screenshots
  in `screenshots/`.
- `app/fonts/` — Anton and Bebas Neue under the SIL Open Font License
  (`OFL.txt` beside them).
- `app/samples/` — two sample photos made with an image model, free to use.
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `shots.json` — the four screenshot scenes.

## License

MIT — see `LICENSE`. Fonts are under the SIL Open Font License.
