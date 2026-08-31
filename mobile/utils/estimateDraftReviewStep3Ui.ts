import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, formatPlanningMoney } from '@/utils/estimateAiDraft';
import { sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  getUniformStatusLabel,
  pendingProposalCalculatedTotal,
  resolveScopePackageBudgetBreakdown,
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
  sumLiveScopePackageTotals,
} from '@/utils/estimateDraftReviewUi';
import { isSoftCostScopePackage } from '@/utils/softCostScope';

function roundedMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type Step3ReviewTotals = {
  heroAmount: number | null;
  heroLabel: string;
  material: number | null;
  labor: number | null;
  allowance: number | null;
  calculatedTotal: number | null;
  estimatedBidWithMarkup: number | null;
  statedTotal: number | null;
  scopeItemCount: number;
  missingPriceCount: number;
  partialCount: number;
  uniformStatusLabel: string | null;
};

export function computeStep3ReviewTotals(
  draft: EstimateAiDraft,
  markupPct = 0
): Step3ReviewTotals {
  const scopePackages = getScopePackagesForReview(draft);
  const appliedScopeBreakdown = sumStep3ReviewBudgetTotals(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal ?? null;
  const pendingTotal = pendingProposalCalculatedTotal(draft);
  const liveScopeTotal = sumLiveScopePackageTotals(draft);

  const calculatedTotal =
    appliedScopeBreakdown && appliedScopeBreakdown.total > 0
      ? appliedScopeBreakdown.total
      : liveScopeTotal > 0
        ? liveScopeTotal
        : draft.calculatedLineItemTotal ??
          draft.calculatedTotal ??
          draft.totalValidation?.calculatedLineItemsTotal ??
          (pendingTotal > 0 ? pendingTotal : null);

  const scopeBudgetTotals = appliedScopeBreakdown
    ? {
        material: appliedScopeBreakdown.material,
        labor: appliedScopeBreakdown.labor,
        allowance: appliedScopeBreakdown.allowance,
      }
    : scopePackages.reduce(
        (sum, pkg) => {
          const isSoftCost = isSoftCostScopePackage(pkg, draft);
          const breakdown = isSoftCost ? null : resolveScopePackageBudgetBreakdown(pkg, draft);
          const numericAmount = scopePackagePricedAmount(pkg, draft);
          if (numericAmount <= 0) return sum;
          if (isSoftCost || !breakdown) {
            return isSoftCost
              ? { ...sum, allowance: sum.allowance + numericAmount }
              : { ...sum, labor: sum.labor + numericAmount };
          }
          const material = Math.min(breakdown.material, numericAmount);
          const labor = Math.min(breakdown.labor, Math.max(0, numericAmount - material));
          const allowance = Math.max(0, numericAmount - material - labor);
          return {
            material: sum.material + material,
            labor: sum.labor + labor,
            allowance: sum.allowance + allowance,
          };
        },
        { material: 0, labor: 0, allowance: 0 }
      );

  const material =
    scopeBudgetTotals.material > 0 ? roundedMoney(scopeBudgetTotals.material) : null;
  const labor = scopeBudgetTotals.labor > 0 ? roundedMoney(scopeBudgetTotals.labor) : null;
  const allowance =
    scopeBudgetTotals.allowance > 0 ? roundedMoney(scopeBudgetTotals.allowance) : null;

  const directSubtotal =
    calculatedTotal != null && calculatedTotal > 0
      ? calculatedTotal
      : material != null || labor != null || allowance != null
        ? roundedMoney((material || 0) + (labor || 0) + (allowance || 0))
        : null;

  const normalizedMarkupPct = Math.max(0, Number(markupPct) || 0);
  const estimatedBidWithMarkup =
    directSubtotal != null && directSubtotal > 0 && normalizedMarkupPct > 0
      ? roundedMoney(directSubtotal * (1 + normalizedMarkupPct / 100))
      : null;

  const hero = getStep3ReviewHeroAmount({
    statedTotal,
    calculatedTotal: directSubtotal,
    estimatedBidWithMarkup,
  });

  const partialCount = scopePackages.filter((p) => p.status === 'partial_pricing').length;
  const missingPriceCount = scopePackages.filter((p) =>
    scopePackageNeedsManualPrice(p, draft)
  ).length;

  return {
    heroAmount: hero.amount,
    heroLabel: hero.label,
    material,
    labor,
    allowance,
    calculatedTotal: directSubtotal,
    estimatedBidWithMarkup,
    statedTotal: statedTotal != null && statedTotal > 0 ? statedTotal : null,
    scopeItemCount: scopePackages.length,
    missingPriceCount,
    partialCount,
    uniformStatusLabel: getUniformStatusLabel(scopePackages),
  };
}

export function getStep3ReviewScopeMetaLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 scope item' : `${count} scope items`;
}

export function shouldDefaultShowAllStep3ScopeItems(_count: number): boolean {
  return false;
}

export type Step3ReviewStatusTone = 'ready' | 'review' | 'partial';

export function getStep3ReviewStatusBadge(totals: Pick<
  Step3ReviewTotals,
  'missingPriceCount' | 'partialCount' | 'uniformStatusLabel'
>): { label: string; tone: Step3ReviewStatusTone } {
  if (totals.uniformStatusLabel) {
    return { label: totals.uniformStatusLabel, tone: 'partial' };
  }
  if (totals.missingPriceCount > 0) {
    return {
      label:
        totals.missingPriceCount === 1
          ? '1 item to check'
          : `${totals.missingPriceCount} items to check`,
      tone: 'review',
    };
  }
  if (totals.partialCount > 0) {
    return {
      label:
        totals.partialCount === 1
          ? '1 partial price'
          : `${totals.partialCount} partial prices`,
      tone: 'partial',
    };
  }
  return { label: 'Pricing ready', tone: 'ready' };
}

/** Subline under Step 3 hero — scope subtotal vs markup % (matches Initial Reveal). */
export function getStep3ReviewHeroMarkupSubline(
  markupPct: number,
  calculatedTotal: number | null | undefined,
  statedTotal?: number | null
): string | null {
  if (statedTotal != null && statedTotal > 0) return null;
  const subtotal = Number(calculatedTotal);
  const pct = Math.max(0, Number(markupPct) || 0);
  if (!(subtotal > 0) || !(pct > 0)) return null;
  const rounded = Math.round(pct * 10) / 10;
  const pctLabel = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${formatPlanningMoney(subtotal)} scope · ${pctLabel}% markup`;
}

export function getStep3ReviewHeroAmount(params: {
  statedTotal?: number | null;
  calculatedTotal?: number | null;
  estimatedBidWithMarkup?: number | null;
}): { amount: number | null; label: string } {
  const stated = params.statedTotal;
  if (stated != null && stated > 0) {
    return { amount: stated, label: 'Total from your notes' };
  }
  const withMarkup = params.estimatedBidWithMarkup;
  if (withMarkup != null && withMarkup > 0) {
    return { amount: withMarkup, label: 'Estimated bid (incl. markup)' };
  }
  const calculated = params.calculatedTotal;
  if (calculated != null && calculated > 0) {
    return { amount: calculated, label: 'Calculated total' };
  }
  return { amount: null, label: 'Add pricing to see total' };
}

export function getStep3ReviewPlanningDisclaimer(
  totals: Pick<
    Step3ReviewTotals,
    'heroAmount' | 'missingPriceCount' | 'partialCount'
  >
): string | null {
  if (totals.heroAmount == null || totals.heroAmount <= 0) return null;
  if (totals.missingPriceCount === 0 && totals.partialCount === 0) return null;
  return 'Planning estimate — review before sending';
}

/** Step 3 — hide AI clarify strip after Confirm Scope (use Ask AI on scope rows instead). */
export function shouldShowStep3ClarifyQuestions(
  draft: EstimateAiDraft | null | undefined,
  totals: Pick<Step3ReviewTotals, 'missingPriceCount' | 'partialCount'> | null | undefined
): boolean {
  if (!draft || !totals) return false;
  if (draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) return false;
  return totals.missingPriceCount > 0 || totals.partialCount > 0;
}

export function formatStep3ReviewFooterTotal(totals: Step3ReviewTotals): string | null {
  if (totals.heroAmount == null || totals.heroAmount <= 0) return null;
  return formatPlanningMoney(totals.heroAmount);
}
