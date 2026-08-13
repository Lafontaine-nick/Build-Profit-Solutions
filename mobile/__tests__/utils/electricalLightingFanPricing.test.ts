import { quoteElectricalLightingFan } from '@/utils/subcontractorTrade/electricalLightingFanPricing';
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

describe('electrical Phase 2E lighting/fan pricing', () => {
  it('quotes fixture-only recessed lights at the locked split', () => {
    const quote = quoteElectricalLightingFan({
      itemId: 'electrical_recessed_light',
      quantity: 18,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 810,
      labor: 1890,
      total: 2700,
    });
    expect(quote?.helper).toMatch(/homerun not included/i);
  });

  it('quotes standard / vanity fixtures at the raised locked split', () => {
    const quote = quoteElectricalLightingFan({
      itemId: 'electrical_standard_fixture',
      quantity: 1,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 50,
      labor: 100,
      total: 150,
    });
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalLightingFan({
      itemId: 'electrical_ceiling_fan',
      quantity: 3,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(300);
    expect(quote?.labor).toBe(735);
    expect(quote?.total).toBe(1035);
  });

  it('marks decorative / chandelier as specialty review', () => {
    const quote = quoteElectricalLightingFan({
      itemId: 'electrical_decorative_light',
      quantity: 1,
    });
    expect(quote?.specialty).toBe(true);
    expect(quote?.helper).toMatch(/specialty/i);
    expect(quote?.total).toBe(300);
  });

  it('wires Confirm Scope locked pricing for lighting cards only', () => {
    const recessed = resolveScopeItemSuggestedPricing(
      'electrical_recessed_light',
      inputWith({
        recessedLightCount: '18',
        itemQuantities: {
          electrical_recessed_light: {
            quantity: '18',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_recessed_light',
        normalizeScopeMeasurements({ recessedLightCount: 18 }),
        { templateKey: 'electrical' }
      )
    );
    expect(recessed.fill?.total).toBe(2700);
    expect(recessed.fill?.rateSourceLabel).toMatch(/approved fixture/i);
    expect(recessed.fill?.productionStatus).toBe('production_ready');

    const chandelier = resolveScopeItemSuggestedPricing(
      'electrical_decorative_light',
      inputWith({
        decorativeLightCount: '1',
        itemQuantities: {
          electrical_decorative_light: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_decorative_light',
        normalizeScopeMeasurements({ decorativeLightCount: 1 }),
        { templateKey: 'electrical' }
      )
    );
    expect(chandelier.fill?.total).toBe(300);
    expect(chandelier.fill?.productionStatus).toBe('review_required');
    expect(
      resolveStep2PricingTier('electrical_recessed_light', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('prices kitchen recessed lights, switches, and circuits without a lighting package', () => {
    const measurements = normalizeScopeMeasurements({
      recessedLightCount: 12,
      singlePoleSwitchCount: 3,
      standardCircuitCount: 2,
    });
    const lights = resolveScopeItemSuggestedPricing(
      'electrical_recessed_light',
      inputWith({
        recessedLightCount: '12',
        itemQuantities: {
          electrical_recessed_light: {
            quantity: '12',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity('electrical_recessed_light', measurements, {
        templateKey: 'electrical',
      })
    );
    const switches = resolveScopeItemSuggestedPricing(
      'electrical_single_pole_switch',
      inputWith({
        singlePoleSwitchCount: '3',
        itemQuantities: {
          electrical_single_pole_switch: {
            quantity: '3',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_single_pole_switch',
        measurements,
        { templateKey: 'electrical' }
      )
    );
    const circuits = resolveScopeItemSuggestedPricing(
      'electrical_standard_circuit',
      inputWith({
        standardCircuitCount: '2',
        itemQuantities: {
          electrical_standard_circuit: {
            quantity: '2',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity('electrical_standard_circuit', measurements, {
        templateKey: 'electrical',
      })
    );
    const rough = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        recessedLightCount: '12',
        singlePoleSwitchCount: '3',
        standardCircuitCount: '2',
      }),
      'electrical',
      resolveChecklistItemQuantity('electrical_rough', measurements, {
        templateKey: 'electrical',
      })
    );
    expect(circuits.fill?.total).toBe(600);
    expect(switches.fill?.total).toBe(285);
    expect(lights.fill?.total).toBe(1800);
    expect(
      (circuits.fill?.total || 0) +
        (switches.fill?.total || 0) +
        (lights.fill?.total || 0)
    ).toBe(2685);
    expect(rough.fill).toBeNull();
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        recessedLightCount: '18',
        ceilingFanCount: '3',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          recessedLightCount: 18,
          ceilingFanCount: 3,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });
});
