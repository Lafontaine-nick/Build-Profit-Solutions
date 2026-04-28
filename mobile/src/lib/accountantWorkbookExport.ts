/**
 * Accountant workbook (XLSX) for bookkeeping support only — not tax filing, not IRS submission.
 */
import * as XLSX from 'xlsx';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import type { Tax1099ReviewSummary, Tax1099ReviewVendorRow } from '@/src/lib/tax1099Review';
import { format1099ReviewMoney } from '@/src/lib/tax1099Review';
import type { TaxCategory } from '@/src/lib/taxCenter';
import type { Vendor } from '@/src/lib/vendorTypes';

function money2(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function sheetFromAoA(rows: (string | number | null | undefined)[][]) {
  return XLSX.utils.aoa_to_sheet(rows);
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

  const summaryRows: (string | number | null | undefined)[][] = [
    ['Build Profit Solutions — Accountant Workbook'],
    ['Informational / bookkeeping support only — not tax advice or official filing'],
    [],
    ['Tax Year', payload.selectedYear],
    ['Date Range', payload.dateRangeLabel],
    ['Generated', payload.generatedAtDisplay],
    [],
    ['Metric', 'Amount'],
    ['Revenue Collected', money2(p.revenueCollected)],
    ['Outstanding Receivables', money2(p.outstandingReceivables)],
    ['Expenses Paid', money2(p.expensesPaid)],
    ['Committed Costs', money2(p.committedCosts)],
    ['Net Income', money2(p.netIncome)],
    ['Net Margin', p.netMargin == null ? 'N/A' : `${Math.round(p.netMargin * 100)}%`],
    ['Subcontractor Payments', money2(p.subcontractorPayments)],
    ['Receipt Count', p.receiptCount],
    [],
    [review.disclaimer],
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(summaryRows), 'Summary');

  const projectRows: (string | number | null | undefined)[][] = [
    ['Project', 'Revenue Collected', 'Outstanding', 'Expenses Paid', 'Net Income', 'Net Margin', 'Receipt Count'],
    ...payload.projectSummaries.map((r) => [
      r.projectName,
      money2(r.revenueCollected),
      money2(r.outstandingInvoices),
      money2(r.expensesPaid),
      money2(r.netIncome),
      r.netMargin == null ? 'N/A' : `${Math.round(r.netMargin * 100)}%`,
      r.receiptCount,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(projectRows), 'Projects');

  const catRows: (string | number | null | undefined)[][] = [
    ['Category', 'Amount', 'Item Count'],
    ...payload.expenseCategories.map((c) => [c.category, money2(c.amount), c.itemCount]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(catRows), 'Expense Categories');

  const reviewHeader = [
    'Vendor',
    'Total Paid',
    'Payment Method',
    'W-9 Status',
    'Projects',
    'Action Needed',
    'Vendor Type',
  ];
  const reviewRows: (string | number | null | undefined)[][] = [
    reviewHeader,
    ...review.rows.map((r: Tax1099ReviewVendorRow) => [
      r.displayName,
      format1099ReviewMoney(r.totalPaid),
      r.paymentMethodDisplay,
      r.w9Status,
      r.projects.join('; '),
      r.actionNeeded.join('; ') || '—',
      r.vendorType,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(reviewRows), 'Vendor & 1099 Review');

  const receiptRows: (string | number | null | undefined)[][] = [
    ['Project', 'Date', 'Month', 'Category', 'Vendor', 'Amount', 'Receipt Attached'],
    ...payload.receipts.map((r) => [
      r.projectName,
      r.date,
      r.month,
      r.category,
      r.vendor,
      money2(r.amount),
      (r.receiptUri || '').trim() ? 'Yes' : 'No',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(receiptRows), 'Receipts');

  const missingW9 = vendors.filter((v) => {
    const w9bad = v.w9Status === 'missing' || v.w9Status === 'requested';
    if (!w9bad) return false;
    const t = v.vendorType;
    return t === 'subcontractor' || t === 'consultant' || t === 'other' || v.requires1099Review === true;
  });
  const w9Rows: (string | number | null | undefined)[][] = [
    ['Business Name', 'Legal Name', 'W-9 Status', 'Vendor Type', 'Email', 'Phone', 'Notes'],
    ...missingW9.map((v) => [
      v.businessName,
      v.legalName || '',
      v.w9Status,
      v.vendorType,
      v.email || '',
      v.phone || '',
      v.notes || '',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(w9Rows), 'Missing W-9s');

  const qbRows: (string | number | null | undefined)[][] = [
    ['BPS Category', 'QuickBooks / external label (export prep only)'],
    ...Object.entries(quickBooksCategoryMap).map(([k, v]) => [k, v || '']),
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromAoA(qbRows), 'QB Mapping');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
