/**
 * Render **start** (optional): kick off Chrome install before `node src/server.js`.
 * Never blocks deploy — server boot also starts a background install.
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
  console.log('[ensure-chrome-start] Chrome missing — starting install (non-blocking for deploy)…');
  const ok = await installPuppeteerChromeIfMissing({
    logPrefix: '[ensure-chrome-start]',
    maxAttempts: 2,
    attemptTimeoutMs: 8 * 60 * 1000,
  });
  if (!ok || !chromeExecutableExists()) {
    console.warn(
      '[ensure-chrome-start] Chrome not ready yet; server will start and retry in background.',
    );
  }
  process.exit(0);
})().catch((e) => {
  console.warn('[ensure-chrome-start] WARN —', e instanceof Error ? e.message : e);
  process.exit(0);
});
