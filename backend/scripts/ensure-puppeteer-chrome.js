/**
 * Install Puppeteer's Chrome into backend/.puppeteer-cache so runtime (server.js)
 * and npm postinstall use the same directory (matches Render + local dev).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, '..', '.puppeteer-cache');
fs.mkdirSync(cacheDir, { recursive: true });

const env = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };

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
