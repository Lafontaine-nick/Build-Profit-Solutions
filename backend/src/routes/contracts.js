const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const express = require('express');
const { isRenderHosting } = require('../utils/renderEnv');

const router = express.Router();

let browserPromise = null;

function sanitizeFilename(value = 'contract.pdf') {
  const trimmed = String(value || 'contract.pdf').trim() || 'contract.pdf';
  const safe = trimmed.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe || 'contract'}.pdf`;
}

function escapeHtmlFooterText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const launchArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

/** Render: build-time Chrome may be omitted from the slug; install at runtime when the binary is missing. */
function puppeteerCacheDirForInstall() {
  const fromEnv = (process.env.PUPPETEER_CACHE_DIR || '').trim();
  if (fromEnv) return fromEnv;
  return path.resolve(__dirname, '..', '..', 'render-pdf-chrome');
}

function sleepSyncRender(seconds) {
  try {
    execSync(`sleep ${seconds}`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}

function tryRuntimeInstallChromeOnRender(puppeteer) {
  if (!isRenderHosting()) return;

  let expected = null;
  try {
    if (typeof puppeteer.executablePath === 'function') {
      expected = puppeteer.executablePath();
    }
  } catch {
    /* continue — still try browsers install */
  }
  if (expected && fs.existsSync(expected)) return;

  const cacheDir = puppeteerCacheDirForInstall();
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
  } catch {
    /* ignore */
  }

  const backendRoot = path.join(__dirname, '..', '..');
  const installEnv = { ...process.env, PUPPETEER_CACHE_DIR: cacheDir };
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.warn(
      `[contracts] Render: Chrome missing at ${expected || '(unknown)'}; running browsers install (attempt ${attempt}/${maxAttempts}, ~1–3 min)…`,
    );
    try {
      execSync('npx puppeteer browsers install chrome', {
        stdio: 'inherit',
        cwd: backendRoot,
        env: installEnv,
        timeout: 720000,
      });
      console.warn('[contracts] Render: Chrome install finished.');
      return;
    } catch (e) {
      console.error(
        '[contracts] Render: runtime Chrome install failed:',
        e instanceof Error ? e.message : e,
      );
      if (attempt < maxAttempts) sleepSyncRender(20);
    }
  }
}

/** When bundled Chromium is missing, use a real browser if installed (common on macOS dev). */
function findSystemChromeExecutable() {
  if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
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

async function launchBrowser(puppeteer) {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: launchArgs,
    });
  }

  tryRuntimeInstallChromeOnRender(puppeteer);

  // On Render/Linux there is no Google Chrome app; use Puppeteer's downloaded binary first.
  let bundledPath = null;
  try {
    if (typeof puppeteer.executablePath === 'function') {
      bundledPath = puppeteer.executablePath();
    }
  } catch (e) {
    console.warn('[contracts] puppeteer.executablePath() failed:', e instanceof Error ? e.message : e);
  }
  if (bundledPath && fs.existsSync(bundledPath)) {
    try {
      return await puppeteer.launch({
        headless: true,
        executablePath: bundledPath,
        args: launchArgs,
      });
    } catch (e) {
      console.warn('[contracts] Launch with bundled Chrome failed:', e instanceof Error ? e.message : e);
    }
  } else {
    console.error(
      '[contracts] No Puppeteer Chrome at executablePath(). PUPPETEER_CACHE_DIR=%s — from backend/: export PUPPETEER_CACHE_DIR="$PWD/render-pdf-chrome" && npx puppeteer browsers install chrome',
      process.env.PUPPETEER_CACHE_DIR || '(default)',
    );
  }

  const systemChrome = findSystemChromeExecutable();
  if (systemChrome) {
    try {
      return await puppeteer.launch({
        headless: true,
        executablePath: systemChrome,
        args: launchArgs,
      });
    } catch (e) {
      console.warn(
        '[contracts] Launch with system Chrome/Chromium failed:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Local dev: optional system Chrome (skip on Render/production — avoids "Could not find Chrome" noise).
  const skipSystemChannel =
    isRenderHosting() ||
    process.env.PUPPETEER_SKIP_CHANNEL === '1' ||
    process.env.NODE_ENV === 'production';
  if (!skipSystemChannel) {
    try {
      return await puppeteer.launch({
        headless: true,
        channel: process.env.PUPPETEER_CHANNEL || 'chrome',
        args: launchArgs,
      });
    } catch (e) {
      console.warn(
        '[contracts] Launch with channel=chrome failed, falling back:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  return puppeteer.launch({
    headless: true,
    args: launchArgs,
  });
}

async function getBrowser() {
  // Lazy-load so the rest of the API still starts if puppeteer fails to install in an environment.
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    const err = new Error('puppeteer is not available on this server');
    err.cause = e;
    throw err;
  }

  if (!browserPromise) {
    browserPromise = launchBrowser(puppeteer);
  }
  try {
    return await browserPromise;
  } catch (e) {
    browserPromise = null;
    throw e;
  }
}

router.post('/render-pdf', async (req, res) => {
  const html = String(req.body?.html || '').trim();
  const filename = sanitizeFilename(req.body?.filename || 'contract.pdf');
  const footerLeft = escapeHtmlFooterText(req.body?.footerLeft);
  const footerCenter = escapeHtmlFooterText(req.body?.footerCenter);
  /** Default true — contract PDFs use header/footer strip. Tax CPA summary sets false (HTML @page only). */
  const displayHeaderFooter = req.body?.displayHeaderFooter !== false;

  if (!html) {
    return res.status(400).json({
      error: 'Missing HTML',
      message: 'Request body must include a non-empty `html` string.',
    });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1660, deviceScaleFactor: 1 });
    await page.emulateMediaType('screen');
    await page.setContent(html, {
      // `domcontentloaded` fires before remote <img> bytes finish — cover logos often
      // looked “broken” in the PDF. `load` waits for subresources; we still wait on
      // images below in case `load` races with decode.
      waitUntil: 'load',
      timeout: 45000,
    });

    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      const waitOne = (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 12000);
        });
      await Promise.all(imgs.map(waitOne));
    });

    await page.evaluate(() => {
      const MM_TO_PX = 96 / 25.4;
      const LETTER_HEIGHT_PX = 11 * 96;
      // Matches HTML @page top/bottom margins plus the native PDF footer reserve.
      const topInsetMm = 8;
      const bottomInsetMm = 11 + 22;
      const printableHeight = LETTER_HEIGHT_PX - (topInsetMm + bottomInsetMm) * MM_TO_PX;

      document.querySelectorAll('[data-keep-together]').forEach((node) => {
        const el = node;
        if (!(el instanceof HTMLElement)) return;

        const pageRoot = el.closest('.page');
        if (!(pageRoot instanceof HTMLElement)) return;

        const blockTop = el.offsetTop;
        const blockHeight = el.offsetHeight;
        const offsetWithinPage = ((blockTop % printableHeight) + printableHeight) % printableHeight;
        const remainingHeight = printableHeight - offsetWithinPage;

        if (blockHeight > remainingHeight) {
          el.classList.add('force-page-break-before');
        }
      });
    });

    const footerTemplate = `
<div style="width:100%;box-sizing:border-box;padding:6px 34px 4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:9px;line-height:1.25;color:#64748b;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;background:#fff;">
  <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:10px;">${footerLeft || '&nbsp;'}</span>
  <span style="flex:1.15;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;text-transform:uppercase;letter-spacing:0.06em;font-size:8px;padding:0 8px;">${footerCenter || '&nbsp;'}</span>
  <span style="flex-shrink:0;color:#10243b;font-weight:600;white-space:nowrap;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`.trim();

    const pdfBytes = displayHeaderFooter
      ? await page.pdf({
          format: 'Letter',
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: true,
          headerTemplate: '<div style="height:0;margin:0;padding:0;font-size:0;"></div>',
          footerTemplate,
          margin: {
            top: '0mm',
            right: '0mm',
            bottom: '22mm',
            left: '0mm',
          },
        })
      : await page.pdf({
          format: 'Letter',
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false,
          margin: {
            top: '0mm',
            right: '0mm',
            bottom: '0mm',
            left: '0mm',
          },
        });

    const pdfBuffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);

    if (!pdfBuffer || pdfBuffer.length < 100) {
      return res.status(500).json({
        error: 'PDF render failed',
        message: 'Generated PDF buffer was empty or invalid.',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Contract PDF render failed:', error);
    return res.status(500).json({
      error: 'PDF render failed',
      message: error instanceof Error ? error.message : 'Unknown PDF rendering error',
    });
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
  }
});

/** Verify deploy: GET /api/contracts/pdf-ready — `ok` is true only if bundled Chrome exists on disk. */
router.get('/pdf-ready', (req, res) => {
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || '';
  const cacheDirExists = Boolean(cacheDir && fs.existsSync(cacheDir));
  let puppeteerPath = null;
  let exists = false;
  let loadError = null;
  try {
    const puppeteer = require('puppeteer');
    if (typeof puppeteer.executablePath === 'function') {
      puppeteerPath = puppeteer.executablePath();
      exists = Boolean(puppeteerPath && fs.existsSync(puppeteerPath));
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }
  const ok = exists && !loadError;
  let whatToDo = null;
  if (!ok && !loadError) {
    if (isRenderHosting()) {
        'chromeOnDisk is false: ensure the Render **build** runs `npm run install-chrome:render-build` (see backend/render.yaml). Chrome is stored under `backend/render-pdf-chrome/` (not gitignored) so it ships in the deploy. Or in Render Shell from `backend/`: export PUPPETEER_CACHE_DIR="$PWD/render-pdf-chrome" && npx puppeteer browsers install chrome.';
    } else {
      whatToDo =
        'chromeOnDisk is false: from the `backend/` folder run: export PUPPETEER_CACHE_DIR="$PWD/render-pdf-chrome" && npx puppeteer browsers install chrome (or install Google Chrome on macOS for dev).';
    }
  } else if (loadError) {
    whatToDo = 'Fix puppeteerLoadError (puppeteer module or executablePath).';
  }
  res.json({
    ok,
    route: 'contracts',
    pdf: 'POST /api/contracts/render-pdf',
    puppeteerCacheDir: cacheDir,
    cacheDirOnDisk: cacheDirExists,
    puppeteerExecutablePath: puppeteerPath,
    chromeOnDisk: exists,
    /** True when the server will run managed Chrome install on first PDF (Render-style hosting). */
    detectedRenderRuntime: isRenderHosting(),
    ...(loadError ? { puppeteerLoadError: loadError } : {}),
    ...(whatToDo ? { whatToDo } : {}),
  });
});

module.exports = router;
