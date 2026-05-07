/**
 * Native / non-web: Tax PDF uses expo-print (see generateTaxSummaryPdf).
 * This stub exists so Metro does not need `html2pdf.js` on iOS/Android.
 */
export async function downloadTaxSummaryPdfFromHtml(_html: string, _filename: string): Promise<void> {
  throw new Error('Tax PDF web export is only supported in the browser.');
}
