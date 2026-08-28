import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { getScopePackages } from '@/utils/estimateAiDraft';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import {
  compactPackageAmount,
  scopePackageNeedsManualPrice,
} from '@/utils/estimateDraftReviewUi';
import { computeStep3ReviewTotals } from '@/utils/estimateDraftReviewStep3Ui';
import { resolveAppliedConfirmScopePackageAmount } from '@/utils/appliedScopePackagePricing';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';

function acceptanceBlock(total: number, material: number, labor: number) {
  return buildAcceptanceFromSuggestedBlock({
    total,
    material,
    labor,
    lumpSumOnly: !(material > 0 && labor > 0),
    rateSourceLabel: 'National Average',
    materialSource: 'national_average',
    laborSource: 'national_average',
  });
}

function paintingItems(): ScopeChecklistItem[] {
  return [
    { id: 'prep', label: 'Prep & Masking', state: 'included', inputType: 'yes_no' },
    { id: 'interior_paint', label: 'Walls & Ceilings', state: 'included', inputType: 'yes_no' },
    { id: 'trim_paint', label: 'Baseboards, trim & molding', state: 'included', inputType: 'yes_no' },
    { id: 'exterior_prep', label: 'Exterior Prep & Masking', state: 'included', inputType: 'yes_no' },
    { id: 'exterior_paint', label: 'Exterior Paint', state: 'included', inputType: 'yes_no' },
  ];
}

function paintingDraftWithLegacyPaintKey(): EstimateAiDraft {
  return {
    projectType: 'painting',
    scopeAssumptionsConfirmed: true,
    confirmedAssumptions: paintingItems(),
    scopeChecklist: { templateKey: 'painting', items: paintingItems() },
    scopePackages: [],
    scopeMeasurements: {
      paintPricingMethod: 'combined',
      wallPaintSqft: 1500,
      baseboardLf: 200,
      exteriorPaintSqft: 2000,
      itemQuantities: {
        paint: { quantity: '1500', unit: 'sqft', quantitySource: 'user_entered' },
        paint__material: { quantity: '871', unit: 'allowance', quantitySource: 'user_entered' },
        paint__labor: { quantity: '2850.85', unit: 'allowance', quantitySource: 'user_entered' },
        trim_paint: { quantity: '200', unit: 'lf', quantitySource: 'user_entered' },
        trim_paint__material: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
        trim_paint__labor: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        exterior_paint: { quantity: '2000', unit: 'sqft', quantitySource: 'user_entered' },
        exterior_paint__material: { quantity: '1800', unit: 'allowance', quantitySource: 'user_entered' },
        exterior_paint__labor: { quantity: '4500', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        paint: acceptanceBlock(3721.85, 871, 2850.85),
        trim_paint: acceptanceBlock(1400, 400, 1000),
        exterior_paint: acceptanceBlock(6300, 1800, 4500),
      },
    },
  } as unknown as EstimateAiDraft;
}

describe('painting Step 2 applied pricing on Step 3 review', () => {
  it('recognizes interior paint applied under legacy paint key', () => {
    const draft = paintingDraftWithLegacyPaintKey();
    const interior = getScopePackages(draft).find((pkg) => pkg.checklistItemId === 'interior_paint');
    expect(interior).toBeTruthy();
    expect(resolveAppliedConfirmScopePackageAmount(interior!, draft)).toBeCloseTo(3721.85, 2);
    expect(compactPackageAmount(interior!, draft)).toBe('$3,721.85');
    expect(scopePackageNeedsManualPrice(interior!, draft)).toBe(false);
  });

  it('does not flag prep as missing when wall paint is already applied', () => {
    const draft = paintingDraftWithLegacyPaintKey();
    const prep = getScopePackages(draft).find((pkg) => pkg.checklistItemId === 'prep');
    expect(prep).toBeTruthy();
    expect(scopePackageNeedsManualPrice(prep!, draft)).toBe(false);
  });

  it('does not flag exterior prep as missing when exterior paint is applied', () => {
    const draft = paintingDraftWithLegacyPaintKey();
    const exteriorPrep = getScopePackages(draft).find((pkg) => pkg.checklistItemId === 'exterior_prep');
    expect(exteriorPrep).toBeTruthy();
    expect(scopePackageNeedsManualPrice(exteriorPrep!, draft)).toBe(false);
  });

  it('clears finish-pricing gaps when surfaces and trim are applied', () => {
    const draft = paintingDraftWithLegacyPaintKey();
    const totals = computeStep3ReviewTotals(draft, 0);
    expect(totals.missingPriceCount).toBe(0);
  });

  it('recognizes applied trim under Baseboards, trim & molding label', () => {
    const draft = {
      ...paintingDraftWithLegacyPaintKey(),
      scopePackages: [
        {
          name: 'Baseboards, trim & molding',
          scope: 'Painted trim',
          checklistItemId: 'trim_paint',
          price: null,
          status: 'missing_price',
        },
      ],
    } as unknown as EstimateAiDraft;
    const trim = getScopePackages(draft).find((pkg) => pkg.checklistItemId === 'trim_paint');
    expect(trim).toBeTruthy();
    expect(scopePackageNeedsManualPrice(trim!, draft)).toBe(false);
    expect(resolveAppliedConfirmScopePackageAmount(trim!, draft)).toBeCloseTo(1400, 2);
  });
});
