/**
 * Render **build** only: install Chrome for Puppeteer into `backend/render-pdf-chrome/`.
 *
 * Uses `@puppeteer/browsers` `install({ cacheDir })` so the browser is never written under
 * `.puppeteer-cache/` (Render / npx env was still resolving there and leaving half-unpacked trees).
 *
 * Invoked from `render.yaml` after `npm install`. Service Root Directory should be `backend/`.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isRenderHosting } = require('../src/utils/renderEnv');

const backendRoot = path.join(__dirname, '..');
const cacheDir = path.join(backendRoot, 'render-pdf-chrome');
const legacyCache = path.join(backendRoot, '.puppeteer-cache');

function sleepSync(seconds) {
  try {
    execSync(`sleep ${seconds}`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}

function wipeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.warn(`[install-puppeteer-chrome-render-build] Removed: ${dir}`);
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

async function installChromeOnce() {
  wipeChromeTrees();
  const { install, Browser, BrowserPlatform } = require('@puppeteer/browsers');
  const buildId = readChromeBuildId();
  console.log(
    `[install-puppeteer-chrome-render-build] @puppeteer/browsers install chrome buildId=${buildId} → ${cacheDir}`,
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

function verifyPuppeteerBinary() {
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  const puppeteerPath = require.resolve('puppeteer');
  delete require.cache[puppeteerPath];
  const puppeteer = require('puppeteer');
  const exe = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : '';
  if (!exe || !fs.existsSync(exe)) {
    throw new Error(`Chrome binary missing after install (executablePath=${exe || '(none)'})`);
  }
  console.log('[install-puppeteer-chrome-render-build] Verified:', exe);
}

(async () => {
  if (!isRenderHosting()) {
    console.log('[install-puppeteer-chrome-render-build] Not a Render host; skipping.');
    process.exit(0);
  }

  const maxAttempts = 3;
  let lastMsg = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`[install-puppeteer-chrome-render-build] Attempt ${attempt}/${maxAttempts} …`);
      await installChromeOnce();
      verifyPuppeteerBinary();
      console.log('[install-puppeteer-chrome-render-build] Chrome install succeeded.');
      process.exit(0);
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      console.warn(`[install-puppeteer-chrome-render-build] Attempt ${attempt} failed:`, lastMsg);
      if (attempt < maxAttempts) sleepSync(30);
    }
  }

  console.error(
    '[install-puppeteer-chrome-render-build] Chrome install failed after retries. Last error:',
    lastMsg,
  );
  process.exit(1);
})();
