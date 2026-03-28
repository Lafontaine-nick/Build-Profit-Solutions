const express = require('express');

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

async function launchBrowser(puppeteer) {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: launchArgs,
    });
  }

  // Prefer installed Google Chrome (stable path on dev Mac/Windows/Linux) so PDF works without
  // `npx puppeteer browsers install chrome` matching the same cache dir as the running process.
  try {
    return await puppeteer.launch({
      headless: true,
      channel: process.env.PUPPETEER_CHANNEL || 'chrome',
      args: launchArgs,
    });
  } catch (e) {
    console.warn(
      '[contracts] Launch with channel=chrome failed, using Puppeteer-managed browser:',
      e instanceof Error ? e.message : e,
    );
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
  return browserPromise;
}

router.post('/render-pdf', async (req, res) => {
  const html = String(req.body?.html || '').trim();
  const filename = sanitizeFilename(req.body?.filename || 'contract.pdf');
  const footerLeft = escapeHtmlFooterText(req.body?.footerLeft);
  const footerCenter = escapeHtmlFooterText(req.body?.footerCenter);

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
      // `networkidle0` has been unreliable here and was timing out even for
      // trivial HTML. For this server-side generated document we only need the
      // DOM/CSS to be ready before printing.
      waitUntil: 'domcontentloaded',
      timeout: 30000,
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

    const pdfBytes = await page.pdf({
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

/** Lets you verify deploy: GET /api/contracts/pdf-ready */
router.get('/pdf-ready', (req, res) => {
  res.json({ ok: true, route: 'contracts', pdf: 'POST /api/contracts/render-pdf' });
});

module.exports = router;
