/* global document, HTMLElement */
const fs = require('fs');
const express = require('express');
const { isRenderHosting } = require('../utils/renderEnv');
const {
  launchPdfBrowser,
  getPdfChromeExecutablePath,
  isPdfChromeReady,
  getPdfChromeEngine,
} = require('../services/pdfBrowser');
const { getChromeInstallMountStatus } = require('../services/puppeteerChromeInstall');
const { authenticateToken } = require('../middleware/authenticateToken');
const { requireEntitlement } = require('../middleware/requireEntitlement');

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

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchPdfBrowser();
  }
  try {
    return await browserPromise;
  } catch (e) {
    browserPromise = null;
    throw e;
  }
}

router.post('/render-pdf', authenticateToken, requireEntitlement(), async (req, res) => {
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
  if (Buffer.byteLength(html, 'utf8') > 2_000_000) {
    return res.status(413).json({
      error: 'PDF request too large',
      message: 'HTML payload must be 2 MB or smaller.',
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

        // Only bump to the next page when the block does not fit in the remaining
        // space AND there is not much room left (avoids half-empty pages).
        const remainingRatio = remainingHeight / printableHeight;
        if (
          blockHeight > remainingHeight &&
          blockHeight < printableHeight * 0.95 &&
          remainingRatio < 0.28
        ) {
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

/** Verify deploy: GET /api/contracts/pdf-ready — `ok` when the PDF browser binary is available. */
router.get('/pdf-ready', async (req, res) => {
  const pdfEngine = getPdfChromeEngine();
  let puppeteerPath = null;
  let exists = false;
  let loadError = null;
  try {
    if (isRenderHosting()) {
      require.resolve('@sparticuz/chromium');
      require.resolve('puppeteer-core');
    } else {
      require.resolve('puppeteer');
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }
  if (!loadError) {
    try {
      puppeteerPath = await getPdfChromeExecutablePath();
      exists = await isPdfChromeReady();
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }
  const ok = exists && !loadError;
  let whatToDo = null;
  if (!ok && !loadError) {
    whatToDo = isRenderHosting()
      ? 'PDF engine not ready: redeploy backend after `npm install` (uses @sparticuz/chromium). Check Render build logs for npm errors.'
      : 'chromeOnDisk is false: from `backend/` run `npx puppeteer browsers install chrome` or install Google Chrome for local dev.';
  } else if (loadError) {
    whatToDo = 'Fix puppeteerLoadError — ensure @sparticuz/chromium and puppeteer-core are installed on the server.';
  }
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || '';
  res.json({
    ok,
    route: 'contracts',
    pdf: 'POST /api/contracts/render-pdf',
    pdfEngine,
    puppeteerCacheDir: cacheDir,
    cacheDirOnDisk: Boolean(cacheDir && fs.existsSync(cacheDir)),
    puppeteerExecutablePath: puppeteerPath,
    chromeOnDisk: exists,
    detectedRenderRuntime: isRenderHosting(),
    chromeInstallMountStatus: isRenderHosting() ? (exists ? 'succeeded' : 'idle') : getChromeInstallMountStatus(),
    ...(loadError ? { puppeteerLoadError: loadError } : {}),
    ...(whatToDo ? { whatToDo } : {}),
  });
});

module.exports = router;
