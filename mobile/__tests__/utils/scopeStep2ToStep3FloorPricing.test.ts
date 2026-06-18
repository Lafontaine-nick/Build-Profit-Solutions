import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import {
  initialScopeMeasurementInputExtended,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';
import { compactPackageAmount } from '@/utils/estimateDraftReviewUi';

const NOTES =
  'Install LVP flooring which is 850 sqft. Material is $4.50 a square foot and $3.25 a square foot for labor.';

/**
 * Reproduces the live Step 2 -> Step 3 handoff for the reported bug:
 * user taps "Use this pricing" ($2,550 material / $3,400 labor = $5,950) on the
 * flooring card in Step 2, then Step 3 must show $5,950 (not the $6,587.50 from notes).
 */
function draftFromNotes(): EstimateAiDraft {
  return {
    scopeChecklist: { templateKey: 'flooring' },
    projectType: 'flooring',
    originalNotes: NOTES,
    scopePackages: [
      {
        name: 'LVP Flooring Installation',
        scope: 'Install LVP flooring 850 sqft',
        price: 6587.5,
        knownSubtotal: 6587.5,
        calculatedSubtotal: 6587.5,
        materialPrice: 3825,
        laborPrice: 2762.5,
        priceSource: 'notes',
        status: 'calculated',
        pricingType: 'split',
      },
    ],
    rooms: [],
    allowances: [],
    scopeMeasurements: { floorAreaSqft: 850, itemQuantities: {} },
  } as unknown as EstimateAiDraft;
}

describe('Step 2 -> Step 3 flooring pricing sync (live path)', () => {
  it('shows the user-selected $5,950 split in Step 3, not the $6,587.50 notes price', () => {
    const draft0 = draftFromNotes();

    // 1. Step 2: hydrate the measurement input the way the modal does.
    const input = initialScopeMeasurementInputExtended(draft0);

    // 2. Step 2: user taps "Use this pricing" -> handleApplySuggestedPricing
    //    writes the saved-rate split as user_entered.
    input.itemQuantities = {
      ...input.itemQuantities,
      flooring: { quantity: '850', unit: 'sqft', quantitySource: 'user_entered' },
      flooring__material: { quantity: '2550', unit: 'allowance', quantitySource: 'user_entered' },
      flooring__labor: { quantity: '3400', unit: 'allowance', quantitySource: 'user_entered' },
      flooring__allowance: { quantity: '5950', unit: 'allowance', quantitySource: 'user_entered' },
    };

    // 3. Confirm: orchestrator persists via scopeMeasurementsPayloadForPersist.
    const payload = scopeMeasurementsPayloadForPersist(input, {
      notes: NOTES,
      templateKey: 'flooring',
    });

    // 4. mergeScopeProgressIntoDraft sets scopeMeasurements = payload, then sync.
    const draft1 = { ...draft0, scopeMeasurements: payload } as EstimateAiDraft;
    const draft2 = syncSelectedScopePricing(draft1);

    // 5. Step 3 display.
    const pkg = getScopePackages(draft2).find((p) => /flooring/i.test(p.name))!;
    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft2);
    const compact = compactPackageAmount(pkg, draft2);

    expect(payload.itemQuantities?.flooring__material).toMatchObject({
      quantity: 2550,
      quantitySource: 'user_entered',
    });

    expect(breakdown).toBeTruthy();
    expect(breakdown!.total).toBe(5950);
    expect(breakdown!.material).toBe(2550);
    expect(breakdown!.labor).toBe(3400);
    expect(breakdown!.materialSource).not.toBe('notes');
    expect(compact).toBe('$5,950');
  });

  it('keeps the selected split when the parent receives an already-persisted measurements payload', () => {
    const draft0 = draftFromNotes();
    const input = initialScopeMeasurementInputExtended(draft0);
    input.itemQuantities = {
      ...input.itemQuantities,
      flooring: { quantity: '850', unit: 'sqft', quantitySource: 'user_entered' },
      flooring__material: { quantity: '2550', unit: 'allowance', quantitySource: 'user_entered' },
      flooring__labor: { quantity: '3400', unit: 'allowance', quantitySource: 'user_entered' },
      flooring__allowance: { quantity: '5950', unit: 'allowance', quantitySource: 'user_entered' },
    };
    const payloadFromModal = scopeMeasurementsPayloadForPersist(input, {
      notes: NOTES,
      templateKey: 'flooring',
    });

    // This mirrors estimate-generator's onPersistProgress/onConfirm handoff:
    // the modal already sends a ScopeMeasurements payload, not UI input.
    const repairedAgainInParent = scopeMeasurementsPayloadForPersist(payloadFromModal as never, {
      notes: NOTES,
      templateKey: 'flooring',
    });
    const draft1 = syncSelectedScopePricing(
      mergeScopeProgressIntoDraft(draft0, [], repairedAgainInParent, { scopeNotes: NOTES })
    );

    const pkg = getScopePackages(draft1).find((p) => /flooring/i.test(p.name))!;
    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft1);

    expect(repairedAgainInParent.itemQuantities?.flooring__allowance).toMatchObject({
      quantity: 5950,
      quantitySource: 'user_entered',
    });
    expect(breakdown?.total).toBe(5950);
  });
});
