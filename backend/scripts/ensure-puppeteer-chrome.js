/**
 * Install Puppeteer's Chrome into backend/.puppeteer-cache for **local dev** only.
 *
 * On Render: **do not** download Chrome during `npm install` — it often fails the build (time,
 * disk, OOM) and must not be committed anyway. Chrome is installed once at **runtime** on the
 * first PDF request (see src/routes/contracts.js `tryRuntimeInstallChromeOnRender`).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const onRender = process.env.RENDER === 'true' || process.env.RENDER === '1';
if (onRender) {
  console.log(
    '[ensure-puppeteer-chrome] Render build: skipping Chrome download during npm install (installed on first PDF at runtime).',
  );
  process.exit(0);
}

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
        timeout: 900000,
      });
      console.log('[ensure-puppeteer-chrome] Chrome install succeeded.');
      return true;
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      console.warn(`[ensure-puppeteer-chrome] Attempt ${attempt} failed:`, lastMsg);
      if (attempt < maxAttempts) sleepSync(20);
    }
  }
  console.warn(
    '[ensure-puppeteer-chrome] Chrome install failed after retries (local dev). PDFs need: npx puppeteer browsers install chrome. Last error:',
    lastMsg,
  );
  return false;
}

void installChrome(2);
process.exit(0);
