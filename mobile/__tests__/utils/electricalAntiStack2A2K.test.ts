import {
  electricalCircuitCardShouldPrice,
} from '@/utils/subcontractorTrade/electricalCircuitPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  hasDetailedElectricalQuantities,
  parseElectricalMeasurementsFromNotes,
  shouldAutoPriceElectricalRoughPackage,
  shouldAutoPriceElectricalTrimPackage,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

function priceElectrical(
  itemId: string,
  fields: Record<string, unknown>
) {
  const input = inputWith(fields as Partial<ScopeMeasurementsInputExtended>);
  return resolveScopeItemSuggestedPricing(
    itemId,
    input,
    'electrical',
    resolveChecklistItemQuantity(
      itemId,
      normalizeScopeMeasurements(fields),
      { templateKey: 'electrical' }
    )
  );
}

describe('electrical 2A–2K global anti-stack', () => {
  it('prices the $10,000 rough allowance only in true package mode', () => {
    const packageMode = priceElectrical('electrical_rough', {
      electricalIncludeRough: true,
      floorAreaSqft: 2000,
    });
    expect(packageMode.fill?.total).toBe(10000);
    expect(packageMode.fill?.basis?.unit).toBe('allowance');
    expect(packageMode.fill?.productionStatus).toBe('review_required');
    expect(packageMode.fill?.pricingRecordId).toBe(
      'bps_electrical_rough:electrical_rough'
    );
  });

  it('does not activate the $10,000 package from a vague electrical-work note', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Need some electrical work'
    );
    expect(parsed.electricalIncludeRough).toBeUndefined();
    expect(parsed.electricalIncludeTrim).toBeUndefined();
    expect(
      shouldAutoPriceElectricalRoughPackage(
        parsed as Record<string, unknown>,
        'electrical'
      )
    ).toBe(false);
    expect(
      priceElectrical('electrical_rough', {
        floorAreaSqft: 2000,
      }).fill
    ).toBeNull();
  });

  it('never uses living SF as an Electrical quantity or rate basis', () => {
    const rough = priceElectrical('electrical_rough', {
      electricalIncludeRough: true,
      floorAreaSqft: 2000,
    });
    expect(rough.fill?.total).toBe(10000);
    expect(rough.fill?.total).not.toBe(2000 * 4);
    expect(rough.fill?.total).not.toBe(2000 * 9);
    expect(rough.fill?.basis?.quantity).toBe(1);
    expect(rough.fill?.basis?.unit).toBe('allowance');
  });

  it('lets trim stack with rough only in package mode', () => {
    const stacked = {
      electricalIncludeRough: true,
      electricalIncludeTrim: true,
    };
    expect(priceElectrical('electrical_rough', stacked).fill?.total).toBe(10000);
    expect(priceElectrical('electrical_trim', stacked).fill?.total).toBe(2500);
  });

  it.each([
    ['2A main panel', { mainPanelCount: 1 }, 'electrical_main_panel', 2050],
    ['2B standard circuit', { standardCircuitCount: 8 }, 'electrical_standard_circuit', 2400],
    ['2C receptacle', { standardReceptacleCount: 12 }, 'electrical_standard_receptacle', 1320],
    ['2D switch', { singlePoleSwitchCount: 8 }, 'electrical_single_pole_switch', 760],
    ['2E recessed light', { recessedLightCount: 18 }, 'electrical_recessed_light', 2700],
    ['2F dishwasher hookup', { dishwasherHookupCount: 1 }, 'electrical_dishwasher_hookup', 500],
    ['2G smoke detector', { smokeDetectorCount: 4 }, 'electrical_smoke_detector', 700],
    ['2H relocate', { relocateCount: 1 }, 'electrical_relocate', 200],
    ['2I conduit', { conduitLf: 80 }, 'electrical_conduit', 560],
  ] as const)(
    'withholds electrical_rough when %s counts exist',
    (_label, fields, detailedItemId, detailedTotal) => {
      const withRoughFlag = {
        ...fields,
        electricalIncludeRough: true,
        floorAreaSqft: 2000,
      };
      expect(hasDetailedElectricalQuantities(withRoughFlag)).toBe(true);
      expect(
        shouldAutoPriceElectricalRoughPackage(withRoughFlag, 'electrical')
      ).toBe(false);
      expect(priceElectrical('electrical_rough', withRoughFlag).fill).toBeNull();
      expect(priceElectrical(detailedItemId, withRoughFlag).fill?.total).toBe(
        detailedTotal
      );
    }
  );

  it('withholds electrical_trim when detailed 2C–2E counts exist', () => {
    const receptacleJob = {
      electricalIncludeTrim: true,
      standardReceptacleCount: 12,
    };
    expect(
      shouldAutoPriceElectricalTrimPackage(receptacleJob, 'electrical')
    ).toBe(false);
    expect(priceElectrical('electrical_trim', receptacleJob).fill).toBeNull();
    expect(
      priceElectrical('electrical_standard_receptacle', receptacleJob).fill?.total
    ).toBe(1320);

    const fixtureJob = {
      electricalIncludeTrim: true,
      recessedLightCount: 18,
    };
    expect(priceElectrical('electrical_trim', fixtureJob).fill).toBeNull();
    expect(
      priceElectrical('electrical_recessed_light', fixtureJob).fill?.total
    ).toBe(2700);
  });

  it('withholds both packages when a mixed detailed takeoff exists', () => {
    const detailed = {
      electricalIncludeRough: true,
      electricalIncludeTrim: true,
      standardCircuitCount: 8,
      standardReceptacleCount: 12,
      recessedLightCount: 18,
      floorAreaSqft: 2000,
    };
    expect(priceElectrical('electrical_rough', detailed).fill).toBeNull();
    expect(priceElectrical('electrical_trim', detailed).fill).toBeNull();
    expect(
      priceElectrical('electrical_standard_circuit', detailed).fill?.total
    ).toBe(2400);
    expect(
      priceElectrical('electrical_standard_receptacle', detailed).fill?.total
    ).toBe(1320);
    expect(
      priceElectrical('electrical_recessed_light', detailed).fill?.total
    ).toBe(2700);
  });

  it('does not stack a notes-inferred dedicated 20A onto a dishwasher hookup', () => {
    expect(
      electricalCircuitCardShouldPrice('electrical_dedicated_20a', {
        itemId: 'electrical_dedicated_20a',
        quantity: 1,
        quantitySource: 'notes',
        dishwasherHookupCount: 1,
      })
    ).toBe(false);
    expect(
      priceElectrical('electrical_dishwasher_hookup', {
        dishwasherHookupCount: 1,
      }).fill?.total
    ).toBe(500);
    expect(
      priceElectrical('electrical_dedicated_20a', {
        dedicated20aCircuitCount: 1,
        dishwasherHookupCount: 1,
        itemQuantities: {
          electrical_dedicated_20a: {
            quantity: 1,
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }).fill
    ).toBeNull();
  });

  it('keeps conduit and trenching outside the rough allowance', () => {
    const raceway = {
      electricalIncludeRough: true,
      conduitLf: 80,
      trenchingLf: 40,
      electricalTrenchCondition: 'normal_soil',
    };
    expect(priceElectrical('electrical_rough', raceway).fill).toBeNull();
    expect(priceElectrical('electrical_conduit', raceway).fill?.total).toBe(560);
    expect(priceElectrical('electrical_trenching', raceway).fill?.total).toBe(400);
  });

  it('does not invent 2B circuit cards from a rough-in note', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: electrical rough-in'
    );
    expect(parsed.electricalIncludeRough).toBe(true);
    expect(parsed.standardCircuitCount).toBeUndefined();
    expect(parsed.dedicated20aCircuitCount).toBeUndefined();
    expect(
      priceElectrical('electrical_standard_circuit', {
        electricalIncludeRough: true,
      }).fill
    ).toBeNull();
  });
});
