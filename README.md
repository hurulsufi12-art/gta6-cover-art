# Golden Hour Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

A free, fully offline cover-art maker for GTA 6 launch week. Turn your own
photo and a caption into a warm golden-hour, multi-panel poster and export it
as a PNG to share. Your photos never leave your machine — there is no upload,
no account, no network request at all.

## How it works

1. **Add photos** — pick one of the two built-in sample photos, or load your
   own from your machine (JPG, PNG or WebP). Click a photo in the tray, then
   click a panel to place it there. **Fill all** drops one photo into every
   panel in a single click.
2. **Pick a layout** — six poster layouts: Magazine, Nine Grid, Diagonal,
   Film Strip, Duo and Full Bleed.
3. **Pick a grade** — six golden-hour duotone grades: Gold, Teal Noir, Peach,
   Mint, Mono and Coral. Every grade finishes with film grain and a vignette.
4. **Write the caption** — an editable title, sub-caption and place tag, in
   big Anton lettering (Solid, Outline or Stamp) with Bebas Neue kickers.
   Toggle the sticker badges: a five-star row, a round `EST. 2026` badge and
   a location-pin tag.
5. **Crop each panel** — drag inside a panel to move the photo, scroll over a
   panel to zoom it.
6. **Export** — one click saves a PNG in 1080x1080 (square), 1080x1350
   (portrait) or 1920x1080 (wide).

Every edit can be stepped back and forward with **Undo / Redo** (buttons or
Ctrl+Z / Ctrl+Y), and the live preview canvas updates on every change.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Everything is static
files under `app/` — no build step, no dependencies, no network.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
`vendor/makefun-app.ts` library. Running it twice writes byte-identical
output.

## Screenshots

`shots.json` drives the app's own `?shot=` scenes: `1-cover.jpg` is an
exported wide cover, `2-editor.jpg` is the editor with a photo loaded,
`3-cover.jpg` is an exported portrait cover and `4-cover.jpg` is an exported
square cover. All four are real renders of the app, nothing edited or
composited.

## Original art

All lettering uses Anton and Bebas Neue, shipped under the SIL Open Font
License (see `app/fonts/OFL.txt`). The sample photos are the kit's own
free-to-use images. Nothing here is Rockstar Games artwork, a Rockstar logo
or wordmark, or a game font.

## License

MIT — see `LICENSE`.
