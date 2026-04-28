import type {
  ProjectTaxSummary,
  ReceiptExportBundle,
  SubcontractorPaymentSummary,
  TaxCategoryRow,
  TaxCenterSummary,
} from '@/src/lib/taxCenter';

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
    netMargin: number | null;
    subcontractorPayments: number;
    receiptCount: number;
  };
  expenseCategories: Array<{
    category: string;
    amount: number;
    itemCount: number;
  }>;
  projectSummaries: Array<{
    projectName: string;
    revenueCollected: number;
    outstandingInvoices: number;
    expensesPaid: number;
    netIncome: number;
    receiptCount: number;
    netMargin: number | null;
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
  }>;
  aiTaxInsight: string;
};

function flattenReceiptExportBundle(bundle: ReceiptExportBundle): TaxSummaryExportPayload['receipts'] {
  const lines = Object.values(bundle.byProject).flat();
  const seen = new Set<string>();
  const out: TaxSummaryExportPayload['receipts'] = [];
  for (const line of lines) {
    const key = `${line.receiptUri || ''}|${line.date || ''}|${line.amount}|${line.projectName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      projectName: line.projectName,
      date: line.date || '',
      month: line.monthKey,
      category: line.category,
      vendor: line.vendor || '',
      amount: line.amount,
      receiptUri: String(line.receiptUri || ''),
    });
  }
  return out;
}

export function buildTaxSummaryExportPayload(input: {
  selectedYear: number;
  summary: TaxCenterSummary;
  expenseCategories: TaxCategoryRow[];
  projectSummaries: ProjectTaxSummary[];
  subcontractorSummary: SubcontractorPaymentSummary[];
  receiptGroups: ReceiptExportBundle;
  aiTaxInsight: string | string[];
}): TaxSummaryExportPayload {
  const { selectedYear, summary, expenseCategories, projectSummaries, subcontractorSummary, receiptGroups, aiTaxInsight } =
    input;
  const dateRangeLabel = `Jan 1 - Dec 31, ${selectedYear}`;
  const generatedAtDisplay = formatTaxExportGeneratedAtDisplay();
  const insightText = Array.isArray(aiTaxInsight) ? aiTaxInsight.join('\n') : aiTaxInsight;

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
    expenseCategories: expenseCategories.map((row) => ({
      category: row.category,
      amount: row.amount,
      itemCount: row.count,
    })),
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
    receipts: flattenReceiptExportBundle(receiptGroups),
    aiTaxInsight: insightText,
  };
}
