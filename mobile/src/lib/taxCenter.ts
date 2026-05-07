import type { Vendor, VendorType } from '@/src/lib/vendorTypes';
import { getProjectRevenue } from '@/lib/projectRevenue';

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
  /**
   * Recognized revenue for the tax year: per project, cash collected in-year, except **completed**
   * jobs use **adjusted contract value** (approved change orders included), matching Budget.
   */
  grossIncomeCollected: number;
  outstandingReceivables: number;
  /**
   * Cash-style “paid” job costs for the tax year: project expenses dated in-year plus purchase
   * orders treated as paid/received (`isPoPaidForTax`: Received, Paid/Complete, or `isPaid`).
   * Pending POs are excluded here and appear under `committedCosts` (matches Budget committed POs).
   */
  totalExpenses: number;
  /** Sum of **Pending** purchase orders only (not yet received/paid); aligns with Budget “Committed POs”. */
  committedCosts: number;
  /** Tax-year: `grossIncomeCollected - totalExpenses` (revenue rule above). */
  netProfit: number;
  /** Net Income / Revenue Collected; null when no collected revenue */
  netMargin: number | null;
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
  /**
   * Completed: **adjusted contract value** (`getProjectRevenue` — includes approved COs).
   * Otherwise: milestone payments marked collected with dates in this tax year.
   */
  revenueCollected: number;
  outstandingInvoices: number;
  expensesPaid: number;
  netIncome: number;
  margin: number | null;
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

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
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
  payment?.collectedAt ||
  payment?.paidAt ||
  payment?.paymentDate ||
  payment?.scheduledDate ||
  payment?.dueDate ||
  payment?.plannedDate ||
  payment?.date;

const isExpenseInYear = (expense: any, year: number, project?: any): boolean => {
  const date = expense.__isPurchaseOrder ? poDate(expense) : expenseDate(expense);
  if (date) return dateInYear(date, year);
  return project ? projectOverlapsYear(project, year) : false;
};

const isPaymentCollected = (payment: any): boolean => {
  const status = String(payment?.status || '').toLowerCase();
  return (
    payment?.paid === true ||
    payment?.collected === true ||
    payment?.isPaid === true ||
    status === 'paid' ||
    status === 'collected' ||
    status === 'completed' ||
    status === 'complete'
  );
};

const paymentAmount = (payment: any): number =>
  toNumber(payment?.collectedAmount ?? payment?.paidAmount ?? payment?.amount ?? payment?.paymentAmount);

export const expenseAmount = (expense: any): number => toNumber(expense?.amount ?? expense?.total ?? expense?.cost);

const normalizeProjectName = (project: any): string =>
  String(project?.title || project?.name || project?.projectData?.title || project?.estimateData?.title || 'Untitled Project');

/** Job closed — tax revenue uses adjusted contract (includes approved change orders). */
export function isProjectTaxCompleted(project: any): boolean {
  const raw = project?.status ?? project?.projectData?.status;
  const s = String(raw ?? '').toLowerCase().replace(/\s+/g, '_');
  return s === 'completed';
}

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
 * PO amounts that count as realized spend for tax summaries (same meaning as Budget: Received = paid).
 * Pending = still committed; Cancelled/Archived are excluded from both paid and committed buckets.
 */
export function isPoPaidForTax(po: any): boolean {
  if (po?.isPaid === true) return true;
  const status = String(po?.status || '').toLowerCase();
  if (status === 'cancelled' || status === 'archived') return false;
  return (
    status === 'paid' ||
    status === 'completed' ||
    status === 'complete' ||
    status === 'received'
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

/** Taxable expense lines: regular expenses + only paid POs */
export function collectTaxableExpenseLines(project: any): TaxExpense[] {
  const regular = collectProjectExpenseLinesOnly(project);
  const pos = collectProjectPurchaseOrderLines(project).filter((po) => isPoPaidForTax(po));
  return [...regular, ...pos];
}

/** Pending POs only — matches Budget “Committed POs” (excludes Received, Cancelled, Archived). */
export function collectUnpaidPurchaseOrderLines(project: any): TaxExpense[] {
  return collectProjectPurchaseOrderLines(project).filter(
    (po) => String(po?.status || '').toLowerCase() === 'pending'
  );
}

function collectProjectInvoices(project: any): any[] {
  const sources = [project?.invoices, project?.projectData?.invoices, project?.estimateData?.invoices];
  return uniqueByKey(sources.flatMap((s) => asArray<any>(s)), (inv, i) =>
    inv?.id ? String(inv.id) : `inv:${i}:${inv?.number || ''}`
  );
}

/**
 * Outstanding receivables for a project in a tax year: **uncollected** amounts still expected
 * (invoice balances dated in the year, or — if there are no invoices — payment milestones dated
 * in the year that are not yet marked collected).
 *
 * **Completed** jobs return **0**: revenue is recognized at adjusted contract (includes change orders);
 * milestone totals may not match that number even when the job is closed, so we do not show synthetic AR.
 */
export function calculateOutstandingInvoices(project: any, selectedYear: number): number {
  if (isProjectTaxCompleted(project)) {
    return 0;
  }

  const invoices = collectProjectInvoices(project).filter((inv) => {
    if (String(inv?.status || '').toLowerCase() === 'cancelled') return false;
    const d = inv?.issueDate || inv?.createdAt;
    return dateInYear(d, selectedYear);
  });

  if (invoices.length > 0) {
    const billed = invoices.reduce((sum, inv) => {
      const total = toNumber(inv.total ?? inv.subtotal);
      const paidOnInvoice = toNumber(inv.paidAmount);
      const balance =
        inv.balance != null && inv.balance !== ''
          ? Math.max(0, toNumber(inv.balance))
          : Math.max(0, total - paidOnInvoice);
      return sum + balance;
    }, 0);
    return Math.max(0, billed);
  }

  // No invoice records: use scheduled payments dated in year that are not yet collected.
  const openSchedule = collectProjectPayments(project).filter(
    (p) => dateInYear(paymentDate(p), selectedYear) && !isPaymentCollected(p)
  );
  return openSchedule.reduce((s, p) => s + paymentAmount(p), 0);
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
  const payments = sources.flatMap((source) => asArray<TaxPayment>(source));

  return uniqueByKey(payments, (payment, index) => {
    const id = payment?.id;
    const label = payment?.title || payment?.name || payment?.description || '';
    return id ? `${projectId}:${id}` : `${projectId}:${index}:${label}:${paymentAmount(payment)}:${paymentDate(payment) || ''}`;
  }).map((payment) => ({
    ...payment,
    projectId,
    projectName,
  }));
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

/** Payments collected in the tax year (cash dates in year). Portfolio revenue also applies completed-job adjusted contract — see `computeTaxCenterSummary`. */
export function getYearCollectedPayments(projects: any[], selectedYear: number): TaxPayment[] {
  const inputs = getTaxCenterDataInputs(projects);
  return inputs.payments.filter(
    (payment) => isPaymentCollected(payment) && dateInYear(paymentDate(payment), selectedYear)
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
      const taxable = collectTaxableExpenseLines(project).filter((e) => isExpenseInYear(e, selectedYear, project));
      const expensesPaid = taxable.reduce((sum, e) => sum + expenseAmount(e), 0);
      const payments = collectProjectPayments(project).filter(
        (payment) => isPaymentCollected(payment) && dateInYear(paymentDate(payment), selectedYear)
      );
      const cashCollectedInYear = payments.reduce((sum, payment) => sum + paymentAmount(payment), 0);
      const adjustedContract = getProjectRevenue(project);
      const revenueCollected =
        isProjectTaxCompleted(project) && adjustedContract > 0 ? adjustedContract : cashCollectedInYear;
      const outstandingInvoices = calculateOutstandingInvoices(project, selectedYear);
      const netIncome = revenueCollected - expensesPaid;
      const receiptCount = taxable.filter((e) => !!e.receiptUri).length;

      return {
        projectId,
        projectName: normalizeProjectName(project),
        revenueCollected,
        outstandingInvoices,
        expensesPaid,
        netIncome,
        margin: revenueCollected > 0 ? netIncome / revenueCollected : null,
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
  const byVendor = new Map<string, SubcontractorPaymentSummary>();

  asArray<TaxExpense>(expenses)
    .filter((expense) => dateInYear(expenseDate(expense), selectedYear))
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
      current.potential1099Review = current.totalPaid >= 600;
      byVendor.set(name, current);
    });

  return Array.from(byVendor.values()).sort((a, b) => b.totalPaid - a.totalPaid);
}

/**
 * Portfolio gross for the tax year: each project once — cash collected in-year, except **completed**
 * jobs use **adjusted contract value** (includes approved change orders). Adds orphan in-year payments
 * (no matching project id in the list).
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
      .filter((payment) => isPaymentCollected(payment) && dateInYear(paymentDate(payment), selectedYear))
      .reduce((s, p) => s + paymentAmount(p), 0);
    if (isProjectTaxCompleted(project)) {
      const adj = getProjectRevenue(project);
      sum += adj > 0 ? adj : cashInYear;
    } else {
      sum += cashInYear;
    }
  }
  const projectIds = new Set(asArray<any>(projects).map((p) => String(p?.id ?? '')).filter(Boolean));
  const orphanSum = asArray<TaxPayment>(allPayments)
    .filter(
      (p) =>
        isPaymentCollected(p) &&
        dateInYear(paymentDate(p), selectedYear) &&
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
  const inputs = getTaxCenterDataInputs(projects, expenses, payments, receipts);
  const yearExpenses = inputs.expenses.filter((expense) => dateInYear(expenseDate(expense), selectedYear));
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
  const receiptsFromExpenses = yearExpenses.filter((expense) => !!expense.receiptUri).length;

  return {
    grossIncomeCollected,
    outstandingReceivables,
    totalExpenses,
    committedCosts,
    netProfit,
    netMargin: grossIncomeCollected > 0 ? netProfit / grossIncomeCollected : null,
    subcontractorPayments,
    receiptCount: receiptsFromExpenses + yearReceipts.length,
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
      ...collectProjectPayments(project).map(paymentDate),
      ...collectProjectInvoices(project).map((inv) => inv?.issueDate || inv?.createdAt),
    ].forEach((value) => {
      const date = parseDate(value);
      if (date) years.add(date.getFullYear());
    });
  });

  return Array.from(years).sort((a, b) => b - a);
}

/** Taxable expense lines for the year (paid POs + regular expenses) */
export function getYearExpenses(projects: any[], selectedYear: number, expenses: TaxExpense[] = []): TaxExpense[] {
  const inputs = getTaxCenterDataInputs(projects, expenses);
  return inputs.expenses.filter((expense) => dateInYear(expenseDate(expense), selectedYear));
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
  const taxable = [
    ...asArray<any>(projects).flatMap(collectTaxableExpenseLines),
    ...asArray<TaxExpense>(extraExpenses),
  ].filter((e) => dateInYear(expenseDate(e), selectedYear) && !!e.receiptUri);

  const byProject: Record<string, ReceiptExportLine[]> = {};
  const byMonth: Record<string, ReceiptExportLine[]> = {};
  const byCategory: Partial<Record<TaxCategory, ReceiptExportLine[]>> = {};

  taxable.forEach((e) => {
    const cat = mapExpenseToTaxCategory(e);
    const d = parseDate(expenseDate(e));
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
      date: expenseDate(e),
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
