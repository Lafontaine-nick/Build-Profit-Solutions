import {
  mergeConfirmScopeSavedMeasurements,
  sumAppliedScopePricingFromDraft,
} from '@/utils/benchmarkReasonablenessContext';
import {
  restoreConfirmedChecklistItemStates,
  type ScopeChecklistItem,
} from '@/utils/estimateScopeChecklistUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('Confirm Scope navigation restore', () => {
  it('mergeConfirmScopeSavedMeasurements keeps saved mat/lab legs dropped by note parse', () => {
    const base = {
      itemQuantities: {},
      pricingAcceptance: {},
    };
    const saved = {
      itemQuantities: {
        excavation__material: { quantity: '444', unit: 'allowance', quantitySource: 'user_entered' },
        excavation__labor: { quantity: '3994', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        excavation: { totalAmount: 4438, selectionStatus: 'accepted' },
      },
    };

    const merged = mergeConfirmScopeSavedMeasurements(base as never, saved as never);
    expect(merged.itemQuantities?.excavation__material?.quantity).toBe('444');
    expect(merged.itemQuantities?.excavation__labor?.quantity).toBe('3994');
    expect(merged.pricingAcceptance?.excavation?.totalAmount).toBe(4438);
  });

  it('restoreConfirmedChecklistItemStates preserves Yes/No after note hydration', () => {
    const confirmed: ScopeChecklistItem[] = [
      { id: 'cleanup', label: 'Cleanup', inputType: 'yes_no', state: 'included' },
      { id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'excluded' },
    ];
    const hydrated: ScopeChecklistItem[] = [
      { id: 'cleanup', label: 'Cleanup', inputType: 'yes_no', state: 'unsure' },
      { id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'included' },
    ];

    const restored = restoreConfirmedChecklistItemStates(hydrated, confirmed);
    expect(restored[0].state).toBe('included');
    expect(restored[1].state).toBe('excluded');
  });

  it('sumAppliedScopePricingFromDraft uses saved Confirm Scope measurements after Step 3 back', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      confirmedAssumptions: [
        { id: 'excavation', label: 'Excavation', inputType: 'yes_no', state: 'included' },
        { id: 'contingency', label: 'Contingency', inputType: 'yes_no', state: 'included' },
      ],
      scopeChecklist: { templateKey: 'ground_up', items: [] },
      scopeMeasurements: {
        itemQuantities: {
          excavation__material: { quantity: '500', unit: 'allowance', quantitySource: 'user_entered' },
          excavation__labor: { quantity: '4500', unit: 'allowance', quantitySource: 'user_entered' },
          contingency__allowance: { quantity: '5000', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {},
      },
    } as unknown as EstimateAiDraft;

    expect(sumAppliedScopePricingFromDraft(draft)?.total).toBe(10000);
  });
});
