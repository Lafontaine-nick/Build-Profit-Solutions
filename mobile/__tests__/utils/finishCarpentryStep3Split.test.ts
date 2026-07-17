import { isSoftCostScopePackage } from '@/utils/softCostScope';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';
import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import {
  getChecklistItemQuantityRule,
  initialScopeMeasurementInputExtended,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';
import { formatScopeQuantity } from '@/utils/estimateDraftReviewUi';

describe('Finish carpentry / interior trim Step 3 material-labor split', () => {
  it('is not lumpSumOnly on ground-up (trade split, not soft-cost allowance)', () => {
    expect(getChecklistItemQuantityRule('interior_trim', 'ground_up')?.lumpSumOnly).toBe(false);
  });

  it('does not treat applied finish carpentry as a soft-cost allowance', () => {
    expect(
      isSoftCostScopePackage(
        {
          name: 'Finish carpentry / interior trim',
          scope: 'Finish trim, interior doors, door hardware & shelving package until detailed takeoff.',
          materialPrice: 5519,
          laborPrice: 4599,
          checklistItemId: 'interior_trim',
        },
        { scopeChecklist: { templateKey: 'ground_up' } as any }
      )
    ).toBe(false);
  });

  it('syncs Confirm Scope mat/lab onto Step 3 with an expandable budget split', () => {
    const draft0 = {
      scopeChecklist: { templateKey: 'ground_up' },
      projectType: 'ground_up',
      estimateTier: 'ground_up',
      originalNotes: 'Ground-up home',
      scopePackages: [
        {
          name: 'Finish carpentry / interior trim',
          scope: 'Finish trim, interior doors, door hardware & shelving package until detailed takeoff.',
          price: null,
          status: 'missing_price',
          priceSource: 'missing',
        },
      ],
      rooms: [],
      scopeMeasurements: { floorAreaSqft: 3098, itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    const input = initialScopeMeasurementInputExtended(draft0);
    input.itemQuantities = {
      ...input.itemQuantities,
      interior_trim: { quantity: '10118', unit: 'allowance', quantitySource: 'user_entered' },
      interior_trim__material: { quantity: '5519', unit: 'allowance', quantitySource: 'user_entered' },
      interior_trim__labor: { quantity: '4599', unit: 'allowance', quantitySource: 'user_entered' },
      interior_trim__allowance: { quantity: '10118', unit: 'allowance', quantitySource: 'user_entered' },
    };
    input.pricingAcceptance = {
      interior_trim: buildAcceptanceFromSuggestedBlock({
        total: 10118,
        material: 5519,
        labor: 4599,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average (builder-budget calibrated)',
        materialSource: 'local_benchmark',
        laborSource: 'local_benchmark',
      }),
    };

    const payload = scopeMeasurementsPayloadForPersist(input, {
      notes: 'Ground-up home',
      templateKey: 'ground_up',
    });
    const draft1 = syncSelectedScopePricing(
      mergeScopeProgressIntoDraft(draft0, [], payload, { scopeNotes: 'Ground-up home' })
    );
    const pkg = getScopePackages(draft1).find((p) => /finish carpentry/i.test(p.name))!;
    expect(pkg.price).toBe(10118);
    expect(pkg.materialPrice).toBe(5519);
    expect(pkg.laborPrice).toBe(4599);
    expect(isSoftCostScopePackage(pkg, draft1)).toBe(false);

    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft1);
    expect(breakdown).toMatchObject({ total: 10118, material: 5519, labor: 4599 });
    // Dollar total must not display as a takeoff quantity.
    expect(formatScopeQuantity(pkg, draft1)).toBeNull();
  });
});
