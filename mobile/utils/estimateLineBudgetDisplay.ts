import { formatMoneyFull } from '@/src/lib/budgetUtils';
import type { EstimateLineSpendSummary } from '@/utils/rateInsightComparisons';

export function lineSpendColor(summary: EstimateLineSpendSummary): string {
  if (summary.loggedTotal <= 0) return '#94a3b8';
  if (summary.budget <= 0) return '#22c55e';
  if (summary.remaining < 0) return '#f87171';
  return '#22c55e';
}

export function formatSpendDetail(summary: EstimateLineSpendSummary): string {
  const spent = formatMoneyFull(summary.loggedTotal, { decimals: 0 });
  if (summary.budget <= 0) return `Total spent ${spent}`;
  if (summary.remaining >= 0) {
    return `Total spent ${spent} · ${formatMoneyFull(summary.remaining, { decimals: 0 })} remaining`;
  }
  return `Total spent ${spent} · ${formatMoneyFull(Math.abs(summary.remaining), { decimals: 0 })} over`;
}

export function progressFillPercent(summary: EstimateLineSpendSummary): number {
  if (summary.budget <= 0 || summary.loggedTotal <= 0) return 0;
  return Math.min(100, (summary.loggedTotal / summary.budget) * 100);
}

export function isOverBudget(summary: EstimateLineSpendSummary): boolean {
  return summary.budget > 0 && summary.remaining < 0;
}

export type CategoryBudgetSummary = {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  hasEstimateBudget: boolean;
};

export function buildCategoryBudgetSummary(
  totalBudget: number,
  totalSpent: number
): CategoryBudgetSummary {
  const hasEstimateBudget = totalBudget > 0;
  const remaining = hasEstimateBudget ? totalBudget - totalSpent : 0;
  return { totalBudget, totalSpent, remaining, hasEstimateBudget };
}

export function formatCategoryBudgetDetail(summary: CategoryBudgetSummary): string {
  const spent = formatMoneyFull(summary.totalSpent, { decimals: 0 });
  if (!summary.hasEstimateBudget) return `Total spent ${spent}`;
  const budget = formatMoneyFull(summary.totalBudget, { decimals: 0 });
  if (summary.remaining >= 0) {
    return `Budget ${budget} · Spent ${spent} · ${formatMoneyFull(summary.remaining, { decimals: 0 })} remaining`;
  }
  return `Budget ${budget} · Spent ${spent} · ${formatMoneyFull(Math.abs(summary.remaining), { decimals: 0 })} over`;
}

export function categoryBudgetSpendColor(summary: CategoryBudgetSummary): string {
  if (!summary.hasEstimateBudget || summary.totalSpent <= 0) return '#94a3b8';
  if (summary.remaining < 0) return '#f87171';
  return '#22c55e';
}

export function categoryBudgetProgressPercent(summary: CategoryBudgetSummary): number {
  if (!summary.hasEstimateBudget || summary.totalSpent <= 0) return 0;
  return Math.min(100, (summary.totalSpent / summary.totalBudget) * 100);
}

export function formatBudgetPercentUsed(percent: number): string {
  if (percent <= 0) return '0% used';
  return `${Math.round(percent)}% used`;
}

export function lineBudgetStatusVariant(
  summary: EstimateLineSpendSummary
): 'over' | 'onTrack' | 'neutral' {
  if (summary.budget <= 0 || summary.loggedTotal <= 0) return 'neutral';
  return summary.remaining < 0 ? 'over' : 'onTrack';
}

export function categoryBudgetStatusVariant(
  summary: CategoryBudgetSummary
): 'over' | 'onTrack' | 'neutral' {
  if (!summary.hasEstimateBudget || summary.totalSpent <= 0) return 'neutral';
  return summary.remaining < 0 ? 'over' : 'onTrack';
}

export function formatCategoryBudgetSubtitle(summary: CategoryBudgetSummary): string {
  if (!summary.hasEstimateBudget) return '';
  const pct = formatBudgetPercentUsed(categoryBudgetProgressPercent(summary));
  if (summary.remaining >= 0) {
    return `${pct} · ${formatMoneyFull(summary.remaining, { decimals: 0 })} remaining`;
  }
  return `${pct} · ${formatMoneyFull(Math.abs(summary.remaining), { decimals: 0 })} over`;
}

/** Add back the expense being edited after `excludeExpenseId` zeroes it out of summaries. */
export function withEditingAmount(
  summary: EstimateLineSpendSummary | undefined,
  budget: number,
  editingAmount?: number | null
): EstimateLineSpendSummary {
  const baseBudget = summary?.budget ?? budget;
  const extra = Number(editingAmount) > 0 ? Number(editingAmount) : 0;
  const loggedTotal = (summary?.loggedTotal ?? 0) + extra;
  const remaining = baseBudget > 0 ? baseBudget - loggedTotal : 0;
  return {
    loggedTotal,
    budget: baseBudget,
    remaining,
    variancePct: summary?.variancePct ?? null,
    badge: baseBudget > 0 && remaining < 0 ? 'over' : null,
  };
}
