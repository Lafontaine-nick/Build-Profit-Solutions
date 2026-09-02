import {
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPlanningDisclaimer,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealPriorityItems,
  getInitialRevealScopeMetaLabel,
  getInitialRevealStatusLabel,
  plainLanguageReviewItem,
  shouldDefaultExpandInitialRevealScope,
  shouldShowInitialRevealWhatWeFound,
  splitInitialRevealConfirmItems,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('estimateInitialRevealUi', () => {
  it('maps technical review copy to plain language', () => {
    expect(plainLanguageReviewItem('Low-confidence quantity for wall tile')).toContain(
      'Please check quantity'
    );
    expect(plainLanguageReviewItem('Pricing gap on plumbing')).toBe('Price needed on plumbing');
    expect(
      plainLanguageReviewItem(
        'Overall bid total or room lump sums (e.g. bathroom $8,500), or $/sqft rates with square footage'
      )
    ).toBe('Pricing total not found in notes');
    expect(plainLanguageReviewItem('Pricing for tile demo')).toBe('Price needed for tile demo');
  });

  it('labels status from attention count and confidence', () => {
    const draft = {
      estimateConfidence: { level: 'high' },
    } as EstimateAiDraft;
    expect(getInitialRevealStatusLabel(draft, 0).label).toBe('Ready to send');
    expect(getInitialRevealStatusLabel(draft, 2).label).toBe('Mostly ready · 2 to check');
  });

  it('builds primary CTA from attention count', () => {
    expect(getInitialRevealPrimaryCtaLabel(0)).toBe('Review & apply estimate');
    expect(getInitialRevealPrimaryCtaLabel(3)).toBe('Continue to review · 3 to check');
    expect(getInitialRevealPrimaryCtaLabel(0, true)).toBe('Confirm scope');
  });

  it('prefers scope items over admin fields on reveal', () => {
    const draft = {
      stillNeededReview: ['Customer name', 'Pricing for tile demo', 'Project address'],
      needsReviewItems: [],
      scopePackages: [{ name: 'Tile demo', status: 'missing_price' }],
    } as EstimateAiDraft;
    const { items } = getInitialRevealPriorityItems(draft, 2);
    expect(items[0]).toContain('tile demo');
  });

  it('splits pricing gaps from bid admin details', () => {
    const buckets = splitInitialRevealConfirmItems([
      'Pricing for tile demo',
      'Customer name',
      'Start date',
    ]);
    expect(buckets.pricingScope).toEqual(['Price needed for tile demo']);
    expect(buckets.bidDetails).toEqual(['Customer name', 'Start date']);
  });

  it('builds confirm buckets from draft — scope/pricing only', () => {
    const draft = {
      stillNeededReview: ['Customer name', 'Pricing for tile demo', 'Project address'],
      needsReviewItems: [],
      scopePackages: [{ name: 'Tile demo', status: 'missing_price' }],
    } as EstimateAiDraft;
    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope.some((item) => /tile demo/i.test(item))).toBe(true);
    expect(buckets.bidDetails).toEqual([]);
  });

  it('labels scope meta separately from checklist gaps', () => {
    expect(getInitialRevealScopeMetaLabel(7)).toBe('7 scope items');
    expect(getInitialRevealScopeMetaLabel(1)).toBe('1 scope item');
  });

  it('expands scope by default when scope items exist', () => {
    expect(shouldDefaultExpandInitialRevealScope(7)).toBe(true);
    expect(shouldDefaultExpandInitialRevealScope(9)).toBe(true);
    expect(shouldDefaultExpandInitialRevealScope(0)).toBe(false);
  });

  it('shows planning disclaimer when total exists and gaps remain', () => {
    expect(
      getInitialRevealPlanningDisclaimer(
        {
          heroTotal: 8976,
          heroTotalLabel: 'Initial estimate (incl. markup)',
          markupPct: 20,
          material: 2530,
          labor: 4950,
          allowance: null,
          estimatedWithMarkup: 8976,
          scopeItemCount: 7,
        },
        10
      )
    ).toBe('Planning estimate — review before sending');
  });

  it('hides what we found when it duplicates the tagline', () => {
    expect(
      shouldShowInitialRevealWhatWeFound(
        ['Detected bathroom remodel job.'],
        'Detected bathroom remodel job.'
      )
    ).toBe(false);
    expect(
      shouldShowInitialRevealWhatWeFound(
        ['Organized Tub Removal / Demo: 1 each — pricing needed.'],
        'Detected bathroom remodel job.'
      )
    ).toBe(true);
  });

  it('drops stale pre-confirm pricing gaps after Confirm Scope', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      confirmedAssumptions: [{ id: 'baseboard', state: 'included' }],
      stillNeededReview: [
        'Material rate per LF',
        'Labor install rate per LF',
        'Caulk & paint',
        'Material and labor pricing',
      ],
      needsReviewItems: ['Pricing total not found in notes'],
      scopePackages: [
        { name: 'Baseboard Installation', status: 'confirmed', price: 1500 },
        { name: 'Interior Paint', status: 'confirmed', price: 8000 },
      ],
      scopeMeasurements: {
        itemQuantities: {
          trim_paint: { quantity: '200', unit: 'lf', quantitySource: 'user_entered' },
          trim_paint__material: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
          trim_paint__labor: { quantity: '1100', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          trim_paint: { selectionStatus: 'accepted', totalAmount: 1500 },
        },
      },
    } as EstimateAiDraft;
    const buckets = getInitialRevealConfirmItems(draft);
    expect(buckets.pricingScope).not.toContain('Material rate per LF');
    expect(buckets.pricingScope).not.toContain('Labor install rate per LF');
    expect(buckets.pricingScope).not.toContain('Caulk & paint');
    expect(buckets.pricingScope).not.toContain('Pricing total not found in notes');
  });

  it('shows placeholder hero when no total yet', () => {
    const display = getInitialRevealHeroDisplay(
      {
        heroTotal: null,
        heroTotalLabel: 'Initial estimate',
        markupPct: null,
        material: null,
        labor: null,
        allowance: null,
        estimatedWithMarkup: null,
        scopeItemCount: 6,
      },
      true
    );
    expect(display.amountText).toBe('—');
    expect(display.hint).toContain('Confirm scope');
  });

  it('shows markup subline under hero hint when markup is applied', () => {
    const display = getInitialRevealHeroDisplay(
      {
        heroTotal: 32111.2,
        heroTotalLabel: 'Initial estimate (incl. markup)',
        markupPct: 15,
        material: 7312.5,
        labor: 19446.83,
        allowance: null,
        estimatedWithMarkup: 32111.2,
        scopeItemCount: 9,
      },
      false
    );
    expect(display.markupSubline).toBe('15% markup');
  });

  it('uses project title for display heading', () => {
    const draft = { projectTitle: 'Master bath remodel' } as EstimateAiDraft;
    expect(getInitialRevealDisplayTitle(draft)).toBe('Master bath remodel');
  });
});
