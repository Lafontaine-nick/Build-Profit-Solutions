/**
 * Render **build**: try to install Chrome into `render-pdf-chrome/` (bundled in deploy slug).
 * Does NOT fail the deploy if download fails — runtime installs in the background (server boot + first PDF).
 */
const path = require('path');
const {
  installPuppeteerChromeIfMissing,
  chromeExecutableExists,
  getCacheDir,
  getResolvedChromeBinaryPath,
} = require('../src/services/puppeteerChromeInstall');

const BUILD_CACHE = path.join(__dirname, '..', 'render-pdf-chrome');

(async () => {
  process.env.BPS_FORCE_PUPPETEER_CHROME_INSTALL = '1';
  process.env.PUPPETEER_CACHE_DIR = BUILD_CACHE;
  console.log('[install-chrome:render-build] START cacheDir=', getCacheDir());
  const ok = await installPuppeteerChromeIfMissing({
    logPrefix: '[install-chrome:render-build]',
    maxAttempts: 1,
    force: true,
    buildPhase: true,
    attemptTimeoutMs: 8 * 60 * 1000,
  });
  if (ok && chromeExecutableExists()) {
    console.log('[install-chrome:render-build] OK chrome=', getResolvedChromeBinaryPath());
    process.exit(0);
  }
  console.warn(
    '[install-chrome:render-build] WARN — Chrome not on disk after build step (deploy will continue; runtime will retry).',
  );
  process.exit(0);
})().catch((e) => {
  console.warn('[install-chrome:render-build] WARN —', e instanceof Error ? e.message : e);
  process.exit(0);
});
