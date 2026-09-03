import { useEffect, useMemo, useState } from 'react';
import { deriveEstimateFeedbackFromBudgetData } from '@/utils/estimateFeedback';
import { normalizeExpenseForMatching } from '@/utils/rateInsightComparisons';
import { submitCloseoutCalibration } from '@/utils/contractorPricingMemory';
import {
  ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS,
  resolveUnlinkedCategoryLabel,
  shouldShowEstimateVsActualCard,
} from '@/utils/estimateVsActualCard';

type BudgetBucket = {
  id?: string;
  stableId?: string;
  name?: string;
  budget?: number;
};

type BudgetLine = {
  id: string;
  category: string;
  qty?: number;
  unit?: string;
  unitCost?: number;
};

export type UseProjectEstimateFeedbackParams = {
  projectId: string;
  status?: string;
  buckets: BudgetBucket[];
  budgetLines?: BudgetLine[];
  expenses: unknown[];
  changeOrders: unknown[];
  plannedBudget: number;
  finalCustomerPrice: number;
  calibrationProjectLike: Record<string, unknown>;
  categoryNames: string[];
  enabled?: boolean;
};

export function useProjectEstimateFeedback({
  projectId,
  status,
  buckets,
  budgetLines,
  expenses,
  changeOrders,
  plannedBudget,
  finalCustomerPrice,
  calibrationProjectLike,
  categoryNames,
  enabled = true,
}: UseProjectEstimateFeedbackParams) {
  const [closeoutTipCount, setCloseoutTipCount] = useState<number | null>(null);

  const feedbackBudgetLines = useMemo(() => {
    if (budgetLines?.length) return budgetLines;
    return buckets.map((bucket) => ({
      id: String(bucket.id || bucket.stableId || bucket.name),
      category: String(bucket.name || 'Category'),
      qty: 1,
      unit: 'lump_sum',
      unitCost: Number(bucket.budget) || 0,
    }));
  }, [budgetLines, buckets]);

  const estimateFeedback = useMemo(
    () =>
      deriveEstimateFeedbackFromBudgetData({
        projectId,
        status: String(status ?? ''),
        lines: feedbackBudgetLines,
        expenses: (expenses || []).map((expense) => {
          const normalized = normalizeExpenseForMatching(expense as Record<string, unknown>);
          const row = expense as Record<string, unknown>;
          return {
            id: normalized.id,
            category: normalized.category,
            description: normalized.description,
            vendor: normalized.vendor,
            amount: normalized.amount,
            date: row.date as string | undefined,
            receiptUri: row.receiptUri as string | undefined,
            aiConfidence: row.aiConfidence as number | undefined,
            linkedLineId: normalized.linkedLineId,
          };
        }),
        changeOrders: (changeOrders || []).map((co) => {
          const row = co as Record<string, unknown>;
          return {
            id: String(row.id),
            title: row.title as string | undefined,
            amount: row.amount as number | undefined,
            status: row.status as string | undefined,
            approved: row.approved as boolean | undefined,
            materialsAmount: row.materialsAmount as number | undefined,
            laborAmount: row.laborAmount as number | undefined,
          };
        }),
        plannedBudget,
        finalCustomerPrice,
      }),
    [
      projectId,
      status,
      feedbackBudgetLines,
      expenses,
      changeOrders,
      plannedBudget,
      finalCustomerPrice,
    ]
  );

  const closeoutPrefetchKey = useMemo(() => {
    const expenseTotal = (expenses || []).reduce(
      (sum, expense) => sum + (Number((expense as { amount?: number }).amount) || 0),
      0
    );
    return `${projectId}:${expenses.length}:${expenseTotal}`;
  }, [projectId, expenses]);

  useEffect(() => {
    if (!enabled) {
      setCloseoutTipCount(null);
      return;
    }

    const coverage = estimateFeedback.projectSummary.mappedActualCoveragePercent ?? 0;
    if (
      !projectId ||
      !shouldShowEstimateVsActualCard(estimateFeedback) ||
      coverage < ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS
    ) {
      setCloseoutTipCount(null);
      return;
    }

    let cancelled = false;
    void submitCloseoutCalibration(calibrationProjectLike)
      .then((result) => {
        if (cancelled) return;
        const serverCount =
          result.rateSuggestions?.length ??
          (result.pendingSuggestionCount != null ? Number(result.pendingSuggestionCount) : null);
        if (serverCount == null || !Number.isFinite(serverCount)) return;
        setCloseoutTipCount((prev) => (prev == null ? serverCount : Math.max(prev, serverCount)));
      })
      .catch(() => {
        // Keep client-side count when prefetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, [closeoutPrefetchKey, calibrationProjectLike, estimateFeedback, projectId, enabled]);

  const linkCostsTarget = useMemo(
    () => resolveUnlinkedCategoryLabel(estimateFeedback, categoryNames) ?? categoryNames[0] ?? null,
    [estimateFeedback, categoryNames]
  );

  return {
    estimateFeedback,
    closeoutTipCount,
    linkCostsTarget,
    cardVisible: shouldShowEstimateVsActualCard(estimateFeedback),
  };
}
