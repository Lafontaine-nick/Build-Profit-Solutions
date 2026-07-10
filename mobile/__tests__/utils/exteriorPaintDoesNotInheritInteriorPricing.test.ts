import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import { lookupRuleKeyForPackage } from '@/utils/scopeItemQuantities';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';
import {
  compactPackageAmount,
  scopePackageNeedsManualPrice,
} from '@/utils/estimateDraftReviewUi';

/**
 * Regression: Ask AI "add exterior painting" must not inherit Interior Painting's
 * Confirm Scope rates via the shared generic `paint` rule key.
 */
function draftWithInteriorPaintPriced(): EstimateAiDraft {
  return {
    projectType: 'adu',
    originalNotes: 'ADU casita build',
    scopePackages: [
      {
        name: 'Interior Painting',
        scope: 'Interior painting',
        price: 3350,
        knownSubtotal: 3350,
        calculatedSubtotal: 3350,
        materialPrice: 850,
        laborPrice: 2500,
        priceSource: 'user_provided',
        status: 'user_provided',
        pricingType: 'split',
        priceProvidedByUser: true,
        applyEligible: true,
        scopeQuantities: [{ quantity: 1000, unit: 'sqft' }],
      },
      {
        name: 'Exterior Painting',
        scope: 'Exterior Painting',
        price: null,
        knownSubtotal: null,
        calculatedSubtotal: null,
        materialPrice: null,
        laborPrice: null,
        status: 'missing_price',
        priceProvidedByUser: false,
      },
    ],
    rooms: [
      {
        name: 'Interior Painting',
        scope: 'Interior painting',
        price: 3350,
        materialPrice: 850,
        laborPrice: 2500,
        priceProvidedByUser: true,
        applyEligible: true,
      },
      {
        name: 'Exterior Painting',
        scope: 'Exterior Painting',
        price: null,
        materialPrice: null,
        laborPrice: null,
        priceProvidedByUser: false,
      },
    ],
    allowances: [],
    scopeMeasurements: {
      wallPaintSqft: 1000,
      itemQuantities: {
        paint: { quantity: 1000, unit: 'sqft', quantitySource: 'user_entered' },
        paint__material: { quantity: 850, unit: 'allowance', quantitySource: 'user_entered' },
        paint__labor: { quantity: 2500, unit: 'allowance', quantitySource: 'user_entered' },
        interior_paint: { quantity: 1000, unit: 'sqft', quantitySource: 'user_entered' },
        interior_paint__material: {
          quantity: 850,
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        interior_paint__labor: {
          quantity: 2500,
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    },
  } as unknown as EstimateAiDraft;
}

describe('Exterior painting does not inherit interior paint pricing', () => {
  it('maps exterior vs interior packages to distinct rule keys', () => {
    expect(lookupRuleKeyForPackage('Exterior Painting')).toBe('exterior_paint');
    expect(lookupRuleKeyForPackage('Interior Painting')).toBe('interior_paint');
    expect(lookupRuleKeyForPackage('Painting')).toBe('paint');
  });

  it('syncSelectedScopePricing keeps exterior as Needs price', () => {
    const synced = syncSelectedScopePricing(draftWithInteriorPaintPriced());
    const interior = getScopePackages(synced).find((p) => /interior/i.test(p.name))!;
    const exterior = getScopePackages(synced).find((p) => /exterior/i.test(p.name))!;

    expect(compactPackageAmount(interior, synced)).toBe('$3,350');
    expect(scopePackageNeedsManualPrice(exterior, synced)).toBe(true);
    expect(compactPackageAmount(exterior, synced)).toBeNull();
    expect(resolveScopePackageBudgetBreakdown(exterior, synced)).toBeNull();
  });
});
