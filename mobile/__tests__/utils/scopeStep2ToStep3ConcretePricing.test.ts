import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  ruleKeysToTryForPackage,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';
import { compactPackageAmount } from '@/utils/estimateDraftReviewUi';

const NOTES = '25 CY concrete for ADU slab.';

function draftFromNotes(): EstimateAiDraft {
  return {
    scopeChecklist: { templateKey: 'addition' },
    projectType: 'adu',
    originalNotes: NOTES,
    scopePackages: [
      {
        name: 'Footings / slab / foundation',
        scope: '25 CY concrete placement',
        price: null,
        knownSubtotal: null,
        calculatedSubtotal: null,
        priceSource: 'missing',
        status: 'missing_price',
        pricingType: 'unknown',
      },
    ],
    rooms: [],
    allowances: [],
    scopeMeasurements: { concreteCy: 25, itemQuantities: {} },
  } as unknown as EstimateAiDraft;
}

describe('Step 2 -> Step 3 concrete pricing sync', () => {
  it('maps Concrete package names to the concrete checklist key, not pour_flatwork', () => {
    expect(lookupRuleKeyForPackage('Concrete', '25 CY concrete placement')).toBe('concrete');
    expect(ruleKeysToTryForPackage('Concrete', '25 CY concrete placement')).toContain('concrete');
    expect(ruleKeysToTryForPackage('Footings / slab / foundation', '25 CY concrete placement')).toContain(
      'concrete'
    );
  });

  it('shows accepted concrete pricing in Step 3 after Confirm Scope', () => {
    const draft0 = draftFromNotes();
    const input = initialScopeMeasurementInputExtended(draft0);
    input.itemQuantities = {
      ...input.itemQuantities,
      concrete: { quantity: '25', unit: 'cy', quantitySource: 'user_entered' },
      concrete__material: { quantity: '4125', unit: 'allowance', quantitySource: 'user_entered' },
      concrete__labor: { quantity: '4625', unit: 'allowance', quantitySource: 'user_entered' },
      concrete__allowance: { quantity: '8750', unit: 'allowance', quantitySource: 'user_entered' },
    };
    input.pricingAcceptance = {
      concrete: buildAcceptanceFromSuggestedBlock({
        total: 8750,
        material: 4125,
        labor: 4625,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
    };

    const payload = scopeMeasurementsPayloadForPersist(input, {
      notes: NOTES,
      templateKey: 'addition',
    });
    const draft1 = syncSelectedScopePricing(
      mergeScopeProgressIntoDraft(draft0, [], payload, { scopeNotes: NOTES })
    );

    const pkg = getScopePackages(draft1).find((p) => /footings|foundation/i.test(p.name))!;
    expect(pkg.status).toBe('user_provided');
    expect(pkg.price).toBe(8750);
    expect(compactPackageAmount(pkg, draft1)).toBe('$8,750');
  });
});
