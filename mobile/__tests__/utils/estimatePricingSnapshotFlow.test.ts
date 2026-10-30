import {
  resolveBenchmarkLivingSf,
  sumStep3ReviewBudgetTotals,
} from '@/utils/benchmarkReasonablenessContext';
import {
  syncConfirmScopeMeasurementsFromPackages,
  applyDraftToEstimate,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';

describe('estimate pricing snapshot flow', () => {
  it('updates Confirm Scope pricing and the snapshot when a room-only Step 3 price changes', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'flooring',
            label: 'Flooring',
            inputType: 'yes_no',
            state: 'included',
          },
        ],
      },
      rooms: [
        {
          name: 'Flooring',
          scope: 'Install LVP flooring',
          price: 8000,
          materialPrice: 5000,
          laborPrice: 3000,
          priceProvidedByUser: true,
          packageStatus: 'user_provided',
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          flooring: { quantity: '1000', unit: 'sqft' },
        },
        pricingAcceptance: {},
        confirmedScopePricingSnapshot: {
          total: 5000,
          material: 3000,
          labor: 2000,
          allowance: 0,
          lines: [
            {
              itemId: 'flooring',
              label: 'Flooring',
              total: 5000,
              material: 3000,
              labor: 2000,
              allowance: 0,
            },
          ],
        },
      },
    } as unknown as EstimateAiDraft;

    const restored = syncConfirmScopeMeasurementsFromPackages(draft);
    const measurements = restored.scopeMeasurements!;

    expect(measurements.pricingAcceptance?.flooring?.totalAmount).toBe(8000);
    expect(measurements.confirmedScopePricingSnapshot).toMatchObject({
      total: 8000,
      material: 5000,
      labor: 3000,
    });
    expect(measurements.confirmedScopePricingSnapshot?.lines).toHaveLength(1);
  });

  it('includes a valid user-added package when applied checklist pricing is zero', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'cleanup',
            label: 'Cleanup & disposal',
            inputType: 'yes_no',
            state: 'included',
          },
        ],
      },
      scopePackages: [
        {
          name: 'Disposal bid',
          scope: 'Disposal',
          price: 1200,
          knownSubtotal: 1200,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
      ],
      scopeMeasurements: {
        itemQuantities: {},
        pricingAcceptance: {},
      },
    } as unknown as EstimateAiDraft;

    expect(sumStep3ReviewBudgetTotals(draft)?.total).toBe(1200);
  });

  it('carries an off-checklist user package into the confirmed snapshot once', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'flooring',
            label: 'Flooring',
            inputType: 'yes_no',
            state: 'included',
          },
        ],
      },
      scopePackages: [
        {
          name: 'Disposal Bid',
          scope: 'Disposal',
          price: 1200,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
        {
          name: 'Disposal Bid',
          scope: 'Disposal',
          price: 1200,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {},
        pricingAcceptance: {},
        confirmedScopePricingSnapshot: {
          total: 8000,
          material: 5000,
          labor: 3000,
          allowance: 0,
          lines: [
            {
              itemId: 'flooring',
              label: 'Flooring',
              total: 8000,
              material: 5000,
              labor: 3000,
              allowance: 0,
            },
          ],
        },
      },
    } as unknown as EstimateAiDraft;

    const restored = syncConfirmScopeMeasurementsFromPackages(draft);
    const snapshot = restored.scopeMeasurements?.confirmedScopePricingSnapshot;

    expect(snapshot?.lines).toHaveLength(2);
    expect(snapshot?.lines.map(line => line.itemId)).toEqual([
      'flooring',
      'garbage_disposal',
    ]);
    expect(snapshot?.total).toBe(9200);
  });

  it('applies the confirmed snapshot totals to the final bid instead of stale package prices', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'flooring', label: 'Flooring', inputType: 'yes_no', state: 'included' },
          { id: 'paint', label: 'Paint', inputType: 'yes_no', state: 'included' },
        ],
      },
      scopePackages: [
        { name: 'Flooring', scope: 'Flooring', price: 5000, status: 'user_provided', priceProvidedByUser: true },
        { name: 'Paint', scope: 'Paint', price: 2500, status: 'user_provided', priceProvidedByUser: true },
      ],
      scopeMeasurements: {
        itemQuantities: {},
        pricingAcceptance: {},
        confirmedScopePricingSnapshot: {
          total: 12000,
          material: 5000,
          labor: 7000,
          allowance: 0,
          lines: [
            { itemId: 'flooring', label: 'Flooring', total: 8000, material: 3500, labor: 4500, allowance: 0 },
            { itemId: 'paint', label: 'Paint', total: 4000, material: 1500, labor: 2500, allowance: 0 },
          ],
        },
      },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, { applyConfirmedOnly: true });
    const materialTotal = (bid.materialLineItems as Array<{ total?: number }>).reduce(
      (sum, line) => sum + Number(line.total || 0),
      0
    );
    const laborTotal = (bid.laborLineItems as Array<{ total?: number }>).reduce(
      (sum, line) => sum + Number(line.total || 0),
      0
    );

    expect(materialTotal + laborTotal).toBe(12000);
  });

  it('does not treat a roof-square value as living area when no valid fallback exists', () => {
    expect(
      resolveBenchmarkLivingSf({
        measurementsInput: {
          floorAreaSqft: '26',
          roofSquares: '26',
          itemQuantities: {},
        } as never,
      })
    ).toBeNull();
  });
});
