/**
 * Tax Center exports (PDF, CSV, receipt manifest).
 * CPA summary PDF: same backend Puppeteer pipeline as contract PDFs (`POST /api/contracts/render-pdf`).
 * Requires: expo-sharing, expo-file-system (see mobile/package.json); backend must serve PDF render.
 * Uses expo-file-system/legacy for cache paths (expo-file-system v19+ stable entry differs).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { renderHtmlPdfViaBackend } from '@/lib/pdf/renderHtmlPdfViaBackend';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import type { TaxCategory } from '@/src/lib/taxCenter';
import { ACCOUNTING_CATEGORY_MAPPING_ENABLED } from '@/src/lib/taxCenterLaunchFlags';
import { SUGGESTED_ACCOUNTING_CATEGORY } from '@/src/lib/taxSuggestedAccountingCategories';

/** Full legal notice for PDF / CSV exports (same substantive copy). */
const TAX_EXPORT_NOTICE_FULL =
  'Tax Center reports are for bookkeeping and tax-preparation support only. They are not tax advice, do not replace a CPA or tax professional, and are not official tax filings or official 1099 forms. Verify all amounts, categories, receipts, vendors, and tax treatment before filing.';

const TAX_EXPORT_DATA_SOURCE_LINE =
  'Prepared from user-entered project, payment, expense, purchase order, subcontractor, and receipt data in Build Profit Solutions.';

const TAX_EXPORT_DATA_ACCURACY_NOTE =
  'Amounts are based on data available in Build Profit Solutions for the selected tax year. Missing, incomplete, or incorrectly categorized entries may affect this report.';

/** CPA Summary PDF callout only — concise wording for the Important Tax Notice card. */
const TAX_EXPORT_NOTICE_PDF_CARD =
  'This report is for bookkeeping and tax-preparation support only. It is not tax advice, does not replace a CPA or tax professional, and is not an official tax filing or official 1099 form. Users are responsible for verifying all amounts, categories, receipts, vendors, and tax treatment before filing.';

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
  /**
   * Chromium print-to-PDF and some embedded WebView stacks can omit `<style>` rules; the PDF then
   * falls back to UA defaults (Times, no backgrounds). Mirror critical presentation as inline styles.
   */
  const PDF_FONT =
    '-apple-system,BlinkMacSystemFont,"Helvetica Neue","Segoe UI",Arial,sans-serif';
  /** Roomier padding + larger base type so PDF text reads clearly when printed. */
  const IN_BODY = `margin:0;padding:36px 40px 44px;background:#ffffff;color:#0f172a;font-family:${PDF_FONT};font-size:12px;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  const IN_BRAND_BAR = `height:6px;margin:-36px -40px 22px -40px;background:#14b8a6;border-radius:0 0 3px 3px;`;
  const IN_HEADER_WRAP = `background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:20px 20px 0;margin:0 0 22px 0;`;
  const IN_HEADER_RULE = `height:3px;margin:16px -20px 0 -20px;background:#14b8a6;border-radius:0 0 11px 11px;`;
  const IN_RD_CARD = `display:inline-block;text-align:left;vertical-align:top;min-width:248px;max-width:310px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 5px rgba(15,23,42,0.07);`;
  const IN_RD_HEAD = `margin:0;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:9px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#0f766e;`;
  const IN_RD_BODY = 'padding:12px 14px 14px;';
  const IN_RD_ROW = `display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px;font-size:11px;line-height:1.45;`;
  const IN_RD_ROW_LAST = `display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:0;font-size:11px;line-height:1.45;`;
  const IN_RD_LABEL = `color:#64748b;font-weight:600;flex-shrink:0;`;
  const IN_RD_VALUE = `color:#1f2937;font-weight:600;text-align:right;word-break:break-word;max-width:64%;`;
  const IN_RD_BADGE =
    'display:inline-block;padding:3px 9px;border-radius:999px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;';
  const IN_PORTFOLIO_NOTE = `margin:10px 0 0 0;font-size:10px;color:#64748b;line-height:1.45;font-weight:500;`;
  const IN_NOTICE = `background:#fef3c7;background-image:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fbbf24;border-left:5px solid #d97706;border-radius:14px;padding:18px 22px;margin:0 0 22px 0;`;
  const IN_NOTICE_TITLE = `font-size:10.5px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#92400e;margin:0 0 12px 0;`;
  const IN_NOTICE_BODY = `font-size:12px;color:#451a03;margin:0;line-height:1.6;`;
  const IN_NOTICE_BLUE = `background:#eff6ff;background-image:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #60a5fa;border-left:4px solid #2563eb;border-radius:12px;padding:16px 18px;margin-bottom:14px;`;
  const IN_NOTICE_BLUE_TITLE = `font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#1e40af;margin:0 0 10px 0;`;
  const IN_NOTICE_BLUE_BODY = `font-size:11px;color:#1e3a8a;margin:0;line-height:1.55;`;
  const IN_AI_KICKER =
    'margin:0 0 10px 0;font-size:11px;color:#64748b;font-weight:500;line-height:1.45;';
  const IN_INSIGHT_TABLE =
    'border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;margin-top:4px;width:100%;border-collapse:collapse;box-shadow:0 1px 4px rgba(15,23,42,0.06);';
  const IN_INSIGHT_STRIP =
    'width:3px;min-width:3px;padding:0;line-height:0;font-size:0;background:#14b8a6;';
  const IN_INSIGHT_CELL = 'background:#fafafa;';
  const IN_INSIGHT_INNER = 'padding:16px 18px 14px;';
  const IN_INSIGHT_TEXT = 'font-size:12px;color:#1f2937;line-height:1.62;margin:0;';
  const IN_INSIGHT_DISCLAIMER =
    'font-size:9px;color:#94a3b8;margin:12px 0 0 0;line-height:1.45;padding-top:12px;border-top:1px solid #e5e7eb;font-style:italic;';
  const IN_EMPTY_MSG = `font-size:11px;color:#64748b;font-style:italic;margin:10px 0 0 0;padding:16px;background:#f8fafc;border-radius:12px;border:1px dashed #94a3b8;`;
  const IN_EMPTY_SUB_BOX = `font-size:11px;color:#64748b;font-style:italic;margin:10px 0 0 0;padding:24px 20px;background:#f8fafc;border-radius:14px;border:2px dashed #cbd5e1;text-align:center;line-height:1.55;`;
  const IN_REPORT_FOOTER = `margin-top:16px;padding:14px 12px 12px;border-top:1px solid #e5e7eb;text-align:center;color:#64748b;font-size:9.5px;line-height:1.58;background:#fafafa;border-radius:0 0 10px 10px;`;
  const IN_REPORT_FOOTER_LEAD = `font-weight:700;color:#374151;margin-bottom:10px;font-size:11px;letter-spacing:0.01em;`;
  const IN_REPORT_BRAND = `font-size:11.5px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#0f766e;margin:0 0 6px 0;`;
  const IN_REPORT_PRODUCT = `font-size:9.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;margin:0 0 16px 0;`;
  const IN_REPORT_TITLE = `margin:0 0 8px 0;font-size:32px;font-weight:800;letter-spacing:-0.035em;color:#0f172a;line-height:1.12;`;
  const IN_REPORT_SUB = `margin:0;font-size:13px;color:#475569;font-weight:500;letter-spacing:0.01em;`;
  const IN_PORTFOLIO_TFOOT_TD = `font-size:10px;color:#64748b;font-style:italic;line-height:1.5;padding:14px 12px 12px;border-top:2px solid #e2e8f0;background:#f8fafc;vertical-align:top;`;

  const IN_CARD =
    'background:#ffffff;background-image:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);border:1px solid #e5e7eb;border-left:3px solid #14b8a6;border-radius:12px;padding:18px 18px 16px;min-height:96px;box-shadow:0 1px 4px rgba(15,23,42,0.06);';
  const IN_CARD_LABEL =
    'font-size:9.5px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;margin-bottom:10px;';
  const IN_CARD_HINT = 'margin-top:10px;font-size:8.5px;line-height:1.4;color:#94a3b8;font-weight:500;';
  /** Slim heading + teal rule — avoids heavy rounded section boxes. */
  const IN_SECTION_HEAD =
    'margin:0 0 8px 0;padding:0 0 6px 0;border-bottom:2px solid #14b8a6;background:transparent;box-shadow:none;border-left:none;border-radius:0;';
  const IN_SECTION_TITLE = 'margin:0;font-size:15px;font-weight:700;color:#1e293b;letter-spacing:-0.02em;';
  const IN_TABLE =
    'width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;margin-top:6px;font-size:11px;border:1px solid #e5e7eb;border-radius:8px;overflow:visible;box-shadow:0 1px 3px rgba(15,23,42,0.04);';
  const IN_TABLE_PROJECT = `${IN_TABLE}font-size:10px;`;
  const IN_TH =
    'background:#0f766e;color:#ffffff;font-weight:700;text-align:left;font-size:10px;padding:11px 12px;border-bottom:1px solid #0d9488;border-right:1px solid rgba(255,255,255,0.15);letter-spacing:0.01em;text-transform:uppercase;vertical-align:bottom;';
  const IN_TH_NUM = `${IN_TH}text-align:right;`;
  const IN_TD =
    'padding:10px 12px;border-bottom:1px solid #eef0f3;border-right:1px solid #f3f4f6;color:#1f2937;font-size:11px;vertical-align:middle;';
  const IN_TD_NUM =
    'padding:10px 12px;border-bottom:1px solid #eef0f3;border-right:1px solid #f3f4f6;color:#1f2937;font-size:11px;vertical-align:middle;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;';
  const metricValueInline = (cls: string): string => {
    let color = '#1f2937';
    if (cls.includes('card-val-neg')) color = '#dc2626';
    else if (cls.includes('card-val-pos')) color = '#0d9488';
    else if (cls.includes('card-val-muted')) color = '#94a3b8';
    return `font-size:26px;font-weight:800;letter-spacing:-0.025em;line-height:1.12;color:${color};`;
  };
  const moneyTdColor = (n: number) => (Number.isFinite(n) && n < 0 ? '#dc2626' : '#1f2937');

  const p = payload.portfolioSummary;
  const year = payload.selectedYear;
  const genDisplay = escapeHtml(payload.generatedAtDisplay);
  const preparedForValueRaw = String(payload.contractorCompanyName ?? '').trim();
  const preparedForDisplay = preparedForValueRaw ? escapeHtml(preparedForValueRaw) : 'User Account';

  const reportDetailsHtml = `<div class="report-details-card" role="group" aria-label="Report details" style="${IN_RD_CARD}">
    <p style="${IN_RD_HEAD}">Report Details</p>
    <div style="${IN_RD_BODY}">
      <div style="${IN_RD_ROW}"><span style="${IN_RD_LABEL}">Tax Year</span><span style="${IN_RD_VALUE}">${year}</span></div>
      <div style="${IN_RD_ROW}"><span style="${IN_RD_LABEL}">Prepared For</span><span style="${IN_RD_VALUE}">${preparedForDisplay}</span></div>
      <div style="${IN_RD_ROW}"><span style="${IN_RD_LABEL}">Generated Date</span><span style="${IN_RD_VALUE}">${genDisplay}</span></div>
      <div style="${IN_RD_ROW}"><span style="${IN_RD_LABEL}">Report Type</span><span style="${IN_RD_VALUE}">CPA Summary</span></div>
      <div style="${IN_RD_ROW_LAST}"><span style="${IN_RD_LABEL}">Status</span><span style="${IN_RD_VALUE}"><span style="${IN_RD_BADGE}">For Review</span></span></div>
    </div>
  </div>`;

  const PORTFOLIO_BELOW_NOTE =
    'Portfolio totals use cash-basis activity dated in the selected tax year: payments when collected, expenses when paid or when purchase orders are received or completed. Outstanding receivables and committed costs are informational and are not included in revenue or expenses paid until collected or paid, depending on your accounting method. Confirm treatment with your CPA.';

  const execCards: Array<{
    label: string;
    value: string;
    cls: string;
    hint?: string;
  }> = [
    {
      label: 'Revenue Collected',
      value: money(p.revenueCollected),
      cls: cardValueClass('revenue', p.revenueCollected),
      hint: 'Payments actually collected during the selected tax year.',
    },
    {
      label: 'Expenses Paid',
      value: money(p.expensesPaid),
      cls: cardValueClass('expense', p.expensesPaid),
      hint: 'Expenses and received/paid purchase orders dated within the selected tax year.',
    },
    {
      label: 'Net Income',
      value: money(p.netIncome),
      cls: cardValueClass('net', p.netIncome),
      hint: 'Revenue collected minus expenses paid for the selected tax year.',
    },
    {
      label: 'Outstanding Receivables',
      value: money(p.outstandingReceivables),
      cls: cardValueClass('receivable', p.outstandingReceivables),
      hint: 'Unpaid invoices or scheduled payments tied to the selected tax year. Not counted as cash-basis income until collected.',
    },
    {
      label: 'Committed Costs',
      value: money(p.committedCosts),
      cls: cardValueClass('committed', p.committedCosts),
      hint: 'Pending purchase orders and committed costs not yet paid or received. Shown for review only.',
    },
    {
      label: 'Receipt Count',
      value: String(p.receiptCount),
      cls: cardValueClass('count', p.receiptCount),
      hint: 'Receipts attached to expenses dated within the selected tax year.',
    },
  ];

  const execGridFootnote =
    p.committedCosts > 0
      ? `<p class="exec-reconcile-note" style="${IN_PORTFOLIO_NOTE}margin-top:10px;">${escapeHtml(
          `Expenses Paid (${money(p.expensesPaid)}) + Committed costs (${money(p.committedCosts)}) = ${money(
            p.expensesPaid + p.committedCosts
          )} total recorded job spend for this tax year. Net income uses Expenses Paid only — confirm cash-basis vs accrual treatment with your CPA.`
        )}</p>`
      : '';

  const metricCardHtml = (c: (typeof execCards)[0]) =>
    `<div class="summary-card" style="${IN_CARD}">
      <div class="summary-card-label" style="${IN_CARD_LABEL}">${escapeHtml(c.label)}</div>
      <div class="summary-card-value ${c.cls}" style="${metricValueInline(c.cls)}">${escapeHtml(c.value)}</div>
      ${c.hint ? `<div class="summary-card-hint" style="${IN_CARD_HINT}">${escapeHtml(c.hint)}</div>` : ''}
    </div>`;

  /** Table-based 2-column layout: reliably paints in Chromium print and embedded WebViews. */
  const metricRows: string[] = [];
  for (let i = 0; i < execCards.length; i += 2) {
    const left = metricCardHtml(execCards[i]);
    const rightCell = execCards[i + 1] ? metricCardHtml(execCards[i + 1]) : '&nbsp;';
    metricRows.push(`<tr><td class="metric-cell">${left}</td><td class="metric-cell">${rightCell}</td></tr>`);
  }
  const execGrid = `<table class="metrics-table" role="presentation" aria-label="Summary metrics" width="100%"><tbody>${metricRows.join('')}</tbody></table>`;

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
      const rowBg = i % 2 === 0 ? '#ffffff' : '#fafbfc';
      if (row.text != null) {
        const cls = row.text === 'N/A' ? 'amt-muted' : '';
        const textColor = row.text === 'N/A' ? '#94a3b8' : '#1f2937';
        return `<tr class="${stripe}" style="background-color:${rowBg}"><td style="${IN_TD}border-right:1px solid #f1f5f9;">${escapeHtml(row.label)}</td><td class="num ${cls}" style="${IN_TD_NUM}color:${textColor};font-weight:${row.text === 'N/A' ? 600 : 700};border-right:none;">${escapeHtml(row.text)}</td></tr>`;
      }
      const n = row.amount ?? 0;
      const amtColor = n < 0 ? '#dc2626' : '#1f2937';
      return `<tr class="${stripe}" style="background-color:${rowBg}"><td style="${IN_TD}border-right:1px solid #f1f5f9;">${escapeHtml(row.label)}</td><td class="num money ${moneyCellClass(n)}" style="${IN_TD_NUM}color:${amtColor};border-right:none;">${escapeHtml(money(n))}</td></tr>`;
    })
    .join('');

  const accountingCell = (raw: string) => {
    const t = String(raw || '').trim();
    return t ? t : 'Needs review';
  };
  const suggestedAccountingCell = (categoryLabel: string) => {
    const key = categoryLabel as TaxCategory;
    const sug = SUGGESTED_ACCOUNTING_CATEGORY[key];
    return sug ? sug : '';
  };

  const unmappedCategoryCount = payload.expenseCategories.filter(
    (c) => !String(c.accountingOrQuickBooksCategory || '').trim()
  ).length;
  const mappingReminderHtml =
    ACCOUNTING_CATEGORY_MAPPING_ENABLED && unmappedCategoryCount > 0
      ? `<div class="notice" role="note" style="${IN_NOTICE_BLUE}">
    <p class="notice-title" style="${IN_NOTICE_BLUE_TITLE}">Mapping reminder</p>
    <p class="notice-body" style="${IN_NOTICE_BLUE_BODY}">${unmappedCategoryCount} categor${unmappedCategoryCount === 1 ? 'y' : 'ies'} need mapping before export. Confirm final labels with your CPA or tax professional.</p>
  </div>`
      : '';

  const catRowsLaunch =
    payload.expenseCategories.length === 0
      ? ''
      : payload.expenseCategories
          .map((c, i) => {
            const bg = i % 2 === 0 ? '#ffffff' : '#fafbfc';
            const amtCol = moneyTdColor(c.amount);
            return `<tr style="background-color:${bg}"><td style="${IN_TD}">${escapeHtml(c.category)}</td><td class="num money ${moneyCellClass(c.amount)}" style="${IN_TD_NUM}color:${amtCol};">${escapeHtml(money(c.amount))}</td><td class="num" style="${IN_TD_NUM};border-right:none;">${c.itemCount}</td></tr>`;
          })
          .join('');

  const catRowsFull =
    payload.expenseCategories.length === 0
      ? ''
      : payload.expenseCategories
          .map((c, i) => {
            const bg = i % 2 === 0 ? '#ffffff' : '#fafbfc';
            const amtCol = moneyTdColor(c.amount);
            return `<tr style="background-color:${bg}"><td style="${IN_TD}">${escapeHtml(c.category)}</td><td style="${IN_TD}">${escapeHtml(accountingCell(c.accountingOrQuickBooksCategory))}</td><td style="${IN_TD}">${escapeHtml(suggestedAccountingCell(c.category))}</td><td class="num money ${moneyCellClass(c.amount)}" style="${IN_TD_NUM}color:${amtCol};">${escapeHtml(money(c.amount))}</td><td class="num" style="${IN_TD_NUM};border-right:none;">${c.itemCount}</td></tr>`;
          })
          .join('');

  const catRows = ACCOUNTING_CATEGORY_MAPPING_ENABLED ? catRowsFull : catRowsLaunch;

  const projRows =
    payload.projectSummaries.length === 0
      ? ''
      : payload.projectSummaries
          .map((r, i) => {
            const bg = i % 2 === 0 ? '#ffffff' : '#fafbfc';
            const nmMuted = !Number.isFinite(r.netMargin);
            const nmInline = nmMuted
              ? `${IN_TD_NUM}color:#94a3b8;font-weight:600;`
              : `${IN_TD_NUM}color:#1f2937;`;
            return `<tr style="background-color:${bg}"><td class="proj-name" style="${IN_TD}">${escapeHtml(r.projectName)}</td><td class="num money ${moneyCellClass(r.revenueCollected)}" style="${IN_TD_NUM}color:${moneyTdColor(r.revenueCollected)};">${escapeHtml(money(r.revenueCollected))}</td><td class="num money ${moneyCellClass(r.outstandingInvoices)}" style="${IN_TD_NUM}color:${moneyTdColor(r.outstandingInvoices)};">${escapeHtml(money(r.outstandingInvoices))}</td><td class="num money ${moneyCellClass(r.expensesPaid)}" style="${IN_TD_NUM}color:${moneyTdColor(r.expensesPaid)};">${escapeHtml(money(r.expensesPaid))}</td><td class="num money ${moneyCellClass(r.netIncome)}" style="${IN_TD_NUM}color:${moneyTdColor(r.netIncome)};">${escapeHtml(money(r.netIncome))}</td><td class="num" style="${nmInline}">${escapeHtml(formatNetMargin(r.netMargin))}</td><td class="num" style="${IN_TD_NUM};border-right:none;">${r.receiptCount}</td></tr>`;
          })
          .join('');

  const subRows =
    payload.subcontractors.length === 0
      ? ''
      : payload.subcontractors
          .map((s, i) => {
            const bg = i % 2 === 0 ? '#ffffff' : '#fafbfc';
            const w9 = s.w9Uploaded ? 'On file' : 'Not on file';
            const rev = s.potential1099Review ? 'Yes' : 'No';
            return `<tr style="background-color:${bg}"><td style="${IN_TD}">${escapeHtml(s.vendorName)}</td><td class="num money ${moneyCellClass(s.totalPaid)}" style="${IN_TD_NUM}color:${moneyTdColor(s.totalPaid)};">${escapeHtml(money(s.totalPaid))}</td><td style="${IN_TD}">${escapeHtml(s.projectNames.join('; '))}</td><td style="${IN_TD}">${escapeHtml(w9)}</td><td style="${IN_TD}">${escapeHtml(rev)}</td><td class="td-muted td-flags" style="${IN_TD};text-align:center;color:#64748b;font-size:10px;border-right:none;">—</td></tr>`;
          })
          .join('');

  const aiHtml = escapeHtml(payload.aiTaxInsight).replace(/\n/g, '<br/>');

  const emptyCat =
    payload.expenseCategories.length === 0
      ? `<p class="empty-msg" style="${IN_EMPTY_MSG}">No expense category data found for this tax year.</p>`
      : ACCOUNTING_CATEGORY_MAPPING_ENABLED
        ? `${mappingReminderHtml}<p class="section-subtitle section-subtitle--tight">Expense categories are based on Build Profit Solutions project categories.</p><table class="data-table" aria-label="Expense categories" style="${IN_TABLE}"><thead><tr><th style="${IN_TH}">BPS Category</th><th style="${IN_TH}">Your accounting category</th><th style="${IN_TH}">Suggested accounting category</th><th style="${IN_TH_NUM}">Amount</th><th style="${IN_TH_NUM};border-right:none;">Item Count</th></tr></thead><tbody>${catRows}</tbody></table><p class="table-note">${escapeHtml(
            'Suggested accounting category is an editable starting point. Confirm final category treatment with your CPA or tax professional.'
          )}</p>`
        : `${mappingReminderHtml}<p class="section-subtitle section-subtitle--tight">Expense categories are based on Build Profit Solutions project categories.</p><table class="data-table" aria-label="Expense categories" style="${IN_TABLE}"><thead><tr><th style="${IN_TH}">BPS Category</th><th style="${IN_TH_NUM}">Amount</th><th style="${IN_TH_NUM};border-right:none;">Item Count</th></tr></thead><tbody>${catRows}</tbody></table><p class="table-note">${escapeHtml(
            'Expense categories are based on Build Profit Solutions project categories. Final tax category treatment should be reviewed with a CPA or tax professional.'
          )}</p>`;

  const emptyProj =
    payload.projectSummaries.length === 0
      ? `<p class="empty-msg" style="${IN_EMPTY_MSG}">No project data found for this tax year.</p>`
      : `<p class="section-subtitle section-subtitle--tight">Tax summaries use cash collected and expenses paid in the selected tax year.</p><table class="data-table project-table" aria-label="Projects" style="${IN_TABLE_PROJECT}"><thead><tr><th style="${IN_TH}">Project</th><th style="${IN_TH_NUM}">Revenue Collected</th><th style="${IN_TH_NUM}">Outstanding</th><th style="${IN_TH_NUM}">Expenses Paid</th><th style="${IN_TH_NUM}">Net Income</th><th style="${IN_TH_NUM}">Net Margin</th><th style="${IN_TH_NUM};border-right:none;">Receipts</th></tr></thead><tbody>${projRows}</tbody></table>`;

  const emptySub =
    payload.subcontractors.length === 0
      ? `<div class="empty-state-box" role="status" style="${IN_EMPTY_SUB_BOX}">No subcontractor payments found for this tax year.</div>`
      : `<table class="data-table data-table--subs" aria-label="Subcontractors" style="${IN_TABLE}"><thead><tr><th style="${IN_TH}">Vendor</th><th style="${IN_TH_NUM}">Total Paid</th><th style="${IN_TH}">Projects</th><th style="${IN_TH}">W-9 Status</th><th style="${IN_TH}">Potential 1099 Review</th><th style="${IN_TH};border-right:none;">Flags</th></tr></thead><tbody>${subRows}</tbody></table>`;

  const portfolioFootnoteTfoot = '';

  const portfolioBlock = `<div class="section section-portfolio section-first pdf-cluster pdf-cluster--portfolio pdf-no-break">
    <div class="section-heading" style="${IN_SECTION_HEAD}">
      <h2 class="section-title" style="${IN_SECTION_TITLE}">Portfolio Summary</h2>
    </div>
    <table class="data-table" aria-label="Portfolio summary" style="${IN_TABLE}"><thead><tr><th style="${IN_TH}border-right:1px solid rgba(255,255,255,0.22);">Metric</th><th style="${IN_TH_NUM}border-right:none;">Amount</th></tr></thead><tbody>${portfolioBody}</tbody>${portfolioFootnoteTfoot}</table>
    <p class="portfolio-below-note" style="${IN_PORTFOLIO_NOTE}">${escapeHtml(PORTFOLIO_BELOW_NOTE)}</p>
  </div>`;

  const expenseBlock = `<div class="section section-expense section-allow-inner-break">
    <div class="section-heading" style="${IN_SECTION_HEAD}">
      <h2 class="section-title" style="${IN_SECTION_TITLE}">Expense Categories</h2>
    </div>
    ${emptyCat}
  </div>`;

  const projectBlock = `<div class="section section-projects section-allow-inner-break">
    <div class="section-heading" style="${IN_SECTION_HEAD}">
      <h2 class="section-title" style="${IN_SECTION_TITLE}">Project-by-Project Summary</h2>
    </div>
    ${emptyProj}
  </div>`;

  const showSubcontractorHint =
    payload.subcontractors.length > 0 || payload.subcontractors.some((s) => s.potential1099Review);
  const subHintHtml = showSubcontractorHint
    ? '<p class="section-hint">Confirm vendor eligibility, payment method, W-9 status, and filing requirements with your CPA or tax professional.</p>'
    : '';

  const subBlock = `<div class="section section-subs section-allow-inner-break">
    <div class="section-heading" style="${IN_SECTION_HEAD}">
      <h2 class="section-title" style="${IN_SECTION_TITLE}">Subcontractor Payment Summary</h2>
    </div>
    ${subHintHtml}
    ${emptySub}
  </div>`;

  const aiBlock = `<div class="section section-ai pdf-no-break">
    <div class="section-heading" style="${IN_SECTION_HEAD}">
      <h2 class="section-title" style="${IN_SECTION_TITLE}">AI Tax Insight</h2>
    </div>
    <p class="ai-insight-kicker" style="${IN_AI_KICKER}">Rules-based insight · Not tax advice</p>
    <table class="insight-table" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${IN_INSIGHT_TABLE}">
      <tr>
        <td class="insight-strip-cell" valign="top" aria-hidden="true" style="${IN_INSIGHT_STRIP}"></td>
        <td class="insight-content-cell" valign="top" style="${IN_INSIGHT_CELL}">
          <div class="insight-body-inner" style="${IN_INSIGHT_INNER}">
            <div class="insight-text" style="${IN_INSIGHT_TEXT}">${aiHtml}</div>
            <div class="insight-disclaimer" style="${IN_INSIGHT_DISCLAIMER}">Rules-based insight. Not tax advice. Review with your CPA or tax professional.</div>
          </div>
        </td>
      </tr>
    </table>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Year-End Tax Summary ${year}</title>
<style>
  @page {
    size: Letter portrait;
    margin: 0;
  }
  html {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #ffffff;
  }
  body {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #ffffff !important;
    color: #111827 !important;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body.pdf-root {
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    padding: 36px 40px 44px;
    max-width: 100%;
    color: #0f172a !important;
  }
  p, .table-note, .table-footnote, .section-subtitle, .insight-text {
    orphans: 3;
    widows: 3;
  }
  .pdf-shell {
    max-width: 720px;
    margin: 0 auto;
    position: relative;
  }
  .pdf-brand-accent {
    height: 6px;
    margin: -36px -40px 22px -40px;
    background: #14b8a6;
    border-radius: 0 0 3px 3px;
  }
  .pdf-page-split-marker {
    break-before: page;
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
    font-size: 0;
    line-height: 0;
    overflow: hidden;
  }
  .pdf-no-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pdf-cluster--portfolio {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* Top padding so first block after the forced page break (Expense Categories) does not sit under the page edge. */
  .pdf-back-matter {
    padding-top: 40px;
  }
  .pdf-back-matter .section:first-child {
    margin-top: 0;
  }
  .pdf-back-matter .section {
    margin-top: 20px;
  }

  .report-header-wrap {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px 20px 0;
    margin: 0 0 22px 0;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  }
  .report-header-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 0;
    padding: 0;
  }
  .report-header-rule {
    height: 3px;
    margin: 16px -20px 0 -20px;
    border-radius: 0 0 11px 11px;
    background: #14b8a6;
  }
  .report-header-left {
    width: 62%;
    padding: 0 18px 0 0;
    vertical-align: top;
  }
  .report-header-right {
    width: 38%;
    padding: 0;
    vertical-align: top;
    text-align: right;
  }
  .report-brand {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #0f766e;
    margin: 0 0 6px 0;
  }
  .report-product {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #64748b;
    margin: 0 0 16px 0;
  }
  .report-title {
    margin: 0 0 8px 0;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.035em;
    color: #0f172a;
    line-height: 1.12;
  }
  .report-sub {
    margin: 0;
    font-size: 13px;
    color: #475569;
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .report-details-card {
    display: inline-block;
    text-align: left;
    vertical-align: top;
    min-width: 248px;
    max-width: 310px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 5px rgba(15, 23, 42, 0.07);
  }

  .notice {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #60a5fa;
    border-left: 4px solid #2563eb;
    border-radius: 12px;
    padding: 14px 18px;
    margin-bottom: 14px;
    box-shadow: 0 2px 12px rgba(37, 99, 235, 0.08);
  }
  .notice-title {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #1e40af;
    margin: 0 0 10px 0;
  }
  .notice-body {
    font-size: 11px;
    color: #1e3a8a;
    margin: 0;
    line-height: 1.55;
  }

  .notice-card {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border: 1px solid #fbbf24;
    border-left: 5px solid #d97706;
    border-radius: 14px;
    padding: 16px 20px;
    margin: 0 0 22px 0;
    box-shadow: 0 4px 18px rgba(217, 119, 6, 0.12);
  }
  .notice-card-title {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #92400e;
    margin: 0 0 12px 0;
  }
  .notice-card-body {
    font-size: 12px;
    color: #451a03;
    margin: 0;
    line-height: 1.6;
  }

  .summary-metrics-wrap {
    width: 100%;
    margin: 0 0 22px 0;
  }
  .metrics-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 14px 14px;
    margin: 0;
  }
  .metric-cell {
    width: 50%;
    vertical-align: top;
    padding: 0;
  }
  .summary-card {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid #e5e7eb;
    border-left: 3px solid #14b8a6;
    border-radius: 12px;
    padding: 18px 18px 16px;
    min-height: 96px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
  }
  .summary-card-label {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 10px;
  }
  .summary-card-value {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.12;
  }
  .summary-card-hint {
    margin-top: 10px;
    font-size: 8.5px;
    line-height: 1.4;
    color: #94a3b8;
    font-weight: 500;
  }
  .card-val { color: #1f2937; }
  .card-val-pos { color: #0d9488; }
  .card-val-neg { color: #dc2626; }
  .card-val-muted { color: #94a3b8; }

  .section {
    margin-top: 22px;
    margin-bottom: 0;
    width: 100%;
  }
  .section-first { margin-top: 10px; }
  /* Extra margin + padding so Portfolio Summary sits lower after the metric cards and when the block starts a new page. */
  .section-portfolio {
    margin-top: 28px;
    padding-top: 36px;
  }
  .section-heading {
    margin: 0 0 8px 0;
    padding: 0 0 6px 0;
    border-bottom: 2px solid #14b8a6;
    background: transparent;
    box-shadow: none;
    border-left: none;
    border-radius: 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  .section-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: -0.02em;
  }
  .section-subtitle {
    font-size: 10.5px;
    color: #64748b;
    margin: 0 0 6px 0;
    line-height: 1.45;
    font-weight: 500;
  }
  .section-subtitle--tight { margin-top: 2px; margin-bottom: 6px; }
  .section-hint {
    font-size: 10px;
    color: #64748b;
    margin: 0 0 8px 0;
    line-height: 1.45;
  }

  .keep-together {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-allow-inner-break {
    break-inside: auto;
    page-break-inside: auto;
  }

  table.data-table tfoot {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  table.data-table tfoot td {
    border-bottom: none;
  }

  table.data-table {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 11px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: visible;
    overflow-wrap: anywhere;
    word-break: normal;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  .section-portfolio .data-table tbody tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-allow-inner-break .data-table tbody tr {
    break-inside: auto;
    page-break-inside: auto;
  }
  .section-allow-inner-break table.data-table {
    break-inside: auto;
    page-break-inside: auto;
  }
  .data-table th {
    background: #0f766e;
    font-weight: 700;
    text-align: left;
    font-size: 10px;
    padding: 11px 12px;
    border-bottom: 1px solid #0d9488;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    color: #ffffff;
    vertical-align: bottom;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }
  .data-table th:last-child { border-right: none; }
  .data-table th.num { text-align: right; }
  .data-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #eef0f3;
    border-right: 1px solid #f3f4f6;
    color: #1f2937;
    vertical-align: middle;
    font-size: 11px;
    background: #ffffff;
  }
  .data-table td:last-child { border-right: none; }
  .data-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .data-table tr.stripe { background: #ffffff; }
  .data-table tr.stripe td { background: #ffffff; }
  .data-table tr.stripe-alt { background: #fafbfc; }
  .data-table tr.stripe-alt td { background: #fafbfc; }
  .data-table--subs td.td-flags {
    text-align: center;
    color: #6b7280;
    font-size: 10px;
  }
  .money { font-weight: 700; white-space: nowrap; }
  .project-table { font-size: 10px; }
  .project-table th,
  .project-table td { padding: 9px 8px; }
  .project-table th:nth-child(1),
  .project-table td:nth-child(1) { width: 15%; }
  .project-table th:nth-child(2),
  .project-table td:nth-child(2) { width: 14%; }
  .project-table th:nth-child(3),
  .project-table td:nth-child(3) { width: 14%; }
  .project-table th:nth-child(4),
  .project-table td:nth-child(4) { width: 14%; }
  .project-table th:nth-child(5),
  .project-table td:nth-child(5) { width: 14%; }
  .project-table th:nth-child(6),
  .project-table td:nth-child(6) { width: 15%; }
  .project-table th:nth-child(7),
  .project-table td:nth-child(7) { width: 14%; }
  .project-table .proj-name { word-wrap: break-word; }

  .amt-pos { color: #1f2937; }
  .amt-neg { color: #dc2626; font-weight: 700; }
  .amt-zero { color: #64748b; }
  .amt-muted { color: #94a3b8; font-weight: 600; }

  .table-footnote {
    font-size: 10px;
    color: #6b7280;
    margin: 10px 0 0 0;
    line-height: 1.45;
    font-style: italic;
  }
  .portfolio-below-note {
    margin: 10px 0 0 0;
    font-size: 10px;
    color: #64748b;
    line-height: 1.45;
    font-weight: 500;
  }

  .table-note {
    font-size: 10px;
    color: #6b7280;
    margin: 8px 0 0 0;
    line-height: 1.45;
    max-width: 100%;
  }

  .empty-msg {
    font-size: 11px;
    color: #64748b;
    font-style: italic;
    margin: 10px 0 0 0;
    padding: 16px;
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
    border: 1px dashed #94a3b8;
  }
  .empty-state-box {
    font-size: 11px;
    color: #64748b;
    font-style: italic;
    margin: 10px 0 0 0;
    padding: 24px 20px;
    background: #f8fafc;
    border-radius: 14px;
    border: 2px dashed #cbd5e1;
    text-align: center;
    line-height: 1.55;
  }

  .insight-table {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    background: #ffffff;
    margin-top: 4px;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
  }
  .insight-strip-cell {
    width: 3px;
    min-width: 3px;
    padding: 0;
    line-height: 0;
    font-size: 0;
    background: #14b8a6;
  }
  .insight-content-cell {
    background: #fafafa;
  }
  .insight-body-inner {
    padding: 16px 18px 14px;
  }
  .insight-text {
    font-size: 12px;
    color: #1e293b;
    line-height: 1.62;
    margin: 0;
  }
  .insight-disclaimer {
    font-size: 9px;
    color: #94a3b8;
    margin: 12px 0 0 0;
    line-height: 1.45;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    font-style: italic;
  }
  .ai-insight-kicker {
    margin: 0 0 10px 0;
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
    line-height: 1.45;
  }

  .report-footer {
    margin-top: 16px;
    padding: 14px 12px 12px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    color: #64748b;
    font-size: 9.5px;
    line-height: 1.58;
    background: #fafafa;
    border-radius: 0 0 10px 10px;
  }
  .report-footer-lead {
    font-weight: 700;
    color: #374151;
    margin-bottom: 10px;
    font-size: 11px;
    letter-spacing: 0.01em;
  }
  .report-footer-line {
    margin: 3px 0;
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
  }
</style></head><body class="pdf-root" style="${IN_BODY}">
  <div class="pdf-shell" style="max-width:720px;margin:0 auto;position:relative;">
    <div class="pdf-brand-accent" aria-hidden="true" style="${IN_BRAND_BAR}"></div>

      <div class="report-header-wrap" style="${IN_HEADER_WRAP}">
        <table class="report-header-table" role="presentation" width="100%" cellpadding="0" cellspacing="0" aria-label="Report header">
          <tbody><tr>
            <td class="report-header-left" valign="top">
              <p class="report-brand" style="${IN_REPORT_BRAND}">BUILD PROFIT SOLUTIONS</p>
              <p class="report-product" style="${IN_REPORT_PRODUCT}">CPA SUMMARY REPORT</p>
              <h1 class="report-title" style="${IN_REPORT_TITLE}">Year-End Tax Summary</h1>
              <p class="report-sub" style="${IN_REPORT_SUB}">Tax-ready report · CPA-ready summary</p>
            </td>
            <td class="report-header-right" valign="top" align="right">
              ${reportDetailsHtml}
            </td>
          </tr></tbody>
        </table>
        <div class="report-header-rule" aria-hidden="true" style="${IN_HEADER_RULE}"></div>
      </div>

      <div class="notice-card pdf-no-break" role="note" style="${IN_NOTICE}">
        <p class="notice-card-title" style="${IN_NOTICE_TITLE}">Important Tax Notice</p>
        <p class="notice-card-body" style="${IN_NOTICE_BODY}">${escapeHtml(TAX_EXPORT_NOTICE_PDF_CARD)}</p>
      </div>

      <div class="summary-metrics-wrap metrics-pdf-block pdf-no-break">${execGrid}${execGridFootnote}</div>

      ${portfolioBlock}

      <div class="pdf-page-split-marker" aria-hidden="true"></div>

      <div class="pdf-back-matter">
      ${expenseBlock}
      ${projectBlock}
      ${subBlock}
      ${aiBlock}

      <footer class="report-footer pdf-no-break" style="${IN_REPORT_FOOTER}">
        <div class="report-footer-lead" style="${IN_REPORT_FOOTER_LEAD}">Generated by Build Profit Solutions</div>
        <div class="report-footer-line">Tax-ready report for bookkeeping and CPA review</div>
        <div class="report-footer-line">${escapeHtml(TAX_EXPORT_DATA_SOURCE_LINE)}</div>
        <div class="report-footer-line">${escapeHtml(TAX_EXPORT_DATA_ACCURACY_NOTE)}</div>
      </footer>
      </div>

  </div>
</body></html>`;
}

/**
 * Generates CPA summary PDF via the same backend Chrome print pipeline as “Generate contract”.
 * Web triggers a browser download and returns null (caller skips share). Native returns a cache file URI for sharing.
 */
export async function generateTaxSummaryPdf(payload: TaxSummaryExportPayload): Promise<string | null> {
  const html = buildTaxSummaryHtml(payload);
  const filename = `BPS_CPA_Summary_${payload.selectedYear}.pdf`;

  return renderHtmlPdfViaBackend({
    html,
    filename,
    displayHeaderFooter: false,
    autoShareOnNative: false,
  });
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
  push(escapeCsvCell('Tax-ready report · CPA-ready summary'));
  push('');
  push(escapeCsvCell('DOCUMENT DETAILS'));
  kv('Report Type', 'Tax CSV');
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
  if (p.committedCosts > 0) {
    kv('Expenses paid + committed POs (informational)', formatMoneyCsv(p.expensesPaid + p.committedCosts));
  }
  kv('Net Income', formatMoneyCsv(p.netIncome));
  kv('Net Margin', formatNetMargin(p.netMargin));
  kv('Subcontractor Payments', formatMoneyCsv(p.subcontractorPayments));
  kv('Receipt Count', p.receiptCount);
  push('');
  push(escapeCsvCell('EXPENSE CATEGORIES'));
  if (ACCOUNTING_CATEGORY_MAPPING_ENABLED) {
    push(
      `${escapeCsvCell('BPS Category')},${escapeCsvCell('Your Accounting Category')},${escapeCsvCell('Suggested Accounting Category')},${escapeCsvCell('Amount')},${escapeCsvCell('Item Count')}`
    );
  } else {
    push(`${escapeCsvCell('BPS Category')},${escapeCsvCell('Amount')},${escapeCsvCell('Item Count')}`);
  }
  if (payload.expenseCategories.length === 0) {
    push(csvLongTextSecondColumn('No expense category data found for this tax year.'));
  } else if (ACCOUNTING_CATEGORY_MAPPING_ENABLED) {
    payload.expenseCategories.forEach((c) => {
      const acct = String(c.accountingOrQuickBooksCategory || '').trim();
      const sug = SUGGESTED_ACCOUNTING_CATEGORY[c.category as TaxCategory] ?? '';
      push(
        `${escapeCsvCell(c.category)},${escapeCsvCell(acct || 'Needs review')},${escapeCsvCell(sug)},${escapeCsvCell(formatMoneyCsv(c.amount))},${escapeCsvCell(c.itemCount)}`
      );
    });
  } else {
    payload.expenseCategories.forEach((c) => {
      push(
        `${escapeCsvCell(c.category)},${escapeCsvCell(formatMoneyCsv(c.amount))},${escapeCsvCell(c.itemCount)}`
      );
    });
  }
  push('');
  push(escapeCsvCell('EXPENSE TRANSACTIONS'));
  push(
    [
      'Date',
      'Project',
      'Vendor',
      'Description',
      'BPS Category',
      'Suggested Accounting Category',
      'Amount',
      'Payment Method',
      'Receipt Attached',
      'Receipt File Name',
      '1099 Eligible',
      'W-9 Status',
      'Notes',
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  payload.expenseTransactions.forEach((r) => {
    push(
      [
        escapeCsvCell(r.date),
        escapeCsvCell(r.project),
        escapeCsvCell(r.vendor),
        escapeCsvCell(r.description),
        escapeCsvCell(String(r.bpsCategory)),
        escapeCsvCell(r.accountingCategory),
        escapeCsvCell(r.amount),
        escapeCsvCell(r.paymentMethod),
        escapeCsvCell(r.receiptAttached),
        escapeCsvCell(r.receiptFileName),
        escapeCsvCell(r.eligible1099),
        escapeCsvCell(r.w9Status),
        escapeCsvCell(r.notes),
      ].join(',')
    );
  });
  push('');
  push(escapeCsvCell('REVENUE PAYMENTS'));
  push(
    [
      'Date',
      'Project',
      'Customer',
      'Invoice / Milestone',
      'Amount Collected',
      'Payment Method',
      'Outstanding Balance',
      'Notes',
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  payload.revenuePayments.forEach((r) => {
    push(
      [
        escapeCsvCell(r.date),
        escapeCsvCell(r.project),
        escapeCsvCell(r.customer),
        escapeCsvCell(r.invoiceOrMilestone),
        escapeCsvCell(r.amountCollected),
        escapeCsvCell(r.paymentMethod),
        escapeCsvCell(r.outstandingBalance),
        escapeCsvCell(r.notes),
      ].join(',')
    );
  });
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
    escapeCsvCell('IMPORTANT TAX NOTICE'),
    csvLongTextSecondColumn(TAX_EXPORT_NOTICE_FULL),
    '',
    escapeCsvCell('RECEIPT LINES'),
    ['Receipt File Name', 'Expense Date', 'Vendor', 'Amount', 'Project', 'Category', 'Attached / Missing', 'Notes']
      .map(escapeCsvCell)
      .join(','),
  ];

  const rows = rowsIn.map((r) => {
    const attached = (r.receiptUri || '').trim() ? 'Attached' : 'Missing';
    return [
      escapeCsvCell(r.receiptFileName || ''),
      escapeCsvCell(formatReadableExpenseDate(r.date)),
      escapeCsvCell(r.vendor),
      escapeCsvCell(moneyReceiptManifest(r.amount)),
      escapeCsvCell(r.projectName),
      escapeCsvCell(r.category),
      escapeCsvCell(attached),
      escapeCsvCell(r.notes || ''),
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
