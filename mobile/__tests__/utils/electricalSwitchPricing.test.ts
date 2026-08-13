import { quoteElectricalSwitch } from '@/utils/subcontractorTrade/electricalSwitchPricing';
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

describe('electrical Phase 2D switch pricing', () => {
  it('quotes device-only single-pole switches at the locked split', () => {
    const quote = quoteElectricalSwitch({
      itemId: 'electrical_single_pole_switch',
      quantity: 8,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 120,
      labor: 640,
      total: 760,
    });
    expect(quote?.helper).toMatch(/homerun not included/i);
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalSwitch({
      itemId: 'electrical_dimmer_switch',
      quantity: 4,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(168);
    expect(quote?.labor).toBe(604.8);
    expect(quote?.total).toBe(772.8);
  });

  it('does not treat a circuit homerun as a switch fill', () => {
    const circuit = resolveScopeItemSuggestedPricing(
      'electrical_standard_circuit',
      inputWith({
        standardCircuitCount: '8',
        singlePoleSwitchCount: '8',
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
    const switches = resolveScopeItemSuggestedPricing(
      'electrical_single_pole_switch',
      inputWith({
        standardCircuitCount: '8',
        singlePoleSwitchCount: '8',
        itemQuantities: {
          electrical_single_pole_switch: {
            quantity: '8',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_single_pole_switch',
        normalizeScopeMeasurements({ singlePoleSwitchCount: 8 }),
        { templateKey: 'electrical' }
      )
    );
    expect(circuit.fill?.total).toBe(2400);
    expect(switches.fill?.total).toBe(760);
    expect(switches.fill?.helper).toMatch(/device/i);
  });

  it('wires Confirm Scope locked pricing for switch cards only', () => {
    const dimmer = resolveScopeItemSuggestedPricing(
      'electrical_dimmer_switch',
      inputWith({
        dimmerSwitchCount: '4',
        itemQuantities: {
          electrical_dimmer_switch: {
            quantity: '4',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_dimmer_switch',
        normalizeScopeMeasurements({ dimmerSwitchCount: 4 }),
        { templateKey: 'electrical' }
      )
    );
    expect(dimmer.fill?.total).toBe(600);
    expect(dimmer.fill?.rateSourceLabel).toMatch(/approved device/i);
    expect(dimmer.fill?.productionStatus).toBe('production_ready');
    expect(
      resolveStep2PricingTier('electrical_single_pole_switch', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        singlePoleSwitchCount: '8',
        dimmerSwitchCount: '4',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          singlePoleSwitchCount: 8,
          dimmerSwitchCount: 4,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('prices a kitchen dedicated circuit, standard switches, and dimmer without a package', () => {
    const measurements = normalizeScopeMeasurements({
      dedicated20aCircuitCount: 1,
      singlePoleSwitchCount: 3,
      dimmerSwitchCount: 1,
    });
    const circuit = resolveScopeItemSuggestedPricing(
      'electrical_dedicated_20a',
      inputWith({
        dedicated20aCircuitCount: '1',
        itemQuantities: {
          electrical_dedicated_20a: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity('electrical_dedicated_20a', measurements, {
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
    const dimmer = resolveScopeItemSuggestedPricing(
      'electrical_dimmer_switch',
      inputWith({
        dimmerSwitchCount: '1',
        itemQuantities: {
          electrical_dimmer_switch: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity('electrical_dimmer_switch', measurements, {
        templateKey: 'electrical',
      })
    );
    const rough = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        dedicated20aCircuitCount: '1',
        singlePoleSwitchCount: '3',
        dimmerSwitchCount: '1',
      }),
      'electrical',
      resolveChecklistItemQuantity('electrical_rough', measurements, {
        templateKey: 'electrical',
      })
    );
    expect(circuit.fill?.total).toBe(400);
    expect(switches.fill?.total).toBe(285);
    expect(dimmer.fill?.total).toBe(150);
    expect((circuit.fill?.total || 0) + (switches.fill?.total || 0) + (dimmer.fill?.total || 0)).toBe(
      835
    );
    expect(rough.fill).toBeNull();
  });
});
