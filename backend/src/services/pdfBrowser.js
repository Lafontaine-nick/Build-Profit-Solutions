/**
 * PDF browser launcher.
 *
 * Render/production Linux: @sparticuz/chromium (ships with npm install — no 150MB download at build/runtime).
 * Local dev: puppeteer + render-pdf-chrome or system Chrome.
 */
const fs = require('fs');
const { isRenderHosting } = require('../utils/renderEnv');
const {
  installPuppeteerChromeIfMissing,
  getResolvedChromeBinaryPath,
  chromeExecutableExists,
} = require('./puppeteerChromeInstall');

const PDF_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

function findSystemChromeExecutable() {
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }
  if (process.platform === 'linux') {
    const candidates = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function launchWithSparticuzChromium() {
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');
  if (typeof chromium.setGraphicsMode === 'function') {
    chromium.setGraphicsMode(false);
  }
  const executablePath = await chromium.executablePath();
  if (!executablePath || !fs.existsSync(executablePath)) {
    throw new Error('@sparticuz/chromium executable missing after npm install');
  }
  const args = [...(chromium.args || []), ...PDF_LAUNCH_ARGS];
  return puppeteer.launch({
    args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless !== false,
  });
}

async function launchWithLocalPuppeteer() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    const puppeteer = require('puppeteer');
    return puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: PDF_LAUNCH_ARGS,
    });
  }

  await installPuppeteerChromeIfMissing({ logPrefix: '[pdf-browser]', maxAttempts: 2 });

  let puppeteer = require('puppeteer');
  try {
    const resolved = require.resolve('puppeteer');
    delete require.cache[resolved];
    puppeteer = require('puppeteer');
  } catch {
    /* keep */
  }

  const bundledPath = getResolvedChromeBinaryPath();
  if (bundledPath && fs.existsSync(bundledPath)) {
    try {
      return await puppeteer.launch({
        headless: true,
        executablePath: bundledPath,
        args: PDF_LAUNCH_ARGS,
      });
    } catch (e) {
      console.warn('[pdf-browser] Bundled Chrome launch failed:', e instanceof Error ? e.message : e);
    }
  }

  const systemChrome = findSystemChromeExecutable();
  if (systemChrome) {
    return puppeteer.launch({
      headless: true,
      executablePath: systemChrome,
      args: PDF_LAUNCH_ARGS,
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      return await puppeteer.launch({
        headless: true,
        channel: process.env.PUPPETEER_CHANNEL || 'chrome',
        args: PDF_LAUNCH_ARGS,
      });
    } catch {
      /* fall through */
    }
  }

  return puppeteer.launch({ headless: true, args: PDF_LAUNCH_ARGS });
}

async function launchPdfBrowser() {
  if (isRenderHosting()) {
    return launchWithSparticuzChromium();
  }
  return launchWithLocalPuppeteer();
}

async function getPdfChromeExecutablePath() {
  if (isRenderHosting()) {
    const chromium = require('@sparticuz/chromium');
    return chromium.executablePath();
  }
  return getResolvedChromeBinaryPath();
}

async function isPdfChromeReady() {
  if (isRenderHosting()) {
    try {
      const exe = await getPdfChromeExecutablePath();
      return Boolean(exe && fs.existsSync(exe));
    } catch {
      return false;
    }
  }
  return chromeExecutableExists();
}

function getPdfChromeEngine() {
  return isRenderHosting() ? 'sparticuz-chromium' : 'puppeteer-managed';
}

module.exports = {
  launchPdfBrowser,
  getPdfChromeExecutablePath,
  isPdfChromeReady,
  getPdfChromeEngine,
  PDF_LAUNCH_ARGS,
};
