/**
 * Render **start** (optional): install Chrome before `node src/server.js`.
 * Server also kicks the same install in the background; this is belt-and-suspenders for long installs.
 */
const { isRenderHosting } = require('../src/utils/renderEnv');
const {
  installPuppeteerChromeIfMissing,
  chromeExecutableExists,
} = require('../src/services/puppeteerChromeInstall');

(async () => {
  if (!isRenderHosting()) {
    process.exit(0);
  }
  if (chromeExecutableExists()) {
    console.log('[ensure-chrome-start] Chrome already on disk; skipping.');
    process.exit(0);
  }
  const ok = await installPuppeteerChromeIfMissing({
    logPrefix: '[ensure-chrome-start]',
    maxAttempts: 3,
  });
  if (!ok || !chromeExecutableExists()) {
    console.error('[ensure-chrome-start] Chrome install failed.');
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('[ensure-chrome-start]', e);
  process.exit(1);
});
