import { useMemo } from 'react';
import { estimateLineOptionsFor } from '@/utils/estimateLineOptions';
import {
  getEstimateLineSpendSummaries,
  getUnlinkedExpensesForKind,
  resolveProjectEstimateData,
  resolveProjectExpenses,
  type EstimateLineSpendSummary,
} from '@/utils/rateInsightComparisons';
import { buildCategoryBudgetSummary } from '@/utils/estimateLineBudgetDisplay';

export type EstimateLineBudgetKind = 'materials' | 'labor';

export function useEstimateLineBudgets(
  projectLike: Record<string, unknown> | null | undefined,
  kind: EstimateLineBudgetKind
) {
  return useMemo(() => {
    const estimateData = resolveProjectEstimateData(projectLike);
    const expenses = resolveProjectExpenses(projectLike);
    const spendSummaries = getEstimateLineSpendSummaries({ estimateData, expenses, kind });
    const options = estimateLineOptionsFor(estimateData, kind);
    const totalBudget = options.reduce((sum, option) => sum + option.budget, 0);
    const totalLogged = Object.values(spendSummaries).reduce(
      (sum, summary) => sum + summary.loggedTotal,
      0
    );
    const unlinkedExpenses = getUnlinkedExpensesForKind({ estimateData, expenses, kind });
    const unlinkedTotal = unlinkedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const categorySummary = buildCategoryBudgetSummary(totalBudget, totalLogged);

    return {
      spendSummaries,
      options,
      totalBudget,
      totalLogged,
      categorySummary,
      unlinkedExpenses,
      unlinkedCount: unlinkedExpenses.length,
      unlinkedTotal,
    };
  }, [projectLike, kind]);
}

export function lookupSpendSummary(
  spendSummaries: Record<string, EstimateLineSpendSummary>,
  lineId: string | null | undefined
): EstimateLineSpendSummary | null {
  if (!lineId) return null;
  return spendSummaries[lineId] ?? null;
}
