import {
  electricalCircuitCardShouldPrice,
  quoteElectricalCircuit,
} from '@/utils/subcontractorTrade/electricalCircuitPricing';
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

describe('electrical Phase 2B circuit pricing', () => {
  it('quotes a new-construction standard 15/20A circuit at the proposed split', () => {
    const quote = quoteElectricalCircuit({
      itemId: 'electrical_standard_circuit',
      quantity: 8,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 440,
      labor: 1960,
      total: 2400,
      specialty: false,
    });
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalCircuit({
      itemId: 'electrical_dedicated_20a',
      quantity: 2,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(150);
    expect(quote?.labor).toBe(910);
    expect(quote?.total).toBe(1060);
  });

  it('does not stack a notes-inferred 50A card onto a range hookup', () => {
    expect(
      electricalCircuitCardShouldPrice('electrical_circuit_50a', {
        itemId: 'electrical_circuit_50a',
        quantity: 1,
        quantitySource: 'notes',
        rangeHookupCount: 1,
      })
    ).toBe(false);
    expect(
      quoteElectricalCircuit({
        itemId: 'electrical_circuit_50a',
        quantity: 1,
        quantitySource: 'notes',
        rangeHookupCount: 1,
      })
    ).toBeNull();
  });

  it('still prices an independently entered 50A circuit beside a range', () => {
    const quote = quoteElectricalCircuit({
      itemId: 'electrical_circuit_50a',
      quantity: 1,
      quantitySource: 'user_entered',
      rangeHookupCount: 1,
    });
    expect(quote?.total).toBe(750);
  });

  it('surfaces a duplicate warning for an explicitly entered dryer circuit', () => {
    const input = inputWith({
      dryerHookupCount: '1',
      circuit30aCount: '1',
      itemQuantities: {
        electrical_dryer_hookup: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        electrical_circuit_30a: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_circuit_30a',
      input,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_circuit_30a',
        normalizeScopeMeasurements(input),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill?.total).toBe(500);
    expect(pricing.fill?.pricingDetail).toMatch(
      /possible duplicate electrical scope/i
    );
    expect(pricing.fill?.pricingDetail).toMatch(/dryer/i);
  });

  it('surfaces a duplicate warning for an explicitly entered range circuit', () => {
    const input = inputWith({
      rangeHookupCount: '1',
      circuit50aCount: '1',
      itemQuantities: {
        electrical_range_hookup: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        electrical_circuit_50a: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_circuit_50a',
      input,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_circuit_50a',
        normalizeScopeMeasurements(input),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill?.total).toBe(750);
    expect(pricing.fill?.pricingDetail).toMatch(/range/i);
  });

  it('surfaces a duplicate warning for an explicitly entered dishwasher circuit', () => {
    const input = inputWith({
      dishwasherHookupCount: '1',
      dedicated20aCircuitCount: '1',
      itemQuantities: {
        electrical_dishwasher_hookup: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        electrical_dedicated_20a: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_dedicated_20a',
      input,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_dedicated_20a',
        normalizeScopeMeasurements(input),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill?.total).toBe(400);
    expect(pricing.fill?.pricingDetail).toMatch(/dishwasher/i);
  });

  it('does not stack a notes-inferred 60A+ card onto an EV charger hookup', () => {
    expect(
      quoteElectricalCircuit({
        itemId: 'electrical_circuit_60a_plus',
        quantity: 1,
        quantitySource: 'notes',
        evChargerHookupCount: 1,
      })
    ).toBeNull();
  });

  it('marks 60A+ as a specialty review tier', () => {
    const quote = quoteElectricalCircuit({
      itemId: 'electrical_circuit_60a_plus',
      quantity: 1,
    });
    expect(quote?.specialty).toBe(true);
    expect(quote?.helper).toMatch(/specialty/i);
    expect(quote?.total).toBe(1000);
  });

  it('wires Confirm Scope proposed pricing for circuit cards only', () => {
    const circuitPricing = resolveScopeItemSuggestedPricing(
      'electrical_standard_circuit',
      inputWith({
        standardCircuitCount: '8',
        electricalProjectCondition: 'new_construction',
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
    expect(circuitPricing.fill?.total).toBe(2400);
    expect(circuitPricing.fill?.rateSourceLabel).toMatch(/approved homerun/i);
    expect(circuitPricing.fill?.productionStatus).toBe('production_ready');
    expect(
      resolveStep2PricingTier('electrical_standard_circuit', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        standardCircuitCount: '8',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          standardCircuitCount: 8,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });
});
