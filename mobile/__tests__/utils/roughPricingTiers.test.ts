import {
  applyRoughPricingTiers,
  classifyRoughPricingItemTier,
  classifyUnpricedPackageTier,
  countUnpricedRoughPricingTiers,
  itemUsesLivingSfFallback,
  ROUGH_PRICING_UNAVAILABLE_COPY,
} from '@/utils/roughPricingTiers';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import type { PricingProposal, PricingScopeItemProposal } from '@/utils/estimateAiDraftPricing';

const groundUpDraft = {
  originalNotes: 'Ground-up home 3,098 sqft',
  scopeChecklist: { templateKey: 'ground_up' },
  scopeMeasurements: { floorAreaSqft: 3098 },
  scopePackages: [
    {
      name: 'Appliance install',
      scope: 'appliances',
      price: null,
      status: 'missing_price',
    },
    {
      name: 'Sitework',
      scope: 'sitework',
      price: null,
      status: 'missing_price',
      scopeQuantities: [{ quantity: 3098, unit: 'sqft' }],
    },
    {
      name: 'Utility taps / connections',
      scope: 'utility_taps',
      price: null,
      status: 'missing_price',
      scopeQuantities: [{ quantity: 3098, unit: 'sqft' }],
    },
    {
      name: 'Contingency allowance',
      scope: 'contingency',
      price: null,
      status: 'missing_price',
      scopeQuantities: [{ quantity: 3098, unit: 'sqft' }],
    },
  ],
  rooms: [],
} as unknown as EstimateAiDraft;

describe('roughPricingTiers', () => {
  it('classifies unpriced packages into ready, planning, and manual-only tiers', () => {
    expect(
      classifyUnpricedPackageTier(
        { name: 'Appliance install', scope: 'appliances' },
        groundUpDraft
      )
    ).toBe('ready');
    expect(
      classifyUnpricedPackageTier({ name: 'Sitework', scope: 'sitework' }, groundUpDraft)
    ).toBe('planning');
    expect(
      classifyUnpricedPackageTier(
        { name: 'Utility taps / connections', scope: 'utility_taps' },
        groundUpDraft
      )
    ).toBe('manual_only');
    expect(
      classifyUnpricedPackageTier(
        { name: 'Contingency allowance', scope: 'contingency' },
        groundUpDraft
      )
    ).toBe('manual_only');
  });

  it('counts tier breakdown for Step 3 copy', () => {
    expect(countUnpricedRoughPricingTiers(groundUpDraft)).toEqual({
      unpriced: 4,
      ready: 1,
      planning: 1,
      manualOnly: 2,
      suggestable: 2,
    });
  });

  it('detects living-SF fallback misuse on allowance scopes', () => {
    expect(
      itemUsesLivingSfFallback(
        {
          scopeName: 'Utility taps / connections',
          quantity: 3098,
          unit: 'sqft',
        },
        groundUpDraft
      )
    ).toBe(true);
    expect(
      itemUsesLivingSfFallback(
        {
          scopeName: 'Sitework',
          quantity: 3098,
          unit: 'sqft',
        },
        groundUpDraft
      )
    ).toBe(false);
  });

  it('strips invented living-SF totals for manual-only scopes', () => {
    const item: PricingScopeItemProposal = {
      scopeItemId: 'utility_taps',
      scopeName: 'Utility taps / connections',
      quantity: 3098,
      unit: 'sqft',
      proposedRates: [
        {
          label: 'Material',
          pricingType: 'material',
          rate: 4,
          unit: 'sqft',
          quantity: 3098,
          total: 12392,
          formula: '',
          source: 'national_trade_average',
          confidence: 'low',
          assumptions: [],
          requiresApproval: true,
        },
        {
          label: 'Labor',
          pricingType: 'labor',
          rate: 6,
          unit: 'sqft',
          quantity: 3098,
          total: 18588,
          formula: '',
          source: 'national_trade_average',
          confidence: 'low',
          assumptions: [],
          requiresApproval: true,
        },
      ],
      comparison: {},
      recommended: {
        source: 'national_trade_average',
        sourceLabel: 'National Average',
        reason: 'test',
        confidence: 'low',
      },
      warnings: [],
    };

    expect(classifyRoughPricingItemTier(item, { name: item.scopeName, scope: 'utility_taps' }, groundUpDraft)).toBe(
      'manual_only'
    );

    const proposal = applyRoughPricingTiers(
      {
        empty: false,
        source: 'ai_rough_estimate',
        sourceLabel: 'National Average',
        lines: [],
        scopeItems: [item],
        totalSuggested: 30980,
        pricingMode: 'suggest',
      } as PricingProposal,
      groundUpDraft
    );

    const utility = proposal.scopeItems?.find((row) => /utility/i.test(row.scopeName));
    expect(utility?.roughPricingTier).toBe('manual_only');
    expect(utility?.proposedRates).toHaveLength(0);
    expect(utility?.priceRangeHint?.combinedTotal).toEqual({ low: 3500, high: 12000 });
    expect(utility?.warnings?.some((w) => w.includes(ROUGH_PRICING_UNAVAILABLE_COPY))).toBe(true);
    expect(proposal.lines || []).toHaveLength(0);
  });

  it('ignores misleading API price ranges for manual-only scopes', () => {
    const item: PricingScopeItemProposal = {
      scopeItemId: 'contingency',
      scopeName: 'Contingency allowance',
      quantity: 3098,
      unit: 'sqft',
      proposedRates: [],
      comparison: {},
      recommended: null,
      warnings: [],
      priceRangeHint: {
        unit: 'sqft',
        combinedTotal: { low: 15490, high: 61960 },
      },
    };

    const proposal = applyRoughPricingTiers(
      {
        empty: false,
        source: 'ai_rough_estimate',
        sourceLabel: 'National Average',
        lines: [],
        scopeItems: [item],
        totalSuggested: 0,
        pricingMode: 'suggest',
      } as PricingProposal,
      groundUpDraft
    );

    const contingency = proposal.scopeItems?.find((row) => /contingenc/i.test(row.scopeName));
    expect(contingency?.priceRangeHint?.combinedTotal?.low).toBeGreaterThan(4000);
    expect(contingency?.priceRangeHint?.combinedTotal?.high).toBeLessThan(20000);
    expect(contingency?.priceRangeHint?.combinedTotal?.low).not.toBe(15490);
  });

  it('classifies allowance scopes without catalog rates as manual-only', () => {
    expect(
      classifyUnpricedPackageTier({ name: 'Mobilization', scope: 'mobilization' }, groundUpDraft)
    ).toBe('manual_only');
    expect(
      classifyUnpricedPackageTier({ name: 'Survey', scope: 'survey' }, groundUpDraft)
    ).toBe('manual_only');
    expect(
      classifyUnpricedPackageTier(
        { name: 'Overhead & profit', scope: 'overhead_profit' },
        groundUpDraft
      )
    ).toBe('manual_only');
  });

  it('keeps sitework as planning tier with range and rates', () => {
    const item: PricingScopeItemProposal = {
      scopeItemId: 'sitework',
      scopeName: 'Sitework',
      quantity: 3098,
      unit: 'sqft',
      proposedRates: [
        {
          label: 'Site prep materials/equipment',
          pricingType: 'material',
          rate: 1.5,
          unit: 'sqft',
          quantity: 3098,
          total: 4647,
          formula: '',
          source: 'national_trade_average',
          confidence: 'low',
          assumptions: [],
          requiresApproval: true,
        },
        {
          label: 'Site prep labor',
          pricingType: 'labor',
          rate: 4,
          unit: 'sqft',
          quantity: 3098,
          total: 12392,
          formula: '',
          source: 'national_trade_average',
          confidence: 'medium',
          assumptions: [],
          requiresApproval: true,
        },
      ],
      comparison: {},
      recommended: {
        source: 'national_trade_average',
        sourceLabel: 'National Average',
        reason: 'test',
        confidence: 'medium',
      },
      warnings: [],
    };

    const proposal = applyRoughPricingTiers(
      {
        empty: false,
        source: 'ai_rough_estimate',
        sourceLabel: 'National Average',
        lines: [],
        scopeItems: [item],
        totalSuggested: 17039,
        pricingMode: 'suggest',
      } as PricingProposal,
      groundUpDraft
    );

    const sitework = proposal.scopeItems?.find((row) => /sitework/i.test(row.scopeName));
    expect(sitework?.roughPricingTier).toBe('planning');
    expect(sitework?.proposedRates?.length).toBeGreaterThan(0);
    expect(sitework?.autoSelectEligible).toBe(false);
    expect(sitework?.priceRangeHint?.combinedTotal?.high).toBeGreaterThan(
      sitework?.priceRangeHint?.combinedTotal?.low || 0
    );
  });

  it('adds missing unpriced scopes to the suggest modal', () => {
    const proposal = applyRoughPricingTiers(
      {
        empty: false,
        source: 'ai_rough_estimate',
        sourceLabel: 'National Average',
        lines: [],
        scopeItems: [],
        totalSuggested: 0,
        pricingMode: 'suggest',
      } as PricingProposal,
      groundUpDraft
    );

    expect(proposal.scopeItems?.length).toBe(4);
    expect(proposal.scopeItems?.filter((i) => i.roughPricingTier === 'manual_only').length).toBe(2);
    expect(proposal.empty).toBe(false);
  });
});
