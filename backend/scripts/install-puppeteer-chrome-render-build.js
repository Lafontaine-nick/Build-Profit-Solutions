/**
 * Render **build** only: install Puppeteer's Chrome into `backend/.puppeteer-cache` so the binary
 * ships in the deploy slug (runtime-only install is flaky: timeouts, cold starts, missing RENDER).
 *
 * Invoked from `render.yaml` after `npm install`. Service Root Directory should be `backend/`.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isRenderHosting } = require('../src/utils/renderEnv');

const backendRoot = path.join(__dirname, '..');
const cacheDir = path.join(backendRoot, '.puppeteer-cache');

function sleepSync(seconds) {
  try {
    execSync(`sleep ${seconds}`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}

if (!isRenderHosting()) {
  console.log('[install-puppeteer-chrome-render-build] Not a Render host; skipping.');
  process.exit(0);
}

fs.mkdirSync(cacheDir, { recursive: true });
process.env.PUPPETEER_CACHE_DIR = cacheDir;
const env = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };
delete env.PUPPETEER_SKIP_DOWNLOAD;
delete env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;

const maxAttempts = 3;
let lastMsg = '';
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    console.log(
      `[install-puppeteer-chrome-render-build] Installing Chrome (attempt ${attempt}/${maxAttempts}) into ${cacheDir} …`,
    );
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      cwd: backendRoot,
      env,
      timeout: 900000,
    });
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      throw new Error(`require(puppeteer) failed: ${e instanceof Error ? e.message : e}`);
    }
    const exe = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : '';
    if (!exe || !fs.existsSync(exe)) {
      throw new Error(`Chrome binary missing after install (executablePath=${exe || '(none)'})`);
    }
    console.log('[install-puppeteer-chrome-render-build] Chrome install succeeded.');
    process.exit(0);
  } catch (e) {
    lastMsg = e instanceof Error ? e.message : String(e);
    console.warn(`[install-puppeteer-chrome-render-build] Attempt ${attempt} failed:`, lastMsg);
    if (attempt < maxAttempts) sleepSync(30);
  }
}

console.error(
  '[install-puppeteer-chrome-render-build] Chrome install failed after retries. PDF routes will stay broken until this succeeds. Last error:',
  lastMsg,
);
process.exit(1);
