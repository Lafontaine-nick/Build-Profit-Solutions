import {
  computeStep3ReviewTotals,
  formatStep3ReviewFooterTotal,
  getStep3ReviewHeroAmount,
  getStep3ReviewHeroMarkupSubline,
  getStep3ReviewPlanningDisclaimer,
  getStep3ReviewScopeMetaLabel,
  getStep3ReviewStatusBadge,
  shouldDefaultShowAllStep3ScopeItems,
  shouldShowStep3ClarifyQuestions,
} from '@/utils/estimateDraftReviewStep3Ui';
import { isMarkupOnlyRefineResult } from '@/utils/estimateAiDraft';
import { shouldShowStep3FinishPricingCard, shouldShowStep3TemplateRatesCard } from '@/utils/estimateDraftReviewUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('estimateDraftReviewStep3Ui', () => {
  it('labels scope meta for singular and plural counts', () => {
    expect(getStep3ReviewScopeMetaLabel(7)).toBe('7 scope items');
    expect(getStep3ReviewScopeMetaLabel(1)).toBe('1 scope item');
    expect(getStep3ReviewScopeMetaLabel(0)).toBe('');
  });

  it('defaults show-all scope for small jobs', () => {
    expect(shouldDefaultShowAllStep3ScopeItems(8)).toBe(false);
    expect(shouldDefaultShowAllStep3ScopeItems(9)).toBe(false);
  });

  it('prefers stated total for hero amount', () => {
    expect(
      getStep3ReviewHeroAmount({
        statedTotal: 8500,
        calculatedTotal: 7200,
        estimatedBidWithMarkup: 9000,
      })
    ).toEqual({ amount: 8500, label: 'Total from your notes' });
  });

  it('falls back to estimated bid with markup when no stated total', () => {
    expect(
      getStep3ReviewHeroAmount({
        statedTotal: null,
        calculatedTotal: 7200,
        estimatedBidWithMarkup: 9000,
      })
    ).toEqual({ amount: 9000, label: 'Estimated bid (incl. markup)' });
  });

  it('shows planning disclaimer when gaps remain', () => {
    expect(
      getStep3ReviewPlanningDisclaimer({
        heroAmount: 8976,
        missingPriceCount: 2,
        partialCount: 0,
      })
    ).toBe('Planning estimate — review before sending');
    expect(
      getStep3ReviewPlanningDisclaimer({
        heroAmount: 8976,
        missingPriceCount: 0,
        partialCount: 0,
      })
    ).toBeNull();
  });

  it('builds status badge from missing prices', () => {
    expect(getStep3ReviewStatusBadge({ missingPriceCount: 2, partialCount: 0, uniformStatusLabel: null }))
      .toEqual({ label: '2 items to check', tone: 'review' });
    expect(getStep3ReviewStatusBadge({ missingPriceCount: 0, partialCount: 0, uniformStatusLabel: null }))
      .toEqual({ label: 'Pricing ready', tone: 'ready' });
  });

  it('shows scope subtotal and markup under hero', () => {
    expect(getStep3ReviewHeroMarkupSubline(20, 40308.66, null)).toBe(
      '$40,309 scope · 20% markup'
    );
    expect(getStep3ReviewHeroMarkupSubline(15, 40308.66, 8500)).toBeNull();
  });

  it('detects markup-only Ask AI refine', () => {
    expect(
      isMarkupOnlyRefineResult({
        markupPct: 20,
        appliedSummary: ['Markup set to 20% (scope prices unchanged)'],
      })
    ).toBe(true);
    expect(
      isMarkupOnlyRefineResult({
        markupPct: 20,
        appliedSummary: ['Markup set to 20%', 'Walls: $5,025'],
      })
    ).toBe(false);
  });

  it('computes totals and formats footer total', () => {
    const draft = {
      statedTotal: 8500,
      scopePackages: [
        { name: 'Tile demo', status: 'priced', price: 1200, materialPrice: 400, laborPrice: 800 },
        { name: 'Plumbing', status: 'missing_price' },
      ],
    } as EstimateAiDraft;
    const totals = computeStep3ReviewTotals(draft, 25);
    expect(totals.heroAmount).toBe(8500);
    expect(totals.heroLabel).toBe('Total from your notes');
    expect(totals.scopeItemCount).toBeGreaterThan(0);
    expect(totals.missingPriceCount).toBeGreaterThan(0);
    expect(formatStep3ReviewFooterTotal(totals)).toBe('$8,500');
  });

  it('hides Finish pricing card after Confirm Scope', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopePackages: [{ name: 'Plumbing', status: 'missing_price' }],
    } as EstimateAiDraft;
    expect(shouldShowStep3FinishPricingCard(draft)).toBe(false);
    expect(
      shouldShowStep3FinishPricingCard({
        scopePackages: [{ name: 'Plumbing', status: 'missing_price' }],
      } as EstimateAiDraft)
    ).toBe(true);
  });

  it('hides template rates and clarify cards after Confirm Scope', () => {
    const draft = { scopeAssumptionsConfirmed: true } as EstimateAiDraft;
    expect(
      shouldShowStep3TemplateRatesCard(draft, {
        roughSuggestionLineCount: 2,
        hasRoughOnScope: true,
        pricingReady: false,
      })
    ).toBe(false);
    expect(
      shouldShowStep3ClarifyQuestions(draft, { missingPriceCount: 1, partialCount: 0 })
    ).toBe(false);
  });
});
