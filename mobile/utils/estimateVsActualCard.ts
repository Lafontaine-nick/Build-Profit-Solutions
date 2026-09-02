import type { EstimateFeedbackResult, ProjectActualSummary } from '@/utils/estimateFeedback';

export const ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_VARIANCE = 50;
export const ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS = 50;

export type EstimateVarianceDisplay = {
  value: string;
  reliable: boolean;
  hint?: string;
  dollarsLine?: string;
  tone?: 'over' | 'under' | 'on_track';
};

export type SpendProgressDisplay = {
  percentLabel: string;
  progressPercent: number;
};

export function formatSpendProgress(summary: ProjectActualSummary): SpendProgressDisplay {
  const spent = summary.mappedDirectCostActual ?? summary.actualDirectCost ?? 0;
  const budget = summary.estimatedDirectCost ?? 0;
  if (budget <= 0) {
    return { percentLabel: '—', progressPercent: 0 };
  }
  const pct = Math.min(100, Math.max(0, (spent / budget) * 100));
  return {
    percentLabel: `${pct.toFixed(1)}%`,
    progressPercent: pct,
  };
}

export function formatSpendDollarsLine(
  summary: ProjectActualSummary,
  formatMoney: (amount: number) => string
): string | undefined {
  const spent = summary.mappedDirectCostActual ?? summary.actualDirectCost;
  const budget = summary.estimatedDirectCost;
  if (spent == null || budget == null || budget <= 0) return undefined;
  return `${formatMoney(spent)} of ${formatMoney(budget)} cost budget`;
}

export function getLinkedCategoryLabels(feedback: EstimateFeedbackResult): string[] {
  return feedback.scopeComparisons
    .filter((comparison) => {
      const actual = comparison.actualDirectCost;
      return actual != null && Number(actual) > 0;
    })
    .map((comparison) => comparison.estimateItem?.name || comparison.scopeItemKey)
    .filter(Boolean);
}

export function formatCategoriesLinkedLabel(linkedCount: number, totalCategories?: number): string {
  if (totalCategories != null && totalCategories > 0) {
    return `${linkedCount} of ${totalCategories}`;
  }
  return linkedCount > 0 ? String(linkedCount) : '0';
}

export function formatCategoriesLinkedSublabel(linkedCategories: string[]): string | undefined {
  if (linkedCategories.length === 0) return undefined;
  if (linkedCategories.length <= 2) return linkedCategories.join(' · ');
  return `${linkedCategories.slice(0, 2).join(' · ')} +${linkedCategories.length - 2} more`;
}

export function resolveUnlinkedCategoryLabel(
  feedback: EstimateFeedbackResult,
  categoryNames: string[]
): string | null {
  const linked = new Set(getLinkedCategoryLabels(feedback));
  return categoryNames.find((name) => !linked.has(name)) ?? null;
}

export function formatCostBudgetVsBidNote(
  costBudget: number,
  bidPrice: number,
  formatMoney: (amount: number) => string
): string | undefined {
  if (costBudget <= 0 || bidPrice <= 0) return undefined;
  const margin = bidPrice - costBudget;
  if (margin <= costBudget * 0.02) return undefined;
  return `${formatMoney(costBudget)} cost budget (materials + labor). ${formatMoney(bidPrice)} bid includes ${formatMoney(margin)} markup & profit — this card tracks costs only.`;
}

export function formatVarianceDollarsLine(
  summary: ProjectActualSummary,
  formatMoney: (amount: number) => string
): string | undefined {
  if (!summary.varianceIsReliable || summary.directCostVariance == null) return undefined;
  const delta = summary.directCostVariance;
  const abs = formatMoney(Math.abs(delta));
  if (delta > 0) return `${abs} over cost budget on linked categories`;
  if (delta < 0) return `${abs} below cost budget on linked categories`;
  return 'On track vs cost budget on linked categories';
}

export function formatEstimateVarianceDisplay(summary: ProjectActualSummary): EstimateVarianceDisplay {
  const coverage = summary.mappedActualCoveragePercent ?? 0;
  const reliable = Boolean(summary.varianceIsReliable && summary.directCostVariancePercent != null);

  if (!reliable || summary.directCostVariancePercent == null) {
    return {
      value: '—',
      reliable: false,
      hint:
        coverage < ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_VARIANCE
          ? 'Log expenses in each budget category to unlock cost budget comparison.'
          : 'Log expenses in budget categories to compare against the cost budget.',
    };
  }

  const pct = summary.directCostVariancePercent;
  const sign = pct > 0 ? '+' : '';
  return {
    value: `${sign}${pct.toFixed(1)}%`,
    reliable: true,
    hint:
      pct > 5
        ? 'Logged costs are above the cost budget on linked categories — not bid price.'
        : pct < -5
          ? 'Logged costs are below the cost budget on linked categories — not bid price.'
          : 'Logged costs are close to the cost budget on linked categories.',
    tone: pct > 5 ? 'over' : pct < -5 ? 'under' : 'on_track',
  };
}

export function resolveEstimateTipCount(
  feedback: EstimateFeedbackResult,
  closeoutRateSuggestions: number | null | undefined
): number {
  const clientCount = feedback.rateSuggestions.length + feedback.assumptionSuggestions.length;
  if (closeoutRateSuggestions != null) {
    return Math.max(closeoutRateSuggestions, clientCount);
  }
  return clientCount;
}

export function formatEstimateStatusLabel(status: EstimateFeedbackResult['status']): string {
  switch (status) {
    case 'ready_for_review':
      return 'Ready to review';
    case 'partial':
      return 'Partial data';
    case 'reviewed':
      return 'Reviewed';
    case 'calibration_applied':
      return 'Applied';
    case 'insufficient_data':
    default:
      return 'Building data';
  }
}

export function getEstimateVsActualCardMessage(
  feedback: EstimateFeedbackResult,
  tipCount: number
): { text: string; tone: 'muted' | 'warn' | 'positive'; showVarianceHint?: boolean } {
  const coverage = feedback.projectSummary.mappedActualCoveragePercent ?? 0;
  const unresolved = feedback.unresolvedMappings.length;

  if (unresolved > 0) {
    return {
      text: `${unresolved} cost${unresolved === 1 ? '' : 's'} still need mapping before tips are reliable.`,
      tone: 'warn',
      showVarianceHint: false,
    };
  }
  if (coverage < ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS) {
    return {
      text: 'Log expenses in each category to compare against the cost budget and unlock rate tips.',
      tone: 'muted',
      showVarianceHint: false,
    };
  }
  if (tipCount > 0) {
    return {
      text: `${tipCount} rate insight${tipCount === 1 ? '' : 's'} available — for information only. Saved rates are not changed from this screen.`,
      tone: 'positive',
      showVarianceHint: false,
    };
  }
  return {
    text: 'Enough categories are linked to compare. No rate tips yet.',
    tone: 'muted',
    showVarianceHint: false,
  };
}

export function shouldShowRateInsightsCta(
  feedback: EstimateFeedbackResult,
  tipCount: number
): boolean {
  return shouldShowReviewRateTipsCta(feedback, tipCount);
}

export function shouldShowReviewRateTipsCta(
  feedback: EstimateFeedbackResult,
  tipCount: number
): boolean {
  if (tipCount <= 0) return false;
  const coverage = feedback.projectSummary.mappedActualCoveragePercent ?? 0;
  if (coverage < ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS) return false;
  if (feedback.unresolvedMappings.length > 0) return false;
  return true;
}

export function shouldShowEstimateVsActualCard(feedback: EstimateFeedbackResult): boolean {
  if (feedback.status === 'insufficient_data') return false;
  return (
    feedback.projectSummary.mappedActualCoveragePercent > 0 ||
    feedback.rateSuggestions.length > 0 ||
    feedback.assumptionSuggestions.length > 0
  );
}

export function shouldShowVarianceRow(feedback: EstimateFeedbackResult): boolean {
  const coverage = feedback.projectSummary.mappedActualCoveragePercent ?? 0;
  return coverage >= ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_VARIANCE;
}

export function shouldShowTipsRow(feedback: EstimateFeedbackResult, tipCount: number): boolean {
  const coverage = feedback.projectSummary.mappedActualCoveragePercent ?? 0;
  return tipCount > 0 || coverage >= ESTIMATE_VS_ACTUAL_MIN_COVERAGE_FOR_TIPS;
}
