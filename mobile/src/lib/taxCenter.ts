import type { Vendor, VendorType } from '@/src/lib/vendorTypes';
import { getPotential1099ReviewThreshold } from '@/src/lib/taxReviewThresholds';
import {
  shouldExcludeChangeOrderPaymentFromOutstandingReceivables,
  getApprovedChangeOrderPaymentRows,
  collectUniqueChangeOrders,
  formatChangeOrderPaymentRowTitle,
  computeProjectFinancials,
  type ChangeOrderPaymentRow,
} from '@/src/lib/projectFinancials';

/**
 * Tax year bucketing uses **business-facing dates** (typically `YYYY-MM-DD` or localized date strings).
 * Date-only values are parsed at local noon so a user's timezone cannot move Jan 1 / Dec 31 into
 * the adjacent tax year. Prefer date-only fields for tax anchors (`actualDate`, `paidAt`,
 * `collectedAt`, expense `date`, PO `paidAt`/`paidDate`, etc.) to reduce UTC midnight surprises. Year membership
 * is calendar `getFullYear()` on the parsed value — do not silently invent dates for missing fields
 * (readiness warnings surface gaps instead).
 */

export type TaxCategory =
  | 'Materials'
  | 'Labor'
  | 'Subcontractors'
  | 'Equipment Rental'
  | 'Permits / Plans'
  | 'Insurance'
  | 'Vehicle / Mileage'
  | 'Software / Tools'
  | 'Office / Admin'
  | 'Other';

export const TAX_CATEGORIES: TaxCategory[] = [
  'Materials',
  'Labor',
  'Subcontractors',
  'Equipment Rental',
  'Permits / Plans',
  'Insurance',
  'Vehicle / Mileage',
  'Software / Tools',
  'Office / Admin',
  'Other',
];

export type TaxExpense = {
  id?: string;
  projectId?: string;
  projectName?: string;
  category?: string;
  vendor?: string;
  /** Optional link to Vendor directory (Phase 2). */
  vendorId?: string;
  /** Denormalized vendor label when not linked by id. */
  vendorName?: string;
  amount?: number | string;
  date?: string;
  orderDate?: string;
  paidAt?: string;
  receiptUri?: string | null;
  notes?: string;
  /** Line detail when present (material description, PO title, etc.). Not user notes. */
  description?: string;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  /** Informational flag for 1099-readiness review (not a legal determination). */
  requires1099Review?: boolean;
  /** Internal: purchase order line (only counted when paid per tax rules) */
  __isPurchaseOrder?: boolean;
};

export type TaxPayment = {
  id?: string;
  projectId?: string;
  projectName?: string;
  amount?: number | string;
  paymentAmount?: number | string;
  collectedAmount?: number | string;
  collectedAt?: string;
  /** Date-only cash receipt; preferred over collectedAt for tax-year bucketing when set. */
  actualDate?: string;
  paidAt?: string;
  paymentDate?: string;
  scheduledDate?: string;
  dueDate?: string;
  plannedDate?: string;
  status?: string;
  paid?: boolean;
  collected?: boolean;
  isPaid?: boolean;
  title?: string;
  name?: string;
  description?: string;
};

export type TaxReceipt = {
  id?: string;
  projectId?: string;
  uri?: string;
  receiptUri?: string;
  date?: string;
  createdAt?: string;
};

export type TaxCenterSummary = {
  /** Cash-basis: payments actually collected during the selected tax year. */
  grossIncomeCollected: number;
  outstandingReceivables: number;
  /**
   * Cash-basis expenses paid in the tax year: non-PO lines use paid date when present, otherwise
   * paid-status + line date; POs require an explicit paid status/date.
   * Unpaid POs are excluded and appear under `committedCosts`.
   */
  totalExpenses: number;
  /** Sum of unpaid purchase orders only; not included in cash-basis expenses. */
  committedCosts: number;
  /** `grossIncomeCollected - totalExpenses` for the selected tax year. */
  netProfit: number;
  /** Net Income ÷ Revenue Collected; **0** when there is no collected revenue in the year. */
  netMargin: number;
  subcontractorPayments: number;
  receiptCount: number;
};

export type TaxCategoryRow = {
  category: TaxCategory;
  /** Accounting / QuickBooks label from user mapping; empty when unmapped. */
  accountingLabel: string;
  amount: number;
  count: number;
};

export type ProjectTaxSummary = {
  projectId: string;
  projectName: string;
  /** Cash collected in the selected tax year (same basis as portfolio revenue). */
  revenueCollected: number;
  outstandingInvoices: number;
  expensesPaid: number;
  netIncome: number;
  /** Net income ÷ revenue collected; **0** when there is no revenue collected for the project in-year. */
  margin: number;
  receiptCount: number;
};

export type SubcontractorPaymentSummary = {
  name: string;
  totalPaid: number;
  projects: string[];
  missingW9: boolean;
  potential1099Review: boolean;
  w9Uploaded: boolean;
  einPlaceholder: string;
  addressPlaceholder: string;
};

export function getTaxYearRange(year: number) {
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

const toNumber = (value: unknown): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value : []);

/** Tax Center includes only current jobs, matching the Projects screen's Active tab. */
export const isCurrentTaxProject = (project: any): boolean => {
  const status = String(project?.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return status === 'won' || status === 'in_progress' || status === 'active';
};

const parseDate = (value: unknown): Date | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  // `new Date('2026-01-01')` is UTC midnight, which is Dec 31 in US time zones.
  // Treat business date-only strings as local calendar dates instead.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateInYear = (value: unknown, year: number): boolean => {
  const date = parseDate(value);
  return !!date && date.getFullYear() === year;
};

const projectOverlapsYear = (project: any, year: number): boolean => {
  const candidates = [
    project?.startDate,
    project?.endDate,
    project?.createdAt,
    project?.updatedAt,
    project?.projectData?.startISO,
    project?.projectData?.endISO,
    project?.estimateData?.projectStartDate,
    project?.estimateData?.projectEndDate,
  ];
  return candidates.some((candidate) => dateInYear(candidate, year));
};

export const expenseDate = (expense: any): string | undefined =>
  expense?.date || expense?.paidAt || expense?.orderDate || expense?.createdAt || expense?.updatedAt;

const poDate = (po: any): string | undefined =>
  po?.orderDate || po?.expectedDelivery || po?.date || po?.createdAt || po?.updatedAt;

const paymentDate = (payment: any): string | undefined =>
  payment?.actualDate ||
  payment?.collectedAt ||
  payment?.paidAt ||
  payment?.paymentDate ||
  payment?.scheduledDate ||
  payment?.dueDate ||
  payment?.plannedDate ||
  payment?.date;

/** Actual collection/payment date only; never falls back to a scheduled date. */
const paymentCollectedDate = (payment: any): string | undefined => {
  const isChangeOrderPayment =
    String(payment?.type || '').toLowerCase() === 'change_order' ||
    String(payment?.id || '').startsWith('bps-co-');
  // Approved change-order rows can carry a generic paymentDate while payment
  // is still outstanding. Only explicit collection fields qualify as
  // cash-basis revenue for change orders.
  if (isChangeOrderPayment) {
    return payment?.actualDate || payment?.collectedAt || payment?.paidAt;
  }
  return payment?.actualDate || payment?.collectedAt || payment?.paidAt || payment?.paymentDate;
};

/**
 * Which tax year an **uncollected** milestone belongs to for AR: prefer Timeline / schedule fields
 * (`plannedDate`, `scheduledDate`, `dueDate`) before `paymentDate()`'s cash-flow-first order.
 * Otherwise open lines can land in the wrong year or disappear vs what the Timeline tab shows.
 */
const arMilestoneYearBucketDate = (payment: any): string | undefined => {
  const fromSchedule = payment?.plannedDate || payment?.scheduledDate || payment?.dueDate;
  const trimmed = String(fromSchedule || '').trim();
  if (trimmed) return trimmed;
  return paymentDate(payment);
};

function parseCoIdFromApprovedPaymentRowId(rowId: string): string | null {
  if (rowId === 'bps-co-unallocated') return null;
  const m = rowId.match(/^bps-co-(.+)$/);
  if (!m) return null;
  if (/^idx-/.test(m[1])) return null;
  return m[1] || null;
}

function approvedCoRowBucketsInTaxYear(
  project: any,
  row: ChangeOrderPaymentRow,
  mergedPayment: TaxPayment | undefined,
  selectedYear: number
): boolean {
  if (mergedPayment) {
    return dateInYear(arMilestoneYearBucketDate(mergedPayment), selectedYear);
  }
  const raw = row.dateRaw ? String(row.dateRaw) : '';
  const dm = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dm && dateInYear(dm[1], selectedYear)) return true;
  const cid = parseCoIdFromApprovedPaymentRowId(row.id);
  if (cid) {
    const cos = collectUniqueChangeOrders(project);
    const co = cos.find((c: any) => String(c?.id ?? '') === cid);
    const d = co?.date ?? co?.createdAt ?? co?.updatedAt;
    if (d && dateInYear(d, selectedYear)) return true;
  }
  if (row.id === 'bps-co-unallocated') return projectOverlapsYear(project, selectedYear);
  return projectOverlapsYear(project, selectedYear);
}

/** Approved CO sell still owed when it is not already counted on the open (in-year, uncollected) schedule. */
function approvedChangeOrderReceivableSupplement(
  project: any,
  selectedYear: number,
  openSchedule: TaxPayment[]
): number {
  const merged = mergeApprovedChangeOrderPaymentRowsIntoPaymentList(project, collectProjectPayments(project));
  const rows = getApprovedChangeOrderPaymentRows(project);
  let sum = 0;
  for (const row of rows) {
    const rowTitleKey = formatChangeOrderPaymentRowTitle(String(row.title ?? '').trim());
    const alreadyOnOpenSchedule =
      openSchedule.some((p) => String(p.id || '') === row.id) ||
      openSchedule.some((p) => {
        const tk = formatChangeOrderPaymentRowTitle(String((p as any).title ?? (p as any).name ?? '').trim());
        return tk === rowTitleKey && Math.abs(paymentAmount(p) - row.amount) < 0.02;
      });
    if (alreadyOnOpenSchedule) continue;

    let p = merged.find((x) => String(x.id || '') === row.id);
    if (!p) {
      p = merged.find(
        (x) =>
          formatChangeOrderPaymentRowTitle(String((x as any).title ?? (x as any).name ?? '').trim()) === rowTitleKey
      );
    }
    if (p && isPaymentCollected(p)) continue;
    if (!approvedCoRowBucketsInTaxYear(project, row, p, selectedYear)) continue;
    sum += row.amount;
  }
  return sum;
}

const isExpenseInYear = (expense: any, year: number, project?: any): boolean => {
  const date = expense.__isPurchaseOrder ? poDate(expense) : expenseDate(expense);
  if (date) return dateInYear(date, year);
  return project ? projectOverlapsYear(project, year) : false;
};

export function projectByIdFromList(projects: any[], projectId: string): any | undefined {
  const id = String(projectId || '').trim();
  if (!id) return undefined;
  return asArray<any>(projects).find((p) => String(p?.id || '') === id);
}

const expenseExplicitlyUnpaid = (expense: any): boolean => {
  const ps = String(expense?.paymentStatus || '').toLowerCase();
  const st = String(expense?.status || '').toLowerCase();
  return (
    ['unpaid', 'pending', 'scheduled', 'draft', 'open', 'cancelled', 'void'].includes(ps) ||
    ['unpaid', 'pending', 'scheduled', 'draft', 'open', 'cancelled', 'void'].includes(st)
  );
};

const expenseExplicitlyPaid = (expense: any): boolean => {
  if (expense?.isPaid === true) return true;
  const ps = String(expense?.paymentStatus || '').toLowerCase();
  const st = String(expense?.status || '').toLowerCase();
  return (
    ps === 'paid' ||
    ps === 'collected' ||
    ps === 'completed' ||
    ps === 'complete' ||
    ps === 'cleared' ||
    ps === 'posted' ||
    st === 'paid' ||
    st === 'complete' ||
    st === 'completed'
  );
};

const cashBasisPoPaidYearDate = (po: any): string | undefined =>
  String(po?.paidAt || '').trim() ||
  String(po?.paidDate || '').trim() ||
  String(po?.paymentDate || '').trim() ||
  undefined;

const cashBasisNonPoExpensePaidYearDate = (expense: any): string | undefined => {
  // An explicit unpaid/pending marker wins over a stale paidAt or record date.
  if (expenseExplicitlyUnpaid(expense)) return undefined;
  const paidAt = String(expense?.paidAt || '').trim();
  if (paidAt) return paidAt;
  if (expenseExplicitlyPaid(expense)) {
    return (
      String(expense?.date || '').trim() ||
      String(expense?.orderDate || '').trim() ||
      String(expense?.createdAt || '').trim() ||
      undefined
    );
  }
  return (
    String(expense?.date || '').trim() ||
    String(expense?.orderDate || '').trim() ||
    String(expense?.createdAt || '').trim() ||
    undefined
  );
};

/**
 * Cash-basis: expense counts in a tax year when it was actually paid. Regular expense entries
 * without an explicit unpaid marker retain the app's existing transaction-date model; purchase
 * orders require an explicit paid status/date.
 */
export function isCashBasisExpensePaidInTaxYear(expense: any, year: number, project?: any): boolean {
  if (expense?.__isPurchaseOrder) {
    if (!isPoPaidForTax(expense)) return false;
    const d = cashBasisPoPaidYearDate(expense);
    return !!d && dateInYear(d, year);
  }
  const d = cashBasisNonPoExpensePaidYearDate(expense);
  if (d) return dateInYear(d, year);
  return false;
}

/** Line date for receipt backup / receipt counts (follows expense or PO schedule, not cash paid date). */
export function expenseRecordDateForTaxYear(expense: any): string | undefined {
  if (expense?.__isPurchaseOrder) return poDate(expense);
  return (
    String(expense?.date || '').trim() ||
    String(expense?.orderDate || '').trim() ||
    String(expense?.paidAt || '').trim() ||
    String(expense?.createdAt || '').trim() ||
    undefined
  );
}

export function isExpenseRecordDatedInTaxYear(expense: any, year: number, project?: any): boolean {
  const d = expenseRecordDateForTaxYear(expense);
  if (d) return dateInYear(d, year);
  return project ? projectOverlapsYear(project, year) : false;
}

const isPaymentCollected = (payment: any): boolean => {
  const isChangeOrderPayment =
    String(payment?.type || '').toLowerCase() === 'change_order' ||
    String(payment?.id || '').startsWith('bps-co-');
  const hasExplicitChangeOrderCollectionDate =
    !!String(payment?.actualDate || '').trim() ||
    !!String(payment?.collectedAt || '').trim() ||
    !!String(payment?.paidAt || '').trim();
  if (isChangeOrderPayment && !hasExplicitChangeOrderCollectionDate) return false;
  if (payment?.paid === true || payment?.collected === true || payment?.isPaid === true) return true;
  if (payment?.completed === true || payment?.isComplete === true) return true;
  const status = String(payment?.status || '').toLowerCase();
  if (
    status === 'paid' ||
    status === 'collected' ||
    status === 'completed' ||
    status === 'complete'
  ) {
    return true;
  }
  const amt = toNumber(payment?.amount ?? payment?.paymentAmount ?? payment?.collectedAmount);
  if (amt > 0 && (Number(payment?.progressPct) || 0) >= 99.5) return true;
  return false;
};

const isPaymentExcludedFromReceivables = (payment: any): boolean => {
  const status = String(payment?.status || '').toLowerCase();
  return ['cancelled', 'canceled', 'void', 'draft'].includes(status);
};

const paymentAmount = (payment: any): number =>
  toNumber(payment?.collectedAmount ?? payment?.paidAmount ?? payment?.amount ?? payment?.paymentAmount);

export const expenseAmount = (expense: any): number => toNumber(expense?.amount ?? expense?.total ?? expense?.cost);

const normalizeProjectName = (project: any): string =>
  String(project?.title || project?.name || project?.projectData?.title || project?.estimateData?.title || 'Untitled Project');

const uniqueByKey = <T>(items: T[], getKey: (item: T, index: number) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const key = getKey(item, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * PO amounts that count as realized spend for tax summaries.
 * A received PO is not necessarily paid, so it remains outside cash-basis expenses until it has an
 * explicit paid status or payment date. Cancelled/Archived are excluded from both buckets.
 */
export function isPoPaidForTax(po: any): boolean {
  if (po?.isPaid === true || po?.paid === true) return true;
  const status = String(po?.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'archived') return false;
  return (
    status === 'paid' ||
    status === 'completed' ||
    status === 'complete' ||
    status === 'cleared' ||
    status === 'settled' ||
    !!String(po?.paidAt || po?.paidDate || po?.paymentDate || '').trim()
  );
}

/** Normalize vendor names for matching saved directory entries to detected names. */
export function normalizeVendorNameKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Match saved vendor directory row without importing tax1099Review (avoid circular deps). */
export function matchVendorForExpense(expense: TaxExpense, vendors: Vendor[]): Vendor | undefined {
  if (!vendors.length) return undefined;
  const vid = String(expense.vendorId || '').trim();
  if (vid) {
    const byId = vendors.find((v) => v.id === vid);
    if (byId) return byId;
  }
  const label = normalizeVendorNameKey(String(expense.vendorName || expense.vendor || '').trim());
  if (!label) return undefined;
  return vendors.find((v) => normalizeVendorNameKey(v.businessName) === label);
}

/** Sum portfolio “Subcontractor Payments”: Subcontractors category **or** vendor directory type subcontractor. */
export function expenseCountsTowardSubcontractorPayments(expense: TaxExpense, vendors?: Vendor[]): boolean {
  if (mapExpenseToTaxCategory(expense) === 'Subcontractors') return true;
  if (!vendors?.length) return false;
  const v = matchVendorForExpense(expense, vendors);
  return v?.vendorType === 'subcontractor';
}

/** Infer vendor type from BPS tax category (detection defaults; users can override in the directory). */
export function inferVendorTypeFromTaxCategory(category: TaxCategory, expense?: Partial<TaxExpense>): VendorType {
  if (
    category === 'Materials' ||
    category === 'Equipment Rental' ||
    category === 'Software / Tools' ||
    category === 'Insurance'
  ) {
    return 'supplier';
  }
  if (category === 'Subcontractors') return 'subcontractor';
  if (category === 'Labor') {
    const v = String(expense?.vendorName || expense?.vendor || '').trim();
    if (!v) return 'supplier';
    const t = v.toLowerCase();
    if (
      /\b(consult|consulting|engineer|engineering|architect|designer|accountant|cpa|attorney|lawyer|legal|professional)\b/.test(
        t
      )
    ) {
      return 'consultant';
    }
    return 'subcontractor';
  }
  return 'supplier';
}

export function mapExpenseToTaxCategory(expense: Partial<TaxExpense> | string | undefined): TaxCategory {
  const raw =
    typeof expense === 'string'
      ? expense
      : `${expense?.category || ''} ${expense?.vendor || ''} ${expense?.notes || ''}`;
  const text = raw.toLowerCase();

  if (/sub|1099|contractor|crew|trade partner/.test(text)) return 'Subcontractors';
  if (/labor|payroll|wage|hour|employee/.test(text)) return 'Labor';
  if (/material|lumber|concrete|drywall|paint|tile|roof|supply|hardware|homedepot|home depot|lowe/.test(text)) return 'Materials';
  if (/equipment|rental|scaffold|lift|excavator|bobcat|tool rental/.test(text)) return 'Equipment Rental';
  if (/permit|plan|inspection|engineering|architect|drawing/.test(text)) return 'Permits / Plans';
  if (/insurance|liability|bond|workers comp|worker/.test(text)) return 'Insurance';
  if (/vehicle|mileage|fuel|gas|truck|parking|toll/.test(text)) return 'Vehicle / Mileage';
  if (/software|subscription|app|saas|tool|license/.test(text)) return 'Software / Tools';
  if (/office|admin|postage|paper|printer|bookkeeping|accounting|phone|internet/.test(text)) return 'Office / Admin';
  return 'Other';
}

function collectProjectExpenseLinesOnly(project: any): TaxExpense[] {
  const projectId = String(project?.id || '');
  const projectName = normalizeProjectName(project);
  const sources = [project?.expenses, project?.projectData?.expenses, project?.estimateData?.expenses];
  const expenses = sources.flatMap((source) => asArray<TaxExpense>(source));

  return uniqueByKey(expenses, (expense, index) => {
    const id = expense?.id;
    return id ? `${projectId}:exp:${id}` : `${projectId}:exp:${index}:${expense?.vendor || ''}:${expenseAmount(expense)}:${expenseDate(expense) || ''}`;
  }).map((expense) => ({
    ...expense,
    __isPurchaseOrder: false,
    projectId,
    projectName,
    amount: expenseAmount(expense),
    date: expenseDate(expense),
  }));
}

function collectProjectPurchaseOrderLines(project: any): TaxExpense[] {
  const projectId = String(project?.id || '');
  const projectName = normalizeProjectName(project);
  const sources = [project?.purchaseOrders, project?.projectData?.purchaseOrders];
  const pos = sources.flatMap((source) => asArray<any>(source));

  return uniqueByKey(pos, (po, index) => {
    const id = po?.id || po?.poNumber;
    return id ? `${projectId}:po:${id}` : `${projectId}:po:${index}:${po?.vendor || ''}:${expenseAmount(po)}:${poDate(po) || ''}`;
  }).map((po) => ({
    ...po,
    id: String(po?.id || po?.poNumber || ''),
    category: po?.category,
    vendor: po?.vendor,
    amount: expenseAmount(po),
    date: poDate(po),
    notes: po?.notes,
    receiptUri: po?.receiptUri ?? null,
    status: po?.status,
    __isPurchaseOrder: true,
    projectId,
    projectName,
  }));
}

/** All expense rows + all PO rows (any status) for receipt-date anchoring and similar review. */
export function collectAllProjectExpenseAndPoLines(project: any): TaxExpense[] {
  return [...collectProjectExpenseLinesOnly(project), ...collectProjectPurchaseOrderLines(project)];
}

/** Taxable expense lines: regular expenses + only explicitly paid POs */
export function collectTaxableExpenseLines(project: any): TaxExpense[] {
  const regular = collectProjectExpenseLinesOnly(project);
  const pos = collectProjectPurchaseOrderLines(project).filter((po) => isPoPaidForTax(po));
  return [...regular, ...pos];
}

/** Unpaid POs — includes received-but-not-paid orders so they are not silently omitted. */
export function collectUnpaidPurchaseOrderLines(project: any): TaxExpense[] {
  return collectProjectPurchaseOrderLines(project).filter((po) => {
    const status = String(po?.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'archived' && !isPoPaidForTax(po);
  });
}

function collectProjectInvoices(project: any): any[] {
  const sources = [project?.invoices, project?.projectData?.invoices, project?.estimateData?.invoices];
  return uniqueByKey(sources.flatMap((s) => asArray<any>(s)), (inv, i) =>
    inv?.id
      ? String(inv.id)
      : String(inv?.number || '').trim()
        ? `inv:number:${String(inv.number).trim()}`
        : `inv:${i}`
  );
}

/** Normalize an invoice's open balance before it contributes to receivables. */
function invoiceOpenBalance(invoice: any): number {
  const status = String(invoice?.status || '').toLowerCase();
  if (['paid', 'settled', 'completed', 'complete'].includes(status)) return 0;

  const total = toNumber(invoice?.total ?? invoice?.subtotal);
  const paidAmount = toNumber(invoice?.paidAmount);
  const reportedBalance =
    invoice?.balance != null && invoice?.balance !== ''
      ? Math.max(0, toNumber(invoice.balance))
      : Math.max(0, total - paidAmount);

  // A stale balance should not exceed the invoice total when a total is available.
  return total > 0 ? Math.min(reportedBalance, total) : reportedBalance;
}

/**
 * A project's open receivables cannot exceed its remaining contract value after collected payments.
 * This prevents duplicated/stale milestone rows from producing impossible AR totals.
 */
function projectReceivableCeiling(project: any, payments: TaxPayment[]): number {
  const adjustedContractValue = Number(computeProjectFinancials(project, {}).adjustedContractValue) || 0;
  if (!(adjustedContractValue > 0)) return Number.POSITIVE_INFINITY;
  const collected = payments
    .filter((payment) => isPaymentCollected(payment))
    .reduce((sum, payment) => sum + paymentAmount(payment), 0);
  return Math.max(0, adjustedContractValue - collected);
}

/**
 * Outstanding receivables for a project in a tax year: **uncollected** amounts still expected
 * (invoice balances dated in the year, or — if there are no invoices — payment milestones dated
 * in the year that are not yet marked collected; milestone year uses schedule dates first so it
 * aligns with Timeline `plannedDate` / `scheduledDate` / `dueDate`). Informational only for cash-basis
 * revenue — not added to Revenue Collected until collected.
 * Synthetic **change order** payment rows (`bps-co-…` / `type: change_order`) count only when they
 * match an **approved** change order (submitted-only COs must not increase receivables).
 * **Approved** change orders that are not yet on the merged payment schedule (or use a different id)
 * are merged in from {@link getApprovedChangeOrderPaymentRows} before AR is computed, and any remainder
 * is still added via a small supplement. When invoice records exist for the year, invoice balances
 * include that supplement so CO-only receivables are not dropped.
 */
export function calculateOutstandingInvoices(project: any, selectedYear: number): number {
  const invoices = collectProjectInvoices(project).filter((inv) => {
    const status = String(inv?.status || '').toLowerCase();
    if (['cancelled', 'draft', 'void', 'archived'].includes(status)) return false;
    const d = inv?.issueDate || inv?.createdAt;
    return dateInYear(d, selectedYear);
  });

  const basePayments = collectProjectPayments(project);
  const mergedPayments = mergeApprovedChangeOrderPaymentRowsIntoPaymentList(project, basePayments);
  const openSchedule = mergedPayments.filter(
    (p) =>
      dateInYear(arMilestoneYearBucketDate(p), selectedYear) &&
      !isPaymentCollected(p) &&
      !isPaymentExcludedFromReceivables(p) &&
      !shouldExcludeChangeOrderPaymentFromOutstandingReceivables(project, p)
  );
  const scheduleTotal = openSchedule.reduce((s, p) => s + paymentAmount(p), 0);
  const coSupplement = approvedChangeOrderReceivableSupplement(project, selectedYear, openSchedule);

  if (invoices.length > 0) {
    const billed = invoices.reduce((sum, inv) => {
      return sum + invoiceOpenBalance(inv);
    }, 0);
    return Math.min(
      Math.max(0, billed + coSupplement),
      projectReceivableCeiling(project, mergedPayments)
    );
  }

  return Math.min(
    Math.max(0, scheduleTotal + coSupplement),
    projectReceivableCeiling(project, mergedPayments)
  );
}

function collectProjectPayments(project: any): TaxPayment[] {
  const projectId = String(project?.id || '');
  const projectName = normalizeProjectName(project);
  const sources = [
    /** First: device timeline (completed / collectedAt) wins over stale estimate milestones. */
    project?.projectData?.timelineV2Milestones,
    project?.payments,
    project?.paymentMilestones,
    project?.weeklyPayments,
    project?.milestones,
    project?.projectData?.payments,
    project?.projectData?.paymentMilestones,
    project?.projectData?.weeklyPayments,
    project?.projectData?.milestones,
    project?.estimateData?.paymentMilestones,
    project?.estimateData?.weeklyPayments,
  ];
  const flat = sources.flatMap((source) => asArray<TaxPayment>(source));

  const paymentAmtForDedupe = (p: any) =>
    toNumber(p?.collectedAmount ?? p?.paidAmount ?? p?.amount ?? p?.paymentAmount);

  const paymentKeyWithId = (p: any) => {
    const id = String(p?.id || '').trim();
    return id ? `${projectId}::id::${id}` : '';
  };

  /** Prefer collected / high-progress rows when the same milestone id appears in timeline + estimate copies. */
  const mergeScore = (p: any) => {
    let s = 0;
    if (isPaymentCollected(p)) s += 100;
    s += Math.min(25, Math.floor((Number(p?.progressPct) || 0) / 4));
    return s;
  };

  const byId = new Map<string, TaxPayment>();
  const idOrder: string[] = [];
  const noIdSeen = new Set<string>();
  const noIdRows: TaxPayment[] = [];

  for (const payment of flat) {
    const idKey = paymentKeyWithId(payment);
    if (idKey) {
      const prev = byId.get(idKey);
      if (!prev || mergeScore(payment) > mergeScore(prev)) {
        byId.set(idKey, payment);
      }
      if (!idOrder.includes(idKey)) idOrder.push(idKey);
      continue;
    }
    const label = payment?.title || payment?.name || payment?.description || '';
    const nk = `${projectId}::noid::${label}:${paymentAmtForDedupe(payment)}:${paymentDate(payment) || ''}`;
    if (noIdSeen.has(nk)) continue;
    noIdSeen.add(nk);
    noIdRows.push(payment);
  }

  const merged = [...idOrder.map((k) => byId.get(k)!), ...noIdRows];

  return merged.map((payment) => ({
    ...payment,
    projectId,
    projectName,
  }));
}

/**
 * Receivables: ensure each **approved** change order appears as a payment line (same ids/amounts as Budget).
 * If timeline milestones are not on the project list yet, inject rows from {@link getApprovedChangeOrderPaymentRows}
 * so Outstanding Receivables increases when a CO is approved.
 */
function mergeApprovedChangeOrderPaymentRowsIntoPaymentList(project: any, payments: TaxPayment[]): TaxPayment[] {
  const rows = getApprovedChangeOrderPaymentRows(project);
  if (!rows.length) return payments;

  const rowTitleKey = (title: string) => formatChangeOrderPaymentRowTitle(String(title ?? '').trim());

  const hasSameLine = (row: (typeof rows)[0]) => {
    if (payments.some((p) => String(p.id || '').trim() === row.id)) return true;
    const rk = rowTitleKey(row.title);
    return payments.some((p) => {
      const pk = rowTitleKey(String((p as any).title ?? (p as any).name ?? ''));
      return pk === rk && Math.abs(paymentAmount(p) - row.amount) < 0.02;
    });
  };

  const projectId = String(project?.id || '');
  const projectName = normalizeProjectName(project);
  const extras: TaxPayment[] = [];

  for (const row of rows) {
    if (hasSameLine(row)) continue;

    const raw = row.dateRaw ? String(row.dateRaw) : '';
    const dm = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    let sched =
      dm && !Number.isNaN(new Date(`${dm[1]}T12:00:00`).getTime()) ? dm[1] : '';
    if (!sched) {
      const cid = parseCoIdFromApprovedPaymentRowId(row.id);
      if (cid) {
        const co = collectUniqueChangeOrders(project).find((c: any) => String(c?.id ?? '') === cid);
        const d = co?.date ?? co?.createdAt ?? co?.updatedAt;
        const m = d ? String(d).match(/^(\d{4}-\d{2}-\d{2})/) : null;
        if (m) sched = m[1];
      }
    }
    if (!sched) {
      const candidates = [
        project?.projectData?.endISO,
        project?.endDate,
        project?.estimateData?.projectEndDate,
        project?.estimateData?.endDate,
      ];
      for (const c of candidates) {
        const m = c ? String(c).match(/^(\d{4}-\d{2}-\d{2})/) : null;
        if (m) {
          sched = m[1];
          break;
        }
      }
    }
    if (!sched) sched = new Date().toISOString().split('T')[0];

    extras.push({
      id: row.id,
      title: row.title,
      name: row.title,
      type: 'change_order',
      amount: row.amount,
      paymentAmount: row.amount,
      scheduledDate: sched,
      dueDate: sched,
      plannedDate: sched,
      status: 'pending',
      projectId,
      projectName,
    } as TaxPayment);
  }

  return [...payments, ...extras];
}

export function getTaxCenterDataInputs(
  projects: any[],
  expenses: TaxExpense[] = [],
  payments: TaxPayment[] = [],
  receipts: TaxReceipt[] = []
) {
  const projectTaxable = asArray<any>(projects).flatMap(collectTaxableExpenseLines);
  const projectPayments = asArray<any>(projects).flatMap(collectProjectPayments);
  return {
    expenses: [...projectTaxable, ...asArray<TaxExpense>(expenses)],
    payments: [...projectPayments, ...asArray<TaxPayment>(payments)],
    receipts: asArray<TaxReceipt>(receipts),
  };
}

/** Payments collected in the tax year (collection / paid date in year). */
export function getYearCollectedPayments(projects: any[], selectedYear: number): TaxPayment[] {
  const inputs = getTaxCenterDataInputs(projects);
  return inputs.payments.filter(
    (payment) =>
      isPaymentCollected(payment) &&
      dateInYear(paymentCollectedDate(payment), selectedYear)
  );
}

export function groupExpensesByTaxCategory(
  expenses: TaxExpense[],
  accountingLabelForCategory: (category: TaxCategory) => string = () => ''
): TaxCategoryRow[] {
  const rows = new Map<TaxCategory, TaxCategoryRow>();
  TAX_CATEGORIES.forEach((category) =>
    rows.set(category, { category, accountingLabel: accountingLabelForCategory(category), amount: 0, count: 0 })
  );

  asArray<TaxExpense>(expenses).forEach((expense) => {
    const category = mapExpenseToTaxCategory(expense);
    const current = rows.get(category) || {
      category,
      accountingLabel: accountingLabelForCategory(category),
      amount: 0,
      count: 0,
    };
    current.accountingLabel = accountingLabelForCategory(category);
    current.amount += expenseAmount(expense);
    current.count += 1;
    rows.set(category, current);
  });

  return TAX_CATEGORIES.map((category) => rows.get(category)!).filter((row) => row.amount > 0 || row.count > 0);
}

export function buildProjectTaxSummaries(projects: any[], selectedYear: number): ProjectTaxSummary[] {
  return asArray<any>(projects)
    .map((project) => {
      const projectId = String(project?.id || '');
      const taxable = collectTaxableExpenseLines(project).filter((e) =>
        isCashBasisExpensePaidInTaxYear(e, selectedYear, project)
      );
      const expensesPaid = taxable.reduce((sum, e) => sum + expenseAmount(e), 0);
      const payments = collectProjectPayments(project).filter(
        (payment) =>
          isPaymentCollected(payment) &&
          dateInYear(paymentCollectedDate(payment), selectedYear)
      );
      const cashCollectedInYear = payments.reduce((sum, payment) => sum + paymentAmount(payment), 0);
      const revenueCollected = cashCollectedInYear;
      const outstandingInvoices = calculateOutstandingInvoices(project, selectedYear);
      const netIncome = revenueCollected - expensesPaid;
      const receiptCount = collectAllProjectExpenseAndPoLines(project).filter(
        (e) => !!String(e.receiptUri ?? '').trim() && isExpenseRecordDatedInTaxYear(e, selectedYear, project)
      ).length;

      return {
        projectId,
        projectName: normalizeProjectName(project),
        revenueCollected,
        outstandingInvoices,
        expensesPaid,
        netIncome,
        margin: revenueCollected > 0 ? netIncome / revenueCollected : 0,
        receiptCount,
      };
    })
    .filter(
      (summary) =>
        summary.revenueCollected > 0 ||
        summary.outstandingInvoices > 0 ||
        summary.expensesPaid > 0 ||
        summary.receiptCount > 0
    )
    .sort((a, b) => Math.abs(b.netIncome) - Math.abs(a.netIncome));
}

export function buildSubcontractorPaymentSummary(
  expenses: TaxExpense[],
  selectedYear: number,
  vendors: Vendor[] = []
): SubcontractorPaymentSummary[] {
  const reviewThreshold = getPotential1099ReviewThreshold(selectedYear);
  const byVendor = new Map<string, SubcontractorPaymentSummary>();

  asArray<TaxExpense>(expenses)
    .filter((expense) => expenseCountsTowardSubcontractorPayments(expense, vendors))
    .forEach((expense) => {
      const name = String(expense.vendor || 'Unknown subcontractor').trim() || 'Unknown subcontractor';
      const current =
        byVendor.get(name) ||
        ({
          name,
          totalPaid: 0,
          projects: [],
          missingW9: true,
          potential1099Review: false,
          w9Uploaded: false,
          einPlaceholder: '—',
          addressPlaceholder: '—',
        } satisfies SubcontractorPaymentSummary);

      current.totalPaid += expenseAmount(expense);
      if (expense.projectName && !current.projects.includes(expense.projectName)) {
        current.projects.push(expense.projectName);
      }
      current.potential1099Review = current.totalPaid >= reviewThreshold;
      byVendor.set(name, current);
    });

  return Array.from(byVendor.values()).sort((a, b) => b.totalPaid - a.totalPaid);
}

/**
 * Portfolio cash revenue for the tax year: sum of payments actually collected in-year, per project once,
 * plus orphan in-year payments (no matching project id in the list).
 */
function grossRecognizedRevenueFromProjects(
  projects: any[],
  selectedYear: number,
  allPayments: TaxPayment[]
): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const project of asArray<any>(projects)) {
    const id = String(project?.id ?? '');
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    const cashInYear = collectProjectPayments(project)
      .filter(
        (payment) =>
          isPaymentCollected(payment) &&
          dateInYear(paymentCollectedDate(payment), selectedYear)
      )
      .reduce((s, p) => s + paymentAmount(p), 0);
    sum += cashInYear;
  }
  const projectIds = new Set(asArray<any>(projects).map((p) => String(p?.id ?? '')).filter(Boolean));
  const orphanSum = asArray<TaxPayment>(allPayments)
    .filter(
      (p) =>
        isPaymentCollected(p) &&
        dateInYear(paymentCollectedDate(p), selectedYear) &&
        (!p.projectId || !projectIds.has(String(p.projectId)))
    )
    .reduce((s, p) => s + paymentAmount(p), 0);
  return sum + orphanSum;
}

export function computeTaxCenterSummary(
  projects: any[],
  expenses: TaxExpense[] = [],
  payments: TaxPayment[] = [],
  receipts: TaxReceipt[] = [],
  selectedYear: number,
  vendors: Vendor[] = []
): TaxCenterSummary {
  /**
   * VALIDATION (read-only): Portfolio Tax Center uses `selectedYear`, cash-basis expense inclusion via
   * `isCashBasisExpensePaidInTaxYear`, revenue via `grossRecognizedRevenueFromProjects`, AR via
   * `calculateOutstandingInvoices` (informational), unpaid POs dated in-year.
   * Pending receivables / committed costs are not added to net income here. If any of that appears wrong,
   * add a TODO rather than changing formulas without an explicit product decision.
   */
  const inputs = getTaxCenterDataInputs(projects, expenses, payments, receipts);
  const yearExpenses = inputs.expenses.filter((expense) => {
    const pid = String(expense.projectId || '');
    const proj = pid ? projectByIdFromList(projects, pid) : undefined;
    return isCashBasisExpensePaidInTaxYear(expense, selectedYear, proj);
  });
  const yearReceipts = inputs.receipts.filter((receipt) =>
    dateInYear(receipt.date || receipt.createdAt, selectedYear)
  );

  const grossIncomeCollected = grossRecognizedRevenueFromProjects(projects, selectedYear, inputs.payments);
  const outstandingReceivables = asArray<any>(projects).reduce(
    (sum, project) => sum + calculateOutstandingInvoices(project, selectedYear),
    0
  );
  const committedCosts = asArray<any>(projects).reduce((sum, project) => {
    return (
      sum +
      collectUnpaidPurchaseOrderLines(project)
        .filter((po) => isExpenseInYear(po, selectedYear, project))
        .reduce((s, po) => s + expenseAmount(po), 0)
    );
  }, 0);

  const totalExpenses = yearExpenses.reduce((sum, expense) => sum + expenseAmount(expense), 0);
  const netProfit = grossIncomeCollected - totalExpenses;
  const subcontractorPayments = yearExpenses
    .filter((expense) => expenseCountsTowardSubcontractorPayments(expense, vendors))
    .reduce((sum, expense) => sum + expenseAmount(expense), 0);

  const seenReceiptKeys = new Set<string>();
  let receiptCount = 0;
  for (const project of asArray<any>(projects)) {
    const pid = String(project?.id || '');
    for (const e of collectAllProjectExpenseAndPoLines(project)) {
      const uri = String(e.receiptUri ?? '').trim();
      if (!uri || !isExpenseRecordDatedInTaxYear(e, selectedYear, project)) continue;
      const k = `${pid}|${String(e.id || '')}|${uri}|${expenseRecordDateForTaxYear(e) || ''}`;
      if (seenReceiptKeys.has(k)) continue;
      seenReceiptKeys.add(k);
      receiptCount += 1;
    }
  }
  for (const e of asArray<TaxExpense>(expenses)) {
    const pid = String(e.projectId || '');
    const proj = pid ? projectByIdFromList(projects, pid) : undefined;
    const uri = String(e.receiptUri ?? '').trim();
    if (!uri || !isExpenseRecordDatedInTaxYear(e, selectedYear, proj)) continue;
    const k = `extra|${pid}|${String(e.id || '')}|${uri}|${expenseRecordDateForTaxYear(e) || ''}`;
    if (seenReceiptKeys.has(k)) continue;
    seenReceiptKeys.add(k);
    receiptCount += 1;
  }
  receiptCount += yearReceipts.length;

  return {
    grossIncomeCollected,
    outstandingReceivables,
    totalExpenses,
    committedCosts,
    netProfit,
    netMargin: grossIncomeCollected > 0 ? netProfit / grossIncomeCollected : 0,
    subcontractorPayments,
    receiptCount,
  };
}

export function getTaxYearOptions(projects: any[], currentYear = new Date().getFullYear()): number[] {
  const years = new Set<number>([currentYear, currentYear - 1, currentYear - 2, currentYear - 3]);

  asArray<any>(projects).forEach((project) => {
    [
      project?.startDate,
      project?.endDate,
      project?.createdAt,
      project?.updatedAt,
      project?.projectData?.startISO,
      project?.projectData?.endISO,
      project?.estimateData?.projectStartDate,
      project?.estimateData?.projectEndDate,
      ...collectTaxableExpenseLines(project).map((e) => expenseDate(e)),
      ...collectAllProjectExpenseAndPoLines(project).map((e) => expenseRecordDateForTaxYear(e) || expenseDate(e)),
      ...collectProjectPayments(project).map(paymentDate),
      ...collectProjectInvoices(project).map((inv) => inv?.issueDate || inv?.createdAt),
    ].forEach((value) => {
      const date = parseDate(value);
      if (date) years.add(date.getFullYear());
    });
  });

  return Array.from(years).sort((a, b) => b - a);
}

/** Cash-basis expense lines paid/received in the selected tax year (paid POs + qualifying non-PO lines). */
export function getYearExpenses(projects: any[], selectedYear: number, expenses: TaxExpense[] = []): TaxExpense[] {
  const inputs = getTaxCenterDataInputs(projects, expenses);
  return inputs.expenses.filter((expense) => {
    const pid = String(expense.projectId || '');
    const proj = pid ? projectByIdFromList(projects, pid) : undefined;
    return isCashBasisExpensePaidInTaxYear(expense, selectedYear, proj);
  });
}

/** Expense/PO lines with a receipt attachment whose **record date** falls in the tax year (receipt backup manifest). */
export function getYearReceiptManifestExpenseLines(
  projects: any[],
  selectedYear: number,
  extra: TaxExpense[] = []
): TaxExpense[] {
  const fromProjects = asArray<any>(projects).flatMap((project) =>
    collectAllProjectExpenseAndPoLines(project).filter(
      (e) => !!String(e.receiptUri ?? '').trim() && isExpenseRecordDatedInTaxYear(e, selectedYear, project)
    )
  );
  const fromExtra = asArray<TaxExpense>(extra).filter((e) => {
    const pid = String(e.projectId || '');
    const proj = pid ? projectByIdFromList(projects, pid) : undefined;
    return !!String(e.receiptUri ?? '').trim() && isExpenseRecordDatedInTaxYear(e, selectedYear, proj);
  });
  return uniqueByKey([...fromProjects, ...fromExtra], (e, i) => {
    const id = String(e?.id || '').trim();
    const pid = String(e?.projectId || '').trim();
    return id ? `${pid}:${id}:${e.__isPurchaseOrder ? 'po' : 'exp'}` : `${pid}:idx:${i}:${expenseAmount(e)}`;
  });
}

export type ReceiptExportLine = {
  id?: string;
  projectId: string;
  projectName: string;
  monthKey: string;
  category: TaxCategory;
  amount: number;
  date?: string;
  receiptUri?: string | null;
  vendor?: string;
  notes?: string;
};

export type ReceiptExportBundle = {
  byProject: Record<string, ReceiptExportLine[]>;
  byMonth: Record<string, ReceiptExportLine[]>;
  byCategory: Partial<Record<TaxCategory, ReceiptExportLine[]>>;
};

/**
 * Prepare receipt lines grouped for future export (by project, month, category).
 */
export function groupReceiptsForExport(
  projects: any[],
  selectedYear: number,
  extraExpenses: TaxExpense[] = []
): ReceiptExportBundle {
  const combined: TaxExpense[] = [
    ...asArray<any>(projects).flatMap(collectAllProjectExpenseAndPoLines),
    ...asArray<TaxExpense>(extraExpenses),
  ];
  const taxable = uniqueByKey(combined, (e, i) => {
    const id = String(e?.id || '').trim();
    const pid = String(e?.projectId || '').trim();
    return id ? `${pid}:${id}:${e.__isPurchaseOrder ? 'po' : 'exp'}` : `${pid}:idx:${i}:${expenseAmount(e)}`;
  }).filter((e) => {
    const pid = String(e.projectId || '');
    const proj = pid ? projectByIdFromList(projects, pid) : undefined;
    return !!String(e.receiptUri ?? '').trim() && isExpenseRecordDatedInTaxYear(e, selectedYear, proj);
  });

  const byProject: Record<string, ReceiptExportLine[]> = {};
  const byMonth: Record<string, ReceiptExportLine[]> = {};
  const byCategory: Partial<Record<TaxCategory, ReceiptExportLine[]>> = {};

  taxable.forEach((e) => {
    const cat = mapExpenseToTaxCategory(e);
    const anchor = expenseRecordDateForTaxYear(e) || expenseDate(e);
    const d = parseDate(anchor);
    const monthKey = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'unknown';
    const pid = String(e.projectId || 'unassigned');
    const pname = String(e.projectName || 'Unassigned');
    const line: ReceiptExportLine = {
      id: e.id,
      projectId: pid,
      projectName: pname,
      monthKey,
      category: cat,
      amount: expenseAmount(e),
      date: anchor,
      receiptUri: e.receiptUri,
      vendor: e.vendor,
      notes: e.notes,
    };
    if (!byProject[pid]) byProject[pid] = [];
    byProject[pid].push(line);
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(line);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(line);
  });

  return { byProject, byMonth, byCategory };
}

export function buildRuleBasedTaxInsights(
  summary: TaxCenterSummary,
  categoryRows: TaxCategoryRow[],
  subcontractors: SubcontractorPaymentSummary[]
): string[] {
  const lines: string[] = [];
  if (summary.committedCosts > 0) {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    lines.push(
      `Expenses Paid (${fmt.format(summary.totalExpenses)}) plus open PO commitments (${fmt.format(summary.committedCosts)}) equals ${fmt.format(summary.totalExpenses + summary.committedCosts)} total recorded job spend. Net income in this summary uses Expenses Paid only—confirm with your CPA.`
    );
  }
  if (summary.netProfit > 0) {
    const reserve = Math.round(summary.netProfit * 0.25);
    lines.push(
      `Based on net profit in this summary, some businesses set aside approximately ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(reserve)} for estimated taxes. This is not tax advice—confirm with your CPA or tax professional.`
    );
  }
  const review = subcontractors.filter((s) => s.potential1099Review);
  if (review.length > 0) {
    const total = review.reduce((s, v) => s + v.totalPaid, 0);
    lines.push(
      `You paid ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(total)} to vendors flagged for Potential 1099 review. Confirm vendor eligibility, payment method, W-9 status, and filing requirements with your CPA or tax professional.`
    );
  }
  const top = [...categoryRows].sort((a, b) => b.amount - a.amount)[0];
  if (top && top.amount > 0) {
    lines.push(
      `Your largest recorded expense category this year was ${top.category}. Review deductibility and tax treatment with your CPA or tax professional.`
    );
  }
  if (lines.length === 0) {
    lines.push('Add collected payments and paid expenses to unlock more year-end insights.');
  }
  return lines.slice(0, 3);
}

export function customerNameFromProject(project: any): string {
  return String(
    project?.clientName ??
      project?.customerName ??
      project?.projectData?.clientName ??
      project?.estimateData?.clientName ??
      ''
  ).trim();
}

/**
 * Labels each **collected** payment row for drill-through only. Does not change revenue math.
 *
 * TODO (product / CPA review): Confirm whether all approved change-order cash collections are always
 * represented on `collectProjectPayment` rows today. If any approved CO cash is missing from Revenue
 * Collected, that would be a math change — do not implement without approval.
 */
export function classifyRevenuePaymentSource(
  payment: TaxPayment
): 'base_contract' | 'change_order' | 'unclassified' {
  const id = String(payment.id || '');
  const t = String((payment as { type?: string }).type || '').toLowerCase();
  if (t === 'change_order' || id.startsWith('bps-co-')) return 'change_order';
  if (t && !['milestone', 'payment', 'deposit', 'progress', 'invoice'].includes(t)) return 'unclassified';
  return 'base_contract';
}

/**
 * Same **payment row set** as portfolio Revenue Collected: per-project `collectProjectPayments` collected
 * in the selected year (duplicate project ids in the list skipped like `grossRecognizedRevenueFromProjects`)
 * plus orphan collected payments on `allPayments` whose `projectId` is missing or not in the list.
 */
export function getRevenueCollectedDetailPayments(
  projects: any[],
  selectedYear: number,
  allPayments: TaxPayment[]
): TaxPayment[] {
  const seenProject = new Set<string>();
  const rows: TaxPayment[] = [];
  const pushPayment = (p: TaxPayment) => {
    rows.push(p);
  };

  for (const project of asArray<any>(projects)) {
    const id = String(project?.id ?? '');
    if (id) {
      if (seenProject.has(id)) continue;
      seenProject.add(id);
    }
    const list = collectProjectPayments(project).filter(
      (payment) =>
        isPaymentCollected(payment) &&
        dateInYear(paymentCollectedDate(payment), selectedYear)
    );
    for (const p of list) pushPayment(p);
  }

  const projectIds = new Set(asArray<any>(projects).map((p) => String(p?.id ?? '')).filter(Boolean));
  for (const p of asArray<TaxPayment>(allPayments)) {
    if (!isPaymentCollected(p) || !dateInYear(paymentCollectedDate(p), selectedYear)) continue;
    if (!p.projectId || !projectIds.has(String(p.projectId))) {
      pushPayment(p);
    }
  }
  return rows;
}

export type OutstandingReceivableDetailRow = {
  projectId: string;
  projectName: string;
  customerName: string;
  lineKind: 'invoice' | 'milestone' | 'change_order' | 'approved_co_supplement';
  label: string;
  scheduledOrDue: string;
  amount: number;
  status: string;
};

/**
 * Line items behind **Outstanding Receivables** for drill-through. Mirrors `calculateOutstandingInvoices`
 * branches (invoice balance path vs open schedule path) plus the approved-CO supplement when present.
 */
export function getOutstandingReceivablesDetailRows(
  projects: any[],
  selectedYear: number
): OutstandingReceivableDetailRow[] {
  const out: OutstandingReceivableDetailRow[] = [];

  for (const project of asArray<any>(projects)) {
    const projectRowStart = out.length;
    const projectId = String(project?.id || '');
    const projectName = normalizeProjectName(project);
    const customerName = customerNameFromProject(project);

    const invoices = collectProjectInvoices(project).filter((inv) => {
      const status = String(inv?.status || '').toLowerCase();
      if (['cancelled', 'draft', 'void', 'archived'].includes(status)) return false;
      const d = inv?.issueDate || inv?.createdAt;
      return dateInYear(d, selectedYear);
    });

    const mergedPayments = mergeApprovedChangeOrderPaymentRowsIntoPaymentList(
      project,
      collectProjectPayments(project)
    );
    const openSchedule = mergedPayments.filter(
      (p) =>
        dateInYear(arMilestoneYearBucketDate(p), selectedYear) &&
        !isPaymentCollected(p) &&
        !isPaymentExcludedFromReceivables(p) &&
        !shouldExcludeChangeOrderPaymentFromOutstandingReceivables(project, p)
    );
    const coSupplement = approvedChangeOrderReceivableSupplement(project, selectedYear, openSchedule);

    if (invoices.length > 0) {
      for (const inv of invoices) {
        const balance = invoiceOpenBalance(inv);
        if (balance <= 0) continue;
        out.push({
          projectId,
          projectName,
          customerName,
          lineKind: 'invoice',
          label: String(inv.number || inv.id || 'Invoice').trim() || 'Invoice',
          scheduledOrDue: String(inv.dueDate || inv.issueDate || inv.createdAt || '').trim(),
          amount: balance,
          status: String(inv.status || 'Open').trim() || 'Open',
        });
      }
      if (coSupplement > 0) {
        out.push({
          projectId,
          projectName,
          customerName,
          lineKind: 'approved_co_supplement',
          label: 'Approved change orders / milestones (receivable supplement)',
          scheduledOrDue: '',
          amount: coSupplement,
          status: 'Supplement (see Budget / Timeline)',
        });
      }
    } else {
      for (const p of openSchedule) {
        const id = String(p.id || '');
        const t = String((p as { type?: string }).type || '').toLowerCase();
        const isCo = t === 'change_order' || id.startsWith('bps-co-');
        out.push({
          projectId,
          projectName,
          customerName,
          lineKind: isCo ? 'change_order' : 'milestone',
          label: String(p.title || p.name || p.description || 'Scheduled payment').trim(),
          scheduledOrDue: String(arMilestoneYearBucketDate(p) || paymentDate(p) || '').trim(),
          amount: paymentAmount(p),
          status: 'Uncollected',
        });
      }
      if (coSupplement > 0) {
        out.push({
          projectId,
          projectName,
          customerName,
          lineKind: 'approved_co_supplement',
          label: 'Approved change orders / milestones (receivable supplement)',
          scheduledOrDue: '',
          amount: coSupplement,
          status: 'Supplement (see Budget / Timeline)',
        });
      }
    }

    let remaining = projectReceivableCeiling(project, mergedPayments);
    for (let i = projectRowStart; i < out.length; i += 1) {
      const amount = Math.min(out[i].amount, Math.max(0, remaining));
      out[i] = { ...out[i], amount };
      remaining -= amount;
    }
    out.splice(
      projectRowStart,
      out.length - projectRowStart,
      ...out.slice(projectRowStart).filter((row) => row.amount > 0)
    );
  }

  return out;
}

export type CommittedCostDetailRow = {
  projectName: string;
  vendor: string;
  poLabel: string;
  committedDate: string;
  amount: number;
  status: string;
  includedInCashBasis: string;
};

export function getCommittedCostsDetailRows(projects: any[], selectedYear: number): CommittedCostDetailRow[] {
  const rows: CommittedCostDetailRow[] = [];
  for (const project of asArray<any>(projects)) {
    const projectName = normalizeProjectName(project);
    for (const po of collectUnpaidPurchaseOrderLines(project)) {
      if (!isExpenseInYear(po, selectedYear, project)) continue;
      rows.push({
        projectName,
        vendor: String(po.vendor || '').trim() || '—',
        poLabel: String(po.id || (po as { poNumber?: string }).poNumber || 'PO').trim(),
        committedDate: String(poDate(po) || '').trim(),
        amount: expenseAmount(po),
        status: String(po.status || 'pending').trim(),
        includedInCashBasis: 'No',
      });
    }
  }
  return rows;
}

export type ReceiptCountDetailRow = {
  projectName: string;
  vendor: string;
  expenseDate: string;
  category: TaxCategory;
  amount: number;
  receiptStatus: string;
  attachmentName: string;
  source: 'expense' | 'purchase_order';
};

/**
 * Receipt-backed lines counted in portfolio **Receipt count** (same de-dupe keys as `computeTaxCenterSummary`).
 */
export function getReceiptCountDetailRows(
  projects: any[],
  selectedYear: number,
  extraExpenses: TaxExpense[] = []
): ReceiptCountDetailRow[] {
  const rows: ReceiptCountDetailRow[] = [];
  const seenReceiptKeys = new Set<string>();

  const pushLine = (e: TaxExpense, pid: string, project: any | undefined) => {
    const uri = String(e.receiptUri ?? '').trim();
    if (!uri) return;
    if (!isExpenseRecordDatedInTaxYear(e, selectedYear, project)) return;
    const k = `${pid}|${String(e.id || '')}|${uri}|${expenseRecordDateForTaxYear(e) || ''}`;
    if (seenReceiptKeys.has(k)) return;
    seenReceiptKeys.add(k);
    rows.push({
      projectName: String(e.projectName || '').trim() || 'Unassigned',
      vendor: String(e.vendor || e.vendorName || '').trim() || '—',
      expenseDate: String(expenseRecordDateForTaxYear(e) || expenseDate(e) || '').trim(),
      category: mapExpenseToTaxCategory(e),
      amount: expenseAmount(e),
      receiptStatus: 'Attached',
      attachmentName: uri.split(/[/\\]/).pop() || uri,
      source: e.__isPurchaseOrder ? 'purchase_order' : 'expense',
    });
  };

  for (const project of asArray<any>(projects)) {
    const pid = String(project?.id || '');
    for (const e of collectAllProjectExpenseAndPoLines(project)) {
      pushLine(e, pid, project);
    }
  }
  for (const e of asArray<TaxExpense>(extraExpenses)) {
    const pid = String(e.projectId || '');
    const proj = pid ? projectByIdFromList(projects, pid) : undefined;
    pushLine(e, pid || 'extra', proj);
  }
  return rows;
}

export type TaxYearBucketAnomalies = {
  paymentsMissingCollectedDate: number;
  expensesMissingPaidDate: number;
};

/**
 * Readiness-only counts (does not change Tax Center totals). Surfaces rows where primary paid/collected
 * dates are blank so the UI can warn without inventing dates.
 */
export function getTaxCenterYearBucketAnomalies(
  projects: any[],
  selectedYear: number,
  extraExpenses: TaxExpense[] = []
): TaxYearBucketAnomalies {
  const inputs = getTaxCenterDataInputs(projects, extraExpenses);
  let paymentsMissingCollectedDate = 0;
  for (const p of inputs.payments) {
    if (!isPaymentCollected(p) || !dateInYear(paymentDate(p), selectedYear)) continue;
    const hasPrimary =
      !!String(p.actualDate || '').trim() ||
      !!String(p.collectedAt || '').trim() ||
      !!String(p.paidAt || '').trim() ||
      !!String(p.paymentDate || '').trim();
    if (!hasPrimary) paymentsMissingCollectedDate += 1;
  }

  let expensesMissingPaidDate = 0;

  for (const e of inputs.expenses) {
    if (!isCashBasisExpensePaidInTaxYear(e, selectedYear)) {
      if (
        e.__isPurchaseOrder &&
        isPoPaidForTax(e) &&
        !String(cashBasisPoPaidYearDate(e) || '').trim() &&
        dateInYear(poDate(e), selectedYear)
      ) {
        expensesMissingPaidDate += 1;
      }
    }
  }

  return {
    paymentsMissingCollectedDate,
    expensesMissingPaidDate,
  };
}
