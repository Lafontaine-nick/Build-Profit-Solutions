import type { EstimateAiDraft, EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages, isComplexEstimateTier } from '@/utils/estimateAiDraft';
import { sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  getCompactProjectSummary,
  getCompactStillNeeded,
  pendingProposalCalculatedTotal,
  resolveScopePackageBudgetBreakdown,
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
  summarizeWhatAiDidForDisplay,
  sumLiveScopePackageTotals,
} from '@/utils/estimateDraftReviewUi';
import { isSoftCostScopePackage } from '@/utils/softCostScope';

export type InitialRevealStatusTone = 'ready' | 'mostly' | 'review';

export type InitialRevealTotals = {
  heroTotal: number | null;
  heroTotalLabel: string;
  material: number | null;
  labor: number | null;
  allowance: number | null;
  estimatedWithMarkup: number | null;
  scopeItemCount: number;
};

function roundedMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Plain-language labels for review / confidence copy (display only). */
export function plainLanguageReviewItem(text: string): string {
  let s = String(text || '').trim();
  if (!s) return s;
  s = s.replace(/\bhigh-confidence extraction\b/gi, 'Ready');
  s = s.replace(/\blow-confidence quantity\b/gi, 'Please check quantity');
  s = s.replace(/\bpricing gap\b/gi, 'Price needed');
  s = s.replace(/\bunsupported plan fact\b/gi, 'Not found on plan');
  s = s.replace(/\bconflicting sources\b/gi, 'Two values found — tap to pick');
  s = s.replace(/\bneeds review\b/gi, 'Please check');
  s = s.replace(/\bmissing price\b/gi, 'Price needed');
  return s;
}

export function getInitialRevealStatusLabel(
  draft: EstimateAiDraft,
  attentionCount: number
): { label: string; tone: InitialRevealStatusTone } {
  const level = draft.estimateConfidence?.level as EstimateConfidenceLevel | undefined;
  if (attentionCount === 0 && level === 'high') {
    return { label: 'Ready to send', tone: 'ready' };
  }
  if (attentionCount === 0) {
    return { label: 'Mostly ready', tone: 'mostly' };
  }
  if (attentionCount === 1) {
    return { label: '1 item to check', tone: 'review' };
  }
  return { label: `${attentionCount} items to check`, tone: 'review' };
}

export function countInitialRevealAttentionItems(draft: EstimateAiDraft): number {
  const { items, overflow } = getCompactStillNeeded(draft, 20);
  return items.length + overflow;
}

export function getInitialRevealDisplayTitle(draft: EstimateAiDraft): string {
  if (draft.projectTitle?.trim()) {
    return draft.projectTitle.trim();
  }
  if (draft.projectType && draft.projectType !== 'other') {
    const label = draft.projectType.replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (draft.customerName?.trim()) {
    return draft.customerName.trim();
  }
  return 'Your project';
}

const REVEAL_LOW_PRIORITY = /customer name|project address|client name|email|phone|permit responsibility|license/i;
const REVEAL_HIGH_PRIORITY = /pricing for|price needed|missing price|please check|measurement|quantity/i;

function revealItemPriority(text: string): number {
  if (REVEAL_HIGH_PRIORITY.test(text)) return 0;
  if (REVEAL_LOW_PRIORITY.test(text)) return 2;
  return 1;
}

/** Top items for the reveal screen — scope/pricing first, admin details later. */
export function getInitialRevealPriorityItems(
  draft: EstimateAiDraft,
  max = 3
): { items: string[]; overflow: number } {
  const { items, overflow } = getCompactStillNeeded(draft, 50);
  const prioritized = [...items].sort((a, b) => revealItemPriority(a) - revealItemPriority(b));
  const visible = prioritized.slice(0, max).map(plainLanguageReviewItem);
  const hidden = Math.max(0, prioritized.length - max) + overflow;
  return { items: visible, overflow: hidden };
}

/** One-line positive summary for the hero area. */
export function getInitialRevealTagline(draft: EstimateAiDraft): string | null {
  const bullets = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], 6);
  const positive = bullets.find(
    (line) =>
      !/no material or labor|rates were provided|no pricing was calculated|could not|unable to/i.test(line)
  );
  if (positive) return plainLanguageReviewItem(positive);

  if (draft.projectType && draft.projectType !== 'other') {
    return `${getInitialRevealDisplayTitle(draft)} scope identified`;
  }
  return null;
}

export type InitialRevealHeroDisplay = {
  hasAmount: boolean;
  amountText: string;
  hint: string;
};

export function getInitialRevealHeroDisplay(
  totals: InitialRevealTotals,
  needsScopeConfirmation: boolean
): InitialRevealHeroDisplay {
  if (totals.heroTotal != null && totals.heroTotal > 0) {
    return {
      hasAmount: true,
      amountText: formatDraftMoney(totals.heroTotal),
      hint: totals.heroTotalLabel,
    };
  }
  if (needsScopeConfirmation) {
    return {
      hasAmount: false,
      amountText: '—',
      hint: 'Confirm scope to calculate pricing',
    };
  }
  return {
    hasAmount: false,
    amountText: '—',
    hint: 'Add rates or confirm scope to see your total',
  };
}

export function getInitialRevealUnderstoodBullets(draft: EstimateAiDraft, max = 3): string[] {
  const fromAi = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], max + 2)
    .map(plainLanguageReviewItem)
    .filter(
      (line) =>
        !/no material or labor|rates were provided|no pricing was calculated/i.test(line)
    );
  if (fromAi.length > 0) return fromAi.slice(0, max);

  const pkgs = getScopePackagesForReview(draft);
  if (pkgs.length > 0) {
    return pkgs.slice(0, max).map((pkg) => {
      const name = String(pkg.name || pkg.scope || 'Scope item').trim();
      const amount = scopePackagePricedAmount(pkg, draft);
      if (amount > 0) return `${name} · ${formatDraftMoney(amount)}`;
      return name;
    });
  }

  const tagline = getInitialRevealTagline(draft);
  return tagline ? [tagline] : ['Built from your notes and inputs'];
}

export function getInitialRevealTotals(
  draft: EstimateAiDraft,
  markupPct = 0
): InitialRevealTotals {
  const scopePackages = getScopePackagesForReview(draft);
  const appliedScopeBreakdown = sumStep3ReviewBudgetTotals(draft);
  const statedTotal = draft.statedTotal ?? draft.totalValidation?.statedTotal;
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

  const material = scopeBudgetTotals.material > 0 ? roundedMoney(scopeBudgetTotals.material) : null;
  const labor = scopeBudgetTotals.labor > 0 ? roundedMoney(scopeBudgetTotals.labor) : null;
  const allowance = scopeBudgetTotals.allowance > 0 ? roundedMoney(scopeBudgetTotals.allowance) : null;

  const directSubtotal =
    calculatedTotal != null && calculatedTotal > 0
      ? calculatedTotal
      : material != null || labor != null || allowance != null
        ? roundedMoney((material || 0) + (labor || 0) + (allowance || 0))
        : null;

  const normalizedMarkupPct = Math.max(0, Number(markupPct) || 0);
  const estimatedWithMarkup =
    directSubtotal != null && directSubtotal > 0 && normalizedMarkupPct > 0
      ? roundedMoney(directSubtotal * (1 + normalizedMarkupPct / 100))
      : null;

  const heroTotal =
    statedTotal != null && statedTotal > 0
      ? statedTotal
      : estimatedWithMarkup != null && estimatedWithMarkup > 0
        ? estimatedWithMarkup
        : directSubtotal != null && directSubtotal > 0
          ? directSubtotal
          : null;

  const heroTotalLabel =
    statedTotal != null && statedTotal > 0
      ? 'Total from your notes'
      : estimatedWithMarkup != null && normalizedMarkupPct > 0
        ? 'Initial estimate (incl. markup)'
        : 'Initial estimate';

  return {
    heroTotal,
    heroTotalLabel,
    material,
    labor,
    allowance,
    estimatedWithMarkup,
    scopeItemCount: getScopePackages(draft).length,
  };
}

export function draftNeedsScopeConfirmation(draft: EstimateAiDraft | null | undefined): boolean {
  if (!draft || !isComplexEstimateTier(draft)) return false;
  return !draft.scopeAssumptionsConfirmed && !(draft.confirmedAssumptions?.length);
}

export function getInitialRevealPrimaryCtaLabel(
  attentionCount: number,
  needsScopeConfirmation = false
): string {
  if (needsScopeConfirmation) {
    return 'Confirm scope';
  }
  if (attentionCount > 0) {
    return attentionCount === 1 ? 'Review 1 item' : `Review ${attentionCount} items`;
  }
  return 'Review & apply estimate';
}

export function scopePackagesNeedingPriceCount(draft: EstimateAiDraft): number {
  return getScopePackagesForReview(draft).filter((pkg) => scopePackageNeedsManualPrice(pkg, draft)).length;
}
