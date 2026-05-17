/**
 * Install Puppeteer's Chrome into backend/.puppeteer-cache (local dev + optional Render build).
 * Never `process.exit(1)` — large Chrome must not be committed; on Render we also install at
 * runtime on first PDF (see src/routes/contracts.js) if the build artifact omits this cache.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cacheDir =
  (process.env.PUPPETEER_CACHE_DIR && String(process.env.PUPPETEER_CACHE_DIR).trim()) ||
  path.join(__dirname, '..', '.puppeteer-cache');

fs.mkdirSync(cacheDir, { recursive: true });

function sleepSync(seconds) {
  try {
    execSync(`sleep ${seconds}`, { stdio: 'ignore' });
  } catch {
    /* non-Unix — ignore */
  }
}

function installChrome(maxAttempts) {
  const env = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };
  delete env.PUPPETEER_SKIP_DOWNLOAD;
  delete env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;

  const cwd = path.join(__dirname, '..');
  let lastMsg = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(
        `[ensure-puppeteer-chrome] Installing Chrome (attempt ${attempt}/${maxAttempts}) into ${cacheDir} …`,
      );
      execSync('npx puppeteer browsers install chrome', {
        stdio: 'inherit',
        env,
        cwd,
        timeout: process.env.RENDER === 'true' ? 420000 : 900000,
      });
      console.log('[ensure-puppeteer-chrome] Chrome install succeeded.');
      return true;
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      console.warn(`[ensure-puppeteer-chrome] Attempt ${attempt} failed:`, lastMsg);
      if (attempt < maxAttempts) sleepSync(20);
    }
  }
  console.error(
    '[ensure-puppeteer-chrome] Chrome install failed after retries. On Render, PDFs may still work after a runtime install on first request. Last error:',
    lastMsg,
  );
  return false;
}

const isRender = process.env.RENDER === 'true';
const attempts = isRender ? 2 : 2;
void installChrome(attempts);
process.exit(0);
