/**
 * Render **runtime** (before `npm start`): if Puppeteer's Chrome is missing, install it here.
 *
 * Render's running instance may not include binaries produced only during the build step; installing
 * on start writes to the same filesystem as `node src/server.js`, so `/api/contracts/pdf-ready` can
 * show chromeOnDisk true.
 *
 * Idempotent: exits immediately when Chrome is already present.
 */
const fs = require('fs');
const path = require('path');
const { isRenderHosting } = require('../src/utils/renderEnv');

const backendRoot = path.join(__dirname, '..');
const cacheDir = path.join(backendRoot, 'render-pdf-chrome');
const legacyCache = path.join(backendRoot, '.puppeteer-cache');

function wipeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.warn(`[ensure-chrome-start] Removed: ${dir}`);
  }
}

function wipeChromeTrees() {
  wipeDir(cacheDir);
  wipeDir(legacyCache);
  fs.mkdirSync(cacheDir, { recursive: true });
}

function readChromeBuildId() {
  try {
    const m = require('puppeteer-core/lib/cjs/puppeteer/revisions.js');
    const id = m?.PUPPETEER_REVISIONS?.chrome;
    if (id && typeof id === 'string') return id;
  } catch {
    /* fall through */
  }
  return '146.0.7680.153';
}

function chromeAlreadyUsable() {
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  try {
    const puppeteerPath = require.resolve('puppeteer');
    delete require.cache[puppeteerPath];
  } catch {
    /* ignore */
  }
  try {
    const puppeteer = require('puppeteer');
    const exe = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : '';
    return Boolean(exe && fs.existsSync(exe));
  } catch {
    return false;
  }
}

async function installChromeOnce() {
  const { install, Browser, BrowserPlatform } = require('@puppeteer/browsers');
  const buildId = readChromeBuildId();
  console.warn(
    `[ensure-chrome-start] Installing Chrome via @puppeteer/browsers (buildId=${buildId}) → ${cacheDir} (first start may take a few minutes)…`,
  );
  await install({
    browser: Browser.CHROME,
    buildId,
    platform: BrowserPlatform.LINUX,
    cacheDir,
    unpack: true,
    downloadProgressCallback: 'default',
  });
}

function verifyOrThrow() {
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  const puppeteerPath = require.resolve('puppeteer');
  delete require.cache[puppeteerPath];
  const puppeteer = require('puppeteer');
  const exe = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : '';
  if (!exe || !fs.existsSync(exe)) {
    throw new Error(`Chrome binary still missing (executablePath=${exe || '(none)'})`);
  }
  console.warn(`[ensure-chrome-start] Chrome OK: ${exe}`);
}

(async () => {
  if (!isRenderHosting()) {
    process.exit(0);
  }

  process.env.PUPPETEER_CACHE_DIR = cacheDir;

  if (chromeAlreadyUsable()) {
    console.log('[ensure-chrome-start] Chrome already on disk; skipping install.');
    process.exit(0);
  }

  const maxAttempts = 3;
  let lastMsg = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.warn(`[ensure-chrome-start] Attempt ${attempt}/${maxAttempts} …`);
      wipeChromeTrees();
      await installChromeOnce();
      verifyOrThrow();
      process.exit(0);
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      console.warn(`[ensure-chrome-start] Attempt ${attempt} failed:`, lastMsg);
      if (attempt < maxAttempts) {
        try {
          require('child_process').execSync('sleep 25', { stdio: 'ignore' });
        } catch {
          /* ignore */
        }
      }
    }
  }

  console.error('[ensure-chrome-start] Chrome install failed after retries:', lastMsg);
  process.exit(1);
})();
