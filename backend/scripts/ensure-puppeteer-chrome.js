/**
 * Install Puppeteer's Chrome into backend/.puppeteer-cache so runtime (server.js)
 * and npm postinstall use the same directory (matches Render + local dev).
 *
 * Render: previously skipped entirely, which left production with no Chrome and
 * broke POST /api/contracts/render-pdf (contracts + Tax Center CPA PDF).
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
  console.error(
    '[ensure-puppeteer-chrome] Chrome install failed after retries. PDF export will fail until Chrome is installed. Last error:',
    lastMsg,
  );
  return false;
}

const isRender = process.env.RENDER === 'true';
const attempts = isRender ? 4 : 2;
const ok = installChrome(attempts);
if (!ok && isRender) {
  console.error(
    '[ensure-puppeteer-chrome] Render: deploy finished without a working Chrome binary. Re-deploy or run on the service: PUPPETEER_CACHE_DIR=$PWD/.puppeteer-cache npx puppeteer browsers install chrome',
  );
}

// Never fail `npm install` / Render build — API must still boot; pdf-ready will show chromeOnDisk false.
void ok;
process.exit(0);
