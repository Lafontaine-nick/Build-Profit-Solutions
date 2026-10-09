/* eslint-disable */
// Exports final logo files (PDF + JPEG) for the hybrid concepts. Run: node export-logos.js
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { PALETTE, THEMES, conceptB, conceptB2, shapesMarkup, bbox } = require('./build');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FONT_URL = 'file://' + path.join(__dirname, 'fonts', 'Inter-Variable.ttf');
const TMP = path.join(__dirname, '.export-tmp');
fs.mkdirSync(TMP, { recursive: true });

const SETS = {
  'final-hybrid-current': conceptB,
  'final-hybrid-refined': conceptB2,
};

const BACKGROUNDS = {
  black: { bg: '#000000', theme: THEMES.dark, sub: PALETTE.inkSecondaryDark, transparentPdf: false },
  white: { bg: PALETTE.white, theme: { ...THEMES.light, ink: '#000000' }, sub: '#000000', transparentPdf: true },
};

function symbolSvg(def, theme, height) {
  const b = bbox(def);
  const width = (b.w / b.h) * height;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(1)}" height="${height}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}">${shapesMarkup(def, theme)}</svg>`;
}

function page({ w, h, bg, transparentPdf, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Inter'; src: url('${FONT_URL}') format('truetype'); font-weight: 100 900; }
  @page { size: ${w}px ${h}px; margin: 0; }
  html, body { margin: 0; padding: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
  body { background: ${bg}; display: flex; align-items: center; justify-content: center;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${transparentPdf ? '@media print { body { background: transparent; } }' : ''}
  .stack { display: flex; flex-direction: column; align-items: center; }
  .name { font-family: 'Inter'; font-weight: 700; letter-spacing: 0.02em; line-height: 1; white-space: nowrap; }
  .sub { font-family: 'Inter'; font-weight: 600; letter-spacing: 0.42em; padding-left: 0.42em; line-height: 1; white-space: nowrap; }
  svg { display: block; }
  </style></head><body>${body}</body></html>`;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Headless Chrome on this machine writes its output but doesn't exit, so wait for a
// stable output file and then stop the process.
function chrome(args, outFile) {
  if (fs.existsSync(outFile)) fs.rmSync(outFile);
  const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${path.join(TMP, 'profile')}`, '--allow-file-access-from-files', ...args], {
    stdio: 'ignore',
    detached: true,
  });
  let last = -1;
  for (let i = 0; i < 300; i++) {
    sleep(200);
    const size = fs.existsSync(outFile) ? fs.statSync(outFile).size : -1;
    if (size > 0 && size === last) break;
    last = size;
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {}
  sleep(300);
  if (!fs.existsSync(outFile)) throw new Error(`Chrome produced no ${outFile}`);
}

function render(outDir, name, spec) {
  const html = path.join(TMP, `${name}.html`);
  fs.writeFileSync(html, page(spec));
  const url = 'file://' + html;
  const pdf = path.join(outDir, `${name}.pdf`);
  chrome(['--no-pdf-header-footer', `--print-to-pdf=${pdf}`, '--virtual-time-budget=2000', url], pdf);
  const png = path.join(TMP, `${name}.png`);
  chrome([`--screenshot=${png}`, `--window-size=${spec.w},${spec.h}`, '--force-device-scale-factor=2', '--virtual-time-budget=2000', url], png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', png, '--out', path.join(outDir, `${name}.jpg`)], { stdio: 'ignore' });
}

for (const [dir, make] of Object.entries(SETS)) {
  const outDir = path.join(__dirname, dir);
  fs.mkdirSync(outDir, { recursive: true });
  const def = make();
  for (const [bgName, o] of Object.entries(BACKGROUNDS)) {
    // House only — 1200 × 1200 artboard
    render(outDir, `bps-logo-house-${bgName}`, {
      w: 1200,
      h: 1200,
      bg: o.bg,
      transparentPdf: o.transparentPdf,
      body: symbolSvg(def, o.theme, 760),
    });
    // House with BUILD PROFIT SOLUTIONS below — 1600 × 1600 artboard
    render(outDir, `bps-logo-stacked-${bgName}`, {
      w: 1600,
      h: 1600,
      bg: o.bg,
      transparentPdf: o.transparentPdf,
      body: `<div class="stack">${symbolSvg(def, o.theme, 700)}
        <div class="name" style="font-size:148px;color:${o.theme.ink};margin-top:96px">BUILD PROFIT</div>
        <div class="sub" style="font-size:62px;color:${o.sub};margin-top:34px">SOLUTIONS</div></div>`,
    });
  }
  console.log('exported', dir, fs.readdirSync(outDir));
}
// Transparent, tightly framed house marks for the app's logo circle (approved: hybrid current).
const APP_IMAGES = path.join(__dirname, '..', '..', 'mobile', 'assets', 'images');
const APP_MARKS = {
  'bps-logo-house-dark': { ...THEMES.dark },
  'bps-logo-house-light': { ...THEMES.light, ink: '#000000' },
};
// Optical centering for the hybrid mark (fraction of mark height): roof peak stays on the
// vertical center line; lift slightly because the walls and floor carry the weight.
const OPTICAL = { x: 0, y: -0.03 };

function renderAppPng(name, { size, bg, theme, markHeight, optical = false }) {
  const html = path.join(TMP, `${name}.html`);
  const shift = optical ? `transform: translate(${(OPTICAL.x * markHeight).toFixed(1)}px, ${(OPTICAL.y * markHeight).toFixed(1)}px);` : '';
  const body = `<div style="${shift}">${symbolSvg(conceptB(), theme, markHeight)}</div>`;
  fs.writeFileSync(html, page({ w: size, h: size, bg: bg || 'transparent', transparentPdf: false, body }));
  const out = path.join(APP_IMAGES, `${name}.png`);
  const args = [`--screenshot=${out}`, `--window-size=${size},${size}`, '--virtual-time-budget=2000'];
  if (!bg) args.push('--default-background-color=00000000');
  chrome([...args, 'file://' + html], out);
  console.log('app image', out);
}

for (const [name, theme] of Object.entries(APP_MARKS)) {
  renderAppPng(name, { size: 600, theme, markHeight: 600 });
}

const TINT = { ink: '#FFFFFF', c1: '#9A9A9A', c2: '#C4C4C4', c3: '#EDEDED' };
const MONO = { ink: '#FFFFFF', c1: '#FFFFFF', c2: '#FFFFFF', c3: '#FFFFFF' };
// iOS: opaque full-bleed square, the system applies the corner mask.
renderAppPng('bps-app-icon', { size: 1024, bg: '#000000', theme: THEMES.dark, markHeight: 640, optical: true });
// iOS 18 dark: transparent so the system supplies its dark backdrop.
renderAppPng('bps-app-icon-dark', { size: 1024, theme: THEMES.dark, markHeight: 640, optical: true });
// iOS 18 tinted: grayscale; bar shades stay distinct after tinting.
renderAppPng('bps-app-icon-tinted', { size: 1024, bg: '#000000', theme: TINT, markHeight: 640, optical: true });
// Splash: transparent mark, background color comes from the splash config.
renderAppPng('bps-splash-icon', { size: 1024, theme: THEMES.dark, markHeight: 1024 });
// Android adaptive: keep the mark inside the 66% safe zone.
renderAppPng('bps-adaptive-icon', { size: 1024, theme: THEMES.dark, markHeight: 540, optical: true });
renderAppPng('bps-adaptive-icon-monochrome', { size: 1024, theme: MONO, markHeight: 540, optical: true });
renderAppPng('bps-favicon', { size: 196, bg: '#000000', theme: THEMES.dark, markHeight: 128, optical: true });
fs.rmSync(TMP, { recursive: true, force: true });
