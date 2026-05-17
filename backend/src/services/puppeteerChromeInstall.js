/**
 * Shared Puppeteer Chrome install for Render (and first-PDF path). Uses @puppeteer/browsers with an
 * explicit cacheDir — avoids flaky `npx puppeteer browsers install` env handling.
 */
const fs = require('fs');
const path = require('path');
const { isRenderHosting } = require('../utils/renderEnv');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

/** idle | running | succeeded | failed */
let mountStatus = 'idle';

function getCacheDir() {
  const fromEnv = (process.env.PUPPETEER_CACHE_DIR || '').trim();
  if (fromEnv) return fromEnv;
  return path.join(BACKEND_ROOT, 'render-pdf-chrome');
}

function readChromeBuildId() {
  try {
    const m = require('puppeteer-core/lib/cjs/puppeteer/revisions.js');
    const id = m?.PUPPETEER_REVISIONS?.chrome;
    if (id && typeof id === 'string') return id;
  } catch {
    /* fall through */
  }
  return '146.0.7680.153';
}

/** Render runs Linux x64; local dev uses the host platform (matches `npx puppeteer browsers install`). */
function getBrowserPlatformForManagedChrome() {
  const { BrowserPlatform } = require('@puppeteer/browsers');
  if (isRenderHosting()) return BrowserPlatform.LINUX;
  if (process.platform === 'linux') return BrowserPlatform.LINUX;
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? BrowserPlatform.MAC_ARM : BrowserPlatform.MAC;
  }
  if (process.platform === 'win32') {
    return process.arch === 'ia32' ? BrowserPlatform.WIN32 : BrowserPlatform.WIN64;
  }
  return BrowserPlatform.LINUX;
}

/**
 * Path to Chrome under PUPPETEER_CACHE_DIR when installed via @puppeteer/browsers (same layout as our
 * Render build/start install). Prefer this over puppeteer.executablePath() — with skipDownload, the
 * latter often does not point at the downloaded binary.
 */
function getResolvedChromeBinaryPath() {
  const cacheDir = getCacheDir();
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  try {
    const { computeExecutablePath, Browser } = require('@puppeteer/browsers');
    const buildId = readChromeBuildId();
    const platform = getBrowserPlatformForManagedChrome();
    const viaCompute = computeExecutablePath({
      browser: Browser.CHROME,
      buildId,
      cacheDir,
      platform,
    });
    if (viaCompute && fs.existsSync(viaCompute)) return viaCompute;
  } catch {
    /* fall through */
  }
  try {
    const puppeteerPath = require.resolve('puppeteer');
    delete require.cache[puppeteerPath];
  } catch {
    /* ignore */
  }
  try {
    const puppeteer = require('puppeteer');
    const exe = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : '';
    if (exe && fs.existsSync(exe)) return exe;
  } catch {
    /* ignore */
  }
  return null;
}

function chromeExecutableExists() {
  return Boolean(getResolvedChromeBinaryPath());
}

function wipeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function installChromeProgrammaticOnce(logPrefix) {
  const cacheDir = getCacheDir();
  const legacyCache = path.join(BACKEND_ROOT, '.puppeteer-cache');
  wipeDir(cacheDir);
  wipeDir(legacyCache);
  fs.mkdirSync(cacheDir, { recursive: true });
  process.env.PUPPETEER_CACHE_DIR = cacheDir;

  const { install, Browser, BrowserPlatform } = require('@puppeteer/browsers');
  const buildId = readChromeBuildId();
  console.warn(`${logPrefix} @puppeteer/browsers install chrome buildId=${buildId} → ${cacheDir}`);
  await install({
    browser: Browser.CHROME,
    buildId,
    platform: BrowserPlatform.LINUX,
    cacheDir,
    unpack: true,
    downloadProgressCallback: 'default',
  });
}

function verifyOrThrow() {
  if (!chromeExecutableExists()) {
    const cacheDir = getCacheDir();
    throw new Error(`Chrome binary still missing under ${cacheDir}`);
  }
}

/**
 * On Render: ensure Chrome exists under PUPPETEER_CACHE_DIR. Safe to call from server boot and from
 * launchBrowser; concurrent callers share one in-flight promise.
 *
 * @param {{ maxAttempts?: number, logPrefix?: string }} [opts]
 * @returns {Promise<boolean>} true if chrome is usable after this call (or already was)
 */
async function installPuppeteerChromeIfMissing(opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const logPrefix = opts.logPrefix ?? '[puppeteer-chrome]';

  if (!isRenderHosting()) {
    mountStatus = 'idle';
    return true;
  }

  if (chromeExecutableExists()) {
    mountStatus = 'succeeded';
    return true;
  }

  if (global.__bpsPuppeteerChromeInstallPromise) {
    await global.__bpsPuppeteerChromeInstallPromise;
    return chromeExecutableExists();
  }

  mountStatus = 'running';
  const work = (async () => {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        console.warn(`${logPrefix} install attempt ${attempt}/${maxAttempts} …`);
        await installChromeProgrammaticOnce(logPrefix);
        verifyOrThrow();
        mountStatus = 'succeeded';
        console.warn(`${logPrefix} Chrome install succeeded.`);
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        console.warn(`${logPrefix} attempt ${attempt} failed:`, lastErr.message);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 25000));
        }
      }
    }
    mountStatus = 'failed';
    console.error(`${logPrefix} Chrome install failed after retries:`, lastErr);
  })();

  global.__bpsPuppeteerChromeInstallPromise = work.finally(() => {
    delete global.__bpsPuppeteerChromeInstallPromise;
  });

  await global.__bpsPuppeteerChromeInstallPromise;
  return chromeExecutableExists();
}

function getChromeInstallMountStatus() {
  if (chromeExecutableExists()) return 'succeeded';
  return mountStatus;
}

module.exports = {
  installPuppeteerChromeIfMissing,
  chromeExecutableExists,
  getResolvedChromeBinaryPath,
  getChromeInstallMountStatus,
  getCacheDir,
};
