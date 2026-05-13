/**
 * Accountant workbook (XLSX) for bookkeeping support only — not tax filing, not IRS submission.
 * Uses `xlsx-js-style` so bold, fills, and wrap persist in Excel / Numbers.
 */
import * as XLSX from 'xlsx-js-style';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import type { Tax1099ReviewSummary, Tax1099ReviewVendorRow } from '@/src/lib/tax1099Review';
import type { Vendor } from '@/src/lib/vendorTypes';
import { format1099ReviewMoney } from '@/src/lib/tax1099Review';
import { TAX_CATEGORIES, type TaxCategory } from '@/src/lib/taxCenter';
import {
  SUGGESTED_ACCOUNTING_CATEGORY,
  SUGGESTED_CATEGORY_CONFIRM_NOTE,
} from '@/src/lib/taxSuggestedAccountingCategories';
import {
  POTENTIAL_1099_REVIEW_EXPLANATION,
  TAX_CENTER_METHODOLOGY_BODY,
  TAX_CENTER_METHODOLOGY_TITLE,
} from '@/src/lib/taxCenterMethodologyCopy';

const BRAND = 'Build Profit Solutions';

const IMPORTANT_NOTICE_TEXT =
  'Tax Center reports are for bookkeeping and tax-preparation support only. They are not tax advice, do not replace a CPA or tax professional, and are not official tax filings or official 1099 forms. Verify all amounts, categories, receipts, vendors, and tax treatment before filing.';

const FOOTER_NOTE =
  'Prepared from user-entered project, payment, expense, purchase order, subcontractor, and receipt data in Build Profit Solutions.\n\nAmounts are based on data available in Build Profit Solutions for the selected tax year. Missing, incomplete, or incorrectly categorized entries may affect this workbook.';

/**
 * CPA Summary PDF palette (`taxCenterExport` inline HTML). Excel uses AARRGGBB with leading FF.
 * @see buildTaxSummaryHtml in taxCenterExport.ts
 */
const PDF = {
  teal500: 'FF14B8A6',
  teal600: 'FF0D9488',
  teal700: 'FF0F766E',
  slate900: 'FF0F172A',
  slate800: 'FF1E293B',
  slate700: 'FF334155',
  slate600: 'FF475569',
  slate500: 'FF64748B',
  white: 'FFFFFFFF',
  rowEven: 'FFFFFFFF',
  rowOdd: 'FFFAFBFC',
  border: 'FFE5E7EB',
  borderLight: 'FFF1F5F9',
  cellLine: 'FFEEF0F3',
  amberFill: 'FFFEF3C7',
  amberFill2: 'FFFFFbeb',
  amberText: 'FF451A03',
  amberTitle: 'FF92400E',
  blueFill: 'FFEFF6FF',
  blueTitle: 'FF1E40AF',
  blueText: 'FF1E3A8A',
  redNeg: 'FFDC2626',
  headerWrap: 'FFFAFAFA',
  /** Alternating table body (more visible than white / #fafbfc in Excel & Numbers). */
  rowZebraB: 'FFF1F5F9',
  /** PDF Important Tax Notice left accent (`#d97706`). */
  amberBorder: 'FFD97706',
  /** PDF Report Methodology left accent (`#2563eb`). */
  blueBorder: 'FF2563EB',
} as const;

const BORDER_BODY_H = {
  bottom: { style: 'thin' as const, color: { rgb: PDF.cellLine } },
};

const BORDER_NOTICE = {
  left: { style: 'thick' as const, color: { rgb: PDF.amberBorder } },
  top: { style: 'thin' as const, color: { rgb: 'FFFBBF24' } },
  right: { style: 'thin' as const, color: { rgb: 'FFFBBF24' } },
  bottom: { style: 'thin' as const, color: { rgb: 'FFFBBF24' } },
};

const BORDER_METH = {
  left: { style: 'thick' as const, color: { rgb: PDF.blueBorder } },
  top: { style: 'thin' as const, color: { rgb: 'FF60A5FA' } },
  right: { style: 'thin' as const, color: { rgb: 'FF60A5FA' } },
  bottom: { style: 'thin' as const, color: { rgb: 'FF60A5FA' } },
};

const STYLE_SECTION_TITLE = {
  font: { bold: true, sz: 15, color: { rgb: PDF.slate900 } },
  fill: { fgColor: { rgb: PDF.white } },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: {
    bottom: { style: 'thick' as const, color: { rgb: PDF.teal500 } },
    top: { style: 'thin' as const, color: { rgb: PDF.border } },
    left: { style: 'thin' as const, color: { rgb: PDF.border } },
    right: { style: 'thin' as const, color: { rgb: PDF.border } },
  },
};
const BORDER_THIN = {
  top: { style: 'thin' as const, color: { rgb: PDF.border } },
  bottom: { style: 'thin' as const, color: { rgb: PDF.border } },
  left: { style: 'thin' as const, color: { rgb: PDF.border } },
  right: { style: 'thin' as const, color: { rgb: PDF.border } },
};

const BORDER_HEADER_BOTTOM = {
  bottom: { style: 'thin' as const, color: { rgb: PDF.teal600 } },
  top: { style: 'thin' as const, color: { rgb: PDF.teal600 } },
  left: { style: 'thin' as const, color: { rgb: PDF.teal600 } },
  right: { style: 'thin' as const, color: { rgb: PDF.teal600 } },
};

const STYLE_BRAND_MAIN = {
  font: { bold: true, sz: 12, color: { rgb: PDF.teal700 } },
  alignment: { vertical: 'center' as const },
  border: {
    left: { style: 'medium' as const, color: { rgb: PDF.teal500 } },
    top: { style: 'thick' as const, color: { rgb: PDF.teal500 } },
    bottom: { style: 'thin' as const, color: { rgb: PDF.border } },
    right: { style: 'thin' as const, color: { rgb: PDF.border } },
  },
  fill: { fgColor: { rgb: PDF.headerWrap } },
};
const STYLE_BRAND_SUB = {
  font: { bold: true, sz: 20, color: { rgb: PDF.slate900 } },
  alignment: { vertical: 'center' as const },
  border: {
    left: { style: 'medium' as const, color: { rgb: PDF.teal500 } },
    bottom: { style: 'thin' as const, color: { rgb: PDF.border } },
    right: { style: 'thin' as const, color: { rgb: PDF.border } },
  },
  fill: { fgColor: { rgb: PDF.white } },
};
const STYLE_BRAND_TAG = {
  font: { bold: true, sz: 11, color: { rgb: PDF.slate600 } },
  alignment: { vertical: 'top' as const, wrapText: true },
  border: {
    left: { style: 'medium' as const, color: { rgb: PDF.teal500 } },
    bottom: { style: 'thick' as const, color: { rgb: PDF.teal500 } },
    right: { style: 'thin' as const, color: { rgb: PDF.border } },
  },
  fill: { fgColor: { rgb: PDF.white } },
};
/** Matches PDF `<th>`: teal background, white text. */
const STYLE_TABLE_HEADER = {
  font: { bold: true, sz: 10, color: { rgb: PDF.white } },
  fill: { fgColor: { rgb: PDF.teal700 } },
  alignment: { vertical: 'center' as const, horizontal: 'left' as const, wrapText: true },
  border: BORDER_HEADER_BOTTOM,
};

const STYLE_BODY_CELL = {
  font: { sz: 11, color: { rgb: PDF.slate800 } },
  alignment: { vertical: 'top' as const, wrapText: true },
  border: BORDER_BODY_H,
};

const STYLE_NOTICE_TITLE = {
  font: { bold: true, sz: 10, color: { rgb: PDF.amberTitle } },
  fill: { fgColor: { rgb: PDF.amberFill } },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: BORDER_NOTICE,
};
const STYLE_NOTICE_BODY = {
  font: { sz: 11, color: { rgb: PDF.amberText } },
  fill: { fgColor: { rgb: PDF.amberFill2 } },
  alignment: { vertical: 'top' as const, wrapText: true },
  border: BORDER_NOTICE,
};

const STYLE_METH_TITLE = {
  font: { bold: true, sz: 10, color: { rgb: PDF.blueTitle } },
  fill: { fgColor: { rgb: PDF.blueFill } },
  alignment: { vertical: 'center' as const, wrapText: true },
  border: BORDER_METH,
};
const STYLE_METH_BODY = {
  font: { sz: 11, color: { rgb: PDF.blueText } },
  fill: { fgColor: { rgb: PDF.blueFill } },
  alignment: { vertical: 'top' as const, wrapText: true },
  border: BORDER_METH,
};

/** Workbook tabs band — same teal header treatment as PDF data tables. */
const STYLE_WORKBOOK_BAND = {
  font: { bold: true, sz: 10, color: { rgb: PDF.white } },
  fill: { fgColor: { rgb: PDF.teal700 } },
  alignment: { vertical: 'center' as const, horizontal: 'left' as const, wrapText: true },
  border: BORDER_HEADER_BOTTOM,
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
  const lastC = 3;
  mergeCols(ws, 0, 0, lastC);
  mergeCols(ws, 1, 0, lastC);
  mergeCols(ws, 2, 0, lastC);
  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  enrichStyle(ws, 2, 0, STYLE_BRAND_TAG);
}

/** Methodology sheet: single-column prose; match PDF “mapping / methodology” blue card. */
function applyMethodologySheetStyles(ws: XLSX.WorkSheet) {
  applyCols(ws, [92]);
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  mergeCols(ws, 0, 0, 0);
  enrichStyle(ws, 0, 0, {
    ...STYLE_BRAND_MAIN,
    alignment: { vertical: 'center', wrapText: true },
  });
  for (let r = 1; r <= range.e.r; r++) {
    const v = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (v == null || v === '') continue;
    mergeCols(ws, r, 0, 0);
    const isTitle = String(v) === TAX_CENTER_METHODOLOGY_TITLE;
    enrichStyle(ws, r, 0, isTitle ? STYLE_METH_TITLE : STYLE_METH_BODY);
  }
}

function applyZebraDataRows(ws: XLSX.WorkSheet, firstDataRow1Based: number, colCount: number) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const start0 = firstDataRow1Based - 1;
  if (start0 > range.e.r) return;
  for (let r = start0; r <= range.e.r; r++) {
    const stripeOdd = (r - start0) % 2 === 1;
    const bg = stripeOdd ? PDF.rowZebraB : PDF.rowEven;
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      enrichStyle(ws, r, c, {
        fill: { fgColor: { rgb: bg } },
        font: STYLE_BODY_CELL.font,
        alignment: STYLE_BODY_CELL.alignment,
        border: BORDER_BODY_H,
      });
    }
  }
}

/** PDF “Report details” strip — Tax Year / Generated / contractor rows. */
function styleSummaryMetadataBlock(ws: XLSX.WorkSheet) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxC = Math.min(range.e.c, 3);
  const probe = ws[XLSX.utils.encode_cell({ r: 4, c: 0 })]?.v;
  if (typeof probe !== 'string' || !probe.includes('Tax Year')) return;
  for (let r = 4; r <= 7; r++) {
    if (r > range.e.r) break;
    const v = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (v == null || v === '') continue;
    mergeCols(ws, r, 0, maxC);
    const stripe = (r - 4) % 2 === 0 ? PDF.headerWrap : PDF.white;
    enrichStyle(ws, r, 0, {
      font: { sz: 11, color: { rgb: PDF.slate600 } },
      fill: { fgColor: { rgb: stripe } },
      alignment: { vertical: 'center', wrapText: true },
      border: BORDER_BODY_H,
    });
  }
}

/** Important notice, Portfolio Summary block, workbook guide, and footer note — aligned with CPA PDF. */
function styleSummaryImportantAndPortfolio(ws: XLSX.WorkSheet) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxC = Math.min(range.e.c, 3);
  for (let r = 0; r <= range.e.r; r++) {
    const a = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (a === 'IMPORTANT TAX NOTICE') {
      mergeCols(ws, r, 0, maxC);
      enrichStyle(ws, r, 0, STYLE_NOTICE_TITLE);
      if (r + 1 <= range.e.r) {
        mergeCols(ws, r + 1, 0, maxC);
        enrichStyle(ws, r + 1, 0, STYLE_NOTICE_BODY);
      }
    }
    if (a === 'Portfolio Summary') {
      mergeCols(ws, r, 0, maxC);
      enrichStyle(ws, r, 0, STYLE_SECTION_TITLE);
      const hdr = r + 1;
      enrichStyle(ws, hdr, 0, STYLE_TABLE_HEADER);
      enrichStyle(ws, hdr, 1, {
        ...STYLE_TABLE_HEADER,
        alignment: { vertical: 'center', horizontal: 'right', wrapText: true },
      });
      let rr = hdr + 1;
      while (rr <= range.e.r) {
        const lab = ws[XLSX.utils.encode_cell({ r: rr, c: 0 })]?.v;
        if (lab === 'WORKBOOK TABS (CPA PACKAGE)') break;
        if (lab === undefined || lab === '') break;
        const zebra = (rr - hdr - 1) % 2 === 1 ? PDF.rowZebraB : PDF.rowEven;
        enrichStyle(ws, rr, 0, {
          fill: { fgColor: { rgb: zebra } },
          font: { sz: 11, color: { rgb: PDF.slate800 }, bold: false },
          alignment: { vertical: 'center', wrapText: true },
          border: BORDER_BODY_H,
        });
        enrichStyle(ws, rr, 1, {
          fill: { fgColor: { rgb: zebra } },
          font: { sz: 11, color: { rgb: PDF.slate900 }, bold: true },
          alignment: { vertical: 'center', wrapText: true, horizontal: 'right' },
          border: BORDER_BODY_H,
        });
        rr++;
      }
    }
    if (a === 'WORKBOOK TABS (CPA PACKAGE)') {
      mergeCols(ws, r, 0, maxC);
      enrichStyle(ws, r, 0, STYLE_WORKBOOK_BAND);
      let rr = r + 1;
      while (rr <= range.e.r) {
        const c0 = ws[XLSX.utils.encode_cell({ r: rr, c: 0 })]?.v;
        const c1 = ws[XLSX.utils.encode_cell({ r: rr, c: 1 })]?.v;
        if (typeof c0 === 'string' && c0.startsWith('Prepared from')) break;
        if (c0 == null && c1 == null) {
          rr++;
          continue;
        }
        if (c0 === '' && !c1) {
          rr++;
          continue;
        }
        const zebra = (rr - r - 1) % 2 === 1 ? PDF.rowZebraB : PDF.rowEven;
        enrichStyle(ws, rr, 0, {
          fill: { fgColor: { rgb: zebra } },
          font: { sz: 10, color: { rgb: PDF.slate800 }, bold: true },
          alignment: { vertical: 'top', wrapText: true },
          border: BORDER_BODY_H,
        });
        enrichStyle(ws, rr, 1, {
          fill: { fgColor: { rgb: zebra } },
          font: { sz: 10, color: { rgb: PDF.slate600 } },
          alignment: { vertical: 'top', wrapText: true },
          border: BORDER_BODY_H,
        });
        rr++;
      }
    }
  }
}

function styleSummaryFooterPrepared(ws: XLSX.WorkSheet) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxC = Math.min(range.e.c, 3);
  for (let r = 0; r <= range.e.r; r++) {
    const v = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (typeof v === 'string' && v.startsWith('Prepared from')) {
      mergeCols(ws, r, 0, maxC);
      enrichStyle(ws, r, 0, {
        font: { sz: 10, color: { rgb: PDF.slate600 }, italic: true },
        fill: { fgColor: { rgb: PDF.rowOdd } },
        alignment: { wrapText: true, vertical: 'top' },
        border: BORDER_BODY_H,
      });
      break;
    }
  }
}

function styleSummaryFooterDisclaimer(ws: XLSX.WorkSheet) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxC = Math.min(range.e.c, 3);
  for (let r = range.e.r; r >= 0; r--) {
    const v = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (typeof v === 'string' && v.toLowerCase().includes('informational only')) {
      mergeCols(ws, r, 0, maxC);
      enrichStyle(ws, r, 0, {
        font: { sz: 10, color: { rgb: PDF.slate500 }, italic: true },
        fill: { fgColor: { rgb: PDF.rowOdd } },
        alignment: { wrapText: true, vertical: 'top' },
        border: BORDER_THIN,
      });
      break;
    }
  }
}

function applyDataSheetPresentation(ws: XLSX.WorkSheet, headerRow1Based: number, colCount: number, widths: number[]) {
  applyCols(ws, widths);
  applyFreezeAndFilter(ws, headerRow1Based, colCount);
  const lastC = Math.max(0, colCount - 1);
  mergeCols(ws, 0, 0, lastC);
  mergeCols(ws, 1, 0, lastC);
  mergeCols(ws, 2, 0, lastC);
  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  enrichStyle(ws, 2, 0, STYLE_BRAND_TAG);
  const h = headerRow1Based - 1;
  for (let c = 0; c < colCount; c++) {
    const hc = XLSX.utils.encode_cell({ r: h, c });
    const cell = ws[hc] as { v?: unknown } | undefined;
    const raw = String(cell?.v ?? '').toUpperCase();
    const alignRight =
      raw.includes('AMOUNT') ||
      raw.includes('COLLECTED') ||
      raw.includes('ITEM COUNT') ||
      raw.includes('MARGIN') ||
      raw.includes('RECEIPT') ||
      (raw.includes('COUNT') && !raw.includes('ACCOUNT'));
    enrichStyle(ws, h, c, {
      ...STYLE_TABLE_HEADER,
      alignment: { vertical: 'center', horizontal: alignRight ? 'right' : 'left', wrapText: true },
    });
  }
  applyZebraDataRows(ws, headerRow1Based + 1, colCount);
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
    ['Methodology', 'Cash basis methodology, receivables/commitments context, and CPA disclaimers.'],
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
    ['Portfolio Summary'],
    ['METRIC', 'AMOUNT'],
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
  styleSummaryMetadataBlock(summaryWs);
  styleSummaryImportantAndPortfolio(summaryWs);
  styleSummaryFooterPrepared(summaryWs);
  styleSummaryFooterDisclaimer(summaryWs);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  const methodologyRows: (string | number | null | undefined)[][] = [
    [BRAND],
    [TAX_CENTER_METHODOLOGY_TITLE],
    [],
    ...TAX_CENTER_METHODOLOGY_BODY.split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => [p]),
    [],
    [POTENTIAL_1099_REVIEW_EXPLANATION],
  ];
  const methodologyWs = sheetFromAoA(methodologyRows);
  applyMethodologySheetStyles(methodologyWs);
  XLSX.utils.book_append_sheet(wb, methodologyWs, 'Methodology');

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

  const receiptDataRows = payload.receipts.map((r) => {
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
  });
  const hasReceiptRows = receiptDataRows.length > 0;
  const receiptFooterCombined = `${RECEIPT_MANIFEST_FOOTER_PREPARED}\n\n${RECEIPT_MANIFEST_FOOTER_ORIGINAL}`;
  const receiptManifestRows: (string | number | null | undefined)[][] = [
    ['BUILD PROFIT SOLUTIONS'],
    ['Receipt Backup Manifest'],
    ['Receipt filenames and attachment status. Retain originals outside BPS for your records.'],
    [],
    ['Tax Year', String(year)],
    ['Date Range', payload.dateRangeLabel],
    ['Generated', payload.generatedAtDisplay],
    ['Contractor contact', payload.contractorContactEmail?.trim() || 'Not set'],
    [],
    ['IMPORTANT TAX NOTICE'],
    [IMPORTANT_NOTICE_TEXT],
    [],
    ['Receipt Lines'],
    [
      'RECEIPT FILE NAME',
      'EXPENSE DATE',
      'VENDOR',
      'AMOUNT',
      'PROJECT',
      'CATEGORY',
      'ATTACHED / MISSING',
      'NOTES',
    ],
    ...receiptDataRows,
  ];
  if (!hasReceiptRows) {
    receiptManifestRows.push(['No receipt-backed expense lines found for this tax year.']);
  }
  receiptManifestRows.push([]);
  receiptManifestRows.push([receiptFooterCombined]);
  const receiptWs = sheetFromAoA(receiptManifestRows);
  const receiptLastCol = RECEIPT_MANIFEST_COL_COUNT - 1;
  const receiptHeaderRow0 = 13;
  const receiptDataStart0 = 14;
  const receiptFooterRow0 = receiptDataStart0 + (hasReceiptRows ? receiptDataRows.length : 1) + 1;
  applyReceiptManifestPresentation(receiptWs, {
    lastCol: receiptLastCol,
    metaStartRow0: 4,
    metaEndRow0: 7,
    noticeTitleRow0: 9,
    noticeBodyRow0: 10,
    sectionRow0: 12,
    headerRow0: receiptHeaderRow0,
    dataStart0: receiptDataStart0,
    hasRealData: hasReceiptRows,
    dataRowCount: receiptDataRows.length,
    methTitle0: null,
    methParaCount: 0,
    footerPreparedRow0: receiptFooterRow0,
  });
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

const VENDOR_REVIEW_COL_COUNT = 12;

function applyCpaVendorReviewPresentation(
  ws: XLSX.WorkSheet,
  opts: {
    lastCol: number;
    metaStartRow0: number;
    metaEndRow0: number;
    noticeTitleRow0: number;
    noticeBodyRow0: number;
    sectionRow0: number;
    headerRow0: number;
    dataStart0: number;
    hasRealData: boolean;
    dataRowCount: number;
    methTitle0: number;
    methParaCount: number;
    footerPreparedRow0: number;
  }
) {
  const {
    lastCol,
    metaStartRow0,
    metaEndRow0,
    noticeTitleRow0,
    noticeBodyRow0,
    sectionRow0,
    headerRow0,
    dataStart0,
    hasRealData,
    dataRowCount,
    methTitle0,
    methParaCount,
    footerPreparedRow0,
  } = opts;
  applyCols(ws, [16, 18, 24, 16, 14, 14, 14, 28, 24, 14, 22, 44]);

  for (const r of [0, 1, 2]) {
    mergeCols(ws, r, 0, lastCol);
  }
  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  enrichStyle(ws, 2, 0, STYLE_BRAND_TAG);

  /** CPA PDF–style report details: label (col A) + value (merged B–last). */
  for (let r = metaStartRow0; r <= metaEndRow0; r++) {
    mergeCols(ws, r, 1, lastCol);
    const stripe = (r - metaStartRow0) % 2 === 0 ? PDF.headerWrap : PDF.white;
    enrichStyle(ws, r, 0, {
      font: { bold: true, sz: 11, color: { rgb: PDF.slate600 } },
      fill: { fgColor: { rgb: stripe } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: BORDER_BODY_H,
    });
    enrichStyle(ws, r, 1, {
      font: { bold: true, sz: 11, color: { rgb: PDF.slate900 } },
      fill: { fgColor: { rgb: stripe } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: BORDER_BODY_H,
    });
  }

  mergeCols(ws, noticeTitleRow0, 0, lastCol);
  enrichStyle(ws, noticeTitleRow0, 0, STYLE_NOTICE_TITLE);
  mergeCols(ws, noticeBodyRow0, 0, lastCol);
  enrichStyle(ws, noticeBodyRow0, 0, STYLE_NOTICE_BODY);

  mergeCols(ws, sectionRow0, 0, lastCol);
  enrichStyle(ws, sectionRow0, 0, STYLE_SECTION_TITLE);

  for (let c = 0; c <= lastCol; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow0, c })] as { v?: unknown } | undefined;
    const raw = String(cell?.v ?? '').toUpperCase();
    const alignRight =
      raw.includes('TOTAL PAID') || raw.includes('AMOUNT') || raw.includes('PAID (SELECTED');
    enrichStyle(ws, headerRow0, c, {
      ...STYLE_TABLE_HEADER,
      alignment: { vertical: 'center', horizontal: alignRight ? 'right' : 'left', wrapText: true },
    });
  }

  if (!hasRealData) {
    mergeCols(ws, dataStart0, 0, lastCol);
    enrichStyle(ws, dataStart0, 0, {
      font: { sz: 11, color: { rgb: PDF.slate500 }, italic: true },
      fill: { fgColor: { rgb: PDF.rowOdd } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: BORDER_BODY_H,
    });
  } else {
    const dataEnd0 = dataStart0 + Math.max(0, dataRowCount) - 1;
    for (let r = dataStart0; r <= dataEnd0; r++) {
      const stripe = (r - dataStart0) % 2 === 1 ? PDF.rowZebraB : PDF.rowEven;
      for (let c = 0; c <= lastCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        const alignRight = c === 3;
        enrichStyle(ws, r, c, {
          fill: { fgColor: { rgb: stripe } },
          font: { sz: 11, color: { rgb: PDF.slate800 }, bold: c === 3 },
          alignment: { vertical: 'top', wrapText: true, horizontal: alignRight ? 'right' : 'left' },
          border: BORDER_BODY_H,
        });
      }
    }
  }

  mergeCols(ws, methTitle0, 0, lastCol);
  enrichStyle(ws, methTitle0, 0, STYLE_SECTION_TITLE);
  for (let i = 0; i < methParaCount; i++) {
    const r = methTitle0 + 1 + i;
    mergeCols(ws, r, 0, lastCol);
    enrichStyle(ws, r, 0, STYLE_METH_BODY);
  }

  mergeCols(ws, footerPreparedRow0, 0, lastCol);
  enrichStyle(ws, footerPreparedRow0, 0, {
    font: { sz: 10, color: { rgb: PDF.slate600 }, italic: true },
    fill: { fgColor: { rgb: PDF.rowOdd } },
    alignment: { wrapText: true, vertical: 'top' },
    border: BORDER_BODY_H,
  });

  applyFreezeAndFilter(ws, headerRow0 + 1, VENDOR_REVIEW_COL_COUNT);
}

/** Styled XLSX (Excel / Numbers) — CSV cannot carry CPA PDF-style fills and borders. */
export function generateCpaVendorReviewXlsxBase64(args: {
  payload: TaxSummaryExportPayload;
  review: Tax1099ReviewSummary;
  vendors: Vendor[];
}): string {
  const { payload, review, vendors } = args;
  const year = payload.selectedYear;
  const lastCol = VENDOR_REVIEW_COL_COUNT - 1;

  const headers = [
    'VENDOR/SUBCONTRACTOR NAME',
    'BUSINESS NAME',
    'PROJECT NAME(S)',
    'TOTAL PAID (SELECTED YEAR)',
    'PAYMENT METHOD',
    'W-9 STATUS',
    'TAX CLASSIFICATION',
    'ADDRESS',
    'EMAIL',
    'PHONE',
    'POTENTIAL 1099 REVIEW',
    'NOTES FOR CPA',
  ];

  const dataRows = review.rows.map((r) => {
    const v = r.vendorId ? vendors.find((x) => x.id === r.vendorId) : undefined;
    const addr = v
      ? [v.address, v.city && v.state ? `${v.city}, ${v.state}` : v.city || v.state].filter(Boolean).join(' · ')
      : '';
    const p1099 = r.actionNeeded.includes('Potential 1099 Review') ? 'Yes — confirm with CPA' : 'No';
    const notes = [...r.actionNeeded, r.informationalNote].filter(Boolean).join(' | ');
    return [
      cleanText(r.displayName),
      cleanText(v?.businessName || r.displayName),
      r.projects.length ? r.projects.join('; ') : '—',
      money2(r.totalPaid),
      r.paymentMethodDisplay === '—' ? 'Not set' : r.paymentMethodDisplay,
      r.w9StatusDisplay,
      r.vendorTypeBadge,
      addr || '—',
      v?.email || '—',
      v?.phone || '—',
      p1099,
      notes || '—',
    ];
  });

  const methParas = TAX_CENTER_METHODOLOGY_BODY.split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const noticeBodyText = `${POTENTIAL_1099_REVIEW_EXPLANATION}\n\n${review.disclaimer}`;

  const hasRealData = dataRows.length > 0;
  const sheetRows: (string | number | null | undefined)[][] = [
    ['BUILD PROFIT SOLUTIONS'],
    ['CPA Vendor / Subcontractor Review (informational)'],
    ['Informational vendor list · Potential 1099 screening · Not official 1099 forms'],
    [],
    ['Tax Year', String(year)],
    ['Date Range', payload.dateRangeLabel],
    ['Generated', payload.generatedAtDisplay],
    ['Contractor contact', payload.contractorContactEmail?.trim() || 'Not set'],
    [],
    ['IMPORTANT TAX NOTICE'],
    [noticeBodyText],
    [],
    ['Vendor List'],
    headers,
    ...dataRows,
  ];

  if (!hasRealData) {
    sheetRows.push(['No vendor payment records found for this tax year.']);
  }

  sheetRows.push([]);
  sheetRows.push([TAX_CENTER_METHODOLOGY_TITLE]);
  for (const p of methParas) {
    sheetRows.push([p]);
  }
  sheetRows.push([]);
  sheetRows.push([FOOTER_NOTE]);

  const ws = sheetFromAoA(sheetRows);
  const metaStartRow0 = 4;
  const metaEndRow0 = 7;
  const noticeTitleRow0 = 9;
  const noticeBodyRow0 = 10;
  const sectionRow0 = 12;
  const headerRow0 = 13;
  const dataStart0 = 14;
  const methTitle0 = dataStart0 + (hasRealData ? dataRows.length : 1) + 1;
  const footerPreparedRow0 = methTitle0 + methParas.length + 2;

  applyCpaVendorReviewPresentation(ws, {
    lastCol,
    metaStartRow0,
    metaEndRow0,
    noticeTitleRow0,
    noticeBodyRow0,
    sectionRow0,
    headerRow0,
    dataStart0,
    hasRealData,
    dataRowCount: dataRows.length,
    methTitle0,
    methParaCount: methParas.length,
    footerPreparedRow0,
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendor Review');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

const RECEIPT_MANIFEST_COL_COUNT = 8;

const RECEIPT_MANIFEST_FOOTER_PREPARED =
  'Prepared from user-entered expense and receipt data in Build Profit Solutions.';

const RECEIPT_MANIFEST_FOOTER_ORIGINAL =
  'Original receipt files should be retained by the user and reviewed with their CPA or tax professional.';

function applyReceiptManifestPresentation(
  ws: XLSX.WorkSheet,
  opts: {
    lastCol: number;
    metaStartRow0: number;
    metaEndRow0: number;
    noticeTitleRow0: number;
    noticeBodyRow0: number;
    sectionRow0: number;
    headerRow0: number;
    dataStart0: number;
    hasRealData: boolean;
    dataRowCount: number;
    methTitle0: number | null;
    methParaCount: number;
    footerPreparedRow0: number;
  }
) {
  const {
    lastCol,
    metaStartRow0,
    metaEndRow0,
    noticeTitleRow0,
    noticeBodyRow0,
    sectionRow0,
    headerRow0,
    dataStart0,
    hasRealData,
    dataRowCount,
    methTitle0,
    methParaCount,
    footerPreparedRow0,
  } = opts;
  applyCols(ws, [26, 16, 24, 14, 22, 16, 18, 36]);

  for (const r of [0, 1, 2]) {
    mergeCols(ws, r, 0, lastCol);
  }
  enrichStyle(ws, 0, 0, STYLE_BRAND_MAIN);
  enrichStyle(ws, 1, 0, STYLE_BRAND_SUB);
  enrichStyle(ws, 2, 0, STYLE_BRAND_TAG);

  for (let r = metaStartRow0; r <= metaEndRow0; r++) {
    mergeCols(ws, r, 1, lastCol);
    const stripe = (r - metaStartRow0) % 2 === 0 ? PDF.headerWrap : PDF.white;
    enrichStyle(ws, r, 0, {
      font: { bold: true, sz: 11, color: { rgb: PDF.slate600 } },
      fill: { fgColor: { rgb: stripe } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: BORDER_BODY_H,
    });
    enrichStyle(ws, r, 1, {
      font: { bold: true, sz: 11, color: { rgb: PDF.slate900 } },
      fill: { fgColor: { rgb: stripe } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: BORDER_BODY_H,
    });
  }

  mergeCols(ws, noticeTitleRow0, 0, lastCol);
  enrichStyle(ws, noticeTitleRow0, 0, STYLE_NOTICE_TITLE);
  mergeCols(ws, noticeBodyRow0, 0, lastCol);
  enrichStyle(ws, noticeBodyRow0, 0, STYLE_NOTICE_BODY);

  mergeCols(ws, sectionRow0, 0, lastCol);
  enrichStyle(ws, sectionRow0, 0, STYLE_SECTION_TITLE);

  for (let c = 0; c <= lastCol; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow0, c })] as { v?: unknown } | undefined;
    const raw = String(cell?.v ?? '').toUpperCase();
    const alignRight = raw.includes('AMOUNT');
    enrichStyle(ws, headerRow0, c, {
      ...STYLE_TABLE_HEADER,
      alignment: { vertical: 'center', horizontal: alignRight ? 'right' : 'left', wrapText: true },
    });
  }

  if (!hasRealData) {
    mergeCols(ws, dataStart0, 0, lastCol);
    enrichStyle(ws, dataStart0, 0, {
      font: { sz: 11, color: { rgb: PDF.slate500 }, italic: true },
      fill: { fgColor: { rgb: PDF.rowOdd } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: BORDER_BODY_H,
    });
  } else {
    const dataEnd0 = dataStart0 + Math.max(0, dataRowCount) - 1;
    for (let r = dataStart0; r <= dataEnd0; r++) {
      const stripe = (r - dataStart0) % 2 === 1 ? PDF.rowZebraB : PDF.rowEven;
      for (let c = 0; c <= lastCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        const alignRight = c === 3;
        enrichStyle(ws, r, c, {
          fill: { fgColor: { rgb: stripe } },
          font: { sz: 11, color: { rgb: PDF.slate800 }, bold: c === 3 },
          alignment: { vertical: 'top', wrapText: true, horizontal: alignRight ? 'right' : 'left' },
          border: BORDER_BODY_H,
        });
      }
    }
  }

  if (methParaCount > 0 && methTitle0 != null) {
    mergeCols(ws, methTitle0, 0, lastCol);
    enrichStyle(ws, methTitle0, 0, STYLE_SECTION_TITLE);
    for (let i = 0; i < methParaCount; i++) {
      const r = methTitle0 + 1 + i;
      mergeCols(ws, r, 0, lastCol);
      enrichStyle(ws, r, 0, STYLE_METH_BODY);
    }
  }

  mergeCols(ws, footerPreparedRow0, 0, lastCol);
  enrichStyle(ws, footerPreparedRow0, 0, {
    font: { sz: 10, color: { rgb: PDF.slate600 }, italic: true },
    fill: { fgColor: { rgb: PDF.rowOdd } },
    alignment: { wrapText: true, vertical: 'top' },
    border: BORDER_BODY_H,
  });

  applyFreezeAndFilter(ws, headerRow0 + 1, RECEIPT_MANIFEST_COL_COUNT);
}

/** Standalone styled receipt manifest (Excel / Numbers), aligned with CPA vendor review / Summary sheet. */
export function generateReceiptManifestXlsxBase64(args: { payload: TaxSummaryExportPayload }): string {
  const { payload } = args;
  const year = payload.selectedYear;
  const lastCol = RECEIPT_MANIFEST_COL_COUNT - 1;

  const headers = [
    'RECEIPT FILE NAME',
    'EXPENSE DATE',
    'VENDOR',
    'AMOUNT',
    'PROJECT',
    'CATEGORY',
    'ATTACHED / MISSING',
    'NOTES',
  ];

  const dataRows = payload.receipts.map((r) => {
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
  });

  const methParas = TAX_CENTER_METHODOLOGY_BODY.split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const hasRealData = dataRows.length > 0;
  const footerCombined = `${RECEIPT_MANIFEST_FOOTER_PREPARED}\n\n${RECEIPT_MANIFEST_FOOTER_ORIGINAL}`;

  const sheetRows: (string | number | null | undefined)[][] = [
    ['BUILD PROFIT SOLUTIONS'],
    ['Receipt Backup Manifest'],
    ['Receipt filenames and attachment status. Retain originals outside BPS for your records.'],
    [],
    ['Tax Year', String(year)],
    ['Date Range', payload.dateRangeLabel],
    ['Generated', payload.generatedAtDisplay],
    ['Contractor contact', payload.contractorContactEmail?.trim() || 'Not set'],
    [],
    ['IMPORTANT TAX NOTICE'],
    [IMPORTANT_NOTICE_TEXT],
    [],
    ['Receipt Lines'],
    headers,
    ...dataRows,
  ];

  if (!hasRealData) {
    sheetRows.push(['No receipt-backed expense lines found for this tax year.']);
  }

  sheetRows.push([]);
  sheetRows.push([TAX_CENTER_METHODOLOGY_TITLE]);
  for (const p of methParas) {
    sheetRows.push([p]);
  }
  sheetRows.push([]);
  sheetRows.push([footerCombined]);

  const ws = sheetFromAoA(sheetRows);
  const metaStartRow0 = 4;
  const metaEndRow0 = 7;
  const noticeTitleRow0 = 9;
  const noticeBodyRow0 = 10;
  const sectionRow0 = 12;
  const headerRow0 = 13;
  const dataStart0 = 14;
  const methTitle0 = dataStart0 + (hasRealData ? dataRows.length : 1) + 1;
  const footerPreparedRow0 = methTitle0 + methParas.length + 2;

  applyReceiptManifestPresentation(ws, {
    lastCol,
    metaStartRow0,
    metaEndRow0,
    noticeTitleRow0,
    noticeBodyRow0,
    sectionRow0,
    headerRow0,
    dataStart0,
    hasRealData,
    dataRowCount: dataRows.length,
    methTitle0,
    methParaCount: methParas.length,
    footerPreparedRow0,
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Receipt Manifest');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
