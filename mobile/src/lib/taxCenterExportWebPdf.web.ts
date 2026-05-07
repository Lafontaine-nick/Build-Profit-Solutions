/**
 * Web-only: Expo `Print.printToFileAsync` opens the browser print dialog instead of
 * returning a PDF file (see Expo Print docs). We render the same HTML client-side
 * and trigger a real file download via html2pdf.js.
 */
import html2pdf from 'html2pdf.js';

function waitForFonts(timeoutMs: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    return Promise.resolve();
  }
  return Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function downloadTaxSummaryPdfFromHtml(html: string, filename: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Tax PDF download requires a browser.');
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'bps-tax-summary-pdf');
  iframe.style.position = 'fixed';
  iframe.style.left = '-12000px';
  iframe.style.top = '0';
  iframe.style.width = '816px';
  iframe.style.minHeight = '1056px';
  iframe.style.border = '0';
  iframe.srcdoc = html;

  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const maxWait = setTimeout(() => reject(new Error('Tax PDF: layout timed out')), 15000);
      const done = () => {
        clearTimeout(maxWait);
        resolve();
      };
      iframe.onload = () => {
        requestAnimationFrame(() => requestAnimationFrame(done));
      };
      iframe.onerror = () => {
        clearTimeout(maxWait);
        reject(new Error('Tax PDF: document failed to load'));
      };
    });

    const doc = iframe.contentDocument;
    const body = doc?.body;
    if (!body) {
      throw new Error('Tax PDF: empty document');
    }

    await waitForFonts(400);

    const html2canvasOpts = {
      scale: typeof window !== 'undefined' ? Math.min(2.5, Math.max(2, (window.devicePixelRatio || 1) * 1.5)) : 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      scrollY: 0,
      windowHeight: body.scrollHeight,
      backgroundColor: '#ffffff',
    };

    const jsPdfOpts = { unit: 'pt' as const, format: 'letter' as const, orientation: 'portrait' as const };

    await html2pdf()
      // html2pdf.js typings omit `pagebreak` and some html2canvas fields; runtime supports them.
      .set({
        margin: [16, 16, 20, 16],
        filename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: html2canvasOpts,
        jsPDF: jsPdfOpts,
        pagebreak: { mode: ['css', 'legacy'] },
      } as any)
      .from(body)
      .save();
  } finally {
    iframe.remove();
  }
}
