import type { Tax1099ReviewSummary } from '@/src/lib/tax1099Review';
import type { TaxCategoryRow, TaxExpense, TaxCenterSummary } from '@/src/lib/taxCenter';
import { ACCOUNTING_CATEGORY_MAPPING_ENABLED } from '@/src/lib/taxCenterLaunchFlags';

export type ReadinessChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
};

export type TaxCenterReadinessResult = {
  allReady: boolean;
  missingReceipts: number;
  unmappedCategories: number;
  missingW9: number;
  missingPaymentMethod: number;
  potential1099Review: number;
  revenueNeedsAttention: boolean;
  checklist: ReadinessChecklistItem[];
  missingSummaryLines: string[];
};

function countMissingReceipts(yearExpenses: TaxExpense[]): number {
  return yearExpenses.filter((e) => {
    const amt =
      typeof e.amount === 'number'
        ? e.amount
        : Number(String(e.amount ?? '').replace(/[$,\s]/g, '')) || 0;
    if (!Number.isFinite(amt) || amt === 0) return false;
    const uri = String(e.receiptUri ?? '').trim();
    return !uri;
  }).length;
}

export function computeTaxCenterReadiness(args: {
  summary: TaxCenterSummary;
  categoryRows: TaxCategoryRow[];
  yearExpenses: TaxExpense[];
  review1099: Tax1099ReviewSummary;
}): TaxCenterReadinessResult {
  const { summary, categoryRows, yearExpenses, review1099 } = args;

  const missingReceipts = countMissingReceipts(yearExpenses);
  const unmappedCategories = categoryRows.filter((r) => !String(r.accountingLabel || '').trim()).length;

  const revenueNeedsAttention =
    summary.totalExpenses > 0 && summary.grossIncomeCollected === 0;

  const checklist: ReadinessChecklistItem[] = [
    {
      id: 'revenue',
      label: 'Revenue reviewed',
      ok: !revenueNeedsAttention,
    },
    {
      id: 'categories',
      label: 'Expenses categorized',
      ok: ACCOUNTING_CATEGORY_MAPPING_ENABLED ? unmappedCategories === 0 : true,
    },
    {
      id: 'receipts',
      label: 'Receipts attached',
      ok: missingReceipts === 0,
    },
    {
      id: 'vendors',
      label: 'Vendors reviewed',
      ok: review1099.missingVendorInfoCount === 0,
    },
    {
      id: 'w9',
      label: 'W-9 / 1099 flags checked',
      ok: review1099.missingW9Count === 0,
    },
    {
      id: 'export',
      label: 'Accountant export ready',
      ok:
        missingReceipts === 0 &&
        (ACCOUNTING_CATEGORY_MAPPING_ENABLED ? unmappedCategories === 0 : true) &&
        review1099.missingW9Count === 0 &&
        review1099.paymentsMissingMethodCount === 0 &&
        !revenueNeedsAttention,
    },
  ];

  const missingSummaryLines: string[] = [];
  if (missingReceipts > 0) {
    missingSummaryLines.push(`${missingReceipts} expense${missingReceipts === 1 ? '' : 's'} missing receipts`);
  }
  if (ACCOUNTING_CATEGORY_MAPPING_ENABLED && unmappedCategories > 0) {
    missingSummaryLines.push(
      `${unmappedCategories} categor${unmappedCategories === 1 ? 'y' : 'ies'} unmapped`
    );
  }
  if (review1099.missingW9Count > 0) {
    missingSummaryLines.push(
      `${review1099.missingW9Count} vendor${review1099.missingW9Count === 1 ? '' : 's'} missing W-9 status`
    );
  }
  if (review1099.paymentsMissingMethodCount > 0) {
    missingSummaryLines.push(
      `${review1099.paymentsMissingMethodCount} vendor${review1099.paymentsMissingMethodCount === 1 ? '' : 's'} missing payment method`
    );
  }
  if (review1099.potential1099VendorCount > 0) {
    missingSummaryLines.push(
      `${review1099.potential1099VendorCount} Potential 1099 review vendor${review1099.potential1099VendorCount === 1 ? '' : 's'}`
    );
  }

  const allReady = checklist.every((c) => c.ok);

  return {
    allReady,
    missingReceipts,
    unmappedCategories,
    missingW9: review1099.missingW9Count,
    missingPaymentMethod: review1099.paymentsMissingMethodCount,
    potential1099Review: review1099.potential1099VendorCount,
    revenueNeedsAttention,
    checklist,
    missingSummaryLines,
  };
}
