import {
  buildFlooringStructuredMeasurements,
  flooringPlanNeedsTypeConfirmation,
  normalizeFlooringScalarMeasurements,
} from '@/utils/subcontractorTrade/flooringPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import {
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

describe('flooring plan convergence', () => {
  it('maps labeled plan install areas into flooringProductScope', () => {
    const structured = buildFlooringStructuredMeasurements({
      flooringCarpetSqft: 500,
      flooringTileSqft: 1500,
    });
    expect(structured.flooringAreaByProduct).toEqual({
      carpet: 500,
      tile: 1500,
    });
    expect(structured.flooringProductScope).toEqual(
      expect.arrayContaining(['carpet', 'tile'])
    );
    expect(structured.flooringInstallScopeCount).toBe(1);
  });

  it('does not infer demo from new flooring alone', () => {
    const structured = buildFlooringStructuredMeasurements({
      flooringLvpSqft: 1000,
      flooringNewLvpInstallMethod: 'floating',
    });
    expect(structured.flooringDemoScopeCount).toBeNull();
    expect(structured.itemQuantities?.floor_demo).toBeUndefined();
  });

  it('does not manufacture flooring type from aggregate area only', () => {
    expect(
      flooringPlanNeedsTypeConfirmation({ flooringSqft: 1850 })
    ).toBe(true);
    const structured = buildFlooringStructuredMeasurements({ flooringSqft: 1850 });
    expect(structured.flooringProductScope).toBeNull();
    expect(structured.flooringInstallScopeCount).toBeNull();
  });

  it('allocates aggregate demo to a single explicit existing type', () => {
    const structured = buildFlooringStructuredMeasurements({
      floorDemoSqft: 1000,
      flooringExistingTypes: ['carpet'],
    });
    expect(structured.flooringDemoScopeCount).toBe(1);
    expect(structured.itemQuantities?.floor_demo__carpet).toMatchObject({
      quantity: 1000,
      unit: 'sqft',
    });
  });

  it('matches manual and plan-export pricing for 1000 sqft LVP floating with carpet demo', () => {
    const manualInput = inputWith({
      flooringProductScope: ['lvp'],
      flooringLvpSqft: '1000',
      flooringNewLvpInstallMethod: 'floating',
      flooringExistingTypes: ['carpet'],
      flooringDemoScopeCount: 1,
      floorDemoSqft: '1000',
      itemQuantities: {
        floor_demo__carpet: { quantity: 1000, unit: 'sqft' },
        floor_install__lvp: { quantity: 1000, unit: 'sqft' },
      },
    });
    const planInput = inputWith({
      flooringProductScope: ['lvp'],
      flooringLvpSqft: '1000',
      flooringNewLvpInstallMethod: 'floating',
      flooringExistingTypes: ['carpet'],
      flooringDemoScopeCount: 1,
      floorDemoSqft: '1000',
      itemQuantities: {
        floor_demo__carpet: { quantity: 1000, unit: 'sqft' },
        floor_install__lvp: { quantity: 1000, unit: 'sqft' },
      },
    });

    const installResolved = {
      quantity: 1000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const manualInstall = resolveScopeItemSuggestedPricing(
      'flooring_lvp',
      manualInput,
      'flooring',
      installResolved
    );
    const planInstall = resolveScopeItemSuggestedPricing(
      'flooring_lvp',
      planInput,
      'flooring',
      installResolved
    );
    expect(planInstall.fill?.total).toBe(manualInstall.fill?.total);
    expect(planInstall.fill?.total).toBe(7000);

    const demoResolved = {
      quantity: 1000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const manualDemo = resolveScopeItemSuggestedPricing(
      'floor_demo',
      manualInput,
      'flooring',
      demoResolved
    );
    const planDemo = resolveScopeItemSuggestedPricing(
      'floor_demo',
      planInput,
      'flooring',
      demoResolved
    );
    expect(planDemo.fill?.total).toBe(manualDemo.fill?.total);
    expect(planDemo.fill?.material).toBe(manualDemo.fill?.material);
    expect(planDemo.fill?.labor).toBe(manualDemo.fill?.labor);
  });

  it('matches manual and plan-export pricing for 500 sqft tile removal and install', () => {
    const manualInput = inputWith({
      flooringProductScope: ['tile'],
      flooringTileSqft: '500',
      flooringExistingTypes: ['tile'],
      flooringDemoScopeCount: 1,
      floorDemoSqft: '500',
      itemQuantities: {
        floor_demo__tile: { quantity: 500, unit: 'sqft' },
        floor_install__tile: { quantity: 500, unit: 'sqft' },
      },
    });
    const planNormalized = normalizeTradeMeasurements(
      'flooring',
      {
        flooringTileSqft: 500,
        floorDemoTileSqft: 500,
        flooringExistingTypes: ['tile'],
      },
      'plan'
    );
    const planInput = inputWith({
      flooringProductScope: ['tile'],
      flooringTileSqft: '500',
      flooringExistingTypes: ['tile'],
      flooringDemoScopeCount: 1,
      floorDemoSqft: '500',
      itemQuantities: planNormalized.structuredMeasurements
        ?.itemQuantities as ScopeMeasurementsInputExtended['itemQuantities'],
    });

    const resolved = {
      quantity: 500,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const manualInstall = resolveScopeItemSuggestedPricing(
      'tile_flooring',
      manualInput,
      'flooring',
      resolved
    );
    const planInstall = resolveScopeItemSuggestedPricing(
      'tile_flooring',
      planInput,
      'flooring',
      resolved
    );
    expect(planInstall.fill?.total).toBe(manualInstall.fill?.total);
    expect(planInstall.fill?.total).toBe(4285);

    const manualDemo = resolveScopeItemSuggestedPricing(
      'floor_demo',
      manualInput,
      'flooring',
      resolved
    );
    const planDemo = resolveScopeItemSuggestedPricing(
      'floor_demo',
      planInput,
      'flooring',
      resolved
    );
    expect(planDemo.fill?.total).toBe(manualDemo.fill?.total);
  });

  it('keeps multi-type quantities independent without overwriting', () => {
    const normalized = normalizeTradeMeasurements(
      'flooring',
      {
        flooringCarpetSqft: 500,
        flooringTileSqft: 1500,
        baseboardLf: 200,
      },
      'plan'
    );
    expect(normalized.measurements.flooringCarpetSqft).toBe(500);
    expect(normalized.measurements.flooringTileSqft).toBe(1500);
    expect(normalized.measurements.flooringSqft).toBe(2000);
    expect(normalized.measurements.baseboardLf).toBe(200);
    expect(normalized.structuredMeasurements?.flooringDemoScopeCount).toBeUndefined();
  });

  it('persists and reloads flooring convergence fields', () => {
    const persisted = scopeMeasurementsPayloadForPersist(
      inputWith({
        flooringProductScope: ['carpet', 'tile'],
        flooringCarpetSqft: '500',
        flooringTileSqft: '1500',
        flooringSqft: '2000',
        flooringExistingTypes: ['carpet', 'tile'],
        floorDemoSqft: '2000',
        flooringInstallScopeCount: 1,
        flooringDemoScopeCount: 1,
        itemQuantities: {
          floor_install__carpet: { quantity: '500', unit: 'sqft' },
          floor_install__tile: { quantity: '1500', unit: 'sqft' },
          floor_demo__carpet: { quantity: '500', unit: 'sqft' },
          floor_demo__tile: { quantity: '1500', unit: 'sqft' },
        },
      })
    );
    expect(persisted.flooringCarpetSqft).toBe(500);
    expect(persisted.flooringTileSqft).toBe(1500);
    expect(persisted.flooringSqft).toBe(2000);
    expect(persisted.floorDemoSqft).toBe(2000);
    expect(persisted.itemQuantities?.floor_install__carpet?.quantity).toBe(500);
    const restored = scopeMeasurementsInputFromPayload(persisted);
    expect(restored.flooringSqft).toBe('2000');
    expect(restored.itemQuantities?.floor_install__carpet?.quantity).toBe('500');
    expect(restored.itemQuantities?.floor_demo__tile?.quantity).toBe('1500');
  });
});
