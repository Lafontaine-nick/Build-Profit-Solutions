const express = require('express');

const router = express.Router();

let browserPromise = null;

function sanitizeFilename(value = 'contract.pdf') {
  const trimmed = String(value || 'contract.pdf').trim() || 'contract.pdf';
  const safe = trimmed.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe || 'contract'}.pdf`;
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
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browserPromise;
}

router.post('/render-pdf', async (req, res) => {
  const html = String(req.body?.html || '').trim();
  const filename = sanitizeFilename(req.body?.filename || 'contract.pdf');

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

    const pdfBytes = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0in',
        right: '0in',
        bottom: '0in',
        left: '0in',
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
