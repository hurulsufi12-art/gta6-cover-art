# Neon Palm Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/hurulsufi12-art/gta6-cover-art/reward.svg)](https://make.fun/c/gta6-cover-art-01)

A GTA-poster-style cover art maker for the
[make.fun](https://make.fun) bounty **gta6-cover-art-01**: turn any photo and a
caption into a multi-panel cover, exported as a PNG to share. It runs entirely
offline in a desktop browser — photos never leave the machine.

## What it does

- **Six layouts** — four-panel grid, hero-and-three, full-bleed, tilted
  snapshots, split duo, stacked portrait.
- **Five colour grades** — Sunset, Neon, Vice Pink, Teal Noir, Golden Hour,
  applied as a true gradient map over each photo.
- **Any photo** — upload your own photos or use the two bundled samples; click
  a panel to select it, drag to position the photo, scroll or slide to zoom,
  fill several panels with one photo or several.
- **Lettering** — bold poster (Anton), script title (Pacifico) or outline
  poster, plus an editable sub-caption. Both fonts are vendored under `app/`
  under the SIL Open Font License; no Rockstar logo, artwork or font is used.
- **Fast export** — one click to PNG at 1080x1080, 1080x1350 or 1920x1080,
  with live preview and undo/redo.

## How the cover is drawn

One renderer (`app/src/cover.js`) draws the editor preview, the screenshot
scenes and the exported PNG, so what you see is what you get. Each photo is
cover-fit into its panel, then run through the grade's gradient map — the
photo's luminance is remapped through a sunset/neon ramp, blended 78% over
the original. Panels are anchored near the top of the photo when the panel
crops it vertically, so faces (which sit high in a photo) are not cut off;
drag a panel to reposition the photo, scroll or slide to zoom. The caption
is set in Anton (or Pacifico for script lettering), white with a neon glow,
over a dark plum band.

| Export size | Use |
| --- | --- |
| 1080 x 1080 | Square post |
| 1080 x 1350 | Portrait post |
| 1920 x 1080 | Wide cover / story |

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
node ../cli/makefun.mjs check --kit .. --repo .
```

## License

MIT. Fonts: Anton and Pacifico under the SIL Open Font License (see
`app/fonts/OFL.txt`). Sample photos were made with an image model for make.fun
and are free to use.
