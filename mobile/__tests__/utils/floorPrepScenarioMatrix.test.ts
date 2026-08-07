import {
  demoWorkCodesForType,
  inferFloorPrepLevel,
  prepIncludesSummaryForLevel,
} from '@/utils/flooringDemoPrepBoundary';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

describe('flooring demo vs prep scenario matrix', () => {
  it('puts ordinary substrate cleaning in demo, not prep', () => {
    expect(demoWorkCodesForType('carpet')).toContain('DEMO_SUBSTRATE_CLEAN');
    expect(prepIncludesSummaryForLevel(1)).toMatch(/after demo cleaning/i);
    expect(prepIncludesSummaryForLevel(1)).not.toMatch(/patching,\s*cleaning/i);
  });

  it.each([
    // existing, new, existingLvpMethod, newLvpMethod, sheetType, expectedPrepRate
    ['carpet', 'carpet', null, null, null, 0.75],
    ['carpet', 'lvp', null, 'floating', null, 0.75],
    ['carpet', 'laminate', null, null, null, 0.75],
    ['carpet', 'tile', null, null, null, 1.5],
    ['carpet', 'solid_hardwood', null, null, null, 1.5],
    ['carpet', 'lvp', null, 'glue_down', null, 1.5],
    ['laminate', 'lvp', null, 'floating', null, 0.75],
    ['laminate', 'tile', null, null, null, 1.5],
    ['lvp', 'lvp', 'floating', 'floating', null, 0.75],
    ['lvp', 'tile', 'floating', null, null, 1.5],
    ['lvp', 'lvp', 'glue_down', 'floating', null, 1.5],
    ['lvp', 'tile', 'glue_down', null, null, 3],
    ['lvp', 'lvp', null, null, null, 1.5], // unknown existing LVP → reviewable moderate/heavy path
    ['sheet_vinyl_vct', 'carpet', null, null, 'sheet_vinyl', 1.5],
    ['sheet_vinyl_vct', 'tile', null, null, 'sheet_vinyl', 3],
    ['sheet_vinyl_vct', 'lvp', null, 'floating', 'vct', 3],
    ['tile', 'carpet', null, null, null, 3],
    ['tile', 'lvp', null, 'floating', null, 3],
    ['tile', 'tile', null, null, null, 3],
    ['solid_hardwood', 'carpet', null, null, null, 1.5],
    ['solid_hardwood', 'tile', null, null, null, 3],
    ['engineered_hardwood', 'lvp', null, 'floating', null, 1.5],
    ['unknown', 'lvp', null, 'floating', null, 1.5],
  ] as const)(
    'prep %s → %s @ $%s/SF',
    (existing, product, existingLvp, newLvp, sheetType, expectedRate) => {
      const measurements = inputWith({
        flooringExistingLvpInstallMethod: existingLvp,
        flooringNewLvpInstallMethod: newLvp,
        flooringExistingSheetVinylType: sheetType,
      });
      expect(inferFloorPrepLevel(existing, product, measurements)).toBe(
        expectedRate === 0.75 ? 1 : expectedRate === 1.5 ? 2 : expectedRate === 3 ? 3 : 2
      );

      const severity =
        expectedRate === 0.75
          ? 'light'
          : expectedRate === 1.5
            ? 'medium'
            : expectedRate === 3
              ? 'heavy'
              : 'medium';
      const input = inputWith({
        flooringExistingTypes: [existing as 'carpet'],
        flooringProductScope: [product as 'lvp'],
        flooringExistingLvpInstallMethod: existingLvp,
        flooringNewLvpInstallMethod: newLvp,
        flooringExistingSheetVinylType: sheetType,
        floorPrepByProduct: {
          [product]: { sqft: 400, severity },
        },
      });
      const { fill } = resolveScopeItemSuggestedPricing('floor_prep', input, 'flooring', {
        quantity: 400,
        unit: 'sqft',
        quantitySource: 'user_entered',
      });
      expect(fill?.total).toBe(400 * expectedRate);
    }
  );

  it('prices carpet+tile demo and carpet+tile prep as separate per-product severities', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      flooringCarpetSqft: '500',
      flooringTileSqft: '1200',
      floorPrepByProduct: {
        carpet: { sqft: 500, severity: 'light' },
        tile: { sqft: 1200, severity: 'heavy' },
      },
      itemQuantities: {
        floor_demo__carpet: { quantity: 500, unit: 'sqft', quantitySource: 'user_entered' },
        floor_demo__tile: { quantity: 1200, unit: 'sqft', quantitySource: 'user_entered' },
      },
    });
    const demo = resolveScopeItemSuggestedPricing('floor_demo', input, 'flooring', {
      quantity: 1700,
      unit: 'sqft',
      quantitySource: 'user_entered',
    });
    expect(demo.fill?.total).toBe(500 * 1.75 + 1200 * 4.5);

    const prep = resolveScopeItemSuggestedPricing('floor_prep', input, 'flooring', {
      quantity: 1700,
      unit: 'sqft',
      quantitySource: 'user_entered',
    });
    expect(prep.fill?.total).toBe(500 * 0.75 + 1200 * 3);
  });
});
