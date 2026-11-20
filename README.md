# Golden Hour Cover Studio

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![cover-art](https://make.fun/badge-cover-art.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![repo](https://img.shields.io/badge/repo-hurulsufi12--art%2Fgta6--cover--art-blue)](https://github.com/hurulsufi12-art/gta6-cover-art)

A free, offline cover-art maker for GTA 6 launch week: turn your own photo
and a caption into a warm golden-hour, multi-panel poster and export it as a
PNG to share. Photos never leave your machine — the app runs entirely from
static files, with no network request.

## What it does

- **6 layouts** — Magazine (full-bleed hero + 3-panel film strip, the
  default), Nine Grid (3×3 with a title block in the centre cell), Diagonal
  (a slanted title band cutting across the cover), Film Strip (a tall strip
  beside one big panel), Duo (two tall side-by-side panels) and Full Bleed
  (one photo filling the whole cover with the title on top).
- **6 golden-hour grades** — Gold, Teal Noir, Peach, Mint, Mono and Coral.
  Each is a duotone gradient map over the photo, finished with film grain
  and a vignette.
- **Lettering** — big Anton titles in three styles (Solid, Outline, Stamp;
  the title may overlap the seam between hero and strip) and Bebas Neue
  kickers and labels. No script font.
- **Any photo** — add your own photos, click a photo to place it in the
  selected panel, fill every panel with one photo in a single click, drag
  inside a panel to move the photo, scroll over a panel to zoom it.
- **Caption editing** — editable title, sub-caption and place tag, plus
  toggleable sticker badges: a 5-star row, a round "EST. 2026" badge and a
  location-pin tag.
- **Fast export** — one click exports the cover as a PNG in 1080×1080
  (square), 1080×1350 (portrait) or 1920×1080 (wide).
- **Undo / redo** — every edit steps back and forward (buttons, Ctrl+Z /
  Ctrl+Y), with a live preview canvas that updates on every change.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a sample photo (Boulevard or Pier), click a panel to place it, choose a
layout and a grade, type your caption, and export. Or add your own photo
with the file picker — it is read on your machine and never uploaded.

## Original art only

No Rockstar Games logo, wordmark, artwork or font is used anywhere. The
lettering fonts (Anton and Bebas Neue) are shipped under the SIL Open Font
License; see `app/fonts/OFL.txt`. The two sample photos in `app/samples/`
come from the competition kit and are free to use.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-app.ts` library. Run it twice and the output is
byte-identical.

## Screenshots

The four screenshots in `screenshots/` are renders of this app's own
`?shot=` scenes — the cover renderer and the editor, driven by URL
parameters (`shots.json` lists them). Nothing was edited or composited.
