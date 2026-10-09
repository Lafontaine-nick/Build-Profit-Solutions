/* eslint-disable */
// Branding exploration only — not used by the app. Run: node build.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'svg');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Palette (shared by all concepts)
// ---------------------------------------------------------------------------
const PALETTE = {
  navy: '#0B1220', // icon tile, primary dark
  navyPanel: '#121B2E', // dark presentation surface
  neutral: '#F2F4F7', // light presentation surface
  white: '#FFFFFF',
  teal: '#2DCC9A', // existing app mint, unchanged
  tealBlue: '#34B5C4', // exact midpoint teal → blue
  blue: '#3B9EEF', // slightly deeper than old #4FB3E8 for hue separation from teal
  tealDeep: '#0E9F78', // light-background versions (≥3:1 on white)
  tealBlueDeep: '#118C9E',
  blueDeep: '#1F74D6',
  inkSecondaryDark: '#9AA6B8',
  inkSecondaryLight: '#5B6678',
};

const THEMES = {
  dark: { ink: PALETTE.white, c1: PALETTE.teal, c2: PALETTE.tealBlue, c3: PALETTE.blue, sub: PALETTE.inkSecondaryDark },
  light: { ink: PALETTE.navy, c1: PALETTE.tealDeep, c2: PALETTE.tealBlueDeep, c3: PALETTE.blueDeep, sub: PALETTE.inkSecondaryLight },
  monoWhite: { ink: PALETTE.white, c1: PALETTE.white, c2: PALETTE.white, c3: PALETTE.white, sub: PALETTE.white },
  monoNavy: { ink: PALETTE.navy, c1: PALETTE.navy, c2: PALETTE.navy, c3: PALETTE.navy, sub: PALETTE.navy },
};

// ---------------------------------------------------------------------------
// Geometry — 1024 grid, 45° pitch everywhere
// Shape: { t: 'poly', pts } | { t: 'rect', x, y, w, h }, c: 'ink' | 'c1' | 'c2' | 'c3'
// ---------------------------------------------------------------------------
const poly = (c, pts) => ({ t: 'poly', c, pts });
const rect = (c, x, y, w, h) => ({ t: 'rect', c, x, y, w, h });

function conceptA({ small = false } = {}) {
  const V = small ? 104 : 90; // roof band, vertical
  const roof = poly('ink', [[512, 180], [776, 444], [776, 444 + V], [512, 180 + V], [248, 444 + V], [248, 444]]);
  const inner = (x) => 180 + V + Math.abs(x - 512);
  const W = small ? 104 : 112;
  const G = small ? 48 : 40;
  const x0 = 512 - (3 * W + 2 * G) / 2;
  const X = [x0, x0 + W + G, x0 + 2 * (W + G)];
  const ROOF_GAP = small ? 64 : 56;
  const BASE = 840;
  const tl = inner(X[2]) + ROOF_GAP;
  const tr = inner(X[2] + W) + ROOF_GAP;
  const step = 125;
  const shapes = [roof];
  if (!small) shapes.push(rect('ink', 664, 262, 64, 148));
  shapes.push(
    rect('c1', X[0], tl + 2 * step, W, BASE - (tl + 2 * step)),
    rect('c2', X[1], tl + step, W, BASE - (tl + step)),
    poly('c3', [[X[2], tl], [X[2] + W, tr], [X[2] + W, BASE], [X[2], BASE]]),
  );
  return { shapes, scale: 1.1, cx: 512, cy: 510 };
}

function conceptB({ small = false } = {}) {
  const V = 90;
  const roof = poly('ink', [[512, 170], [800, 458], [800, 458 + V], [512, 170 + V], [224, 458 + V], [224, 458]]);
  const inner = (x) => 170 + V + Math.abs(x - 512);
  const T = 64;
  const LW = 284;
  const BASE = 860;
  const W = small ? 96 : 100;
  const G = small ? 36 : 32;
  const AXIS_GAP = 0;
  const xEnd = 748;
  const X = [xEnd - 3 * W - 2 * G, xEnd - 2 * W - G, xEnd - W];
  const barBottom = BASE - T - AXIS_GAP;
  const ROOF_GAP = 56;
  const tl = inner(X[2]) + ROOF_GAP;
  const tr = inner(X[2] + W) + ROOF_GAP;
  const step = 92;
  return {
    shapes: [
      roof,
      rect('ink', LW, 400, T, BASE - 400), // wall = chart y-axis
      rect('ink', LW, BASE - T, xEnd - LW, T), // floor = chart x-axis
      rect('c1', X[0], tl + 2 * step, W, barBottom - (tl + 2 * step)),
      rect('c2', X[1], tl + step, W, barBottom - (tl + step)),
      poly('c3', [[X[2], tl], [X[2] + W, tr], [X[2] + W, barBottom], [X[2], barBottom]]),
    ],
    scale: 1.05,
    cx: 512,
    cy: 515,
  };
}

// B2: eaves cut flush with the walls (no overhang) and a wider footprint, so the
// silhouette reads as a building/structure rather than a residential home.
function conceptB2({ small = false } = {}) {
  const V = 90;
  const L = 252;
  const R = 772;
  const T = 64;
  const BASE = 860;
  const outer = (x) => 170 + Math.abs(x - 512);
  const inner = (x) => outer(x) + V;
  const roof = poly('ink', [[512, 170], [R, outer(R)], [R, inner(R)], [512, 170 + V], [L, inner(L)], [L, outer(L)]]);
  const W = small ? 112 : 116;
  const G = small ? 40 : 34;
  const X = [R - 3 * W - 2 * G, R - 2 * W - G, R - W];
  const barBottom = BASE - T;
  const ROOF_GAP = small ? 64 : 56;
  const tl = inner(X[2]) + ROOF_GAP;
  const tr = inner(X[2] + W) + ROOF_GAP;
  const step = 96;
  return {
    shapes: [
      roof,
      rect('ink', L, outer(L) + 20, T, BASE - outer(L) - 20), // wall = chart y-axis
      rect('ink', L, BASE - T, R - L, T), // floor = chart x-axis
      rect('c1', X[0], tl + 2 * step, W, barBottom - (tl + 2 * step)),
      rect('c2', X[1], tl + step, W, barBottom - (tl + step)),
      poly('c3', [[X[2], tl], [X[2] + W, tr], [X[2] + W, barBottom], [X[2], barBottom]]),
    ],
    scale: 1.08,
    cx: 512,
    cy: 515,
  };
}

function conceptC({ small = false } = {}) {
  const G = small ? 44 : 36;
  const top = 212;
  const bot = 812;
  const stemW = small ? 150 : 140;
  const sx = 290;
  const bx = sx + stemW; // stem and bowls touch so the letter reads as one B
  const split = 488; // top bowl bottom
  const ch = (x0, y0, x1, y1, c) => [[x0, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0, y1]];
  return {
    shapes: [
      poly('ink', [[sx, top + stemW], [sx + stemW, top], [sx + stemW, bot], [sx, bot]]),
      poly('c3', ch(bx, top, 690, split, 96)),
      poly('c1', ch(bx, split + G, 730, bot, 104)),
    ],
    scale: 1.04,
    cx: 515,
    cy: 512,
  };
}

const CONCEPTS = {
  a: { name: 'Concept A — Refined Original', make: conceptA },
  b: { name: 'Concept B — Hybrid House', make: conceptB },
  c: { name: 'Concept C — BPS Signature', make: conceptC },
};

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
const fmt = (n) => Math.round(n * 100) / 100;

function shapesMarkup(def, theme) {
  const k = def.scale;
  const tx = (x) => fmt(def.cx + (x - def.cx) * k);
  const ty = (y) => fmt(def.cy + (y - def.cy) * k);
  return def.shapes
    .map((s) => {
      const fill = theme[s.c];
      if (s.t === 'rect') {
        return `<rect x="${tx(s.x)}" y="${ty(s.y)}" width="${fmt(s.w * k)}" height="${fmt(s.h * k)}" fill="${fill}"/>`;
      }
      return `<polygon points="${s.pts.map(([x, y]) => `${tx(x)},${ty(y)}`).join(' ')}" fill="${fill}"/>`;
    })
    .join('');
}

function bbox(def) {
  const k = def.scale;
  const xs = [];
  const ys = [];
  for (const s of def.shapes) {
    const pts = s.t === 'rect' ? [[s.x, s.y], [s.x + s.w, s.y + s.h]] : s.pts;
    for (const [x, y] of pts) {
      xs.push(def.cx + (x - def.cx) * k);
      ys.push(def.cy + (y - def.cy) * k);
    }
  }
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

const svgDoc = (w, h, body, vb = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>`;

// Full-bleed square for App Store Connect / Xcode (iOS applies the mask).
const iconBody = (def) => `<rect width="1024" height="1024" fill="${PALETTE.navy}"/>${shapesMarkup(def, THEMES.dark)}`;

// Masked preview tile placed at (x, y) with size s.
let clipSeq = 0;
function tile(def, x, y, s) {
  const id = `m${clipSeq++}`;
  return `<clipPath id="${id}"><rect width="1024" height="1024" rx="230"/></clipPath>
    <g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(s / 1024 * 1e4) / 1e4})"><g clip-path="url(#${id})">${iconBody(def)}</g></g>`;
}

// Symbol (no tile) fitted to height h at (x, y). Returns { markup, width }.
function symbol(def, theme, x, y, h) {
  const b = bbox(def);
  const k = h / b.h;
  return {
    markup: `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(k * 1e4) / 1e4}) translate(${fmt(-b.x)} ${fmt(-b.y)})">${shapesMarkup(def, theme)}</g>`,
    width: b.w * k,
  };
}

const FONT = `Inter, 'SF Pro Display', -apple-system, 'Helvetica Neue', Arial, sans-serif`;

function wordmark(theme, x, y, capH, align = 'start') {
  // capH ≈ cap height of "BUILD PROFIT"; font-size ≈ capH / 0.72
  const fs1 = capH / 0.72;
  const fs2 = fs1 * 0.42;
  const anchor = align === 'middle' ? 'middle' : 'start';
  return `<text x="${fmt(x)}" y="${fmt(y + capH)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${fmt(fs1)}" font-weight="700" letter-spacing="${fmt(fs1 * 0.02)}" fill="${theme.ink}">BUILD PROFIT</text>
    <text x="${fmt(x)}" y="${fmt(y + capH + fs2 * 1.9)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${fmt(fs2)}" font-weight="600" letter-spacing="${fmt(fs2 * 0.42)}" fill="${theme.sub}">SOLUTIONS</text>`;
}

function lockupHorizontal(def, theme, x, y, h) {
  const sym = symbol(def, theme, x, y, h);
  return sym.markup + wordmark(theme, x + sym.width + h * 0.32, y + h * 0.16, h * 0.36);
}

function lockupStacked(def, theme, cx, y, h) {
  const b = bbox(def);
  const w = (h / b.h) * b.w;
  const sym = symbol(def, theme, cx - w / 2, y, h);
  return sym.markup + wordmark(theme, cx, y + h * 1.22, h * 0.26, 'middle');
}

// ---------------------------------------------------------------------------
// Per-concept asset files
// ---------------------------------------------------------------------------
const HYBRIDS = {
  b: { name: 'B — Hybrid House (current)', make: conceptB },
  b2: { name: 'B2 — Hybrid, refined', make: conceptB2 },
};

for (const [key, c] of Object.entries({ ...CONCEPTS, b2: HYBRIDS.b2 })) {
  const full = c.make();
  const small = c.make({ small: true });
  const b = bbox(full);
  const pad = 24;
  const symVB = `${fmt(b.x - pad)} ${fmt(b.y - pad)} ${fmt(b.w + 2 * pad)} ${fmt(b.h + 2 * pad)}`;
  const write = (name, s) => fs.writeFileSync(path.join(OUT, `concept-${key}-${name}.svg`), s);
  write('app-icon-1024', svgDoc(1024, 1024, iconBody(full)));
  write('app-icon-small-variant', svgDoc(1024, 1024, iconBody(small)));
  write('symbol-on-dark', svgDoc(fmt(b.w + 2 * pad), fmt(b.h + 2 * pad), shapesMarkup(full, THEMES.dark), symVB));
  write('symbol-on-light', svgDoc(fmt(b.w + 2 * pad), fmt(b.h + 2 * pad), shapesMarkup(full, THEMES.light), symVB));
  write('symbol-mono-white', svgDoc(fmt(b.w + 2 * pad), fmt(b.h + 2 * pad), shapesMarkup(full, THEMES.monoWhite), symVB));
  write('symbol-mono-navy', svgDoc(fmt(b.w + 2 * pad), fmt(b.h + 2 * pad), shapesMarkup(full, THEMES.monoNavy), symVB));
  write('lockup-horizontal-dark', svgDoc(980, 220, `<rect width="980" height="220" fill="${PALETTE.navy}"/>${lockupHorizontal(full, THEMES.dark, 50, 40, 140)}`));
  write('lockup-horizontal-light', svgDoc(980, 220, `<rect width="980" height="220" fill="${PALETTE.white}"/>${lockupHorizontal(full, THEMES.light, 50, 40, 140)}`));
  write('lockup-stacked-dark', svgDoc(560, 520, `<rect width="560" height="520" fill="${PALETTE.navy}"/>${lockupStacked(full, THEMES.dark, 280, 50, 240)}`));
  write('lockup-stacked-light', svgDoc(560, 520, `<rect width="560" height="520" fill="${PALETTE.white}"/>${lockupStacked(full, THEMES.light, 280, 50, 240)}`));
}

// ---------------------------------------------------------------------------
// Board 1 — side-by-side comparison, dark + light, all sizes
// ---------------------------------------------------------------------------
const S = 1600;
const COL = S / 3;
const label = (x, y, t, fill, size = 30, weight = 700, anchor = 'start') =>
  `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${t}</text>`;

function comparisonBoard() {
  let out = `<rect width="${S}" height="${S}" fill="${PALETTE.navyPanel}"/><rect y="${S / 2}" width="${S}" height="${S / 2}" fill="${PALETTE.neutral}"/>`;
  const sizes = [180, 120, 60, 32];
  Object.entries(CONCEPTS).forEach(([key, c], i) => {
    const x0 = i * COL;
    const cx = x0 + COL / 2;
    const full = c.make();
    const small = c.make({ small: true });
    [0, S / 2].forEach((top, half) => {
      const ink = half === 0 ? '#FFFFFF' : PALETTE.navy;
      const sub = half === 0 ? PALETTE.inkSecondaryDark : PALETTE.inkSecondaryLight;
      out += label(cx, top + 62, c.name.toUpperCase(), ink, 22, 700, 'middle');
      out += label(cx, top + 92, half === 0 ? 'Dark presentation' : 'Light presentation', sub, 18, 500, 'middle');
      out += tile(full, cx - 150, top + 120, 300);
      const total = sizes.reduce((a, s) => a + s, 0) + 28 * (sizes.length - 1);
      let x = cx - total / 2;
      const rowTop = top + 470;
      sizes.forEach((s) => {
        out += tile(s <= 60 ? small : full, x, rowTop + (180 - s), s);
        out += label(x + s / 2, rowTop + 212, `${s}`, sub, 16, 600, 'middle');
        x += s + 28;
      });
    });
    if (i > 0) {
      out += `<rect x="${x0}" y="30" width="1" height="${S / 2 - 60}" fill="#FFFFFF" opacity="0.08"/>`;
      out += `<rect x="${x0}" y="${S / 2 + 30}" width="1" height="${S / 2 - 60}" fill="${PALETTE.navy}" opacity="0.08"/>`;
    }
  });
  return svgDoc(S, S, out);
}

// ---------------------------------------------------------------------------
// Board 2 — brand identity: lockups, monochrome, small variant
// ---------------------------------------------------------------------------
function identityBoard() {
  const rowH = S / 3;
  let out = `<rect width="${S}" height="${S}" fill="${PALETTE.neutral}"/>`;
  Object.entries(CONCEPTS).forEach(([key, c], i) => {
    const full = c.make();
    const small = c.make({ small: true });
    const top = i * rowH;
    // dark panel: horizontal + stacked
    out += `<rect x="0" y="${top}" width="${S * 0.5}" height="${rowH}" fill="${PALETTE.navy}"/>`;
    out += label(40, top + 46, c.name.toUpperCase(), '#FFFFFF', 20, 700);
    out += lockupHorizontal(full, THEMES.dark, 40, top + 80, 96);
    out += lockupStacked(full, THEMES.dark, 400, top + 236, 132);
    out += label(S * 0.5 + 40, top + 46, 'ON LIGHT', PALETTE.inkSecondaryLight, 20, 700);
    out += lockupHorizontal(full, THEMES.light, S * 0.5 + 40, top + 80, 96);
    out += lockupStacked(full, THEMES.light, 1110, top + 236, 132);
    // mono + small-size variant on the far right
    const chipX = S - 190;
    const mw = symbol(full, THEMES.monoWhite, 0, 0, 84).width;
    out += `<rect x="${chipX}" y="${top + 40}" width="140" height="140" rx="22" fill="${PALETTE.navy}"/>`;
    out += symbol(full, THEMES.monoWhite, chipX + 70 - mw / 2, top + 68, 84).markup;
    out += `<rect x="${chipX}" y="${top + 196}" width="140" height="140" rx="22" fill="#FFFFFF" stroke="${PALETTE.navy}" stroke-opacity="0.12"/>`;
    out += symbol(full, THEMES.monoNavy, chipX + 70 - mw / 2, top + 224, 84).markup;
    out += label(chipX + 70, top + 362, 'Monochrome', PALETTE.inkSecondaryLight, 15, 600, 'middle');
    out += tile(small, chipX + 18, top + 384, 60);
    out += tile(small, chipX + 94, top + 412, 32);
    out += label(chipX + 70, top + 476, 'Small-size variant', PALETTE.inkSecondaryLight, 15, 600, 'middle');
    if (i > 0) out += `<rect x="0" y="${top}" width="${S}" height="1" fill="#FFFFFF" opacity="0.12"/>`;
  });
  return svgDoc(S, S, out);
}

fs.writeFileSync(path.join(OUT, 'board-1-comparison.svg'), comparisonBoard());
fs.writeFileSync(path.join(OUT, 'board-2-identity.svg'), identityBoard());

// ---------------------------------------------------------------------------
// Board 3 — hybrid: current vs refined
// ---------------------------------------------------------------------------
function hybridBoard() {
  const half = S / 2;
  let out = `<rect width="${S}" height="${S}" fill="${PALETTE.navyPanel}"/><rect y="${S * 0.62}" width="${S}" height="${S * 0.38}" fill="${PALETTE.neutral}"/>`;
  const sizes = [180, 120, 60, 32];
  Object.values(HYBRIDS).forEach((c, i) => {
    const cx = i * half + half / 2;
    const full = c.make();
    const small = c.make({ small: true });
    out += label(cx, 70, c.name.toUpperCase(), '#FFFFFF', 26, 700, 'middle');
    out += tile(full, cx - 180, 110, 360);
    const total = sizes.reduce((a, s) => a + s, 0) + 36 * (sizes.length - 1);
    let x = cx - total / 2;
    sizes.forEach((s) => {
      out += tile(s <= 60 ? small : full, x, 520 + (180 - s), s);
      out += label(x + s / 2, 728, `${s}`, PALETTE.inkSecondaryDark, 16, 600, 'middle');
      x += s + 36;
    });
    out += lockupHorizontal(full, THEMES.dark, cx - 290, 790, 96);
    out += lockupHorizontal(full, THEMES.light, cx - 290, S * 0.62 + 70, 96);
    x = cx - total / 2;
    sizes.forEach((s) => {
      out += tile(s <= 60 ? small : full, x, S * 0.62 + 230 + (180 - s), s);
      x += s + 36;
    });
    if (i > 0) out += `<rect x="${half}" y="30" width="1" height="${S - 60}" fill="#7f8aa0" opacity="0.25"/>`;
  });
  return svgDoc(S, S, out);
}
fs.writeFileSync(path.join(OUT, 'board-3-hybrid.svg'), hybridBoard());

// Shapes for the review canvas (already scaled into 1024 space).
const scaled = {};
for (const [key, c] of Object.entries(CONCEPTS)) {
  scaled[key] = {};
  for (const variant of ['full', 'small']) {
    const def = c.make({ small: variant === 'small' });
    const k = def.scale;
    const t = (x, y) => [fmt(def.cx + (x - def.cx) * k), fmt(def.cy + (y - def.cy) * k)];
    scaled[key][variant] = def.shapes.map((s) =>
      s.t === 'rect'
        ? { c: s.c, pts: [t(s.x, s.y), t(s.x + s.w, s.y), t(s.x + s.w, s.y + s.h), t(s.x, s.y + s.h)] }
        : { c: s.c, pts: s.pts.map(([x, y]) => t(x, y)) },
    );
  }
}
fs.writeFileSync(path.join(__dirname, 'shapes.json'), JSON.stringify({ palette: PALETTE, concepts: scaled }));
console.log('built', fs.readdirSync(OUT).length, 'svgs');

module.exports = { PALETTE, THEMES, conceptB, conceptB2, shapesMarkup, bbox };
