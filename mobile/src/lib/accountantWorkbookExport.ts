/**
 * Accountant workbook (XLSX) for bookkeeping support only — not tax filing, not IRS submission.
 * Uses `xlsx-js-style` so bold, fills, and wrap persist in Excel / Numbers.
 */
import * as XLSX from 'xlsx-js-style';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import type { Tax1099ReviewSummary, Tax1099ReviewVendorRow } from '@/src/lib/tax1099Review';
import { format1099ReviewMoney } from '@/src/lib/tax1099Review';
import { TAX_CATEGORIES, type TaxCategory } from '@/src/lib/taxCenter';
import {
  SUGGESTED_ACCOUNTING_CATEGORY,
  SUGGESTED_CATEGORY_CONFIRM_NOTE,
} from '@/src/lib/taxSuggestedAccountingCategories';

const BRAND = 'Build Profit Solutions';

const IMPORTANT_NOTICE_TEXT =
  'Tax Center reports are for bookkeeping and tax-preparation support only. They are not tax advice, do not replace a CPA or tax professional, and are not official tax filings or official 1099 forms. Verify all amounts, categories, receipts, vendors, and tax treatment before filing.';

const FOOTER_NOTE =
  'Prepared from user-entered project, payment, expense, purchase order, subcontractor, and receipt data in Build Profit Solutions.\n\nAmounts are based on data available in Build Profit Solutions for the selected tax year. Missing, incomplete, or incorrectly categorized entries may affect this workbook.';

/** Excel theme-friendly fills (ARGB). */
const FILL_HEADER = { fgColor: { rgb: 'FFF1F5F9' } };

const STYLE_BRAND_MAIN = {
  font: { bold: true, sz: 18, color: { rgb: 'FF0F766E' } },
  alignment: { vertical: 'center' as const },
};
const STYLE_BRAND_SUB = {
  font: { bold: true, sz: 15, color: { rgb: 'FF0F172A' } },
  alignment: { vertical: 'center' as const },
};
const STYLE_BRAND_TAG = {
  font: { bold: true, sz: 11, color: { rgb: 'FF475569' } },
  alignment: { vertical: 'center' as const, wrapText: true },
};
const STYLE_TABLE_HEADER = {
  font: { bold: true, sz: 11, color: { rgb: 'FF0F172A' } },
  fill: FILL_HEADER,
  alignment: { vertical: 'center' as const },
};

function money2(n: number): string {
  const x = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
}

function pctOrNa(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return 'N/A';
  return `${(p * 100).toFixed(1)}%`;
}

/** Receipt / expense date: never export raw ISO in workbook cells. */
function formatWorkbookExpenseDate(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Not set';
  if (/^file:/i.test(s)) return 'Not set';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    if (s.length > 24 && /T\d{2}:\d{2}/.test(s)) return 'Not set';
    return s.length > 18 ? 'Not set' : s;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function cleanText(v: unknown, emptyLabel = 'Not set'): string {
  if (v == null) return emptyLabel;
  if (typeof v === 'number' && !Number.isFinite(v)) return emptyLabel;
  const t = String(v).trim();
  if (!t || t === 'undefined' || t === 'null' || t === 'NaN') return emptyLabel;
  if (t.startsWith('file://')) return 'Yes';
  return t;
}

function sheetFromAoA(rows: (string | number | null | undefined)[][]) {
  return XLSX.utils.aoa_to_sheet(rows);
}

function applyCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function enrichStyle(ws: XLSX.WorkSheet, r0: number, c0: number, s: Record<string, unknown>) {
  const addr = XLSX.utils.encode_cell({ r: r0, c: c0 });
  const cell = ws[addr] as { v?: unknown; t?: string; s?: Record<string, unknown> } | undefined;
  if (!cell || typeof cell !== 'object') return;
  cell.s = { ...(cell.s || {}), ...s };
}

function mergeCols(ws: XLSX.WorkSheet, r0: number, c0: number, c1: number) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: r0, c: c0 }, e: { r: r0, c: c1 } });
}

function applyFreezeAndFilter(ws: XLSX.WorkSheet, headerRow1Based: number, colCount: number) {
  const lastCol = XLSX.utils.encode_col(Math.max(0, colCount - 1));
  ws['!autofilter'] = { ref: `A${headerRow1Based}:${lastCol}1000` };
}

function optionalUserAccountingLabel(map: Partial<Record<TaxCategory, string>>, cat: TaxCategory): string {
  const raw = map[cat];
  return typeof raw === 'string' ? raw.trim() : '';
}

function mappingSheetStatus(map: Partial<Record<TaxCategory, string>>, cat: TaxCategory): string {
  return optionalUserAccountingLabel(map, cat) ? 'Custom label' : 'Suggested only';
}

function mappingSheetNotes(map: Partial<Record<TaxCategory, string>>, cat: TaxCategory): string {
  const t = optionalUserAccountingLabel(map, cat);
  return t
    ? `Optional label: ${t}. ${SUGGESTED_CATEGORY_CONFIRM_NOTE}`
    : `Suggested accounting labels only. ${SUGGESTED_CATEGORY_CONFIRM_NOTE}`;
}

function vendorReviewPaymentMethod(row: Tax1099ReviewVendorRow): string {
  const d = String(row.paymentMethodDisplay || '').trim();
  if (!d || d === '—') return 'Not set';
  return d;
}

function vendorReviewW9Display(row: Tax1099ReviewVendorRow): string {
  if (!row.w9UiRelevant) return 'N/A';
  return cleanText(row.w9StatusDisplay, 'Not set');
}

function vendorReviewFlags(row: Tax1099ReviewVendorRow): string {
  const f = String(row.workbookFlags || '').trim();
  return f && f !== '—' ? f : 'No flags';
}

function humanizeActionList(row: Tax1099ReviewVendorRow): string {
  const parts = row.actionNeeded.map((a) => {
    if (a === 'Confirm Payment Method') return 'Missing payment method';
    if (a === 'Potential 1099 Review') return 'Potential 1099 review';
    if (a === 'Missing W-9') return 'Missing W-9';
    return a;
  });
  return parts.length ? parts.join('; ') : 'None';
}

function potential1099ReviewCell(row: Tax1099ReviewVendorRow): string {
  return row.actionNeeded.includes('Potential 1099 Review')
    ? 'Yes — confirm with CPA'
    : 'No';
}

function applySummarySheetBasics(ws: XLSX.WorkSheet) {
  applyCols(ws, [36, 74, 22, 22]);
  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  enrichStyle(ws, 2, 0, STYLE_BRAND_TAG);
}

function applyDataSheetPresentation(ws: XLSX.WorkSheet, headerRow1Based: number, colCount: number, widths: number[]) {
  applyCols(ws, widths);
  applyFreezeAndFilter(ws, headerRow1Based, colCount);
  const h = headerRow1Based - 1;
  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  mergeCols(ws, 2, 0, Math.max(0, colCount - 1));
  enrichStyle(ws, 2, 0, { ...STYLE_BRAND_TAG, alignment: { wrapText: true, vertical: 'top' } });
  for (let c = 0; c < colCount; c++) {
    enrichStyle(ws, h, c, STYLE_TABLE_HEADER);
  }
}

export function generateAccountantWorkbookBase64(args: {
  payload: TaxSummaryExportPayload;
  review: Tax1099ReviewSummary;
  quickBooksCategoryMap: Partial<Record<TaxCategory, string>>;
}): string {
  const { payload, review, quickBooksCategoryMap } = args;
  const p = payload.portfolioSummary;
  const wb = XLSX.utils.book_new();
  const year = payload.selectedYear;

  const workbookGuide: [string, string][] = [
    ['Summary', 'Portfolio totals, disclaimers, and this guide.'],
    ['Projects', 'Project-level revenue, expenses, net income, receipts, and margin.'],
    ['Expenses', 'Transaction-level expenses. Vendor / description / notes are separate fields when provided in BPS.'],
    ['Revenue Payments', 'Collected payments / milestones by project for the tax year.'],
    ['Vendors', 'Vendor directory-style review from paid activity — informational only.'],
    ['Potential 1099 Review', 'Vendors flagged for Potential 1099 review — confirm with CPA.'],
    ['Receipt Backup Manifest', 'Receipt filenames and attachment status for backup workflows.'],
    [
      'Suggested Category Mapping',
      'Suggested accounting labels only — not final tax categories until confirmed with a CPA.',
    ],
  ];

  const summaryRows: (string | number | null | undefined)[][] = [
    ['BUILD PROFIT SOLUTIONS'],
    ['Accountant Workbook'],
    ['Tax-ready export · CPA review package · Project-first job costing'],
    [],
    [`Tax Year: ${year}`],
    [`Date Range: ${payload.dateRangeLabel}`],
    [`Generated: ${payload.generatedAtDisplay}`],
    [`Contractor contact: ${payload.contractorContactEmail?.trim() || 'Not set'}`],
    [],
    ['IMPORTANT TAX NOTICE'],
    [IMPORTANT_NOTICE_TEXT],
    [],
    ['PORTFOLIO SUMMARY'],
    ['Metric', 'Amount'],
    ['Revenue Collected', money2(p.revenueCollected)],
    ['Outstanding Receivables', money2(p.outstandingReceivables)],
    ['Expenses Paid', money2(p.expensesPaid)],
    ['Committed Costs', money2(p.committedCosts)],
    ['Net Income', money2(p.netIncome)],
    ['Net Margin', pctOrNa(p.netMargin)],
    ['Subcontractor Payments', money2(p.subcontractorPayments)],
    ['Receipt Count', p.receiptCount],
    [],
    ['WORKBOOK TABS (CPA PACKAGE)'],
    ...workbookGuide.map(([a, b]) => [a, b]),
    [],
    [FOOTER_NOTE],
    [],
    [cleanText(review.disclaimer)],
  ];
  const summaryWs = sheetFromAoA(summaryRows);
  applySummarySheetBasics(summaryWs);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const DATA_HEADER_ROW = 5;

  const projectRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Projects'],
    ['Project-level revenue, expenses, net income, receipt count, and margin for CPA review.'],
    [],
    ['Project', 'Revenue Collected', 'Outstanding', 'Expenses Paid', 'Net Income', 'Net Margin', 'Receipt Count'],
    ...payload.projectSummaries.map((r) => [
      cleanText(r.projectName, 'Not set'),
      money2(r.revenueCollected),
      money2(r.outstandingInvoices),
      money2(r.expensesPaid),
      money2(r.netIncome),
      pctOrNa(r.netMargin),
      r.receiptCount,
    ]),
  ];
  const projectWs = sheetFromAoA(projectRows);
  applyDataSheetPresentation(projectWs, DATA_HEADER_ROW, 7, [28, 18, 18, 18, 18, 14, 14]);
  XLSX.utils.book_append_sheet(wb, projectWs, 'Projects');

  const expenseTxnRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Expenses'],
    ['Transaction-level expenses for the selected tax year. Description is the expense line detail; Notes are separate user notes. Unknown fields show as blank or “Needs review”.'],
    [],
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
    ],
    ...payload.expenseTransactions.map((r) => [
      r.date,
      r.project,
      r.vendor,
      r.description,
      r.bpsCategory,
      r.accountingCategory,
      r.amount,
      r.paymentMethod,
      r.receiptAttached,
      r.receiptFileName,
      r.eligible1099,
      r.w9Status,
      r.notes,
    ]),
  ];
  const expenseWs = sheetFromAoA(expenseTxnRows);
  applyDataSheetPresentation(expenseWs, DATA_HEADER_ROW, 13, [14, 22, 22, 28, 16, 22, 14, 18, 16, 22, 22, 18, 28]);
  XLSX.utils.book_append_sheet(wb, expenseWs, 'Expenses');

  const revenueRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Revenue Payments'],
    ['Collected payments allocated to the tax year. Outstanding balance is project-level context when available.'],
    [],
    [
      'Date',
      'Project',
      'Customer',
      'Invoice / Milestone',
      'Amount Collected',
      'Payment Method',
      'Outstanding Balance',
      'Notes',
    ],
    ...payload.revenuePayments.map((r) => [
      r.date,
      r.project,
      r.customer,
      r.invoiceOrMilestone,
      r.amountCollected,
      r.paymentMethod,
      r.outstandingBalance,
      r.notes,
    ]),
  ];
  const revenueWs = sheetFromAoA(revenueRows);
  applyDataSheetPresentation(revenueWs, DATA_HEADER_ROW, 8, [14, 22, 22, 28, 18, 18, 22, 28]);
  XLSX.utils.book_append_sheet(wb, revenueWs, 'Revenue Payments');

  const vendorRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Vendors'],
    [
      'Review vendors, W-9 tracking, payment methods, and Potential 1099 review flags. Informational only — confirm with CPA.',
    ],
    [],
    [
      'Vendor',
      'Vendor Type',
      'Total Paid',
      'Projects',
      'Payment Method',
      'W-9 Status',
      'Potential 1099 Review',
      'Flags',
      'Actions / Notes',
    ],
    ...review.rows.map((r: Tax1099ReviewVendorRow) => [
      cleanText(r.displayName),
      r.vendorTypeBadge,
      format1099ReviewMoney(r.totalPaid),
      r.projects.length ? r.projects.join('; ') : 'Not set',
      vendorReviewPaymentMethod(r),
      vendorReviewW9Display(r),
      potential1099ReviewCell(r),
      vendorReviewFlags(r),
      humanizeActionList(r),
    ]),
  ];
  const vendorWs = sheetFromAoA(vendorRows);
  applyDataSheetPresentation(vendorWs, DATA_HEADER_ROW, 9, [26, 18, 16, 28, 22, 18, 22, 28, 36]);
  XLSX.utils.book_append_sheet(wb, vendorWs, 'Vendors');

  const p1099RowsFiltered = review.rows.filter((r) => r.actionNeeded.includes('Potential 1099 Review'));
  const p1099Rows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Potential 1099 Review'],
    ['Potential 1099 review — confirm eligibility and filing requirements with your CPA. Not tax advice.'],
    [],
    [
      'Vendor',
      'Vendor Type',
      'Total Paid',
      'Projects',
      'Payment Method',
      'W-9 Status',
      'Flags',
      'Notes',
    ],
    ...p1099RowsFiltered.map((r: Tax1099ReviewVendorRow) => [
      cleanText(r.displayName),
      r.vendorTypeBadge,
      format1099ReviewMoney(r.totalPaid),
      r.projects.length ? r.projects.join('; ') : 'Not set',
      vendorReviewPaymentMethod(r),
      vendorReviewW9Display(r),
      vendorReviewFlags(r),
      cleanText(r.informationalNote, 'Confirm with CPA.'),
    ]),
  ];
  const p1099Ws = sheetFromAoA(p1099Rows);
  applyDataSheetPresentation(p1099Ws, DATA_HEADER_ROW, 8, [26, 18, 16, 28, 22, 18, 28, 40]);
  XLSX.utils.book_append_sheet(wb, p1099Ws, 'Potential 1099 Review');

  const receiptManifestRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Receipt Backup Manifest'],
    ['Receipt filenames and attachment status. Retain originals outside BPS for your records.'],
    [],
    [
      'Receipt File Name',
      'Expense Date',
      'Vendor',
      'Amount',
      'Project',
      'Category',
      'Attached / Missing',
      'Notes',
    ],
    ...payload.receipts.map((r) => {
      const attached = (r.receiptUri || '').trim() ? 'Attached' : 'Missing';
      return [
        cleanText(r.receiptFileName, ''),
        formatWorkbookExpenseDate(r.date),
        cleanText(r.vendor, 'Not set'),
        money2(r.amount),
        cleanText(r.projectName),
        cleanText(r.category),
        attached,
        cleanText(r.notes, ''),
      ];
    }),
  ];
  const receiptWs = sheetFromAoA(receiptManifestRows);
  applyDataSheetPresentation(receiptWs, DATA_HEADER_ROW, 8, [28, 16, 24, 14, 22, 18, 18, 32]);
  XLSX.utils.book_append_sheet(wb, receiptWs, 'Receipt Backup Manifest');

  const accountingRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Suggested Category Mapping'],
    ['Suggested accounting labels only. Final category treatment should be confirmed with your CPA or tax professional.'],
    [],
    [
      'BPS Category',
      'Optional accounting label',
      'Suggested accounting category',
      'Status',
      'Notes',
    ],
    ...TAX_CATEGORIES.map((cat) => [
      cat,
      optionalUserAccountingLabel(quickBooksCategoryMap, cat) || '—',
      SUGGESTED_ACCOUNTING_CATEGORY[cat],
      mappingSheetStatus(quickBooksCategoryMap, cat),
      mappingSheetNotes(quickBooksCategoryMap, cat),
    ]),
  ];
  const mapWs = sheetFromAoA(accountingRows);
  applyDataSheetPresentation(mapWs, DATA_HEADER_ROW, 5, [22, 28, 32, 14, 44]);
  XLSX.utils.book_append_sheet(wb, mapWs, 'Suggested Category Mapping');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
