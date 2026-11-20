// Golden Hour Cover Studio — render.js
// The cover renderer: six poster layouts, six golden-hour duotone grades,
// Anton / Bebas Neue lettering, sticker badges, film grain and vignette.
// Pure canvas drawing: given a state, a list of loaded photos and a size,
// it paints the whole cover. No network, no DOM writes, no side effects
// besides the canvas it is handed.

export const LAYOUTS = {
  magazine: { name: 'Magazine', panels: 4 },
  ninegrid: { name: 'Nine Grid', panels: 8 },
  diagonal: { name: 'Diagonal', panels: 1 },
  filmstrip: { name: 'Film Strip', panels: 4 },
  duo: { name: 'Duo', panels: 2 },
  fullbleed: { name: 'Full Bleed', panels: 1 },
};

export const GRADES = {
  gold: { name: 'Gold', shadow: [43, 16, 58], mid: [198, 93, 33], high: [255, 217, 138] },
  teal: { name: 'Teal Noir', shadow: [3, 24, 28], mid: [15, 95, 107], high: [191, 232, 216] },
  peach: { name: 'Peach', shadow: [58, 15, 30], mid: [224, 112, 90], high: [255, 227, 194] },
  mint: { name: 'Mint', shadow: [11, 36, 31], mid: [46, 143, 122], high: [216, 255, 233] },
  mono: { name: 'Mono', shadow: [0, 0, 0], mid: [119, 119, 119], high: [255, 255, 255] },
  coral: { name: 'Coral', shadow: [42, 10, 30], mid: [214, 69, 107], high: [255, 209, 102] },
};

export const TITLE_STYLES = {
  solid: 'Solid',
  outline: 'Outline',
  stamp: 'Stamp',
};

export const EXPORT_SIZES = {
  square: { name: 'Square', w: 1080, h: 1080 },
  portrait: { name: 'Portrait', w: 1080, h: 1350 },
  wide: { name: 'Wide', w: 1920, h: 1080 },
};

// Panel rectangles (fractions of the cover) for each layout, plus where the
// title sits. Gaps are baked into the fractions so the warm paper colour
// shows between panels as a poster border.
export function panelsForLayout(layout, W, H) {
  const g = 0.012; // gutter, as a fraction of the cover width
  switch (layout) {
    case 'magazine': {
      const stripY = 0.62;
      const stripH = 0.35;
      const third = (1 - g * 4) / 3;
      return {
        panels: [
          { id: 'hero', x: 0, y: 0, w: W, h: H * 0.58 },
          { id: 'strip1', x: W * g, y: H * stripY, w: W * third, h: H * stripH },
          { id: 'strip2', x: W * (g * 2 + third), y: H * stripY, w: W * third, h: H * stripH },
          { id: 'strip3', x: W * (g * 3 + third * 2), y: H * stripY, w: W * third, h: H * stripH },
        ],
        title: { x: W * 0.05, y: H * 0.485, w: W * 0.9, h: H * 0.15, align: 'left' },
      };
    }
    case 'ninegrid': {
      const cell = 1 / 3;
      const panels = [];
      let n = 0;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (row === 1 && col === 1) continue; // centre cell is the title block
          n++;
          panels.push({
            id: `cell${n}`,
            x: W * (col * cell + g / 2),
            y: H * (row * cell + g / 2),
            w: W * (cell - g),
            h: H * (cell - g),
          });
        }
      }
      return {
        panels,
        title: { x: W * cell, y: H * cell, w: W * cell, h: H * cell, align: 'centre', block: true },
      };
    }
    case 'diagonal':
      return {
        panels: [{ id: 'bg', x: 0, y: 0, w: W, h: H }],
        title: { x: 0, y: H * 0.38, w: W, h: H * 0.24, align: 'centre', band: true },
      };
    case 'filmstrip': {
      const stripX = 0.68;
      const third = (1 - g * 4) / 3;
      return {
        panels: [
          { id: 'big', x: 0, y: 0, w: W * 0.66, h: H },
          { id: 'tall1', x: W * stripX, y: H * g, w: W * (0.32 - g), h: H * third },
          { id: 'tall2', x: W * stripX, y: H * (g * 2 + third), w: W * (0.32 - g), h: H * third },
          { id: 'tall3', x: W * stripX, y: H * (g * 3 + third * 2), w: W * (0.32 - g), h: H * third },
        ],
        title: { x: W * 0.04, y: H * 0.8, w: W * 0.58, h: H * 0.14, align: 'left' },
      };
    }
    case 'duo':
      return {
        panels: [
          { id: 'left', x: 0, y: 0, w: W * (0.5 - g / 2), h: H },
          { id: 'right', x: W * (0.5 + g / 2), y: 0, w: W * (0.5 - g / 2), h: H },
        ],
        title: { x: W * 0.05, y: H * 0.78, w: W * 0.9, h: H * 0.16, align: 'left' },
      };
    case 'fullbleed':
    default:
      return {
        panels: [{ id: 'full', x: 0, y: 0, w: W, h: H }],
        title: { x: W * 0.05, y: H * 0.72, w: W * 0.9, h: H * 0.2, align: 'left', scrim: true },
      };
  }
}

// A small deterministic random generator, so the film grain is identical
// every time the same cover is drawn.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Map one luminance value through a grade's three-stop gradient.
function gradePixel(lum, grade) {
  const t = lum / 255;
  let lo;
  let hi;
  let f;
  if (t < 0.5) {
    lo = grade.shadow;
    hi = grade.mid;
    f = t / 0.5;
  } else {
    lo = grade.mid;
    hi = grade.high;
    f = (t - 0.5) / 0.5;
  }
  return [lerp(lo[0], hi[0], f), lerp(lo[1], hi[1], f), lerp(lo[2], hi[2], f)];
}

// The graded copy of one photo, cached by photo and grade. The grade is
// baked into a downscaled copy (900 px on the long side), which the panels
// then draw cover-fit, so grading runs once per photo, not once per panel.
const gradedCache = new Map();
export function gradedPhoto(photo, gradeKey) {
  const key = `${photo.name}|${gradeKey}`;
  const hit = gradedCache.get(key);
  if (hit) return hit;
  const grade = GRADES[gradeKey] ?? GRADES.gold;
  const img = photo.img;
  const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(2, Math.round(img.naturalWidth * scale));
  const h = Math.max(2, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const [r, g, b] = gradePixel(lum, grade);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  if (gradedCache.size > 24) gradedCache.clear();
  gradedCache.set(key, canvas);
  return canvas;
}

// Draw one graded photo cover-fit into a panel rect, honouring its
// drag offset (ox, oy as fractions of the panel) and zoom.
function drawPanelPhoto(ctx, photo, gradeKey, rect, place) {
  const src = gradedPhoto(photo, gradeKey);
  const zoom = place?.zoom ?? 1;
  const scale = Math.max(rect.w / src.width, rect.h / src.height) * zoom;
  const dw = src.width * scale;
  const dh = src.height * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (place?.ox ?? 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (place?.oy ?? 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(src, dx, dy, dw, dh);
  // A faint warm wash keeps the grade sunny even in the shadows.
  ctx.fillStyle = 'rgba(255, 170, 60, 0.06)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

// A five-pointed star path, for the sticker row.
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Fit the title to its zone by shrinking the font until it fits.
function fitFont(ctx, text, maxWidth, startPx, family) {
  let px = startPx;
  while (px > 12) {
    ctx.font = `${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px -= 2;
  }
  return px;
}

function drawTitle(ctx, state, zone, W, H) {
  const title = (state.title || 'GOLDEN HOUR').toUpperCase();
  const style = state.titleStyle || 'solid';
  const unit = W / 1080;
  if (zone.band) {
    // A slanted band cutting across the cover, title riding on it.
    ctx.save();
    ctx.translate(W / 2, zone.y + zone.h / 2);
    ctx.rotate(-0.1);
    const bandGrad = ctx.createLinearGradient(-W / 2, 0, W / 2, 0);
    bandGrad.addColorStop(0, '#ff7a18');
    bandGrad.addColorStop(0.5, '#e63b7a');
    bandGrad.addColorStop(1, '#7a2bd8');
    ctx.fillStyle = bandGrad;
    ctx.fillRect(-W * 0.62, -zone.h * 0.42, W * 1.24, zone.h * 0.84);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(-W * 0.62, -zone.h * 0.42, W * 1.24, Math.max(2, 3 * unit));
    ctx.fillRect(-W * 0.62, zone.h * 0.42 - Math.max(2, 3 * unit), W * 1.24, Math.max(2, 3 * unit));
    const px = fitFont(ctx, title, W * 0.94, zone.h * 0.62, 'Anton, sans-serif');
    ctx.font = `${px}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff8ec';
    ctx.fillText(title, 0, px * 0.04);
    ctx.restore();
    return;
  }
  if (zone.block) {
    // The centre cell of the Nine Grid: a deep title block.
    ctx.fillStyle = '#1c0f2e';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = Math.max(2, 3 * unit);
    ctx.strokeRect(zone.x + 6 * unit, zone.y + 6 * unit, zone.w - 12 * unit, zone.h - 12 * unit);
    const words = title.split(' ');
    const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [title];
    const px = fitFont(ctx, lines.reduce((a, b) => (a.length > b.length ? a : b), ''), zone.w * 0.86, zone.w * 0.24, 'Anton, sans-serif');
    ctx.font = `${px}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd98a';
    lines.forEach((line, i) => {
      ctx.fillText(line, zone.x + zone.w / 2, zone.y + zone.h / 2 + (i - (lines.length - 1) / 2) * px * 1.08);
    });
    return;
  }
  if (zone.scrim) {
    const grad = ctx.createLinearGradient(0, zone.y - H * 0.08, 0, zone.y + zone.h + H * 0.04);
    grad.addColorStop(0, 'rgba(10, 5, 20, 0)');
    grad.addColorStop(1, 'rgba(10, 5, 20, 0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, zone.y - H * 0.08, W, zone.h + H * 0.12);
  }
  const px = fitFont(ctx, title, zone.w, zone.h * 0.62, 'Anton, sans-serif');
  ctx.font = `${px}px Anton, sans-serif`;
  ctx.textAlign = zone.align === 'centre' ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  const tx = zone.align === 'centre' ? zone.x + zone.w / 2 : zone.x;
  const ty = zone.y + zone.h * 0.62;
  ctx.save();
  if (style === 'stamp') {
    ctx.translate(tx, ty);
    ctx.rotate(-0.03);
    ctx.translate(-tx, -ty);
  }
  ctx.shadowColor = 'rgba(20, 8, 30, 0.55)';
  ctx.shadowBlur = Math.max(2, 10 * unit);
  ctx.shadowOffsetY = Math.max(2, 4 * unit);
  if (style === 'outline') {
    ctx.lineWidth = Math.max(2, px * 0.045);
    ctx.strokeStyle = '#fff8ec';
    ctx.strokeText(title, tx, ty);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255, 248, 236, 0.12)';
    ctx.fillText(title, tx, ty);
  } else if (style === 'stamp') {
    ctx.lineWidth = Math.max(2, px * 0.04);
    ctx.strokeStyle = '#ff5a3c';
    const tw = ctx.measureText(title).width;
    const pad = px * 0.28;
    const bx = zone.align === 'centre' ? tx - tw / 2 - pad : tx - pad;
    ctx.strokeRect(bx, ty - px * 0.95, tw + pad * 2, px * 1.25);
    ctx.fillStyle = '#ff5a3c';
    ctx.fillText(title, tx, ty);
  } else {
    const grad = ctx.createLinearGradient(0, ty - px, 0, ty);
    grad.addColorStop(0, '#fff8ec');
    grad.addColorStop(1, '#ffd98a');
    ctx.fillStyle = grad;
    ctx.fillText(title, tx, ty);
  }
  ctx.restore();
}

function drawSubtitle(ctx, state, zone, W, H) {
  const sub = (state.subtitle || '').trim();
  if (!sub) return;
  const unit = Math.min(W, H) / 1080;
  const px = Math.max(12, Math.round(Math.min(W, H) * 0.026));
  ctx.font = `${px}px "Bebas Neue", sans-serif`;
  try {
    ctx.letterSpacing = `${Math.max(2, 4 * unit)}px`;
  } catch {
    // letterSpacing is optional; the caption reads fine without it.
  }
  ctx.textAlign = zone.align === 'centre' ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  const tx = zone.align === 'centre' ? zone.x + zone.w / 2 : zone.x;
  // The sub-caption sits just under the title, inside the title zone — and
  // in the Magazine layout it must stay above the film strip below the
  // hero, never printed across the strip's panels.
  let ty = zone.y + zone.h * 0.95;
  if (state.layout === 'magazine') ty = Math.min(ty, H * 0.6);
  ty = Math.min(ty, H - px * 0.6);
  ctx.fillStyle = '#fff8ec';
  ctx.shadowColor = 'rgba(20, 8, 30, 0.6)';
  ctx.shadowBlur = 6 * unit;
  ctx.fillText(sub.toUpperCase(), tx, ty);
  ctx.shadowColor = 'transparent';
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // ignore
  }
}

function drawStickers(ctx, state, W, H) {
  const unit = W / 1080;
  const stickers = state.stickers || {};
  const margin = W * 0.045;
  let y = H * 0.045;
  if (stickers.stars) {
    const r = Math.max(8, 13 * unit);
    for (let i = 0; i < 5; i++) {
      starPath(ctx, margin + r + i * r * 2.4, y + r, r);
      ctx.fillStyle = '#ffc93c';
      ctx.strokeStyle = 'rgba(20, 8, 30, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
    y += r * 2 + H * 0.015;
  }
  if (stickers.est) {
    const r = Math.max(26, 40 * unit);
    const cx = W - margin - r;
    const cy = r + H * 0.03;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20, 8, 30, 0.78)';
    ctx.fill();
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = Math.max(2, 3 * unit);
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(10, 15 * unit)}px "Bebas Neue", sans-serif`;
    ctx.fillText('EST.', cx, cy - r * 0.28);
    ctx.font = `${Math.max(12, 19 * unit)}px Anton, sans-serif`;
    ctx.fillText('2026', cx, cy + r * 0.3);
  }
  if (stickers.pin) {
    const place = (state.place || '').trim();
    if (place) {
      const px = Math.max(11, Math.round(W * 0.02));
      ctx.font = `${px}px "Bebas Neue", sans-serif`;
      const tw = ctx.measureText(place.toUpperCase()).width;
      const pad = px * 0.9;
      const bw = tw + pad * 2 + px * 1.1;
      const bh = px * 2.1;
      const bx = margin;
      const by = H - margin - bh;
      ctx.fillStyle = 'rgba(20, 8, 30, 0.78)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a3c';
      ctx.beginPath();
      ctx.arc(bx + pad + px * 0.35, by + bh / 2, px * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8ec';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(place.toUpperCase(), bx + pad + px * 1.05, by + bh / 2 + px * 0.06);
    }
  }
}

// Paint the whole cover for a state onto ctx at W x H.
export function drawCover(ctx, state, photos, W, H) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f7efe2'; // warm paper: the gutters between panels
  ctx.fillRect(0, 0, W, H);
  const { panels, title } = panelsForLayout(state.layout || 'magazine', W, H);
  const gradeKey = state.grade || 'gold';
  for (const panel of panels) {
    const place = (state.panels || {})[panel.id];
    const photo = place && place.photo !== null && place.photo !== undefined ? photos[place.photo] : null;
    if (photo && photo.img && photo.img.naturalWidth > 0) {
      drawPanelPhoto(ctx, photo, gradeKey, panel, place);
    } else {
      // An empty panel reads as a sun-faded placeholder, never a hole.
      const grad = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.w, panel.y + panel.h);
      grad.addColorStop(0, '#e8b06a');
      grad.addColorStop(1, '#c65d8a');
      ctx.fillStyle = grad;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.fillStyle = 'rgba(255, 248, 236, 0.85)';
      ctx.font = `${Math.max(12, Math.round(panel.w * 0.05))}px "Bebas Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', panel.x + panel.w / 2, panel.y + panel.h / 2);
    }
  }
  // Vignette: darkened corners pull the eye to the middle of the poster.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(20, 8, 30, 0)');
  vig.addColorStop(1, 'rgba(20, 8, 30, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  drawTitle(ctx, state, title, W, H);
  if (!title.block && !title.band) drawSubtitle(ctx, state, title, W, H);
  drawStickers(ctx, state, W, H);
  // Film grain, seeded so the same cover always grains the same way.
  const seed = [...(state.title || ''), state.layout || '', state.grade || ''].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const rand = mulberry32(seed);
  const dots = Math.floor((W * H) / 900);
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < dots; i++) {
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * W, rand() * H, 1.4, 1.4);
  }
  ctx.restore();
}

// Make a fresh canvas and draw the cover on it at the export size.
export function renderCoverCanvas(state, photos, W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  drawCover(canvas.getContext('2d'), state, photos, W, H);
  return canvas;
}
