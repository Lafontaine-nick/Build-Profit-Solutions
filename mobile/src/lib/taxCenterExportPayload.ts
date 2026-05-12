import type {
  ProjectTaxSummary,
  SubcontractorPaymentSummary,
  TaxCategory,
  TaxCategoryRow,
  TaxCenterSummary,
  TaxExpense,
  TaxPayment,
} from '@/src/lib/taxCenter';
import {
  expenseAmount,
  expenseDate,
  expenseRecordDateForTaxYear,
  getYearReceiptManifestExpenseLines,
  mapExpenseToTaxCategory,
} from '@/src/lib/taxCenter';
import type { Vendor } from '@/src/lib/vendorTypes';
import {
  buildExpenseTransactionExportRows,
  buildRevenuePaymentExportRows,
  type ExpenseTransactionExportRow,
  type RevenuePaymentExportRow,
} from '@/src/lib/taxExportDetailRows';

export function formatTaxExportGeneratedAtDisplay(at: Date = new Date()): string {
  const datePart = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart} at ${timePart}`;
}

export type TaxSummaryExportPayload = {
  selectedYear: number;
  dateRangeLabel: string;
  /** Human-readable timestamp for exports only (never ISO). */
  generatedAtDisplay: string;
  portfolioSummary: {
    revenueCollected: number;
    outstandingReceivables: number;
    expensesPaid: number;
    committedCosts: number;
    netIncome: number;
    netMargin: number;
    subcontractorPayments: number;
    receiptCount: number;
  };
  expenseCategories: Array<{
    category: string;
    /** User mapping label, or empty when unmapped (exports may show "Needs review"). */
    accountingOrQuickBooksCategory: string;
    amount: number;
    itemCount: number;
  }>;
  /** Category → accounting label for workbook-only tabs (includes unmapped categories). */
  quickBooksCategoryMap: Partial<Record<TaxCategory, string>>;
  projectSummaries: Array<{
    projectName: string;
    revenueCollected: number;
    outstandingInvoices: number;
    expensesPaid: number;
    netIncome: number;
    receiptCount: number;
    netMargin: number;
  }>;
  subcontractors: Array<{
    vendorName: string;
    totalPaid: number;
    projectNames: string[];
    w9Uploaded: boolean;
    potential1099Review: boolean;
  }>;
  receipts: Array<{
    projectName: string;
    date: string;
    month: string;
    category: string;
    vendor: string;
    amount: number;
    receiptUri: string;
    /** Receipt filename when attached; empty when missing. */
    receiptFileName: string;
    /** User notes from the expense line when available. */
    notes: string;
  }>;
  expenseTransactions: ExpenseTransactionExportRow[];
  revenuePayments: RevenuePaymentExportRow[];
  /** From Profile → Edit Profile (bps.contractorProfile); shown on tax exports when set. */
  contractorContactEmail?: string | null;
  /** Company name from Profile storage (bps.contractorProfile.company); CPA PDF header only. */
  contractorCompanyName?: string | null;
  aiTaxInsight: string;
};

function monthKeyFromRawDate(raw: string | undefined): string {
  if (!raw) return 'unknown';
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** All tax-year expense lines for receipt backup (includes missing attachments). */
function buildReceiptManifestFromYearExpenses(yearExpenses: TaxExpense[]): TaxSummaryExportPayload['receipts'] {
  const seen = new Set<string>();
  const out: TaxSummaryExportPayload['receipts'] = [];
  for (const e of yearExpenses) {
    const uri = String(e.receiptUri ?? '').trim();
    const anchor = expenseRecordDateForTaxYear(e) || expenseDate(e) || '';
    const key = `${uri}|${anchor}|${expenseAmount(e)}|${String(e.projectName ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fname = uri ? uri.split(/[/\\]/).pop() || '' : '';
    out.push({
      projectName: String(e.projectName || '').trim() || 'Unassigned',
      date: anchor,
      month: monthKeyFromRawDate(anchor),
      category: mapExpenseToTaxCategory(e),
      vendor: String(e.vendor || e.vendorName || '').trim(),
      amount: expenseAmount(e),
      receiptUri: uri,
      receiptFileName: fname.length > 120 ? `${fname.slice(0, 117)}…` : fname,
      notes: String(e.notes || '').trim(),
    });
  }
  return out;
}

export function buildTaxSummaryExportPayload(input: {
  selectedYear: number;
  summary: TaxCenterSummary;
  expenseCategories: TaxCategoryRow[];
  quickBooksCategoryMap: Partial<Record<TaxCategory, string>>;
  projectSummaries: ProjectTaxSummary[];
  subcontractorSummary: SubcontractorPaymentSummary[];
  aiTaxInsight: string | string[];
  /** Projects list (for revenue row customer / outstanding lookup). */
  projects: any[];
  /** Paid expense lines for the selected tax year. */
  yearExpenses: TaxExpense[];
  /** Collected payments in the tax year (same basis as Tax Center revenue). */
  yearCollectedPayments: TaxPayment[];
  vendors: Vendor[];
}): TaxSummaryExportPayload {
  const {
    selectedYear,
    summary,
    expenseCategories,
    quickBooksCategoryMap,
    projectSummaries,
    subcontractorSummary,
    aiTaxInsight,
    projects,
    yearExpenses,
    yearCollectedPayments,
    vendors,
  } = input;
  const dateRangeLabel = `Jan 1 - Dec 31, ${selectedYear}`;
  const generatedAtDisplay = formatTaxExportGeneratedAtDisplay();
  const insightText = Array.isArray(aiTaxInsight) ? aiTaxInsight.join('\n') : aiTaxInsight;

  const categoryToAccountingLabel = (cat: TaxCategory): string => {
    const raw = quickBooksCategoryMap[cat];
    return typeof raw === 'string' ? raw.trim() : '';
  };

  const expenseTransactions = buildExpenseTransactionExportRows(yearExpenses, vendors, categoryToAccountingLabel);
  const revenuePayments = buildRevenuePaymentExportRows(
    projects,
    yearCollectedPayments,
    projectSummaries,
    selectedYear
  );

  const receiptManifestLines = getYearReceiptManifestExpenseLines(projects, selectedYear, []);
  const receipts = buildReceiptManifestFromYearExpenses(receiptManifestLines);

  return {
    selectedYear,
    dateRangeLabel,
    generatedAtDisplay,
    portfolioSummary: {
      revenueCollected: summary.grossIncomeCollected,
      outstandingReceivables: summary.outstandingReceivables,
      expensesPaid: summary.totalExpenses,
      committedCosts: summary.committedCosts,
      netIncome: summary.netProfit,
      netMargin: summary.netMargin,
      subcontractorPayments: summary.subcontractorPayments,
      receiptCount: summary.receiptCount,
    },
    expenseCategories: expenseCategories.map((row) => {
      const raw = row.accountingLabel?.trim() || '';
      return {
        category: row.category,
        accountingOrQuickBooksCategory: raw,
        amount: row.amount,
        itemCount: row.count,
      };
    }),
    quickBooksCategoryMap,
    projectSummaries: projectSummaries.map((p) => ({
      projectName: p.projectName,
      revenueCollected: p.revenueCollected,
      outstandingInvoices: p.outstandingInvoices,
      expensesPaid: p.expensesPaid,
      netIncome: p.netIncome,
      receiptCount: p.receiptCount,
      netMargin: p.margin,
    })),
    subcontractors: subcontractorSummary.map((s) => ({
      vendorName: s.name,
      totalPaid: s.totalPaid,
      projectNames: [...s.projects],
      w9Uploaded: s.w9Uploaded,
      potential1099Review: s.potential1099Review,
    })),
    receipts,
    expenseTransactions,
    revenuePayments,
    aiTaxInsight: insightText,
  };
}
