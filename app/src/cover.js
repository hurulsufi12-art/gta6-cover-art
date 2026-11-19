// Cover renderer: draws a GTA-poster-style multi-panel cover onto a canvas.
// Layouts, colour grades and lettering are all drawn here, so the editor, the
// export and the screenshot scenes all share one drawing path.
export const LAYOUTS = {
  grid4: 'Four-panel grid',
  hero3: 'Hero and three',
  fullbleed: 'Full-bleed photo',
  tilted: 'Tilted snapshots',
  duo: 'Split duo',
  stack: 'Stacked portrait',
};

export const LAYOUT_ORDER = ['grid4', 'hero3', 'fullbleed', 'tilted', 'duo', 'stack'];

export const GRADES = {
  sunset: 'Sunset',
  neon: 'Neon',
  vice: 'Vice Pink',
  teal: 'Teal Noir',
  golden: 'Golden Hour',
};

export const GRADE_ORDER = ['sunset', 'neon', 'vice', 'teal', 'golden'];

// Gradient-map stops: [position 0..1, r, g, b]. Each grade maps photo luminance
// through its own sunset/neon ramp, the neon-coast poster look this bounty asks for.
export const GRADE_STOPS = {
  sunset: [[0, 24, 8, 46], [0.35, 122, 32, 96], [0.65, 238, 92, 60], [1, 255, 214, 130]],
  neon: [[0, 8, 10, 38], [0.35, 24, 66, 128], [0.65, 176, 44, 164], [1, 255, 120, 220]],
  vice: [[0, 30, 6, 44], [0.35, 148, 28, 110], [0.65, 244, 84, 150], [1, 255, 196, 214]],
  teal: [[0, 4, 16, 22], [0.35, 12, 74, 84], [0.65, 44, 158, 150], [1, 190, 240, 224]],
  golden: [[0, 34, 14, 6], [0.35, 120, 62, 18], [0.65, 232, 138, 44], [1, 255, 226, 150]],
};

export const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

/** A fresh cover state: layout, grade, lettering, captions and one crop per panel. */
export function defaultCoverState() {
  return {
    layout: 'hero3',
    grade: 'neon',
    size: 'wide',
    caption: 'Neon Shore',
    subcaption: 'a night in Neon Bay',
    lettering: 'anton',
    panels: [
      { photoId: 'pier', zoom: 1, dx: 0, dy: 0 },
      { photoId: 'boulevard', zoom: 1, dx: 0, dy: 0 },
      { photoId: 'pier', zoom: 1, dx: 0, dy: 0 },
      { photoId: 'boulevard', zoom: 1, dx: 0, dy: 0 },
    ],
  };
}

/** How many panels a layout shows. */
export function panelCountFor(layout) {
  return { grid4: 4, hero3: 4, fullbleed: 1, tilted: 3, duo: 2, stack: 2 }[layout] ?? 4;
}

/**
 * Panel geometry for a layout at canvas size (w, h). Returns
 * { panels: [{x, y, w, h, rot}], caption: {x, y, w, h, align}, frame } where
 * every rect is in canvas pixels and rot is a tilt in radians.
 */
export function layoutPanels(w, h, layout) {
  const frame = Math.round(Math.min(w, h) * 0.022);
  const gut = Math.round(Math.min(w, h) * 0.018);
  const capH = Math.round(h * 0.17);
  const inner = { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 - capH };
  const caption = { x: frame, y: h - frame - capH, w: w - frame * 2, h: capH, align: 'left' };
  switch (layout) {
    case 'grid4': {
      const cw = (inner.w - gut) / 2;
      const ch = (inner.h - gut) / 2;
      return {
        frame, caption,
        panels: [
          { x: inner.x, y: inner.y, w: cw, h: ch, rot: 0 },
          { x: inner.x + cw + gut, y: inner.y, w: cw, h: ch, rot: 0 },
          { x: inner.x, y: inner.y + ch + gut, w: cw, h: ch, rot: 0 },
          { x: inner.x + cw + gut, y: inner.y + ch + gut, w: cw, h: ch, rot: 0 },
        ],
      };
    }
    case 'hero3': {
      const heroW = inner.w * 0.62;
      const sideX = inner.x + heroW + gut;
      const sideW = inner.w - heroW - gut;
      const sh = (inner.h - gut * 2) / 3;
      return {
        frame, caption,
        panels: [
          { x: inner.x, y: inner.y, w: heroW, h: inner.h, rot: 0 },
          { x: sideX, y: inner.y, w: sideW, h: sh, rot: 0 },
          { x: sideX, y: inner.y + sh + gut, w: sideW, h: sh, rot: 0 },
          { x: sideX, y: inner.y + (sh + gut) * 2, w: sideW, h: sh, rot: 0 },
        ],
      };
    }
    case 'fullbleed':
      return {
        frame: 0,
        caption: { x: w * 0.06, y: h - h * 0.24, w: w * 0.88, h: h * 0.2, align: 'left' },
        panels: [{ x: 0, y: 0, w, h, rot: 0 }],
      };
    case 'tilted': {
      const pw = inner.w * 0.56;
      const ph = inner.h * 0.62;
      const cy = inner.y + inner.h * 0.06;
      return {
        frame, caption,
        panels: [
          { x: inner.x + inner.w * 0.02, y: cy, w: pw, h: ph, rot: -0.1 },
          { x: inner.x + inner.w * 0.42, y: cy - inner.h * 0.04, w: pw, h: ph, rot: 0.05 },
          { x: inner.x + inner.w * 0.22, y: cy + inner.h * 0.28, w: pw, h: ph * 0.62, rot: -0.03 },
        ],
      };
    }
    case 'duo': {
      const cw = (inner.w - gut) / 2;
      return {
        frame, caption,
        panels: [
          { x: inner.x, y: inner.y, w: cw, h: inner.h, rot: 0 },
          { x: inner.x + cw + gut, y: inner.y, w: cw, h: inner.h, rot: 0 },
        ],
      };
    }
    case 'stack': {
      const topH = inner.h * 0.58;
      return {
        frame, caption,
        panels: [
          { x: inner.x, y: inner.y, w: inner.w, h: topH, rot: 0 },
          { x: inner.x, y: inner.y + topH + gut, w: inner.w, h: inner.h - topH - gut, rot: 0 },
        ],
      };
    }
    default:
      return layoutPanels(w, h, 'grid4');
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gradeColor(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (t <= t1) {
      const k = (t - t0) / Math.max(0.0001, t1 - t0);
      return [lerp(r0, r1, k), lerp(g0, g1, k), lerp(b0, b1, k)];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

/**
 * Paints `img` into `rect` on `ctx` (cover-fit, per-panel zoom and drag offset),
 * then runs the grade's gradient map over the painted pixels. `rect` may be
 * rotated; the caller clips first.
 */
export function paintGradedPhoto(ctx, img, rect, panel, stops) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(rect.w));
  off.height = Math.max(2, Math.round(rect.h));
  const octx = off.getContext('2d');
  const base = Math.max(off.width / img.naturalWidth, off.height / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  // Cover-fit, anchored near the top of the photo when the panel crops it
  // vertically (faces sit high; the old 0.35 anchor cut heads off in wide,
  // short panels), plus the panel's own drag offset. When the panel is
  // taller than the photo there is no vertical crop to anchor, so keep the
  // centred 0.35 anchor there.
  const verticalCrop = rect.w / rect.h > img.naturalWidth / img.naturalHeight;
  const anchor = verticalCrop ? 0.08 : 0.35;
  const dx = (off.width - pw) * 0.5 + (panel.dx || 0) * off.width;
  const dy = (off.height - ph) * anchor + (panel.dy || 0) * off.height;
  octx.drawImage(img, dx, dy, pw, ph);
  const data = octx.getImageData(0, 0, off.width, off.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    const [r, g, b] = gradeColor(stops, lum);
    px[i] = px[i] * 0.22 + r * 0.78;
    px[i + 1] = px[i + 1] * 0.22 + g * 0.78;
    px[i + 2] = px[i + 2] * 0.22 + b * 0.78;
  }
  octx.putImageData(data, 0, 0);
  ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
}

/** Draws one photo panel: graded photo, white snapshot border, soft shadow. */
export function drawPhotoPanel(ctx, img, rect, panel, stops, border) {
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(rect.rot || 0);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.max(4, rect.w * 0.02);
  ctx.shadowOffsetY = Math.max(2, rect.h * 0.012);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-border, -border, rect.w + border * 2, rect.h + border * 2);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, rect.w, rect.h);
  ctx.clip();
  if (img) paintGradedPhoto(ctx, img, { x: 0, y: 0, w: rect.w, h: rect.h }, panel, stops);
  else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(0, 0, rect.w, rect.h);
  }
  ctx.restore();
  ctx.restore();
}

function fitCaptionFont(ctx, text, maxWidth, startSize, family = 'Anton, sans-serif') {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/** Draws the caption, sub-caption and place tag inside the caption band. */
export function drawCaptionBand(ctx, state, captionRect, w) {
  const { x, y, h } = captionRect;
  const text = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim();
  const pad = Math.max(10, w * 0.02);
  const cx = x + pad;
  const maxW = captionRect.w - pad * 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const lettering = state.lettering || 'anton';
  if (text) {
    const family = lettering === 'script' ? 'Pacifico, cursive' : 'Anton, sans-serif';
    const size = fitCaptionFont(ctx, text, maxW, h * (lettering === 'script' ? 0.62 : 0.52), family);
    ctx.font = `${size}px ${family}`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.strokeText(text, cx, y + h * 0.52);
    if (lettering === 'outline') {
      ctx.lineWidth = Math.max(2, size * 0.045);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(text, cx, y + h * 0.52);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 60, 160, 0.55)';
      ctx.shadowBlur = size * 0.18;
      ctx.fillText(text, cx, y + h * 0.52);
      ctx.shadowBlur = 0;
    }
  }
  if (sub) {
    const subSize = Math.max(12, h * 0.2);
    if (lettering === 'script') {
      ctx.font = `700 ${subSize}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sub.toUpperCase(), cx, y + h * 0.86);
    } else {
      ctx.font = `${subSize}px Pacifico, cursive`;
      ctx.fillStyle = '#ffd166';
      ctx.fillText(sub, cx, y + h * 0.86);
    }
  }
  ctx.font = `700 ${Math.max(11, h * 0.13)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.textAlign = 'right';
  ctx.fillText('NEON BAY', x + captionRect.w - pad, y + h * 0.3);
  ctx.textAlign = 'left';
}

/** Vignette + warm glow over the whole cover, for the poster finish. */
export function drawCoverFinish(ctx, w, h, grade) {
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.12, 0, w * 0.5, h * 0.12, Math.max(w, h) * 0.75);
  const tint = grade === 'neon' ? '255, 80, 200' : grade === 'teal' ? '40, 220, 200' : '255, 140, 60';
  glow.addColorStop(0, `rgba(${tint}, 0.14)`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draws the whole cover for `state` onto `canvas`, using `photos` (a Map of
 * photo id -> image). The canvas keeps its own pixel size; pass an offscreen
 * canvas at export size to render a PNG.
 */
export function drawCoverArt(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const stops = GRADE_STOPS[state.grade] || GRADE_STOPS.sunset;
  const geo = layoutPanels(w, h, state.layout);
  const count = panelCountFor(state.layout);
  // Backdrop: deep plum, or the grade's dark end for full-bleed.
  ctx.fillStyle = state.layout === 'tilted' ? '#170b26' : '#f5efe8';
  ctx.fillRect(0, 0, w, h);
  if (state.layout === 'fullbleed') {
    const rect = geo.panels[0];
    const panel = state.panels[0] || { photoId: null, zoom: 1, dx: 0, dy: 0 };
    drawPhotoPanel(ctx, photos.get(panel.photoId) || null, rect, panel, stops, 0);
    const scrim = ctx.createLinearGradient(0, h * 0.45, 0, h);
    scrim.addColorStop(0, 'rgba(10, 4, 24, 0)');
    scrim.addColorStop(1, 'rgba(10, 4, 24, 0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);
  } else {
    if (state.layout === 'tilted') {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#2b0f45');
      bg.addColorStop(0.55, '#7a1e6e');
      bg.addColorStop(1, '#ff7a3d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    const border = Math.max(3, Math.min(w, h) * 0.008);
    for (let i = 0; i < count; i++) {
      const panel = state.panels[i] || { photoId: null, zoom: 1, dx: 0, dy: 0 };
      drawPhotoPanel(ctx, photos.get(panel.photoId) || null, geo.panels[i], panel, stops, border);
    }
    // Caption band: dark plum strip with a neon top rule.
    ctx.fillStyle = '#160a24';
    ctx.fillRect(geo.caption.x, geo.caption.y, geo.caption.w, geo.caption.h);
    ctx.fillStyle = state.grade === 'neon' ? '#ff4fd8' : '#ff8a3d';
    ctx.fillRect(geo.caption.x, geo.caption.y, geo.caption.w, Math.max(3, h * 0.006));
  }
  drawCaptionBand(ctx, state, geo.caption, w);
  drawCoverFinish(ctx, w, h, state.grade);
}
