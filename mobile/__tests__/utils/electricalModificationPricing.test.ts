import { quoteElectricalModification } from '@/utils/subcontractorTrade/electricalModificationPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { parseElectricalMeasurementsFromNotes } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { resolveStep2PricingTier } from '@/utils/confirmScopeStep2Pricing';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

describe('electrical Phase 2H modification pricing', () => {
  it('quotes relocate at the locked split without stacking a new device', () => {
    const quote = quoteElectricalModification({
      itemId: 'electrical_relocate',
      quantity: 2,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 70,
      labor: 330,
      total: 400,
    });
    expect(quote?.helper).toMatch(/new device not stacked/i);
    expect(quote?.helper).toMatch(/approved split/i);
  });

  it('quotes device removal cheaper than a new receptacle', () => {
    const quote = quoteElectricalModification({
      itemId: 'electrical_device_removal',
      quantity: 4,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 60,
      labor: 280,
      total: 340,
    });
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalModification({
      itemId: 'electrical_relocate',
      quantity: 1,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(35);
    expect(quote?.labor).toBe(231);
    expect(quote?.total).toBe(266);
  });

  it('marks abandoned circuits specialty / confirm', () => {
    const quote = quoteElectricalModification({
      itemId: 'electrical_abandoned_circuit',
      quantity: 1,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 25,
      labor: 150,
      total: 175,
      specialty: true,
    });
  });

  it('wires Confirm Scope locked pricing for modification cards only', () => {
    const relocate = resolveScopeItemSuggestedPricing(
      'electrical_relocate',
      inputWith({
        relocateCount: '1',
        itemQuantities: {
          electrical_relocate: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_relocate',
        normalizeScopeMeasurements({ relocateCount: 1 }),
        { templateKey: 'electrical' }
      )
    );
    expect(relocate.fill?.total).toBe(200);
    expect(relocate.fill?.rateSourceLabel).toMatch(/approved make-safe/i);
    expect(relocate.fill?.productionStatus).toBe('production_ready');
    expect(relocate.fill?.pricingRecordId).toBe(
      'bps_electrical_modification:electrical_relocate'
    );

    const removal = resolveScopeItemSuggestedPricing(
      'electrical_device_removal',
      inputWith({
        deviceRemovalCount: '4',
        itemQuantities: {
          electrical_device_removal: {
            quantity: '4',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_device_removal',
        normalizeScopeMeasurements({ deviceRemovalCount: 4 }),
        { templateKey: 'electrical' }
      )
    );
    expect(removal.fill?.total).toBe(340);
    expect(removal.fill?.productionStatus).toBe('production_ready');

    const abandoned = resolveScopeItemSuggestedPricing(
      'electrical_abandoned_circuit',
      inputWith({
        abandonedCircuitCount: '1',
        itemQuantities: {
          electrical_abandoned_circuit: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_abandoned_circuit',
        normalizeScopeMeasurements({ abandonedCircuitCount: 1 }),
        { templateKey: 'electrical' }
      )
    );
    expect(abandoned.fill?.total).toBe(175);
    expect(abandoned.fill?.productionStatus).toBe('review_required');

    expect(
      resolveStep2PricingTier('electrical_relocate', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        relocateCount: '2',
        deviceRemovalCount: '4',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          relocateCount: 2,
          deviceRemovalCount: 4,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('does not stack relocate or removal onto install cards', () => {
    const moved = parseElectricalMeasurementsFromNotes(
      'Electrical: relocate 2 outlets'
    );
    expect(moved.relocateCount).toBe(2);
    expect(moved.standardReceptacleCount).toBeUndefined();
    expect(moved.deviceRemovalCount).toBeUndefined();

    const removed = parseElectricalMeasurementsFromNotes(
      'Electrical: remove 4 outlets'
    );
    expect(removed.deviceRemovalCount).toBe(4);
    expect(removed.standardReceptacleCount).toBeUndefined();
    expect(removed.relocateCount).toBeUndefined();

    const fixtures = parseElectricalMeasurementsFromNotes(
      'Electrical: remove 3 light fixtures'
    );
    expect(fixtures.fixtureRemovalCount).toBe(3);
    expect(fixtures.standardFixtureCount).toBeUndefined();

    const abandoned = parseElectricalMeasurementsFromNotes(
      'Electrical: abandon 2 circuits'
    );
    expect(abandoned.abandonedCircuitCount).toBe(2);
    expect(abandoned.standardCircuitCount).toBeUndefined();
  });
});
