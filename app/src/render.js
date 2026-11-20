// Golden Hour Cover Studio — cover render engine.
// Draws the whole poster on a 2D canvas: multi-panel layouts, golden-hour
// gradient-map grades, bold lettering and sticker badges. Everything is
// drawn with canvas primitives; no image is fetched from the network.
// Deterministic: the film grain uses a fixed-seed generator, so the same
// state always paints the same pixels.

export const CREAM = '#f7ead2';
export const INK = '#241a12';
export const CORAL = '#e4572e';
export const SUN = '#f2a541';

// Six golden-hour grades. Each maps a photo's luminance onto a duotone
// ramp (shadow colour -> highlight colour) and blends it back over the
// original, then grain and a vignette finish the film look.
export const GRADES = {
  gold: { shadow: [46, 22, 8], hi: [255, 190, 90], mix: 0.55, glow: 'rgba(255,170,60,0.10)' },
  teal: { shadow: [8, 42, 48], hi: [255, 196, 120], mix: 0.6, glow: 'rgba(40,180,170,0.08)' },
  peach: { shadow: [74, 30, 40], hi: [255, 196, 168], mix: 0.55, glow: 'rgba(255,150,130,0.10)' },
  mint: { shadow: [16, 52, 40], hi: [190, 255, 214], mix: 0.5, glow: 'rgba(120,220,170,0.08)' },
  mono: { shadow: [20, 16, 12], hi: [250, 238, 214], mix: 0.85, glow: 'rgba(255,240,210,0.05)' },
  coral: { shadow: [66, 14, 26], hi: [255, 150, 120], mix: 0.6, glow: 'rgba(255,80,90,0.10)' },
};

export const GRADE_NAMES = ['gold', 'teal', 'peach', 'mint', 'mono', 'coral'];
export const LAYOUT_NAMES = ['magazine', 'ninegrid', 'diagonal', 'filmstrip', 'duo', 'fullbleed'];
export const TITLE_STYLES = ['solid', 'outline', 'stamp'];

// Panel rectangles as fractions of the cover (x, y, w, h). The title zone
// is where the caption lettering goes; `titleBand` marks a slanted band.
export function layoutPanels(layout, W, H) {
  const g = 0.012; // cream gutter between panels, as a fraction of width
  const gw = W * g;
  switch (layout) {
    case 'ninegrid': {
      const cw = (W - gw * 4) / 3;
      const ch = (H - gw * 4) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue; // centre cell is the title block
          out.push({ x: gw + c * (cw + gw), y: gw + r * (ch + gw), w: cw, h: ch });
        }
      }
      return { panels: out, title: { x: gw + cw + gw, y: gw + ch + gw, w: cw, h: ch, kind: 'cell' } };
    }
    case 'diagonal':
      return {
        panels: [{ x: 0, y: 0, w: W, h: H }],
        title: { x: 0, y: H * 0.34, w: W, h: H * 0.32, kind: 'band', angle: -0.09 },
      };
    case 'filmstrip': {
      const stripW = W * 0.27;
      const smallH = (H - gw * 4) / 3;
      return {
        panels: [
          { x: gw, y: gw, w: stripW - gw, h: smallH },
          { x: gw, y: gw * 2 + smallH, w: stripW - gw, h: smallH },
          { x: gw, y: gw * 3 + smallH * 2, w: stripW - gw, h: smallH },
          { x: stripW + gw, y: gw, w: W - stripW - gw * 2, h: H - gw * 2 },
        ],
        title: { x: stripW + gw * 2, y: H * 0.68, w: W - stripW - gw * 3, h: H * 0.26, kind: 'foot' },
      };
    }
    case 'duo': {
      const pw = (W - gw * 3) / 2;
      return {
        panels: [
          { x: gw, y: gw, w: pw, h: H - gw * 2 },
          { x: gw * 2 + pw, y: gw, w: pw, h: H - gw * 2 },
        ],
        title: { x: gw, y: H * 0.60, w: W - gw * 2, h: H * 0.34, kind: 'foot' },
      };
    }
    case 'fullbleed':
      return {
        panels: [{ x: 0, y: 0, w: W, h: H }],
        title: { x: W * 0.06, y: H * 0.62, w: W * 0.88, h: H * 0.32, kind: 'foot' },
      };
    case 'magazine':
    default: {
      const heroH = H * 0.60;
      const stripY = heroH + gw;
      const stripH = H - stripY - gw;
      const pw = (W - gw * 4) / 3;
      return {
        panels: [
          { x: 0, y: 0, w: W, h: heroH },
          { x: gw, y: stripY, w: pw, h: stripH },
          { x: gw * 2 + pw, y: stripY, w: pw, h: stripH },
          { x: gw * 3 + pw * 2, y: stripY, w: pw, h: stripH },
        ],
        // Title overlaps the seam between hero and strip, like a magazine masthead.
        title: { x: W * 0.05, y: heroH - H * 0.085, w: W * 0.9, h: H * 0.17, kind: 'seam' },
      };
    }
  }
}

// Fixed-seed noise so grain is identical on every render.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Apply a grade to a panel-sized offscreen canvas and return it.
function gradedPanel(img, rect, grade, ox, oy, zoom) {
  const w = Math.max(2, Math.round(rect.w));
  const h = Math.max(2, Math.round(rect.h));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.fillStyle = '#3a2a1c';
  c.fillRect(0, 0, w, h);
  if (img) {
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
    const pw = img.naturalWidth * base;
    const ph = img.naturalHeight * base;
    c.drawImage(img, (w - pw) / 2 + ox * w, (h - ph) / 2 + oy * h, pw, ph);
  } else {
    // Empty panel: warm paper with a dashed frame and a hint, never blank white.
    c.fillStyle = '#e8d5ae';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(36,26,18,0.45)';
    c.setLineDash([10, 8]);
    c.lineWidth = 2;
    c.strokeRect(10, 10, w - 20, h - 20);
    c.setLineDash([]);
    c.fillStyle = 'rgba(36,26,18,0.6)';
    c.font = `${Math.max(14, Math.round(w * 0.055))}px "Bebas Neue", sans-serif`;
    c.textAlign = 'center';
    c.fillText('ADD A PHOTO', w / 2, h / 2);
    return cv;
  }
  const g = GRADES[grade] || GRADES.gold;
  const data = c.getImageData(0, 0, w, h);
  const px = data.data;
  const [sr, sg, sb] = g.shadow;
  const [hr, hg, hb] = g.hi;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    const tr = sr + (hr - sr) * lum;
    const tg = sg + (hg - sg) * lum;
    const tb = sb + (hb - sb) * lum;
    px[i] = px[i] * (1 - g.mix) + tr * g.mix;
    px[i + 1] = px[i + 1] * (1 - g.mix) + tg * g.mix;
    px[i + 2] = px[i + 2] * (1 - g.mix) + tb * g.mix;
  }
  c.putImageData(data, 0, 0);
  c.fillStyle = g.glow;
  c.fillRect(0, 0, w, h);
  return cv;
}

function paintGrain(ctx, W, H) {
  const rnd = mulberry(20261120);
  const step = Math.max(3, Math.round(W / 260));
  ctx.save();
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const v = rnd();
      if (v < 0.5) continue;
      ctx.fillStyle = v > 0.92 ? 'rgba(255,240,210,0.16)' : 'rgba(20,10,5,0.10)';
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }
  ctx.restore();
}

function paintVignette(ctx, W, H) {
  const r = Math.hypot(W, H) / 2;
  const grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(20,8,2,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function fitFont(ctx, text, maxW, startPx, family) {
  let px = startPx;
  ctx.font = `${px}px ${family}`;
  while (ctx.measureText(text).width > maxW && px > 10) {
    px -= 2;
    ctx.font = `${px}px ${family}`;
  }
  return px;
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function paintBadges(ctx, W, H, badges, zone) {
  const bx = zone.x + zone.w - W * 0.02;
  const by = zone.y + zone.h * 0.08;
  if (badges.stars) {
    const r = Math.max(8, W * 0.013);
    for (let i = 0; i < 5; i++) drawStar(ctx, bx - (4 - i) * r * 2.4, by, r, '#ffd166');
  }
  if (badges.est) {
    const cx = bx - W * 0.02;
    const cy = by + H * 0.075;
    const r = Math.max(20, W * 0.032);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = CREAM; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.08); ctx.strokeStyle = CORAL; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(r * 0.52)}px "Bebas Neue", sans-serif`;
    ctx.fillText('EST.', cx, cy - r * 0.28);
    ctx.font = `${Math.round(r * 0.62)}px "Anton", sans-serif`;
    ctx.fillText('2026', cx, cy + r * 0.34);
    ctx.restore();
  }
  if (badges.pin) {
    const px = zone.x + W * 0.02;
    const py = zone.y + zone.h * 0.10;
    ctx.save();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(9, W * 0.014), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4, W * 0.006), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// The title block: big Anton caption in the chosen style, a Bebas Neue
// sub-caption and a place tag underneath.
function paintTitle(ctx, zone, opts) {
  const { titleStyle, title, sub, tag } = opts;
  const W = zone.w;
  const titleText = (title || 'GOLDEN HOUR').toUpperCase();
  ctx.save();
  if (zone.kind === 'band') {
    ctx.translate(zone.x + zone.w / 2, zone.y + zone.h / 2);
    ctx.rotate(zone.angle || 0);
    ctx.translate(-zone.w / 2, -zone.h / 2);
    ctx.fillStyle = 'rgba(36,26,18,0.88)';
    ctx.fillRect(-zone.w * 0.05, zone.h * 0.08, zone.w * 1.1, zone.h * 0.84);
    // Title centred inside the band, kicker above it, sub-caption below it.
    const band = { x: 0, y: zone.h * 0.08, w: zone.w, h: zone.h * 0.84 };
    const px = fitFont(ctx, titleText, band.w * 0.9, Math.min(band.h * 0.45, band.w * 0.12), '"Anton", sans-serif');
    const lines = wrapLines(ctx, titleText, band.w * 0.9);
    const lineH = px * 1.04;
    const totalH = lines.length * lineH;
    const firstBase = band.y + band.h / 2 - totalH / 2 + px * 0.36;
    ctx.textAlign = 'center';
    if (tag) {
      ctx.font = `${Math.max(12, Math.round(px * 0.22))}px "Bebas Neue", sans-serif`;
      ctx.fillStyle = SUN;
      ctx.fillText(`★ ${tag.toUpperCase()} ★`, band.w / 2, firstBase - totalH / 2 - px * 0.30);
    }
    drawTitleText(ctx, lines, band.w / 2, firstBase, lineH, px, titleStyle);
    if (sub) {
      ctx.font = `${Math.max(13, Math.round(px * 0.24))}px "Bebas Neue", sans-serif`;
      ctx.fillStyle = CREAM;
      ctx.fillText(sub.toLowerCase().slice(0, 64), band.w / 2, firstBase + (lines.length - 1) * lineH + px * 0.46);
    }
    ctx.restore();
    return;
  }
  if (zone.kind === 'cell') {
    ctx.fillStyle = INK;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    const px = fitFont(ctx, titleText, zone.w * 0.86, zone.w * 0.16, '"Anton", sans-serif');
    const lines = wrapLines(ctx, titleText, zone.w * 0.86);
    const lineH = px * 1.02;
    let y = zone.y + zone.h / 2 - ((lines.length - 1) * lineH) / 2 + px * 0.32;
    for (const ln of lines) { ctx.fillText(ln, zone.x + zone.w / 2, y); y += lineH; }
    ctx.font = `${Math.round(zone.w * 0.07)}px "Bebas Neue", sans-serif`;
    ctx.fillStyle = SUN;
    ctx.fillText((sub || '').toUpperCase().slice(0, 40), zone.x + zone.w / 2, zone.y + zone.h - zone.h * 0.10);
    ctx.restore();
    return;
  }
  paintTitleLines(ctx, zone, opts, titleText);
  ctx.restore();
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

// Draws the title lines at (x, firstBaseline), one line per lineH.
// Solid: cream fill with a soft shadow. Outline: dark under-stroke first so
// hollow letters stay readable on bright photos, then a cream stroke.
// Stamp: coral offset copy behind a cream outline.
function drawTitleText(ctx, lines, x, firstBaseline, lineH, px, titleStyle) {
  // Caller sets textAlign (left for seam/foot zones, centre for the band).
  // The title font must be (re)set here: the kicker above it uses Bebas Neue.
  ctx.font = `${px}px "Anton", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  let y = firstBaseline;
  for (const ln of lines) {
    if (titleStyle === 'outline') {
      ctx.lineWidth = Math.max(3, px * 0.15);
      ctx.strokeStyle = INK;
      ctx.strokeText(ln, x, y);
      ctx.lineWidth = Math.max(2, px * 0.05);
      ctx.strokeStyle = CREAM;
      ctx.strokeText(ln, x, y);
    } else if (titleStyle === 'stamp') {
      ctx.fillStyle = CORAL;
      ctx.fillText(ln, x + px * 0.07, y + px * 0.08);
      ctx.lineWidth = Math.max(2, px * 0.05);
      ctx.strokeStyle = CREAM;
      ctx.strokeText(ln, x, y);
    } else {
      ctx.fillStyle = CREAM;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = px * 0.12;
      ctx.shadowOffsetY = px * 0.04;
      ctx.fillText(ln, x, y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    y += lineH;
  }
  return y;
}

function paintTitleLines(ctx, zone, opts, titleText) {
  const { titleStyle, sub, tag } = opts;
  const pad = zone.w * 0.04;
  const maxW = zone.w - pad * 2;
  const px = fitFont(ctx, titleText, maxW, Math.min(zone.h * 0.52, zone.w * 0.13), '"Anton", sans-serif');
  const lines = wrapLines(ctx, titleText, maxW);
  const lineH = px * 1.04;
  const totalH = lines.length * lineH;
  // A soft ink scrim behind the lettering so it reads on any photo.
  ctx.fillStyle = 'rgba(36,26,18,0.42)';
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  // Kicker at the top of the zone, title block centred, sub-caption below.
  // The seam zone is too short for all three, so the kicker is dropped there.
  if (tag && zone.h >= totalH + px * 1.1) {
    ctx.font = `${Math.max(12, Math.round(px * 0.22))}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = SUN;
    ctx.fillText(`★ ${tag.toUpperCase()} ★`, zone.x + pad, zone.y + px * 0.26);
  }
  const firstBase = zone.y + zone.h / 2 - totalH / 2 + px * 0.36;
  ctx.textAlign = 'left';
  const after = drawTitleText(ctx, lines, zone.x + pad, firstBase, lineH, px, titleStyle);
  if (sub) {
    ctx.font = `${Math.max(13, Math.round(px * 0.24))}px "Bebas Neue", sans-serif`;
    ctx.fillStyle = CREAM;
    ctx.fillText(sub.toLowerCase().slice(0, 64), zone.x + pad, after + px * 0.10);
  }
}

// Paint a full cover. `panels` is an array aligned with layoutPanels'
// panels: { img, ox, oy, zoom } or null per slot.
export function paintCover(canvas, opts) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const layout = layoutPanels(opts.layout || 'magazine', W, H);
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  layout.panels.forEach((rect, i) => {
    const slot = (opts.panels && opts.panels[i]) || null;
    const panel = gradedPanel(slot ? slot.img : null, rect, opts.grade || 'gold', slot ? slot.ox || 0 : 0, slot ? slot.oy || 0 : 0, slot ? slot.zoom || 1 : 1);
    ctx.drawImage(panel, rect.x, rect.y);
    if (opts.selected === i) {
      ctx.save();
      ctx.strokeStyle = CORAL;
      ctx.lineWidth = Math.max(3, W * 0.004);
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.restore();
    }
  });
  paintTitle(ctx, layout.title, opts);
  paintBadges(ctx, W, H, opts.badges || {}, { x: 0, y: 0, w: W, h: H * 0.30 });
  paintGrain(ctx, W, H);
  paintVignette(ctx, W, H);
  // Thin ink frame, the poster's edge.
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(3, W * 0.005);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  return layout;
}

export const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 square' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 portrait' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080 wide' },
};
