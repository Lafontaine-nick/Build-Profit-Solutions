/**
 * Tax Center exports (PDF, CSV, receipt manifest).
 * Requires: expo-print, expo-sharing, expo-file-system (see mobile/package.json).
 * Install if missing: npx expo install expo-print expo-sharing expo-file-system
 * Uses expo-file-system/legacy for cache paths (expo-file-system v19+ stable entry differs).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';

/** Full legal notice for PDF / CSV exports (same substantive copy). */
const TAX_EXPORT_NOTICE_FULL =
  'This report is for bookkeeping and tax-preparation support only. It is not tax advice, does not replace a CPA or tax professional, and is not an official tax filing or official 1099 form. Users are responsible for verifying all amounts, categories, receipts, vendor information, and tax treatment with their CPA or tax professional before filing.';

const TAX_EXPORT_DATA_SOURCE_LINE =
  'Prepared from user-entered project, payment, expense, purchase order, subcontractor, and receipt data in Build Profit Solutions.';

const TAX_EXPORT_DATA_ACCURACY_NOTE =
  'Amounts are based on data available in Build Profit Solutions for the selected tax year. Missing, incomplete, or incorrectly categorized entries may affect this report.';

const ACCENT = '#0d9488';
const TEXT = '#1e293b';
const TEXT_MUTED = '#64748b';
const CARD_BG = '#f1f5f9';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );

/** Receipt manifest amounts: always two decimals (e.g. $6,743.00). */
function moneyReceiptManifest(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Tax Summary CSV currency: two decimals, explicit negative (e.g. -$16,743.00). PDF uses `money()` separately. */
function formatMoneyCsv(value: number | null | undefined): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `-$${abs}` : `$${abs}`;
}

function formatNetMargin(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return 'N/A';
  return `${Math.round(n * 100)}%`;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Long prose in column 2 with empty column 1 so Numbers/Excel do not stretch the first column. */
function csvLongTextSecondColumn(value: string): string {
  return `${escapeCsvCell('')},${escapeCsvCell(value)}`;
}

function csvGeneratedDateOnly(generatedAtDisplay: string): string {
  const idx = generatedAtDisplay.indexOf(' at ');
  return (idx >= 0 ? generatedAtDisplay.slice(0, idx) : generatedAtDisplay).trim();
}

function formatReadableExpenseDate(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return s;
}

function formatMonthDisplay(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function moneyCellClass(n: number): string {
  if (!Number.isFinite(n)) return 'amt-muted';
  if (n < 0) return 'amt-neg';
  if (n > 0) return 'amt-pos';
  return 'amt-zero';
}

function cardValueClass(kind: 'revenue' | 'expense' | 'net' | 'receivable' | 'committed' | 'count', n: number): string {
  if (kind === 'net') {
    if (!Number.isFinite(n)) return 'card-val-muted';
    if (n < 0) return 'card-val-neg';
    if (n > 0) return 'card-val-pos';
    return 'card-val-muted';
  }
  if (kind === 'count') {
    if (!Number.isFinite(n) || n === 0) return 'card-val-muted';
    return 'card-val';
  }
  if (kind === 'revenue' || kind === 'receivable') {
    if (!Number.isFinite(n) || n === 0) return 'card-val-muted';
    return 'card-val-pos';
  }
  return 'card-val';
}

function buildTaxSummaryHtml(payload: TaxSummaryExportPayload): string {
  const p = payload.portfolioSummary;
  const year = payload.selectedYear;
  const genDisplay = escapeHtml(payload.generatedAtDisplay);
  const contactEmail = String(payload.contractorContactEmail || '').trim();
  const contactMetaRow = contactEmail
    ? `<div><span class="meta-k">Contractor contact:</span> ${escapeHtml(contactEmail)}</div>`
    : '';

  const execCards = [
    { label: 'Revenue Collected', value: money(p.revenueCollected), cls: cardValueClass('revenue', p.revenueCollected) },
    { label: 'Expenses Paid', value: money(p.expensesPaid), cls: cardValueClass('expense', p.expensesPaid) },
    { label: 'Net Income', value: money(p.netIncome), cls: cardValueClass('net', p.netIncome) },
    {
      label: 'Outstanding Receivables',
      value: money(p.outstandingReceivables),
      cls: cardValueClass('receivable', p.outstandingReceivables),
    },
    { label: 'Committed Costs', value: money(p.committedCosts), cls: cardValueClass('committed', p.committedCosts) },
    { label: 'Receipt Count', value: String(p.receiptCount), cls: cardValueClass('count', p.receiptCount) },
  ];

  const execGrid = execCards
    .map(
      (c) => `
    <div class="summary-card">
      <div class="summary-card-label">${escapeHtml(c.label)}</div>
      <div class="summary-card-value ${c.cls}">${escapeHtml(c.value)}</div>
    </div>`
    )
    .join('');

  const portfolioDefs: Array<{ label: string; amount?: number; text?: string }> = [
    { label: 'Revenue Collected', amount: p.revenueCollected },
    { label: 'Outstanding Receivables', amount: p.outstandingReceivables },
    { label: 'Expenses Paid', amount: p.expensesPaid },
    { label: 'Committed Costs', amount: p.committedCosts },
    { label: 'Net Income', amount: p.netIncome },
    { label: 'Net Margin', text: formatNetMargin(p.netMargin) },
    { label: 'Subcontractor Payments', amount: p.subcontractorPayments },
    { label: 'Receipt Count', text: String(p.receiptCount) },
  ];

  const portfolioBody = portfolioDefs
    .map((row, i) => {
      const stripe = i % 2 === 0 ? 'stripe' : 'stripe-alt';
      if (row.text != null) {
        const cls = row.text === 'N/A' ? 'amt-muted' : '';
        return `<tr class="${stripe}"><td>${escapeHtml(row.label)}</td><td class="num ${cls}">${escapeHtml(row.text)}</td></tr>`;
      }
      const n = row.amount ?? 0;
      return `<tr class="${stripe}"><td>${escapeHtml(row.label)}</td><td class="num money ${moneyCellClass(n)}">${escapeHtml(money(n))}</td></tr>`;
    })
    .join('');

  const accountingCell = (raw: string) => {
    const t = String(raw || '').trim();
    return t ? t : 'Unmapped';
  };
  const catRows =
    payload.expenseCategories.length === 0
      ? ''
      : payload.expenseCategories
          .map(
            (c, i) =>
              `<tr class="${i % 2 === 0 ? 'stripe' : 'stripe-alt'}"><td>${escapeHtml(c.category)}</td><td>${escapeHtml(accountingCell(c.accountingOrQuickBooksCategory))}</td><td class="num money ${moneyCellClass(c.amount)}">${escapeHtml(money(c.amount))}</td><td class="num">${c.itemCount}</td></tr>`
          )
          .join('');

  const projRows =
    payload.projectSummaries.length === 0
      ? ''
      : payload.projectSummaries
          .map(
            (r, i) =>
              `<tr class="${i % 2 === 0 ? 'stripe' : 'stripe-alt'}"><td class="proj-name">${escapeHtml(r.projectName)}</td><td class="num money ${moneyCellClass(r.revenueCollected)}">${escapeHtml(money(r.revenueCollected))}</td><td class="num money ${moneyCellClass(r.outstandingInvoices)}">${escapeHtml(money(r.outstandingInvoices))}</td><td class="num money ${moneyCellClass(r.expensesPaid)}">${escapeHtml(money(r.expensesPaid))}</td><td class="num money ${moneyCellClass(r.netIncome)}">${escapeHtml(money(r.netIncome))}</td><td class="num ${r.netMargin == null || !Number.isFinite(r.netMargin) ? 'amt-muted' : ''}">${escapeHtml(formatNetMargin(r.netMargin))}</td><td class="num">${r.receiptCount}</td></tr>`
          )
          .join('');

  const subRows =
    payload.subcontractors.length === 0
      ? ''
      : payload.subcontractors
          .map((s, i) => {
            const w9 = s.w9Uploaded ? 'On file' : 'Not on file';
            const rev = s.potential1099Review ? 'Yes' : 'No';
            return `<tr class="${i % 2 === 0 ? 'stripe' : 'stripe-alt'}"><td>${escapeHtml(s.vendorName)}</td><td class="num money ${moneyCellClass(s.totalPaid)}">${escapeHtml(money(s.totalPaid))}</td><td>${escapeHtml(s.projectNames.join('; '))}</td><td>${escapeHtml(w9)}</td><td>${escapeHtml(rev)}</td></tr>`;
          })
          .join('');

  const aiHtml = escapeHtml(payload.aiTaxInsight).replace(/\n/g, '<br/>');

  const emptyCat =
    payload.expenseCategories.length === 0
      ? '<p class="empty-msg">No expense category data found for this tax year.</p>'
      : `<table class="data-table" aria-label="Expense categories"><thead><tr><th>BPS Category</th><th>Accounting / QuickBooks Category</th><th class="num">Amount</th><th class="num">Item Count</th></tr></thead><tbody>${catRows}</tbody></table>`;

  const emptyProj =
    payload.projectSummaries.length === 0
      ? '<p class="empty-msg">No project data found for this tax year.</p>'
      : `<table class="data-table project-table" aria-label="Projects"><thead><tr><th>Project</th><th class="num">Revenue Collected</th><th class="num">Outstanding</th><th class="num">Expenses Paid</th><th class="num">Net Income</th><th class="num">Net Margin</th><th class="num">Receipts</th></tr></thead><tbody>${projRows}</tbody></table>`;

  const emptySub =
    payload.subcontractors.length === 0
      ? '<p class="empty-msg">No subcontractor payments found for this tax year.</p>'
      : `<table class="data-table" aria-label="Subcontractors"><thead><tr><th>Vendor / Subcontractor</th><th class="num">Total Paid</th><th>Projects</th><th>W-9 tracking (informational)</th><th>Potential 1099 Review</th></tr></thead><tbody>${subRows}</tbody></table>`;

  const portfolioBlock = `<div class="section keep-together section-first">
    <div class="section-title">Portfolio Summary</div>
    <table class="data-table" aria-label="Portfolio summary"><thead><tr><th>Metric</th><th class="num">Amount</th></tr></thead><tbody>${portfolioBody}</tbody></table>
  </div>`;

  const expenseBlock = `<div class="section keep-together section-allow-inner-break section-page-start">
    <div class="section-title">Expense Categories</div>
    ${emptyCat}
  </div>`;

  const projectBlock = `<div class="section keep-together section-allow-inner-break">
    <div class="section-title">Project-by-Project Summary</div>
    ${emptyProj}
  </div>`;

  const showSubcontractorHint =
    payload.subcontractors.length > 0 || payload.subcontractors.some((s) => s.potential1099Review);
  const subHintHtml = showSubcontractorHint
    ? '<p class="section-hint">Confirm vendor eligibility, payment method, W-9 status, and filing requirements with your CPA or tax professional.</p>'
    : '';

  const subBlock = `<div class="section keep-together section-allow-inner-break">
    <div class="section-title">Subcontractor Payment Summary</div>
    ${subHintHtml}
    ${emptySub}
  </div>`;

  const aiBlock = `<div class="section keep-together">
    <div class="section-title">AI Tax Insight</div>
    <div class="insight-card">
      <div class="insight-text">${aiHtml}</div>
      <div class="insight-subtext">Rules-based insight. Not tax advice. Review with your CPA or tax professional.</div>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Year-End Tax Summary ${year}</title>
<style>
  /* @page margins are unreliable in WKWebView / expo-print; safe inset is body + .page padding. */
  @page {
    size: Letter;
    margin: 0;
  }
  html, body {
    margin: 0;
    width: 100%;
    background: #ffffff;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    color: #17202a;
    font-size: 12px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 36px 52px 56px;
    max-width: 100%;
  }
  .page {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: 0 16px 48px;
    overflow: visible;
  }
  .header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
    border-bottom: 4px solid #22f0bd;
    padding-bottom: 18px;
    margin-bottom: 18px;
    width: 100%;
  }
  .brand {
    font-size: 12px;
    font-weight: 900;
    color: #0f766e;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0 0 6px 0;
  }
  .title {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 900;
    color: #17202a;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
  }
  .doc-sub { font-size: 12px; color: ${TEXT_MUTED}; margin: 0; }
  .metadata {
    text-align: right;
    color: #667085;
    font-size: 10px;
    min-width: 190px;
    max-width: 240px;
  }
  .metadata div { margin-bottom: 4px; }
  .metadata .meta-k { color: #667085; font-weight: 600; margin-right: 6px; }
  .notice { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #e9d5a8; border-radius: 10px; padding: 14px 16px; margin: 0 0 22px 0; }
  .notice-title { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #92400e; margin: 0 0 8px 0; }
  .notice-body { font-size: 11px; color: #78350f; margin: 0; line-height: 1.55; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin: 16px 0 24px;
    width: 100%;
  }
  .summary-card {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
    min-height: 74px;
    overflow: hidden;
  }
  .summary-card-label { font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${TEXT_MUTED}; margin-bottom: 8px; }
  .summary-card-value { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
  .card-val { color: #17202a; }
  .card-val-pos { color: #0f766e; }
  .card-val-neg { color: #b91c1c; }
  .card-val-muted { color: #94a3b8; }
  .section {
    margin-top: 24px;
    width: 100%;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-first { margin-top: 12px; }
  .section-title {
    font-size: 15px;
    font-weight: 900;
    color: #17202a;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 3px solid #0f766e;
    break-after: avoid;
    page-break-after: avoid;
  }
  .section-page-start {
    break-before: page;
    page-break-before: always;
    /* WKWebView often puts the first line flush under the page break; pad the new page top. */
    padding-top: 48px;
    margin-top: 0;
  }
  .keep-together {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section.keep-together.section-allow-inner-break {
    break-inside: auto;
    page-break-inside: auto;
  }
  table {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-top: 8px;
    font-size: 10px;
    border: 1px solid #e5e7eb;
    overflow-wrap: anywhere;
    word-break: normal;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  thead { display: table-header-group; }
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-allow-inner-break table.data-table {
    break-inside: auto;
    page-break-inside: auto;
  }
  th, td {
    padding: 8px 7px;
    border-bottom: 1px solid #e5e7eb;
    color: #17202a;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  .data-table th {
    background: #e2e8f0;
    font-weight: 800;
    text-align: left;
    font-size: 9px;
    text-transform: none;
    border-right: 1px solid #cbd5e1;
  }
  .data-table th:last-child { border-right: none; }
  .data-table th.num { text-align: right; }
  .data-table td {
    border-right: 1px solid #e5e7eb;
    vertical-align: middle;
  }
  .data-table td:last-child { border-right: none; }
  .data-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .data-table tr.stripe { background: #fff; }
  .data-table tr.stripe-alt { background: #f8fafc; }
  .money { font-weight: 800; white-space: nowrap; }
  .project-table { font-size: 9px; }
  .project-table th,
  .project-table td { padding: 7px 5px; }
  .project-table th:nth-child(1),
  .project-table td:nth-child(1) { width: 16%; }
  .project-table th:nth-child(2),
  .project-table td:nth-child(2) { width: 17%; }
  .project-table th:nth-child(3),
  .project-table td:nth-child(3) { width: 18%; }
  .project-table th:nth-child(4),
  .project-table td:nth-child(4) { width: 15%; }
  .project-table th:nth-child(5),
  .project-table td:nth-child(5) { width: 13%; }
  .project-table th:nth-child(6),
  .project-table td:nth-child(6) { width: 11%; }
  .project-table th:nth-child(7),
  .project-table td:nth-child(7) { width: 10%; }
  .project-table .proj-name { word-wrap: break-word; }
  .amt-pos { color: #0f172a; }
  .amt-neg { color: #b91c1c; font-weight: 700; }
  .amt-zero { color: ${TEXT_MUTED}; }
  .amt-muted { color: #94a3b8; font-weight: 600; }
  .empty-msg { font-size: 11px; color: ${TEXT_MUTED}; font-style: italic; margin: 8px 0 0 0; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; }
  .insight-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px 18px; margin-top: 0; background: #fafafa; }
  .insight-text { font-size: 11px; color: #17202a; line-height: 1.55; margin: 0; }
  .insight-subtext { font-size: 9px; color: ${TEXT_MUTED}; margin: 12px 0 0 0; font-style: italic; line-height: 1.45; }
  .section-hint {
    font-size: 9px;
    color: #64748b;
    margin: 0 0 10px 0;
    line-height: 1.45;
    max-width: 100%;
  }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    color: #667085;
    font-size: 10px;
    text-align: center;
    line-height: 1.4;
  }
  .footer div {
    margin-bottom: 4px;
  }
  .footer-small {
    color: #667085;
    font-size: 9.5px;
    line-height: 1.35;
    max-width: 620px;
    margin: 6px auto 0;
    text-align: center;
  }
  .footer-small + .footer-small {
    margin-top: 4px;
  }
</style></head><body>
  <div class="page">
  <header class="header">
    <div>
      <p class="brand">Build Profit Solutions</p>
      <h1 class="title">Year-End Tax Summary</h1>
      <p class="doc-sub">Tax-ready report · CPA-ready summary</p>
    </div>
    <div class="metadata">
      <div><span class="meta-k">Tax Year:</span> ${year}</div>
      <div><span class="meta-k">Date Range:</span> ${escapeHtml(payload.dateRangeLabel)}</div>
      <div><span class="meta-k">Generated:</span> ${genDisplay}</div>
      ${contactMetaRow}
    </div>
  </header>

  <div class="notice" role="note">
    <p class="notice-title">Important Tax Notice</p>
    <p class="notice-body">${escapeHtml(TAX_EXPORT_NOTICE_FULL)}</p>
  </div>

  <div class="summary-grid">${execGrid}</div>

  ${portfolioBlock}
  ${expenseBlock}
  ${projectBlock}
  ${subBlock}
  ${aiBlock}

  <footer class="footer">
    <div><strong>Generated by Build Profit Solutions</strong></div>
    <div>Tax-ready report for bookkeeping and CPA review</div>
    <p class="footer-small">${escapeHtml(TAX_EXPORT_DATA_SOURCE_LINE)}</p>
    <p class="footer-small">${escapeHtml(TAX_EXPORT_DATA_ACCURACY_NOTE)}</p>
  </footer>
  </div>
</body></html>`;
}

/** Generates a PDF file in cache and returns its URI. */
export async function generateTaxSummaryPdf(payload: TaxSummaryExportPayload): Promise<string> {
  const html = buildTaxSummaryHtml(payload);
  const { uri: tempUri } = await Print.printToFileAsync({ html });
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const dest = `${base}BPS_Year_End_Tax_Summary_${payload.selectedYear}.pdf`;
  try {
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  } catch {
    return tempUri;
  }
}

export function generateTaxCenterCsv(payload: TaxSummaryExportPayload): string {
  const lines: string[] = [];
  const p = payload.portfolioSummary;
  const y = payload.selectedYear;
  const genShort = csvGeneratedDateOnly(payload.generatedAtDisplay);
  const dateRangeCsv = `Jan 1 - Dec 31, ${y}`;

  const push = (line: string) => lines.push(line);
  const kv = (k: string, v: string | number) => push(`${escapeCsvCell(k)},${escapeCsvCell(v)}`);

  push(escapeCsvCell('BUILD PROFIT SOLUTIONS'));
  push(escapeCsvCell('Year-End Tax Summary'));
  push(escapeCsvCell('Tax-ready report / CPA-ready summary'));
  push('');
  push(escapeCsvCell('DOCUMENT DETAILS'));
  kv('Report Type', 'Year-End Tax Summary CSV');
  kv('Tax Year', y);
  kv('Date Range', dateRangeCsv);
  kv('Generated', genShort);
  const ce = String(payload.contractorContactEmail || '').trim();
  if (ce) kv('Contractor contact', ce);
  push('');
  push(escapeCsvCell('PORTFOLIO SUMMARY'));
  push(`${escapeCsvCell('Metric')},${escapeCsvCell('Amount')}`);
  kv('Revenue Collected', formatMoneyCsv(p.revenueCollected));
  kv('Outstanding Receivables', formatMoneyCsv(p.outstandingReceivables));
  kv('Expenses Paid', formatMoneyCsv(p.expensesPaid));
  kv('Committed Costs', formatMoneyCsv(p.committedCosts));
  kv('Net Income', formatMoneyCsv(p.netIncome));
  kv('Net Margin', formatNetMargin(p.netMargin));
  kv('Subcontractor Payments', formatMoneyCsv(p.subcontractorPayments));
  kv('Receipt Count', p.receiptCount);
  push('');
  push(escapeCsvCell('EXPENSE CATEGORIES'));
  push(
    `${escapeCsvCell('BPS Category')},${escapeCsvCell('Accounting / QuickBooks Category')},${escapeCsvCell('Amount')},${escapeCsvCell('Item Count')}`
  );
  if (payload.expenseCategories.length === 0) {
    push(csvLongTextSecondColumn('No expense category data found for this tax year.'));
  } else {
    payload.expenseCategories.forEach((c) => {
      const acct = String(c.accountingOrQuickBooksCategory || '').trim();
      push(
        `${escapeCsvCell(c.category)},${escapeCsvCell(acct || 'Unmapped')},${escapeCsvCell(formatMoneyCsv(c.amount))},${escapeCsvCell(c.itemCount)}`
      );
    });
  }
  push('');
  push(escapeCsvCell('PROJECT-BY-PROJECT SUMMARY'));
  push(
    `${escapeCsvCell('Project')},${escapeCsvCell('Revenue Collected')},${escapeCsvCell('Outstanding')},${escapeCsvCell('Expenses Paid')},${escapeCsvCell('Net Income')},${escapeCsvCell('Net Margin')},${escapeCsvCell('Receipt Count')}`
  );
  if (payload.projectSummaries.length === 0) {
    push(csvLongTextSecondColumn('No project data found for this tax year.'));
  } else {
    payload.projectSummaries.forEach((r) => {
      push(
        [
          escapeCsvCell(r.projectName),
          escapeCsvCell(formatMoneyCsv(r.revenueCollected)),
          escapeCsvCell(formatMoneyCsv(r.outstandingInvoices)),
          escapeCsvCell(formatMoneyCsv(r.expensesPaid)),
          escapeCsvCell(formatMoneyCsv(r.netIncome)),
          escapeCsvCell(formatNetMargin(r.netMargin)),
          escapeCsvCell(r.receiptCount),
        ].join(',')
      );
    });
  }
  push('');
  push(escapeCsvCell('SUBCONTRACTOR PAYMENT SUMMARY'));
  push(
    `${escapeCsvCell('Vendor/Subcontractor')},${escapeCsvCell('Total Paid')},${escapeCsvCell('Projects')},${escapeCsvCell('W-9 tracking (informational)')},${escapeCsvCell('Potential 1099 Review')}`
  );
  if (payload.subcontractors.length === 0) {
    push(csvLongTextSecondColumn('No subcontractor payments found for this tax year.'));
  } else {
    payload.subcontractors.forEach((s) => {
      push(
        [
          escapeCsvCell(s.vendorName),
          escapeCsvCell(formatMoneyCsv(s.totalPaid)),
          escapeCsvCell(s.projectNames.join('; ')),
          escapeCsvCell(s.w9Uploaded ? 'On file' : 'Not on file'),
          escapeCsvCell(s.potential1099Review ? 'Yes' : 'No'),
        ].join(',')
      );
    });
  }
  push('');
  push(escapeCsvCell('AI TAX INSIGHT'));
  push(csvLongTextSecondColumn(payload.aiTaxInsight));
  push(
    csvLongTextSecondColumn(
      'Rules-based insight. Not tax advice. Review with your CPA or tax professional.'
    )
  );
  push('');
  push(escapeCsvCell('IMPORTANT TAX NOTICE'));
  push(csvLongTextSecondColumn(TAX_EXPORT_NOTICE_FULL));
  push(csvLongTextSecondColumn(TAX_EXPORT_DATA_SOURCE_LINE));
  push(csvLongTextSecondColumn(TAX_EXPORT_DATA_ACCURACY_NOTE));
  push('');
  push(escapeCsvCell('END OF REPORT'));
  kv('Prepared For', 'Bookkeeping and CPA Review');
  kv('Product', 'Build Profit Solutions');

  return `\uFEFF${lines.join('\n')}`;
}

const RECEIPT_MANIFEST_FOOTER_PREPARED =
  'Prepared from user-entered expense and receipt data in Build Profit Solutions.';

const RECEIPT_MANIFEST_FOOTER_ORIGINAL =
  'Original receipt files should be retained by the user and reviewed with their CPA or tax professional.';

/** Receipt manifest CSV; caller should only invoke when payload.receipts is non-empty. */
export function generateReceiptManifestCsv(payload: TaxSummaryExportPayload): string {
  const y = payload.selectedYear;
  const dateRangeManifest = `Jan 1 - Dec 31, ${y}`;
  const genManifest = csvGeneratedDateOnly(payload.generatedAtDisplay);
  const rowsIn = payload.receipts;

  const headerLines: string[] = [
    escapeCsvCell('BUILD PROFIT SOLUTIONS'),
    escapeCsvCell('Receipt Backup Manifest'),
    '',
    `${escapeCsvCell('Tax Year')},${escapeCsvCell(y)}`,
    `${escapeCsvCell('Date Range')},${escapeCsvCell(dateRangeManifest)}`,
    `${escapeCsvCell('Generated')},${escapeCsvCell(genManifest)}`,
    ...(String(payload.contractorContactEmail || '').trim()
      ? [`${escapeCsvCell('Contractor contact')},${escapeCsvCell(String(payload.contractorContactEmail).trim())}`]
      : []),
    '',
    escapeCsvCell('RECEIPT LINES'),
    ['Project Name', 'Expense Date', 'Month', 'Category', 'Vendor', 'Amount', 'Receipt Attached']
      .map(escapeCsvCell)
      .join(','),
  ];

  const rows = rowsIn.map((r) => {
    const attached = (r.receiptUri || '').trim() ? 'Yes' : 'No';
    return [
      escapeCsvCell(r.projectName),
      escapeCsvCell(formatReadableExpenseDate(r.date)),
      escapeCsvCell(formatMonthDisplay(r.month)),
      escapeCsvCell(r.category),
      escapeCsvCell(r.vendor),
      escapeCsvCell(moneyReceiptManifest(r.amount)),
      escapeCsvCell(attached),
    ].join(',');
  });

  const footerLines = [
    '',
    escapeCsvCell('END OF RECEIPT MANIFEST'),
    escapeCsvCell(RECEIPT_MANIFEST_FOOTER_PREPARED),
    escapeCsvCell(RECEIPT_MANIFEST_FOOTER_ORIGINAL),
  ];

  return `\uFEFF${[...headerLines, ...rows, ...footerLines].join('\n')}`;
}

export type ExportShareMimeType =
  | 'application/pdf'
  | 'text/csv'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function shareExportUri(uri: string, mimeType: ExportShareMimeType): Promise<void> {
  const can = await Sharing.isAvailableAsync();
  if (!can) {
    throw new Error('SHARING_UNAVAILABLE');
  }
  const UTI =
    mimeType === 'application/pdf'
      ? 'com.adobe.pdf'
      : mimeType === 'text/csv'
        ? 'public.comma-separated-values-text'
        : 'org.openxmlformats.spreadsheetml.sheet';
  await Sharing.shareAsync(uri, {
    mimeType,
    UTI,
  });
}

export async function writeBase64ToCacheFile(base64: string, filename: string): Promise<string> {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) {
    throw new Error('NO_FILESYSTEM_BASE');
  }
  const path = `${base}${filename}`;
  try {
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (e) {
    console.error('writeBase64ToCacheFile', e);
    throw new Error('EXPORT_WRITE_FAILED');
  }
  return path;
}

export async function writeStringToCacheFile(content: string, filename: string): Promise<string> {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) {
    throw new Error('NO_FILESYSTEM_BASE');
  }
  const path = `${base}${filename}`;
  try {
    await FileSystem.writeAsStringAsync(path, content, { encoding: 'utf8' });
  } catch (e) {
    console.error('writeStringToCacheFile', e);
    throw new Error('EXPORT_WRITE_FAILED');
  }
  return path;
}
