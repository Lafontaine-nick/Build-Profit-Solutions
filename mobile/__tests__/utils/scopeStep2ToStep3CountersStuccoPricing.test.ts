import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';

const NOTES = 'Ground-up custom home 3098 SF living.';

function draftFromNotes(): EstimateAiDraft {
  return {
    scopeChecklist: { templateKey: 'ground_up' },
    projectType: 'ground_up',
    estimateTier: 'ground_up',
    originalNotes: NOTES,
    scopePackages: [
      {
        name: 'Counters',
        scope: 'Kitchen countertops',
        price: null,
        knownSubtotal: null,
        calculatedSubtotal: null,
        priceSource: 'missing',
        status: 'missing_price',
        pricingType: 'unknown',
        scopeQuantities: [{ label: 'Living', quantity: 3098, unit: 'sqft' }],
      },
      {
        name: 'Stucco / exterior wall finish',
        scope: 'Exterior stucco',
        price: null,
        knownSubtotal: null,
        calculatedSubtotal: null,
        priceSource: 'missing',
        status: 'missing_price',
        pricingType: 'unknown',
        scopeQuantities: [{ label: 'Living', quantity: 3098, unit: 'sqft' }],
      },
    ],
    rooms: [],
    allowances: [],
    scopeMeasurements: { floorAreaSqft: 3098, itemQuantities: {} },
  } as unknown as EstimateAiDraft;
}

describe('Step 2 -> Step 3 counters / stucco pricing', () => {
  it('maps package labels to checklist rule keys', () => {
    expect(lookupRuleKeyForPackage('Counters')).toBe('countertops');
    expect(lookupRuleKeyForPackage('Stucco / exterior wall finish')).toBe('stucco');
  });

  it('syncs Confirm Scope accepted pricing onto Counters and Stucco packages', () => {
    const draft0 = draftFromNotes();
    const input = initialScopeMeasurementInputExtended(draft0);
    input.itemQuantities = {
      ...input.itemQuantities,
      countertops: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
      countertops__material: { quantity: '2800', unit: 'allowance', quantitySource: 'user_entered' },
      countertops__labor: { quantity: '2000', unit: 'allowance', quantitySource: 'user_entered' },
      stucco: { quantity: '3253', unit: 'sqft', quantitySource: 'user_entered' },
      stucco__material: { quantity: '11385', unit: 'allowance', quantitySource: 'user_entered' },
      stucco__labor: { quantity: '17891', unit: 'allowance', quantitySource: 'user_entered' },
    };
    input.pricingAcceptance = {
      countertops: buildAcceptanceFromSuggestedBlock({
        total: 4800,
        material: 2800,
        labor: 2000,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      stucco: buildAcceptanceFromSuggestedBlock({
        total: 29276,
        material: 11385,
        labor: 17891,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
    };

    const payload = scopeMeasurementsPayloadForPersist(input, {
      notes: NOTES,
      templateKey: 'ground_up',
    });
    const draft1 = syncSelectedScopePricing(
      mergeScopeProgressIntoDraft(draft0, [], payload, { scopeNotes: NOTES })
    );

    const counters = getScopePackages(draft1).find((p) => p.name === 'Counters')!;
    const stucco = getScopePackages(draft1).find((p) => /stucco/i.test(p.name))!;
    expect(counters.status).toBe('user_provided');
    expect(counters.price).toBe(4800);
    expect(stucco.status).toBe('user_provided');
    expect(stucco.price).toBe(29276);
  });
});
