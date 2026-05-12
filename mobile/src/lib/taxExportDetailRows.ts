import {
  calculateOutstandingInvoices,
  expenseAmount,
  expenseDate,
  mapExpenseToTaxCategory,
  type ProjectTaxSummary,
  type TaxCategory,
  type TaxExpense,
  type TaxPayment,
} from '@/src/lib/taxCenter';
import { resolveVendorForExpense } from '@/src/lib/tax1099Review';
import { SUGGESTED_ACCOUNTING_CATEGORY } from '@/src/lib/taxSuggestedAccountingCategories';
import type { Vendor } from '@/src/lib/vendorTypes';

const toNumber = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const paymentDate = (payment: TaxPayment): string | undefined =>
  payment.actualDate ||
  payment.collectedAt ||
  payment.paidAt ||
  payment.paymentDate ||
  payment.scheduledDate ||
  payment.dueDate ||
  payment.plannedDate ||
  (payment as { date?: string }).date;

const paymentAmount = (payment: TaxPayment): number =>
  toNumber(
    payment.collectedAmount ??
      (payment as { paidAmount?: number | string }).paidAmount ??
      payment.amount ??
      payment.paymentAmount
  );

function formatExportDate(raw: string | undefined): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.length > 24 ? '' : s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function receiptBasename(uri: string): string {
  const u = String(uri || '').trim();
  if (!u) return '';
  const parts = u.split(/[/\\]/);
  const last = parts[parts.length - 1] || '';
  return last.length > 120 ? `${last.slice(0, 117)}…` : last;
}

function invoiceOrMilestoneLabel(p: TaxPayment): string {
  return String(p.title || p.name || p.description || '').trim();
}

/** Expense line detail (purchase description, PO line, etc.). Not vendor name and not user notes. */
function expenseLineDescription(e: TaxExpense): string {
  const x = e as TaxExpense & { itemName?: string; title?: string; memo?: string };
  return String(x.description || x.itemName || x.title || x.memo || '').trim();
}

function customerFromProject(project: any): string {
  return String(
    project?.clientName ??
      project?.customerName ??
      project?.projectData?.clientName ??
      project?.estimateData?.clientName ??
      ''
  ).trim();
}

function findProjectForPayment(projects: any[], payment: TaxPayment): any | undefined {
  const id = String(payment.projectId || '').trim();
  const list = Array.isArray(projects) ? projects : [];
  if (id) {
    const hit = list.find((pr) => String(pr?.id || '') === id);
    if (hit) return hit;
  }
  const pn = String(payment.projectName || '').trim();
  if (pn) {
    const hit = list.find((pr) => String(pr?.name || pr?.title || '').trim() === pn);
    if (hit) return hit;
  }
  return undefined;
}

export type ExpenseTransactionExportRow = {
  date: string;
  project: string;
  vendor: string;
  description: string;
  bpsCategory: TaxCategory | string;
  accountingCategory: string;
  amount: string;
  paymentMethod: string;
  receiptAttached: string;
  receiptFileName: string;
  eligible1099: string;
  w9Status: string;
  notes: string;
};

export type RevenuePaymentExportRow = {
  date: string;
  project: string;
  customer: string;
  invoiceOrMilestone: string;
  amountCollected: string;
  paymentMethod: string;
  outstandingBalance: string;
  notes: string;
};

export function buildExpenseTransactionExportRows(
  yearExpenses: TaxExpense[],
  vendors: Vendor[],
  categoryToAccountingLabel: (cat: TaxCategory) => string
): ExpenseTransactionExportRow[] {
  const rows: ExpenseTransactionExportRow[] = [];

  for (const e of yearExpenses) {
    const cat = mapExpenseToTaxCategory(e);
    const acctRaw = categoryToAccountingLabel(cat).trim();
    const suggested = SUGGESTED_ACCOUNTING_CATEGORY[cat] ?? '';
    const accountingCategory = acctRaw || suggested || 'Needs review';
    const linked = resolveVendorForExpense(e, vendors);
    const vendor =
      String(linked?.businessName || e.vendorName || e.vendor || '').trim() || 'Needs review';
    const uri = String(e.receiptUri ?? '').trim();
    const receiptAttached = uri ? 'Yes' : 'Missing';
    const w9 =
      linked?.w9Status === 'not_applicable'
        ? 'Not needed'
        : linked?.w9Status === 'missing'
          ? 'Missing'
          : linked?.w9Status === 'requested'
            ? 'Requested'
            : linked?.w9Status === 'uploaded'
              ? 'Received'
              : linked?.w9Status === 'verified'
                ? 'Received'
                : 'Needs review';

    let eligible1099 = 'Needs review';
    const vt = linked?.vendorType;
    if (vt === 'subcontractor' || vt === 'consultant' || vt === 'other') {
      eligible1099 = 'Potential 1099 review — confirm with CPA';
    } else if (vt === 'supplier' && linked?.requires1099Review) {
      eligible1099 = 'Potential 1099 review — confirm with CPA';
    } else if (vt === 'supplier') {
      eligible1099 = 'Not flagged';
    }

    rows.push({
      date: formatExportDate(expenseDate(e)),
      project: String(e.projectName || '').trim() || 'Needs review',
      vendor,
      description: expenseLineDescription(e),
      bpsCategory: cat,
      accountingCategory,
      amount: moneyCsv(expenseAmount(e)),
      paymentMethod: String(e.paymentMethod || '').trim() || 'Needs review',
      receiptAttached,
      receiptFileName: uri ? receiptBasename(uri) : '',
      eligible1099,
      w9Status: w9,
      notes: String(e.notes ?? '').trim(),
    });
  }

  return rows;
}

function moneyCsv(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(safe).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `-$${abs}` : `$${abs}`;
}

export function buildRevenuePaymentExportRows(
  projects: any[],
  yearPayments: TaxPayment[],
  projectSummaries: ProjectTaxSummary[],
  selectedYear: number
): RevenuePaymentExportRow[] {
  const outstandingByName = new Map<string, number>();
  for (const p of projectSummaries) {
    outstandingByName.set(String(p.projectName || '').trim(), p.outstandingInvoices);
  }

  return yearPayments.map((pay) => {
    const proj = findProjectForPayment(projects, pay);
    const pname = String(pay.projectName || '').trim() || (proj ? String(proj?.name || proj?.title || '').trim() : '');
    const outstanding =
      outstandingByName.get(pname.trim()) ??
      (proj ? calculateOutstandingInvoices(proj, selectedYear) : undefined);
    const pm = String(
      (pay as { paymentMethod?: string }).paymentMethod ||
        (pay as { method?: string }).method ||
        ''
    ).trim();

    return {
      date: formatExportDate(paymentDate(pay)),
      project: pname || 'Needs review',
      customer: proj ? customerFromProject(proj) : '',
      invoiceOrMilestone: invoiceOrMilestoneLabel(pay) || 'Needs review',
      amountCollected: moneyCsv(paymentAmount(pay)),
      paymentMethod: pm || 'Needs review',
      outstandingBalance:
        outstanding != null && Number.isFinite(outstanding) ? moneyCsv(outstanding) : 'Needs review',
      notes: '',
    };
  });
}
