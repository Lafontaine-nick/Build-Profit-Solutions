import {
  removeScopePackageFromDraft,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';

describe('removeScopePackageFromDraft', () => {
  it('removes the package, clears Confirm Scope pricing, and refreshes the total', () => {
    const draft = {
      scopePackages: [
        {
          name: 'Excavation',
          checklistItemId: 'excavation',
          price: 4437.84,
          knownSubtotal: 4437.84,
          status: 'user_provided',
        },
        {
          name: 'Framing',
          checklistItemId: 'framing',
          price: 67073.6,
          knownSubtotal: 67073.6,
          status: 'user_provided',
        },
      ],
      rooms: [
        { name: 'Excavation', price: 4437.84 },
        { name: 'Framing', price: 67073.6 },
      ],
      calculatedLineItemTotal: 71511.44,
      calculatedTotal: 71511.44,
      scopeMeasurements: {
        itemQuantities: {
          excavation: { quantity: 132, unit: 'cy', quantitySource: 'user_entered' },
          excavation__material: { quantity: 444, unit: 'allowance', quantitySource: 'user_entered' },
          excavation__labor: { quantity: 3994, unit: 'allowance', quantitySource: 'user_entered' },
          framing: { quantity: 4070, unit: 'sqft', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          excavation: { selectionStatus: 'accepted', totalAmount: 4437.84 },
          framing: { selectionStatus: 'accepted', totalAmount: 67073.6 },
        },
      },
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'excavation', label: 'Excavation', state: 'included', inputType: 'yes_no' },
          { id: 'framing', label: 'Framing', state: 'included', inputType: 'yes_no' },
        ],
      },
    } as unknown as EstimateAiDraft;

    const next = removeScopePackageFromDraft(draft, 'Excavation');
    expect(next.scopePackages?.map((p) => p.name)).toEqual(['Framing']);
    expect(next.rooms?.map((r) => r.name)).toEqual(['Framing']);
    expect(next.calculatedLineItemTotal).toBe(67073.6);
    expect(next.scopeMeasurements?.itemQuantities?.excavation).toBeUndefined();
    expect(next.scopeMeasurements?.pricingAcceptance?.excavation).toBeUndefined();
    expect(next.scopeChecklist?.items?.find((i) => i.id === 'excavation')?.state).toBe('excluded');
    expect(next.scopeChecklist?.items?.find((i) => i.id === 'framing')?.state).toBe('included');
  });
});
