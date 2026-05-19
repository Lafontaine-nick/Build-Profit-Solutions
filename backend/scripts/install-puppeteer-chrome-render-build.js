/**
 * Render **build**: install Chrome into `render-pdf-chrome/` (same logic as runtime / first PDF).
 * This script is only invoked from render.yaml `buildCommand` — always install, do not skip when
 * Render env vars are missing during the build phase.
 */
const path = require('path');
const {
  installPuppeteerChromeIfMissing,
  chromeExecutableExists,
  getCacheDir,
  getResolvedChromeBinaryPath,
} = require('../src/services/puppeteerChromeInstall');

(async () => {
  process.env.PUPPETEER_CACHE_DIR =
    process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '..', 'render-pdf-chrome');
  /** Build containers may not set RENDER_* yet; must not skip install or return success without Chrome. */
  process.env.BPS_FORCE_PUPPETEER_CHROME_INSTALL = '1';
  console.log('[install-chrome:render-build] START cacheDir=', getCacheDir());
  const ok = await installPuppeteerChromeIfMissing({
    logPrefix: '[install-chrome:render-build]',
    maxAttempts: 3,
    force: true,
  });
  if (!ok || !chromeExecutableExists()) {
    console.error('[install-chrome:render-build] FAILED — Chrome install verification failed.');
    process.exit(1);
  }
  console.log('[install-chrome:render-build] OK chrome=', getResolvedChromeBinaryPath());
  process.exit(0);
})().catch((e) => {
  console.error('[install-chrome:render-build]', e);
  process.exit(1);
});
