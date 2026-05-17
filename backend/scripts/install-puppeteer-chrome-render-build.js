/**
 * Render **build**: install Chrome into `render-pdf-chrome/` (same logic as runtime / first PDF).
 * Delegates to `src/services/puppeteerChromeInstall.js`.
 */
const { isRenderHosting } = require('../src/utils/renderEnv');
const {
  installPuppeteerChromeIfMissing,
  chromeExecutableExists,
} = require('../src/services/puppeteerChromeInstall');

(async () => {
  if (!isRenderHosting()) {
    console.log('[install-chrome:render-build] Not a Render host; skipping.');
    process.exit(0);
  }
  const ok = await installPuppeteerChromeIfMissing({
    logPrefix: '[install-chrome:render-build]',
    maxAttempts: 3,
  });
  if (!ok || !chromeExecutableExists()) {
    console.error('[install-chrome:render-build] Chrome install verification failed.');
    process.exit(1);
  }
  console.log('[install-chrome:render-build] OK');
  process.exit(0);
})().catch((e) => {
  console.error('[install-chrome:render-build]', e);
  process.exit(1);
});
