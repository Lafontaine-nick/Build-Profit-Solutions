/**
 * Accountant workbook (XLSX) for bookkeeping support only — not tax filing, not IRS submission.
 * Uses `xlsx-js-style` so bold, fills, and wrap persist in Excel / Numbers.
 */
import * as XLSX from 'xlsx-js-style';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import type { Tax1099ReviewSummary, Tax1099ReviewVendorRow } from '@/src/lib/tax1099Review';
import { format1099ReviewMoney } from '@/src/lib/tax1099Review';
import { TAX_CATEGORIES, type TaxCategory } from '@/src/lib/taxCenter';
import type { Vendor } from '@/src/lib/vendorTypes';

const BRAND = 'Build Profit Solutions';

const IMPORTANT_NOTICE_TEXT =
  'This workbook is for bookkeeping and tax-preparation support only. It is not tax advice, does not replace a CPA or tax professional, and is not an official tax filing or official 1099 form. Users are responsible for verifying all amounts, categories, receipts, vendor information, and tax treatment with their CPA or tax professional before filing.';

const FOOTER_NOTE =
  'Prepared from user-entered project, payment, expense, purchase order, vendor, W-9, accounting mapping, and receipt data in Build Profit Solutions.\n\nAmounts are based on data available for the selected tax year. Missing, incomplete, duplicated, or incorrectly categorized entries may affect this workbook.';

/** Excel theme-friendly fills (ARGB). */
const FILL_SECTION = { fgColor: { rgb: 'FFE5E7EB' } }; // light gray
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
const STYLE_SECTION_TITLE = {
  font: { bold: true, sz: 12, color: { rgb: 'FF0F172A' } },
  fill: FILL_SECTION,
  alignment: { vertical: 'center' as const },
};
const STYLE_WRAP = {
  alignment: { wrapText: true, vertical: 'top' as const },
};
const STYLE_TABLE_HEADER = {
  font: { bold: true, sz: 11, color: { rgb: 'FF0F172A' } },
  fill: FILL_HEADER,
  alignment: { vertical: 'center' as const },
};
const STYLE_CONTENT_DESC = {
  alignment: { wrapText: true, vertical: 'top' as const },
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

/** Branding: rows 1–3; blank row 4; table header row 5 (1-based). */
function applyFreezeAndFilter(ws: XLSX.WorkSheet, headerRow1Based: number, colCount: number) {
  const lastCol = XLSX.utils.encode_col(Math.max(0, colCount - 1));
  ws['!autofilter'] = { ref: `A${headerRow1Based}:${lastCol}1000` };
}

function accountingMappedLabel(map: Partial<Record<TaxCategory, string>>, cat: TaxCategory): string {
  const raw = map[cat];
  const t = typeof raw === 'string' ? raw.trim() : '';
  return t || 'Unmapped';
}

function accountingStatus(map: Partial<Record<TaxCategory, string>>, cat: TaxCategory): string {
  const raw = map[cat];
  const t = typeof raw === 'string' ? raw.trim() : '';
  return t ? 'Mapped' : 'Needs Review';
}

function accountingNotes(map: Partial<Record<TaxCategory, string>>, cat: TaxCategory): string {
  const t = typeof map[cat] === 'string' ? map[cat]!.trim() : '';
  return t
    ? 'Ready for export review'
    : 'Map this category before sending to bookkeeper or syncing later.';
}

function vendorEligibleForW9FollowUp(v: Vendor): boolean {
  if (v.vendorType === 'supplier' && !v.requires1099Review) return false;
  return (
    v.vendorType === 'subcontractor' ||
    v.vendorType === 'consultant' ||
    v.vendorType === 'other' ||
    v.requires1099Review === true
  );
}

function includeVendorInW9FollowUp(v: Vendor): boolean {
  if (!vendorEligibleForW9FollowUp(v)) return false;
  if (v.w9Status === 'not_applicable') return false;
  if (v.w9Status === 'verified') return false;
  return v.w9Status === 'missing' || v.w9Status === 'requested' || v.w9Status === 'uploaded';
}

function w9FollowUpActionNeeded(v: Vendor): string {
  switch (v.w9Status) {
    case 'missing':
      return 'Request W-9';
    case 'requested':
      return 'Follow up on requested W-9';
    case 'uploaded':
      return 'Review uploaded W-9';
    case 'verified':
      return 'No action';
    case 'not_applicable':
      return 'No action';
    default:
      return 'No action';
  }
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

function vendorReviewActionNeeded(row: Tax1099ReviewVendorRow): string {
  const a = String(row.workbookActionNeeded || '').trim();
  if (a && a !== '—') return a;
  const parts = row.actionNeeded.filter(Boolean);
  return parts.length ? parts.join('; ') : 'No action';
}

function applySummaryVisualPolish(ws: XLSX.WorkSheet) {
  applyCols(ws, [32, 70, 22, 22]);

  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  enrichStyle(ws, 2, 0, STYLE_BRAND_TAG);

  enrichStyle(ws, 9, 0, STYLE_SECTION_TITLE);
  mergeCols(ws, 10, 0, 3);
  enrichStyle(ws, 10, 0, STYLE_WRAP);

  enrichStyle(ws, 12, 0, STYLE_SECTION_TITLE);
  enrichStyle(ws, 13, 0, STYLE_TABLE_HEADER);
  enrichStyle(ws, 13, 1, STYLE_TABLE_HEADER);

  enrichStyle(ws, 23, 0, STYLE_SECTION_TITLE);
  for (let r = 24; r <= 29; r++) {
    enrichStyle(ws, r, 1, STYLE_CONTENT_DESC);
  }

  mergeCols(ws, 30, 0, 3);
  enrichStyle(ws, 30, 0, STYLE_WRAP);

  mergeCols(ws, 32, 0, 3);
  enrichStyle(ws, 32, 0, STYLE_WRAP);
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
  vendors: Vendor[];
  quickBooksCategoryMap: Partial<Record<TaxCategory, string>>;
}): string {
  const { payload, review, vendors, quickBooksCategoryMap } = args;
  const p = payload.portfolioSummary;
  const wb = XLSX.utils.book_new();
  const year = payload.selectedYear;

  const summaryRows: (string | number | null | undefined)[][] = [
    ['BUILD PROFIT SOLUTIONS'],
    ['Accountant Workbook'],
    ['Tax-ready bookkeeping package · CPA review support'],
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
    ['Net Margin', p.netMargin == null ? 'N/A' : pctOrNa(p.netMargin)],
    ['Subcontractor Payments', money2(p.subcontractorPayments)],
    ['Receipt Count', p.receiptCount],
    [],
    ['WORKBOOK CONTENTS'],
    [
      'Projects',
      'Project-level revenue, expenses, net income, receipt count, and margin for CPA or bookkeeper review.',
    ],
    [
      'Expense Categories',
      'Amounts by BPS tax category with optional QuickBooks / accounting labels.',
    ],
    [
      'Vendor & 1099 Review',
      'Vendors detected from paid activity for the tax year — informational only; review with your CPA.',
    ],
    ['Receipts', 'Receipt-linked expense lines with readable dates (no file paths).'],
    [
      'W-9 Follow-Up',
      'Directory vendors needing W-9 collection or review — informational only; not tax advice.',
    ],
    [
      'Accounting Mapping',
      'BPS categories mapped to your accounting system labels for export handoff.',
    ],
    [],
    [FOOTER_NOTE],
    [],
    [cleanText(review.disclaimer)],
  ];
  const summaryWs = sheetFromAoA(summaryRows);
  applySummaryVisualPolish(summaryWs);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const DATA_HEADER_ROW = 5;

  const projectRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Projects'],
    ['Project-level revenue, expenses, net income, receipt count, and margin for CPA/bookkeeper review.'],
    [],
    ['Project', 'Revenue Collected', 'Outstanding', 'Expenses Paid', 'Net Income', 'Net Margin', 'Receipt Count'],
    ...payload.projectSummaries.map((r) => [
      cleanText(r.projectName, 'Not set'),
      money2(r.revenueCollected),
      money2(r.outstandingInvoices),
      money2(r.expensesPaid),
      money2(r.netIncome),
      r.netMargin == null ? 'N/A' : pctOrNa(r.netMargin),
      r.receiptCount,
    ]),
  ];
  const projectWs = sheetFromAoA(projectRows);
  applyDataSheetPresentation(projectWs, DATA_HEADER_ROW, 7, [28, 18, 18, 18, 18, 14, 14]);
  XLSX.utils.book_append_sheet(wb, projectWs, 'Projects');

  const catRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Expense Categories'],
    ['Expense totals by BPS category with accounting / QuickBooks mapping labels when set.'],
    [],
    ['BPS Category', 'Accounting / QuickBooks Category', 'Amount', 'Item Count'],
    ...payload.expenseCategories.map((c) => {
      const acct = String(c.accountingOrQuickBooksCategory || '').trim();
      return [c.category, acct || 'Unmapped', money2(c.amount), c.itemCount];
    }),
  ];
  const catWs = sheetFromAoA(catRows);
  applyDataSheetPresentation(catWs, DATA_HEADER_ROW, 4, [28, 32, 18, 14]);
  XLSX.utils.book_append_sheet(wb, catWs, 'Expense Categories');

  const reviewRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Vendor & 1099 Review'],
    [
      'Vendors from paid activity for this tax year. Potential 1099 Review flags are informational — confirm with your CPA. Not tax advice.',
    ],
    [],
    [
      'Vendor',
      'Vendor Type',
      'Total Paid',
      'Payment Method',
      'W-9 Status',
      'Projects',
      'Flags',
      'Action Needed',
      'Informational Note',
    ],
    ...review.rows.map((r: Tax1099ReviewVendorRow) => [
      cleanText(r.displayName),
      r.vendorTypeBadge,
      format1099ReviewMoney(r.totalPaid),
      vendorReviewPaymentMethod(r),
      vendorReviewW9Display(r),
      r.projects.length ? r.projects.join('; ') : 'Not set',
      vendorReviewFlags(r),
      vendorReviewActionNeeded(r),
      cleanText(r.informationalNote, 'Informational only. Not tax advice.'),
    ]),
  ];
  const reviewWs = sheetFromAoA(reviewRows);
  applyDataSheetPresentation(reviewWs, DATA_HEADER_ROW, 9, [28, 18, 18, 20, 18, 28, 32, 32, 42]);
  XLSX.utils.book_append_sheet(wb, reviewWs, 'Vendor & 1099 Review');

  const receiptRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Receipts'],
    ['Expense lines with receipts for the selected tax year. Dates are shown in readable form; receipt URIs are not exported.'],
    [],
    ['Project', 'Expense Date', 'Month', 'Category', 'Vendor', 'Amount', 'Receipt Attached'],
    ...payload.receipts.map((r) => [
      cleanText(r.projectName),
      formatWorkbookExpenseDate(r.date),
      cleanText(r.month, 'Not set'),
      cleanText(r.category),
      cleanText(r.vendor, 'Not set'),
      money2(r.amount),
      (r.receiptUri || '').trim() ? 'Yes' : 'No',
    ]),
  ];
  const receiptWs = sheetFromAoA(receiptRows);
  applyDataSheetPresentation(receiptWs, DATA_HEADER_ROW, 7, [28, 18, 16, 20, 26, 16, 18]);
  XLSX.utils.book_append_sheet(wb, receiptWs, 'Receipts');

  const w9List = vendors.filter(includeVendorInW9FollowUp);
  const w9Rows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['W-9 Follow-Up'],
    [
      'Directory vendors that may need W-9 collection or review. Informational only — confirm with your CPA or bookkeeper.',
    ],
    [],
    ['Business Name', 'Legal Name', 'Vendor Type', 'W-9 Status', 'Email', 'Phone', 'Action Needed', 'Notes'],
    ...w9List.map((v) => [
      cleanText(v.businessName),
      cleanText(v.legalName, 'Not set'),
      v.vendorType,
      v.w9Status,
      cleanText(v.email, 'Not set'),
      cleanText(v.phone, 'Not set'),
      w9FollowUpActionNeeded(v),
      cleanText(v.notes, 'Not set'),
    ]),
  ];
  const w9Ws = sheetFromAoA(w9Rows);
  applyDataSheetPresentation(w9Ws, DATA_HEADER_ROW, 8, [28, 28, 18, 18, 28, 18, 32, 36]);
  XLSX.utils.book_append_sheet(wb, w9Ws, 'W-9 Follow-Up');

  const accountingRows: (string | number | null | undefined)[][] = [
    [BRAND],
    ['Accounting Mapping'],
    ['Map each BPS expense category to your accounting system before handoff to your bookkeeper.'],
    [],
    ['BPS Category', 'Accounting / QuickBooks Category', 'Status', 'Notes'],
    ...TAX_CATEGORIES.map((cat) => [
      cat,
      accountingMappedLabel(quickBooksCategoryMap, cat),
      accountingStatus(quickBooksCategoryMap, cat),
      accountingNotes(quickBooksCategoryMap, cat),
    ]),
  ];
  const mapWs = sheetFromAoA(accountingRows);
  applyDataSheetPresentation(mapWs, DATA_HEADER_ROW, 4, [28, 36, 18, 40]);
  XLSX.utils.book_append_sheet(wb, mapWs, 'Accounting Mapping');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
