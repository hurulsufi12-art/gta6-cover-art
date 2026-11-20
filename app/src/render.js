// Golden Hour Cover Studio — the cover engine.
//
// Draws a multi-panel GTA-poster-style cover onto a 2D canvas from a plain
// state object: which layout, which colour grade, which photos sit in which
// panels (with a zoom and a pan each), and the caption. No DOM, no network,
// no state of its own, so the studio, the exporter and the headless shot
// driver all render through this one function.

export const SIZES = [
  { id: 'square', name: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', name: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

export const GRADES = [
  { id: 'vice-sunset', name: 'Vice Sunset', top: '#ff7a3d', mid: '#ff2e88', deep: '#2b1055', wash: 'rgba(255,110,60,0.20)', strength: 0.62 },
  { id: 'neon-nights', name: 'Neon Nights', top: '#00e5ff', mid: '#ff2e88', deep: '#12002e', wash: 'rgba(0,229,255,0.16)', strength: 0.66 },
  { id: 'golden-hour', name: 'Golden Hour', top: '#ffd166', mid: '#ef8354', deep: '#4a1942', wash: 'rgba(255,190,80,0.22)', strength: 0.55 },
  { id: 'palm-teal', name: 'Palm Teal', top: '#7ef0c1', mid: '#0e7c7b', deep: '#062b2b', wash: 'rgba(80,220,180,0.16)', strength: 0.58 },
  { id: 'heat-haze', name: 'Heat Haze', top: '#ff9e5e', mid: '#d7263d', deep: '#1d0b1e', wash: 'rgba(255,120,90,0.24)', strength: 0.60 },
  { id: 'mono-noir', name: 'Mono Noir', top: '#e8e8e8', mid: '#8a8a8a', deep: '#0a0a0a', wash: 'rgba(200,200,200,0.10)', strength: 0.50 },
];

// A panel is a rectangle in cover coordinates (0..1) with an optional tilt
// in degrees. Layouts return the photo panels in draw order plus, where the
// layout has one, a title cell (a panel with no photo, filled by the title
// block instead).
export const LAYOUTS = [
  {
    id: 'hero-split', name: 'Hero Split',
    panels: () => [
      { x: 0.03, y: 0.03, w: 0.60, h: 0.72 },
      { x: 0.65, y: 0.03, w: 0.32, h: 0.35 },
      { x: 0.65, y: 0.40, w: 0.32, h: 0.35 },
    ],
    title: { x: 0.03, y: 0.78, w: 0.94, h: 0.19 },
  },
  {
    id: 'four-grid', name: 'Four Grid',
    panels: () => [
      { x: 0.03, y: 0.03, w: 0.455, h: 0.36 },
      { x: 0.515, y: 0.03, w: 0.455, h: 0.36 },
      { x: 0.03, y: 0.41, w: 0.455, h: 0.36 },
      { x: 0.515, y: 0.41, w: 0.455, h: 0.36 },
    ],
    title: { x: 0.03, y: 0.79, w: 0.94, h: 0.18 },
  },
  {
    id: 'full-bleed', name: 'Full Bleed',
    panels: () => [{ x: 0.0, y: 0.0, w: 1.0, h: 1.0 }],
    title: { x: 0.05, y: 0.72, w: 0.90, h: 0.23 },
  },
  {
    id: 'strip-stack', name: 'Strip Stack',
    panels: () => [
      { x: 0.03, y: 0.03, w: 0.94, h: 0.235 },
      { x: 0.03, y: 0.285, w: 0.94, h: 0.235 },
      { x: 0.03, y: 0.54, w: 0.94, h: 0.20 },
    ],
    title: { x: 0.03, y: 0.76, w: 0.94, h: 0.21 },
  },
  {
    id: 'tilted-snaps', name: 'Tilted Snapshots',
    panels: () => [
      { x: 0.06, y: 0.06, w: 0.52, h: 0.46, rot: -4 },
      { x: 0.44, y: 0.10, w: 0.50, h: 0.42, rot: 3 },
      { x: 0.22, y: 0.40, w: 0.56, h: 0.36, rot: -2 },
    ],
    title: { x: 0.05, y: 0.79, w: 0.90, h: 0.18 },
  },
  {
    id: 'nine-grid', name: 'Nine Grid',
    panels: () => {
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // centre cell is the title
          out.push({ x: 0.02 + c * 0.325, y: 0.02 + r * 0.325, w: 0.305, h: 0.305 });
        }
      }
      return out;
    },
    title: { x: 0.345, y: 0.345, w: 0.305, h: 0.305 },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

// A tiny deterministic PRNG so the film grain is identical on every render
// of the same cover (seeded per cover, not per call).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw one image cover-fit inside a rectangle, with a zoom factor and a pan
// (fractions of the rectangle, -1..1). Empty slots fall back to a painted
// sunset so a cover is never a blank hole.
export function drawPhotoInto(ctx, img, rect, zoom, dx, dy) {
  const px = rect.x, py = rect.y, pw = rect.w, ph = rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  if (!img || !img.naturalWidth) {
    const g = ctx.createLinearGradient(px, py, px, py + ph);
    g.addColorStop(0, '#ff9e5e');
    g.addColorStop(0.55, '#d7263d');
    g.addColorStop(1, '#2b1055');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    drawSun(ctx, px + pw / 2, py + ph * 0.42, Math.min(pw, ph) * 0.22);
  } else {
    const z = Math.max(0.5, zoom || 1);
    const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * z;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const cx = px + pw / 2 + (dx || 0) * pw;
    const cy = py + ph / 2 + (dy || 0) * ph;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();
}

// A flat setting-sun disc with rays, drawn from paths — the studio's own
// mark, not borrowed art.
export function drawSun(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,233,168,0.85)';
  ctx.lineWidth = Math.max(2, r * 0.08);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
    ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// The colour grade: a sunset/neon gradient mapped over the whole cover,
// a warm wash, a vignette and seeded grain.
export function applyGrade(ctx, w, h, grade) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, grade.top);
  g.addColorStop(0.55, grade.mid);
  g.addColorStop(1, grade.deep);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.strength;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,0,20,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);

  const rand = mulberry32(0x9e3779b9);
  ctx.save();
  ctx.globalAlpha = 0.05;
  const step = Math.max(2, Math.round(Math.min(w, h) / 360));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (rand() < 0.5) {
        ctx.fillStyle = rand() < 0.5 ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.restore();
}

// Fit one line of text to a width by shrinking the font until it fits.
function fitFont(ctx, text, weight, family, startPx, maxW) {
  let px = startPx;
  while (px > 12) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
    px = Math.floor(px * 0.92);
  }
  return px;
}

export function drawTitleBlock(ctx, w, h, state, layout) {
  const t = layout.title;
  const tx = t.x * w, ty = t.y * h, tw = t.w * w, th = t.h * h;
  const grade = gradeById(state.grade);
  const [dr, dg, db] = hexRgb(grade.deep);

  ctx.save();
  // Scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(tx, ty, tx, ty + th);
  scrim.addColorStop(0, `rgba(${dr},${dg},${db},0.82)`);
  scrim.addColorStop(1, `rgba(${dr},${dg},${db},0.94)`);
  ctx.fillStyle = scrim;
  ctx.fillRect(tx, ty, tw, th);
  // Neon top rule.
  ctx.fillStyle = grade.top;
  ctx.fillRect(tx, ty, tw, Math.max(3, h * 0.006));

  const pad = tw * 0.04;
  const title = (state.title || 'GOLDEN HOUR').toUpperCase();
  const sub = state.subtitle || '';
  // The sun mark only fits a wide title block; in a near-square cell (the
  // nine-grid centre) it would sit on top of the lettering, so skip it there
  // and let the title use the full width.
  const sunR = Math.min(th * 0.30, tw * 0.06);
  const drawSunMark = tw > th * 2;
  const textW = tw - pad * 2 - (drawSunMark ? sunR * 2.2 : 0);
  const titlePx = fitFont(ctx, title, 400, "'Anton', sans-serif", Math.floor(th * 0.52), textW);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff8ec';
  ctx.shadowColor = grade.mid;
  ctx.shadowBlur = Math.max(6, h * 0.012);
  ctx.fillText(title, tx + pad, ty + th * (sub ? 0.36 : 0.52));
  ctx.shadowBlur = 0;
  if (sub) {
    const subPx = fitFont(ctx, sub, 400, "'Bebas Neue', sans-serif", Math.floor(th * 0.24), textW);
    ctx.fillStyle = grade.top;
    ctx.fillText(sub.toUpperCase(), tx + pad, ty + th * 0.78);
  }
  // Sun mark at the right of the title block.
  if (drawSunMark) drawSun(ctx, tx + tw - pad - sunR, ty + th / 2, sunR * 0.8);
  ctx.restore();
}

// Render the whole cover onto ctx at the canvas's own pixel size.
export function drawCover(ctx, w, h, state, photos) {
  const layout = layoutById(state.layout);
  const grade = gradeById(state.grade);

  // Backdrop: the grade's deep colour, so gutters read as part of the art.
  ctx.save();
  ctx.fillStyle = grade.deep;
  ctx.fillRect(0, 0, w, h);

  const panels = layout.panels();
  const gutter = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  panels.forEach((p, i) => {
    const slot = state.panels?.[i] ?? { photo: i % Math.max(1, photos.length), zoom: 1, dx: 0, dy: 0 };
    const img = photos[slot.photo] ?? null;
    const rect = { x: p.x * w, y: p.y * h, w: p.w * w, h: p.h * h };
    ctx.save();
    if (p.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      drawPhotoInto(ctx, img, { x: 0, y: 0, w: rect.w, h: rect.h }, slot.zoom, slot.dx, slot.dy);
      ctx.restore();
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.strokeStyle = '#fff8ec';
      ctx.lineWidth = gutter;
      ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.restore();
    } else {
      drawPhotoInto(ctx, img, rect, slot.zoom, slot.dx, slot.dy);
      ctx.strokeStyle = '#fff8ec';
      ctx.lineWidth = gutter;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  });

  applyGrade(ctx, w, h, grade);
  drawTitleBlock(ctx, w, h, state, layout);

  // Outer frame.
  ctx.strokeStyle = 'rgba(255,248,236,0.9)';
  ctx.lineWidth = Math.max(3, Math.round(Math.min(w, h) * 0.008));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();
}

// The default panel slots for a fresh cover: alternate the pool photos.
export function defaultPanels(count, poolSize) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ photo: poolSize ? i % poolSize : 0, zoom: 1, dx: 0, dy: 0 });
  }
  return out;
}
