import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import {
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
} from '@/utils/estimateDraftReviewUi';

function pkg(overrides: Partial<EstimateDraftScopePackage> = {}): EstimateDraftScopePackage {
  return {
    name: 'Interior Painting',
    scope: 'paint walls',
    scopeQuantities: [{ quantity: 2560, unit: 'sqft' }],
    price: null,
    laborPrice: null,
    materialPrice: null,
    pricingType: 'unknown',
    includesLabor: null,
    includesMaterials: null,
    priceSource: 'missing',
    status: 'missing_price',
    knownSubtotal: null,
    formula: null,
    missingInfo: [],
    missingPriceItems: [],
    pricingItems: [],
    ...overrides,
  } as EstimateDraftScopePackage;
}

function draft(overrides: Partial<EstimateAiDraft> = {}): EstimateAiDraft {
  return {
    projectType: 'adu',
    estimateTier: 'addition',
    originalNotes: '800 sqft ADU',
    scopePackages: [],
    rooms: [],
    scopeMeasurements: {
      itemQuantities: {},
    },
    ...overrides,
  } as EstimateAiDraft;
}

describe('scopePackageNeedsManualPrice with budget splits', () => {
  it('treats Confirm Scope budget-split totals as already priced', () => {
    const painting = pkg({ name: 'Interior Painting', status: 'missing_price' });
    const withSplit = draft({
      scopePackages: [painting],
      scopeMeasurements: {
        itemQuantities: {
          paint__material: { quantity: 2176, unit: 'allowance', quantitySource: 'user_entered' },
          paint__labor: { quantity: 6400, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    });

    expect(scopePackagePricedAmount(painting, withSplit)).toBeGreaterThan(0);
    expect(scopePackageNeedsManualPrice(painting, withSplit)).toBe(false);
  });

  it('still needs price when package and budget split are empty', () => {
    const excavation = pkg({
      name: 'Excavation',
      status: 'missing_price',
      scopeQuantities: [{ quantity: 50, unit: 'cy' }],
    });
    const empty = draft({ scopePackages: [excavation] });
    expect(scopePackageNeedsManualPrice(excavation, empty)).toBe(true);
  });

  it('does not need manual price when package.price is set', () => {
    const permits = pkg({
      name: 'Permits / fees',
      price: 3500,
      knownSubtotal: 3500,
      status: 'user_provided',
    });
    expect(scopePackageNeedsManualPrice(permits, draft())).toBe(false);
  });

  it('needs manual price when user clears an allowance to $0', () => {
    const contingency = pkg({
      name: 'Contingency allowance',
      price: 0,
      knownSubtotal: 0,
      status: 'user_provided',
      scopeQuantities: [{ quantity: 1, unit: 'allowance' }],
    });
    expect(scopePackagePricedAmount(contingency, draft())).toBe(0);
    expect(scopePackageNeedsManualPrice(contingency, draft())).toBe(true);
  });
});
