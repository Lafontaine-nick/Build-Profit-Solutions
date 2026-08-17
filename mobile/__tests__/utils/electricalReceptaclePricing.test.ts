import { quoteElectricalReceptacle } from '@/utils/subcontractorTrade/electricalReceptaclePricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
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

describe('electrical Phase 2C receptacle pricing', () => {
  it('quotes device-only standard receptacles at the locked split', () => {
    const quote = quoteElectricalReceptacle({
      itemId: 'electrical_standard_receptacle',
      quantity: 12,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 240,
      labor: 1080,
      total: 1320,
    });
    expect(quote?.helper).toMatch(/homerun not included/i);
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalReceptacle({
      itemId: 'electrical_gfci_receptacle',
      quantity: 4,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(140);
    expect(quote?.labor).toBe(784);
    expect(quote?.total).toBe(924);
  });

  it('does not treat a circuit homerun as a receptacle fill', () => {
    const circuit = resolveScopeItemSuggestedPricing(
      'electrical_standard_circuit',
      inputWith({
        standardCircuitCount: '8',
        standardReceptacleCount: '12',
        itemQuantities: {
          electrical_standard_circuit: {
            quantity: '8',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_standard_circuit',
        normalizeScopeMeasurements({ standardCircuitCount: 8 }),
        { templateKey: 'electrical' }
      )
    );
    const receptacle = resolveScopeItemSuggestedPricing(
      'electrical_standard_receptacle',
      inputWith({
        standardCircuitCount: '8',
        standardReceptacleCount: '12',
        itemQuantities: {
          electrical_standard_receptacle: {
            quantity: '12',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_standard_receptacle',
        normalizeScopeMeasurements({ standardReceptacleCount: 12 }),
        { templateKey: 'electrical' }
      )
    );
    expect(circuit.fill?.total).toBe(2400);
    expect(receptacle.fill?.total).toBe(1320);
    expect(receptacle.fill?.helper).toMatch(/device/i);
  });

  it('wires Confirm Scope locked pricing for receptacle cards only', () => {
    const gfci = resolveScopeItemSuggestedPricing(
      'electrical_gfci_receptacle',
      inputWith({
        gfciReceptacleCount: '4',
        itemQuantities: {
          electrical_gfci_receptacle: {
            quantity: '4',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_gfci_receptacle',
        normalizeScopeMeasurements({ gfciReceptacleCount: 4 }),
        { templateKey: 'electrical' }
      )
    );
    expect(gfci.fill?.total).toBe(700);
    expect(gfci.fill?.rateSourceLabel).toMatch(/approved device/i);
    expect(gfci.fill?.productionStatus).toBe('production_ready');
    expect(
      resolveStep2PricingTier('electrical_standard_receptacle', 'electrical')
        .tier
    ).toBe('auto_planning');
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        standardReceptacleCount: '12',
        gfciReceptacleCount: '4',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          standardReceptacleCount: 12,
          gfciReceptacleCount: 4,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('prices a manually entered floor receptacle quantity', () => {
    const input = inputWith({
      itemQuantities: {
        electrical_floor_receptacle: {
          quantity: '10',
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
    });
    const normalized = normalizeScopeMeasurements(input);
    const resolved = resolveChecklistItemQuantity(
      'electrical_floor_receptacle',
      normalized,
      { templateKey: 'electrical' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_floor_receptacle',
      input,
      'electrical',
      resolved
    );

    expect(resolved).toMatchObject({
      quantity: '10',
      unit: 'each',
      pricingReady: true,
    });
    expect(pricing.fill).toMatchObject({
      material: 900,
      labor: 2200,
      total: 3100,
    });
  });
});
