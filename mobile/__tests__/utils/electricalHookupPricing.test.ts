import {
  electricalCircuitCardShouldPrice,
  quoteElectricalCircuit,
} from '@/utils/subcontractorTrade/electricalCircuitPricing';
import { quoteElectricalHookup } from '@/utils/subcontractorTrade/electricalHookupPricing';
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

describe('electrical Phase 2F hookup pricing', () => {
  it('quotes a range hookup as owned 50A plus connection', () => {
    const quote = quoteElectricalHookup({
      itemId: 'electrical_range_hookup',
      quantity: 1,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 225,
      labor: 725,
      total: 950,
    });
    expect(quote?.helper).toMatch(/owned circuit/i);
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

  it('does not stack a notes-inferred dedicated 20A onto a dishwasher hookup', () => {
    expect(
      quoteElectricalCircuit({
        itemId: 'electrical_dedicated_20a',
        quantity: 1,
        quantitySource: 'notes',
        dishwasherHookupCount: 1,
      })
    ).toBeNull();
  });

  it('marks EV charger hookup as specialty review', () => {
    const quote = quoteElectricalHookup({
      itemId: 'electrical_ev_charger_hookup',
      quantity: 1,
    });
    expect(quote?.specialty).toBe(true);
    expect(quote?.total).toBe(1250);
  });

  it('wires Confirm Scope locked pricing for hookup cards only', () => {
    const range = resolveScopeItemSuggestedPricing(
      'electrical_range_hookup',
      inputWith({
        rangeHookupCount: '1',
        itemQuantities: {
          electrical_range_hookup: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_range_hookup',
        normalizeScopeMeasurements({ rangeHookupCount: 1 }),
        { templateKey: 'electrical' }
      )
    );
    expect(range.fill?.total).toBe(950);
    expect(range.fill?.rateSourceLabel).toMatch(/approved owned-circuit/i);
    expect(range.fill?.productionStatus).toBe('production_ready');

    const ev = resolveScopeItemSuggestedPricing(
      'electrical_ev_charger_hookup',
      inputWith({
        evChargerHookupCount: '1',
        itemQuantities: {
          electrical_ev_charger_hookup: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_ev_charger_hookup',
        normalizeScopeMeasurements({ evChargerHookupCount: 1 }),
        { templateKey: 'electrical' }
      )
    );
    expect(ev.fill?.total).toBe(1250);
    expect(ev.fill?.productionStatus).toBe('review_required');
    expect(resolveStep2PricingTier('electrical_range_hookup', 'electrical').tier).toBe(
      'auto_planning'
    );
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        rangeHookupCount: '1',
        dishwasherHookupCount: '1',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          rangeHookupCount: 1,
          dishwasherHookupCount: 1,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });
});
