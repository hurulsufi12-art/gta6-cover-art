// Golden Hour Cover Studio — cover render engine (canvas 2D).
// Draws a GTA-style multi-panel cover from photos + caption state.
// Layouts: magazine, ninegrid, diagonal, strip, duo, fullbleed.
// Grades: gold, tealnoir, peach, mint, mono, coral (gradient-map duotones).
// Lettering: Anton title in solid / outline / stamp styles, Bebas Neue labels.

export const LAYOUTS = ['magazine', 'ninegrid', 'diagonal', 'strip', 'duo', 'fullbleed'];
export const GRADES = ['gold', 'tealnoir', 'peach', 'mint', 'mono', 'coral'];
export const TITLE_STYLES = ['solid', 'outline', 'stamp'];
export const SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

// Each grade is a 3-stop gradient map: [shadow, mid, highlight] plus a warm
// wash colour laid over the whole cover and a grain strength.
export const GRADE_MAPS = {
  gold:     { stops: ['#16302e', '#c98a2e', '#fff3d6'], wash: 'rgba(255,176,66,0.10)', grain: 0.05 },
  tealnoir: { stops: ['#052426', '#1f6f6b', '#d8f2ec'], wash: 'rgba(20,120,110,0.08)', grain: 0.07 },
  peach:    { stops: ['#4a2b3a', '#e07856', '#ffe9d6'], wash: 'rgba(255,140,90,0.10)', grain: 0.05 },
  mint:     { stops: ['#14352c', '#4fae8a', '#e8fff2'], wash: 'rgba(120,220,170,0.08)', grain: 0.05 },
  mono:     { stops: ['#101010', '#8a8a8a', '#ffffff'], wash: 'rgba(255,255,255,0.00)', grain: 0.09 },
  coral:    { stops: ['#3a1a2e', '#e14b5a', '#ffe3c2'], wash: 'rgba(255,90,90,0.10)', grain: 0.06 },
};

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

export function lerpColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Map one pixel's luminance through the grade's 3-stop gradient.
export function gradePixel(lum, stops) {
  const [s, m, h] = stops.map(hexRgb);
  if (lum < 0.5) return lerpColor(s, m, lum * 2);
  return lerpColor(m, h, (lum - 0.5) * 2);
}

// Apply the grade to a canvas in place (duotone gradient map + warm wash).
export function applyGrade(ctx, w, h, gradeName) {
  const grade = GRADE_MAPS[gradeName] || GRADE_MAPS.gold;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const stops = grade.stops;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const [r, g, b] = gradePixel(lum, stops);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  if (grade.wash !== 'rgba(255,255,255,0.00)') {
    ctx.fillStyle = grade.wash;
    ctx.fillRect(0, 0, w, h);
  }
}

// Deterministic grain: a seeded scatter of tiny dots, same cover every run.
export function addGrain(ctx, w, h, strength) {
  let seed = 20261119;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.save();
  const count = Math.floor(w * h * strength / 900);
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  ctx.restore();
}

// Soft vignette: darkens the corners so the title pops.
export function addVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(20,10,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// Draw one photo into a rect with per-panel crop: cx/cy in 0..1, zoom >= 1.
// Cover-fit: the photo always fills the rect. The crop offset only moves the
// photo along the axis where it overflows, so no paper ever shows through.
export function drawPhotoPanel(ctx, img, rect, crop) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const zoom = Math.max(1, crop.zoom || 1);
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale, dh = img.height * scale;
  const cx = crop.cx ?? 0.5, cy = crop.cy ?? 0.5;
  const dx = x + (w - dw) / 2 + (0.5 - cx) * Math.max(0, dw - w);
  const dy = y + (h - dh) / 2 + (0.5 - cy) * Math.max(0, dh - h);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// Cream frame line around a panel, like a printed photo border.
export function framePanel(ctx, rect, lineW, color) {
  ctx.save();
  ctx.strokeStyle = color || '#fff8e7';
  ctx.lineWidth = lineW;
  ctx.strokeRect(rect.x + lineW / 2, rect.y + lineW / 2, rect.w - lineW, rect.h - lineW);
  ctx.restore();
}

// Panel rects for each layout, in cover coordinates. Returns { panels, titleZone }.
// titleZone: { x, y, w, h, align } where the big title is centred.
export function layoutPanels(layout, W, H) {
  const gap = Math.round(W * 0.008);
  const heroH = Math.round(H * 0.62);
  const stripH = H - heroH - Math.round(H * 0.16);
  const bandH = H - heroH - stripH;
  switch (layout) {
    case 'magazine': {
      const stripY = heroH;
      const pw = (W - gap * 2) / 3;
      return {
        panels: [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: stripY, w: pw, h: stripH },
          { x: pw + gap, y: stripY, w: pw, h: stripH },
          { x: (pw + gap) * 2, y: stripY, w: pw, h: stripH },
        ],
        titleZone: { x: 0, y: heroH - Math.round(H * 0.075), w: W, h: Math.round(H * 0.15), align: 'center' },
        bandY: heroH + stripH,
        bandH,
      };
    }
    case 'ninegrid': {
      const cw = W / 3, ch = H / 3;
      const panels = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        if (r === 1 && c === 1) continue; // centre cell is the title block
        panels.push({ x: c * cw + gap / 2, y: r * ch + gap / 2, w: cw - gap, h: ch - gap });
      }
      return {
        panels,
        titleZone: { x: cw, y: ch, w: cw, h: ch, align: 'center', block: true },
        bandY: H, bandH: 0,
      };
    }
    case 'diagonal': {
      return {
        panels: [
          { x: 0, y: 0, w: W, h: H },
          { x: Math.round(W * 0.52), y: Math.round(H * 0.60), w: Math.round(W * 0.42), h: Math.round(H * 0.32) },
        ],
        titleZone: { x: 0, y: Math.round(H * 0.30), w: W, h: Math.round(H * 0.22), align: 'center', tilt: -7 },
        bandY: H, bandH: 0,
      };
    }
    case 'strip': {
      const sw = Math.round(W * 0.30);
      const ph = (H - gap * 2) / 3;
      return {
        panels: [
          { x: 0, y: 0, w: sw, h: ph },
          { x: 0, y: ph + gap, w: sw, h: ph },
          { x: 0, y: (ph + gap) * 2, w: sw, h: ph },
          { x: sw + gap, y: 0, w: W - sw - gap, h: H },
        ],
        titleZone: { x: sw + gap, y: Math.round(H * 0.70), w: W - sw - gap, h: Math.round(H * 0.16), align: 'center' },
        bandY: H, bandH: 0,
      };
    }
    case 'duo': {
      const pw = (W - gap) / 2;
      return {
        panels: [
          { x: 0, y: 0, w: pw, h: Math.round(H * 0.82) },
          { x: pw + gap, y: 0, w: pw, h: Math.round(H * 0.82) },
        ],
        titleZone: { x: 0, y: Math.round(H * 0.70), w: W, h: Math.round(H * 0.14), align: 'center' },
        bandY: Math.round(H * 0.82), bandH: H - Math.round(H * 0.82),
      };
    }
    case 'fullbleed':
    default: {
      return {
        panels: [{ x: 0, y: 0, w: W, h: H }],
        titleZone: { x: 0, y: Math.round(H * 0.68), w: W, h: Math.round(H * 0.16), align: 'center' },
        bandY: H, bandH: 0,
      };
    }
  }
}

// Fit a title into a zone: shrink the font until it fits the width.
export function fitTitleFont(ctx, text, zone, maxSize) {
  let size = maxSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 24 && ctx.measureText(text).width > zone.w * 0.94) {
    size = Math.floor(size * 0.92);
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

// Draw the big title in one of three styles, with a hard offset shadow.
export function drawTitle(ctx, text, zone, style, W) {
  const maxSize = Math.round(Math.min(zone.h * 0.95, W * 0.16));
  const size = fitTitleFont(ctx, text.toUpperCase(), zone, maxSize);
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2 + size * 0.36;
  const shadowDx = Math.max(4, Math.round(size * 0.055));
  const shadowDy = Math.max(5, Math.round(size * 0.07));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (zone.tilt) {
    ctx.translate(cx, cy);
    ctx.rotate(zone.tilt * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }
  if (style === 'stamp') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-2 * Math.PI / 180);
    ctx.translate(-cx, -cy);
    drawTitleText(ctx, text.toUpperCase(), cx, cy, size, '#fff8e7', '#b3541e', Math.round(size * 0.10));
    ctx.strokeStyle = '#b3541e';
    ctx.lineWidth = Math.max(3, size * 0.035);
    const tw = ctx.measureText(text.toUpperCase()).width;
    ctx.strokeRect(cx - tw / 2 - size * 0.28, cy - size * 0.78, tw + size * 0.56, size * 1.28);
    ctx.restore();
  } else if (style === 'outline') {
    // Hard offset shadow first, then cream outline with a deep-teal fill.
    ctx.fillStyle = '#0f3d3a';
    ctx.fillText(text.toUpperCase(), cx + shadowDx, cy + shadowDy);
    ctx.strokeStyle = '#fff8e7';
    ctx.lineWidth = Math.max(3, size * 0.07);
    ctx.strokeText(text.toUpperCase(), cx, cy);
    ctx.fillStyle = '#0f3d3a';
    ctx.fillText(text.toUpperCase(), cx, cy);
  } else {
    // Solid: cream letters, amber offset shadow, thin teal outline.
    ctx.fillStyle = '#d97b29';
    ctx.fillText(text.toUpperCase(), cx + shadowDx, cy + shadowDy);
    ctx.strokeStyle = '#0f3d3a';
    ctx.lineWidth = Math.max(2, size * 0.03);
    ctx.strokeText(text.toUpperCase(), cx, cy);
    ctx.fillStyle = '#fff8e7';
    ctx.fillText(text.toUpperCase(), cx, cy);
  }
  ctx.restore();
}

function drawTitleText(ctx, text, cx, cy, size, fill, stroke, lineW) {
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineW;
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, cy);
}

// Five-point star path.
export function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Sticker badges: a 5-star row, a round EST. 2026 badge, a location-pin tag.
export function drawBadges(ctx, W, H, tag, layout) {
  const s = Math.min(W, H);
  // 5-star row, top-left corner.
  const starR = Math.round(s * 0.016);
  const sx = Math.round(W * 0.035), sy = Math.round(H * 0.045);
  ctx.save();
  for (let i = 0; i < 5; i++) {
    starPath(ctx, sx + i * starR * 2.4, sy, starR);
    ctx.fillStyle = '#ffb020';
    ctx.fill();
    ctx.strokeStyle = '#0f3d3a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Round EST. 2026 badge, top-right corner.
  const bx = W - Math.round(W * 0.055), by = Math.round(H * 0.055);
  const br = Math.round(s * 0.042);
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8e7';
  ctx.fill();
  ctx.strokeStyle = '#b3541e';
  ctx.lineWidth = Math.max(2, br * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx, by, br * 0.78, 0, Math.PI * 2);
  ctx.strokeStyle = '#0f3d3a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#0f3d3a';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(br * 0.42)}px "Bebas Neue", sans-serif`;
  ctx.fillText('EST.', bx, by - br * 0.05);
  ctx.fillText('2026', bx, by + br * 0.42);
  ctx.restore();
}

// Location-pin tag: a small pin + the tag text in a cream pill.
export function drawPinTag(ctx, x, y, tag, scale) {
  const s = scale || 1;
  ctx.save();
  ctx.font = `${Math.round(22 * s)}px "Bebas Neue", sans-serif`;
  const tw = ctx.measureText(tag.toUpperCase()).width;
  const pad = 14 * s, h = 34 * s;
  ctx.fillStyle = '#fff8e7';
  ctx.strokeStyle = '#0f3d3a';
  ctx.lineWidth = 2;
  const w = tw + pad * 2 + 22 * s;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  // Pin: circle + triangle.
  const px = x + pad + 8 * s, py = y + h / 2;
  ctx.fillStyle = '#d97b29';
  ctx.beginPath();
  ctx.arc(px, py - 2 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px - 6 * s, py + 2 * s);
  ctx.lineTo(px + 6 * s, py + 2 * s);
  ctx.lineTo(px, py + 9 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py - 2 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f3d3a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag.toUpperCase(), x + pad + 20 * s, py + 1);
  ctx.restore();
}

// Bottom cream band: subtitle in Bebas + pin tag, used by magazine + duo.
export function drawBottomBand(ctx, W, H, bandY, bandH, state) {
  if (bandH <= 0) return;
  ctx.save();
  ctx.fillStyle = '#fff8e7';
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = '#d97b29';
  ctx.fillRect(0, bandY, W, Math.max(3, Math.round(bandH * 0.06)));
  const s = Math.min(W, H);
  ctx.fillStyle = '#0f3d3a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const subSize = Math.max(18, Math.round(bandH * 0.34));
  ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
  ctx.fillText((state.subcaption || '').toLowerCase(), Math.round(W * 0.035), bandY + bandH * 0.55);
  const scale = Math.max(0.7, bandH / 64);
  drawPinTag(ctx, W - Math.round(W * 0.035) - (ctx.measureText((state.tag || '').toUpperCase()).width + 48 * scale), bandY + (bandH - 34 * scale) / 2, state.tag || '', scale);
  ctx.restore();
}

// Main entry: render the whole cover onto ctx at W x H.
// state: { layout, grade, titleStyle, caption, subcaption, tag, panels }
// photos: { pier: HTMLImageElement, boulevard: HTMLImageElement }
export function renderCover(ctx, W, H, state, photos) {
  const layout = state.layout || 'magazine';
  const grade = state.grade || 'gold';
  const { panels, titleZone, bandY, bandH } = layoutPanels(layout, W, H);
  const s = Math.min(W, H);

  // Cream paper base.
  ctx.fillStyle = '#fff8e7';
  ctx.fillRect(0, 0, W, H);

  // Photos, one per panel, graded panel by panel.
  panels.forEach((rect, i) => {
    const panelState = (state.panels && state.panels[i]) || {};
    const photoKey = panelState.photo || (i % 2 === 0 ? 'pier' : 'boulevard');
    const img = photos[photoKey] || photos.pier || photos.boulevard;
    if (!img) return;
    drawPhotoPanel(ctx, img, rect, panelState);
    framePanel(ctx, rect, Math.max(2, Math.round(s * 0.004)));
  });

  // Gradient-map the photos now, while the canvas holds only photos and
  // cream paper (the paper gate leaves the paper untouched). The title,
  // band and badges are drawn after, so their colours stay exact.
  gradeCoverCanvas(ctx, W, H, grade);

  // Diagonal layout: slanted cream band behind the title.
  if (layout === 'diagonal') {
    ctx.save();
    ctx.translate(W / 2, titleZone.y + titleZone.h / 2);
    ctx.rotate(-7 * Math.PI / 180);
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(-W * 0.62, -titleZone.h * 0.52, W * 1.24, titleZone.h * 1.04);
    ctx.fillStyle = '#d97b29';
    ctx.fillRect(-W * 0.62, -titleZone.h * 0.52, W * 1.24, Math.max(4, titleZone.h * 0.08));
    ctx.fillRect(-W * 0.62, titleZone.h * 0.44, W * 1.24, Math.max(4, titleZone.h * 0.08));
    ctx.restore();
  }

  // Nine-grid centre: cream title block with a double rule.
  if (titleZone.block) {
    ctx.save();
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(titleZone.x, titleZone.y, titleZone.w, titleZone.h);
    ctx.strokeStyle = '#b3541e';
    ctx.lineWidth = Math.max(3, s * 0.004);
    ctx.strokeRect(titleZone.x + 8, titleZone.y + 8, titleZone.w - 16, titleZone.h - 16);
    ctx.restore();
    // Title wraps to two lines inside the block: big Anton, sub-caption
    // beneath it, pin tag pinned to the bottom edge.
    const words = (state.caption || 'GOLDEN HOUR').toUpperCase().split(' ');
    const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [words[0]];
    const longest = Math.max(...lines.map(l => l.length));
    const size = Math.round(Math.min(titleZone.w * 0.92 / (longest * 0.55), titleZone.h * 0.24));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.fillStyle = '#0f3d3a';
    lines.forEach((line, i) => {
      ctx.fillText(line, titleZone.x + titleZone.w / 2, titleZone.y + titleZone.h * 0.42 + (i - (lines.length - 1) / 2) * size * 1.08);
    });
    // Sub-caption, shrunk to fit inside the block.
    let subSize = Math.round(size * 0.5);
    ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
    while (subSize > 12 && ctx.measureText((state.subcaption || '').toLowerCase()).width > titleZone.w * 0.88) {
      subSize = Math.floor(subSize * 0.9);
      ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
    }
    ctx.fillStyle = '#b3541e';
    ctx.fillText((state.subcaption || '').toLowerCase(), titleZone.x + titleZone.w / 2, titleZone.y + titleZone.h * 0.72);
    ctx.restore();
  } else {
    drawTitle(ctx, state.caption || 'GOLDEN HOUR', titleZone, state.titleStyle || 'outline', W);
  }

  // Bottom band + badges sit above the grade so text stays crisp.
  drawBottomBand(ctx, W, H, bandY, bandH, state);
  if (layout !== 'ninegrid') drawBadges(ctx, W, H, state.tag || 'PALM BAY', layout);
  if (layout === 'ninegrid') {
    // Pin tag centred on the title block's bottom edge.
    drawPinTag(ctx, titleZone.x + titleZone.w / 2 - 48, titleZone.y + titleZone.h - 40, state.tag || 'PALM BAY', 0.8);
  }
  addVignette(ctx, W, H);
  addGrain(ctx, W, H, (GRADE_MAPS[grade] || GRADE_MAPS.gold).grain);
}

// Gradient-map the photo pixels of a finished cover. Photos were drawn first,
// so we grade everything except the cream paper areas by masking on luminance:
// cream paper (#fff8e7) is near-white and stays untouched by a luminance gate.
export function gradeCoverCanvas(ctx, W, H, gradeName) {
  const grade = GRADE_MAPS[gradeName] || GRADE_MAPS.gold;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const stops = grade.stops;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Skip the cream paper (very bright warm white) so bands stay paper.
    if (r > 245 && g > 235 && b > 215) continue;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const [nr, ng, nb] = gradePixel(lum, stops);
    d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
  }
  ctx.putImageData(img, 0, 0);
}

// Default panel assignment for a fresh cover (alternating photos). The first
// panel is usually the hero, so its crop window sits a little high (cy 0.32)
// to keep faces in frame instead of centring on a torso.
export function defaultPanels(layout) {
  const count = { magazine: 4, ninegrid: 8, diagonal: 2, strip: 4, duo: 2, fullbleed: 1 }[layout] || 4;
  const panels = [];
  for (let i = 0; i < count; i++) {
    // The diagonal hero sits under a slanted title band, so its crop window
    // sits higher still (cy 0.18) to keep the face clear of the band.
    const cy = i === 0 ? (layout === 'diagonal' ? 0.18 : 0.32) : 0.5;
    panels.push({ photo: i % 2 === 0 ? 'pier' : 'boulevard', cx: 0.5, cy, zoom: 1 });
  }
  return panels;
}
