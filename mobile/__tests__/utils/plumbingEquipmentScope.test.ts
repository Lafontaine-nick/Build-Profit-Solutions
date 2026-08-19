import {
  isTanklessWaterHeater,
  resolvePlumbingWaterHeaterSuggestedPricing,
} from '@/utils/subcontractorTrade/plumbingEquipmentPricing';
import { hydratePlumbingPlanMeasurementsFromInventory, reconcilePlumbingEquipmentScopeMeasurements } from '@/utils/planTakeoffReviewUi';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import { PLUMBING_PLAN_SCOPE_ALLOWLIST } from '@/utils/subcontractorTrade/plumbingPlanConvergence';

describe('plumbing equipment scope cards', () => {
  test('plan scope allowlist includes fixtures, water heater, and gas connections', () => {
    expect(PLUMBING_PLAN_SCOPE_ALLOWLIST).toEqual(
      expect.arrayContaining([
        'plumbing_fixtures_hardware',
        'water_heater',
        'gas_appliance_connections',
      ])
    );
  });

  test('hydrates fixtures hardware from rough-in when schedule counts are missing', () => {
    expect(
      hydratePlumbingPlanMeasurementsFromInventory(
        { plumbingRoughPointCount: 10, plumbingTrimHookupCount: 10 },
        null,
        {
          waterHeaterDetail: { count: 1, type: 'tank' },
          gasApplianceScope: { range: true, fireplace: true, dryer: true },
        }
      )
    ).toMatchObject({
      plumbingFixturesHardwareCount: 10,
      waterHeaterCount: 1,
      gasApplianceConnectionCount: 3,
    });
  });

  test('hydrates fixtures, water heater, and gas connection counts from plan takeoff', () => {
    expect(
      hydratePlumbingPlanMeasurementsFromInventory(
        {},
        {
          toilets: 3,
          lavatories: 3,
          showers: 2,
          tubs: 1,
          kitchenSinks: 1,
        },
        {
          waterHeaterDetail: { count: 1, type: 'tank', fuel: 'gas' },
          gasApplianceScope: { range: true, fireplace: true, dryer: true },
        }
      )
    ).toMatchObject({
      plumbingRoughPointCount: 10,
      plumbingTrimHookupCount: 10,
      plumbingFixturesHardwareCount: 10,
      waterHeaterCount: 1,
      gasApplianceConnectionCount: 3,
    });
  });

  test('fixtures & hardware pricing uses builder-grade product allowance', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'plumbing_fixtures_hardware',
      { plumbingFixturesHardwareCount: '10' },
      'plumbing_service',
      { quantity: 10, unit: 'each', quantitySource: 'plan_detected' },
      { state: 'UT' }
    );
    expect(pricing.fill?.total).toBe(2800);
    expect(pricing.fill?.material).toBe(2800);
    expect(pricing.fill?.labor).toBe(0);
  });

  test('water heater uses tankless pricing when documented', () => {
    expect(isTanklessWaterHeater({ type: 'tankless gas' })).toBe(true);
    const tankless = resolvePlumbingWaterHeaterSuggestedPricing({
      quantity: 1,
      waterHeaterDetail: { type: 'tankless' },
    });
    expect(tankless.fill?.total).toBe(3500);
    const tank = resolvePlumbingWaterHeaterSuggestedPricing({
      quantity: 1,
      waterHeaterDetail: { type: 'tank' },
    });
    expect(tank.fill?.total).toBe(2000);
  });

  test('gas appliance connections price per documented hookup', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'gas_appliance_connections',
      { gasApplianceConnectionCount: '3' },
      'plumbing_service',
      { quantity: 3, unit: 'each', quantitySource: 'plan_detected' },
      { state: 'UT' }
    );
    expect(pricing.fill?.total).toBe(675);
  });

  test('infers equipment counts from complexity factors when vision omits detail objects', () => {
    expect(
      hydratePlumbingPlanMeasurementsFromInventory(
        { plumbingRoughPointCount: 10, plumbingTrimHookupCount: 10 },
        null,
        {
          complexityFactors: [
            { key: 'gas_appliances', label: 'Gas range, fireplace, and dryer' },
          ],
        }
      )
    ).toMatchObject({
      gasApplianceConnectionCount: 3,
    });
  });

  test('clamps fixtures hardware to rough/trim when allowance was inflated', () => {
    expect(
      hydratePlumbingPlanMeasurementsFromInventory(
        {
          plumbingRoughPointCount: 10,
          plumbingTrimHookupCount: 10,
          plumbingFixturesHardwareCount: 11,
          waterHeaterCount: 1,
        },
        { waterHeaters: 1 },
        { waterHeaterDetail: { count: 1, type: 'tank' } }
      )
    ).toMatchObject({
      plumbingFixturesHardwareCount: 10,
      waterHeaterCount: 1,
    });
  });

  test('uses gasAppliances inventory count when scope only lists one appliance', () => {
    expect(
      hydratePlumbingPlanMeasurementsFromInventory(
        { gasApplianceConnectionCount: 1, gasLineLf: 30 },
        { gasAppliances: 3 },
        { gasApplianceScope: { range: true, gasPipingRequired: true } }
      )
    ).toMatchObject({
      gasApplianceConnectionCount: 3,
    });
  });

  test('expands partial gas scope when only range is detected on documented gas line', () => {
    expect(
      hydratePlumbingPlanMeasurementsFromInventory(
        { gasApplianceConnectionCount: 1, gasLineLf: 35 },
        null,
        { gasApplianceScope: { range: true, gasPipingRequired: true } }
      )
    ).toMatchObject({
      gasApplianceConnectionCount: 3,
    });
  });

  test('reconciles stale applied gas pricing when connection count upgrades', () => {
    expect(
      reconcilePlumbingEquipmentScopeMeasurements({
        planImportTradeKey: 'plumbing',
        gasLineLf: 40,
        gasApplianceConnectionCount: 1,
        plumbingGasApplianceScope: { range: true, gasPipingRequired: true },
        itemQuantities: {
          gas_appliance_connections: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'plan_detected',
          },
        },
        pricingAcceptance: {
          gas_appliance_connections: {
            selectionStatus: 'accepted',
            totalAmount: 225,
            materialAmount: 75,
            laborAmount: 150,
          },
        },
      })
    ).toMatchObject({
      gasApplianceConnectionCount: 3,
      itemQuantities: {
        gas_appliance_connections: { quantity: '3' },
      },
      pricingAcceptance: {
        gas_appliance_connections: {
          totalAmount: 675,
          materialAmount: 225,
          laborAmount: 450,
        },
      },
    });
  });

  test('Plan 58-style package totals near nineteen thousand', () => {
    const plan58Inventory = {
      toilets: 3,
      lavatories: 3,
      showers: 2,
      tubs: 1,
      kitchenSinks: 1,
    };
    const measurements = hydratePlumbingPlanMeasurementsFromInventory(
      {
        waterLineLf: '50',
        sewerLineLf: '30',
        gasLineLf: '35',
      },
      plan58Inventory,
      {
        waterHeaterDetail: { count: 1, type: 'tank', fuel: 'gas' },
        gasApplianceScope: { range: true, fireplace: true, dryer: true },
      }
    );
    const items = [
      ['plumbing_rough', measurements.plumbingRoughPointCount],
      ['plumbing_trim', measurements.plumbingTrimHookupCount],
      ['water_line', measurements.waterLineLf],
      ['sewer_line', measurements.sewerLineLf],
      ['gas_line', measurements.gasLineLf],
      ['plumbing_fixtures_hardware', measurements.plumbingFixturesHardwareCount],
      ['water_heater', measurements.waterHeaterCount],
      ['gas_appliance_connections', measurements.gasApplianceConnectionCount],
    ] as const;
    let total = 0;
    for (const [itemId, quantity] of items) {
      const pricing = resolveScopeItemSuggestedPricing(
        itemId,
        measurements,
        'plumbing_service',
        {
          quantity: Number(quantity),
          unit: itemId.endsWith('_line') ? 'lf' : 'each',
          quantitySource: 'plan_detected',
        },
        { state: 'UT' },
        null,
        null
      );
      total += pricing.fill?.total || 0;
    }
    expect(total).toBeGreaterThanOrEqual(18800);
    expect(total).toBeLessThanOrEqual(19400);
  });
});
