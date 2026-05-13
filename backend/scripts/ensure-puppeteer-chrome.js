/**
 * Install Puppeteer's Chrome into backend/.puppeteer-cache so runtime (server.js)
 * and npm postinstall use the same directory (matches Render + local dev).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Render builds: downloading Chrome into the repo cache often flakes (partial extract →
// "folder exists but executable missing", Firefox provider retries, exit 1). That fails
// the whole deploy. OCR and the REST API do not need Puppeteer. Contract PDF on Render
// can use PUPPETEER_EXECUTABLE_PATH or a system Chromium image later.
if (process.env.RENDER === 'true') {
  console.log('[ensure-puppeteer-chrome] Skipping Chrome install on Render (keeps deploy green).');
  process.exit(0);
}

const cacheDir = path.join(__dirname, '..', '.puppeteer-cache');
fs.mkdirSync(cacheDir, { recursive: true });

// Root package.json sets skipDownload so Puppeteer's npm postinstall doesn't fail CI/Render.
// Here we explicitly try to install Chrome — clear skip flags for this subprocess only.
const env = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };
delete env.PUPPETEER_SKIP_DOWNLOAD;
delete env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD;

try {
  execSync('npx puppeteer browsers install chrome', {
    stdio: 'inherit',
    env,
    cwd: path.join(__dirname, '..'),
  });
} catch {
  console.warn(
    'WARN: puppeteer browsers install chrome failed — PDF export needs it. From backend/: PUPPETEER_CACHE_DIR=.puppeteer-cache npx puppeteer browsers install chrome',
  );
  process.exit(0);
}
