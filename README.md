# Golden Hour Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

A free offline cover-art maker for GTA 6 launch week: turn your own photo and
a caption into a warm golden-hour, multi-panel poster and export it as a PNG
to share. Photos never leave your machine; the app runs entirely from static
files, no network request.

## What it does

- **6 layouts** — Magazine (full-bleed hero + 3-panel film strip, the
  default), Nine Grid (3×3 with a title block in the centre), Diagonal
  (slanted title band), Film Strip (vertical strip + one big panel), Duo
  (two tall panels), Full Bleed (one photo + title).
- **6 golden-hour grades** — Gold, Teal Noir, Peach, Mint, Mono and Coral,
  each a duotone gradient map with grain and a vignette.
- **Lettering** — Anton big title in Solid, Outline or Stamp styles
  (cream outline + hard offset shadow, overlapping the hero/strip seam),
  Bebas Neue kickers and labels. No script font.
- **Any photo** — add your own photos, click one to put it in the selected
  panel, fill every panel with one photo, drag a panel to move the photo,
  scroll to zoom (per-panel crop).
- **Caption editing** — title, sub-caption and place tag, plus sticker
  badges: a 5-star row, a round “EST. 2026” badge and a location-pin tag.
- **Fast export** — one click to PNG in 1080×1080, 1080×1350 or 1920×1080.
- **Undo / redo** — every edit steps back (Ctrl+Z / Ctrl+Y too), with a
  live preview canvas.

## Try it

```bash
node serve.ts
# open http://localhost:8080
```

## Files

- `main.ts` — entrypoint: copies `app/` + `screenshots/` to `/output` and
  writes `dossier.json` (Node 22, stdlib only).
- `app/index.html`, `app/style.css` — light cream, ink-on-paper editor.
- `app/src/render.js` — cover render engine: layouts, grades, lettering, badges.
- `app/src/studio.js` — editor UI, state, undo/redo, export.
- `app/src/shots.js` — `?shot=` renderer (`cover` / `editor`).
- `app/src/boot.js` — bootstrap.
- `app/fonts/` — Anton + Bebas Neue (SIL Open Font License, OFL.txt included).
- `app/samples/` — two sample photos (kit files, free to use).

Original art only: no Rockstar Games logo, wordmark, artwork or font is used.
