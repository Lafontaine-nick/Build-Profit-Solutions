import {
  buildHvacPlanBarometerComparisonBlock,
  buildPureNationalAverageComparisonBlock,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import {
  hvacH64InstalledForProject,
  resolveHvacPackageComparable,
} from '@/utils/southernUtahHvacComparables';
import { buildSuggestedPricingCardDisplay } from '@/utils/suggestedPricingCardUi';

describe('southernUtahHvacComparables', () => {
  it('matches Plan 58 living SF to the H64 ~$18,500 package', () => {
    expect(resolveHvacPackageComparable(3660)).toMatchObject({
      projectLabel: 'Plan 58',
      h64InstalledTotal: 18500,
    });
    expect(hvacH64InstalledForProject('lot58')).toBe(18500);
  });
});

describe('HVAC suggested pricing comparisons', () => {
  it('anchors Plan 58 on the H64 package when system counts are unverified', () => {
    const input = {
      floorAreaSqft: '3660',
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      planFacts: {
        buildingAreas: { totalLivingSqft: 3660 },
      },
      itemQuantities: {
        hvac: { quantity: '2', unit: 'each', quantitySource: 'needs_confirmation' },
      },
      quickMeasurementSources: {
        hvacSystemCount: 'needs_confirmation',
        hvacSystemTons: 'needs_confirmation',
      },
      planImportTradeKey: 'hvac',
    } as const;

    const resolved = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'hvac',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'hvac',
      resolved,
      { state: 'UT' }
    );

    expect(pricing.fill?.total).toBe(18500);
    expect(pricing.fill?.basis).toMatchObject({ quantity: 2, unit: 'each' });
    expect(pricing.fill?.helper).toMatch(/Plan 58 H64 complete HVAC package ~\$18,500/i);
    expect(pricing.fill?.helper).toMatch(/includes equipment, ductwork, registers, thermostat/i);
    expect(pricing.comparison).toMatchObject({
      total: 21000,
      rateSourceLabel: 'National average comparison',
      isComparison: true,
    });
  });

  it('suppresses component pricing when the installed package is the anchor', () => {
    const input = {
      floorAreaSqft: '3660',
      hvacSystemCount: '2',
      hvacDuctworkLf: '120',
      quickMeasurementSources: {
        hvacSystemCount: 'needs_confirmation',
      },
      itemQuantities: {
        ductwork: { quantity: '120', unit: 'lf', quantitySource: 'needs_confirmation' },
      },
      planImportTradeKey: 'hvac',
    } as const;

    const resolved = resolveChecklistItemQuantity('ductwork', input, {
      templateKey: 'hvac',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'ductwork',
      input,
      'hvac',
      resolved
    );
    expect(pricing.fill).toBeNull();
    expect(pricing.comparison).toBeNull();
  });

  it('uses tier-based system pricing only when equipment counts are verified', () => {
    const input = {
      floorAreaSqft: '3660',
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      planFacts: {
        buildingAreas: { totalLivingSqft: 3660 },
      },
      itemQuantities: {
        hvac: { quantity: '2', unit: 'each', quantitySource: 'plan_detected' },
      },
      quickMeasurementSources: {
        hvacSystemCount: 'contractor_confirmed_from_plan_review',
        hvacSystemTons: 'contractor_confirmed_from_plan_review',
      },
      planImportTradeKey: 'hvac',
    } as const;

    const resolved = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'hvac',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'hvac',
      resolved
    );

    expect(pricing.fill?.total).toBe(19000);
    expect(pricing.fill?.helper).toMatch(/2 complete HVAC systems/i);
    expect(pricing.comparison).toMatchObject({
      total: 21000,
      rateSourceLabel: 'National average comparison',
      isComparison: true,
    });
  });

  it('builds a pure national comparison on the same qty/unit basis as the fill', () => {
    const comparison = buildPureNationalAverageComparisonBlock({
      itemId: 'hvac',
      basis: { quantity: 2, unit: 'each' },
      fillTotal: 26400,
    });
    expect(comparison).toMatchObject({
      total: 21000,
      materialSource: 'national_average',
      laborSource: 'national_average',
    });
  });

  it('builds a Plan 58 H64 barometer comparison when national is redundant', () => {
    const comparison = buildHvacPlanBarometerComparisonBlock({
      livingSf: 3660,
      fillTotal: 26400,
      pricingContext: { state: 'UT' },
    });
    expect(comparison).toMatchObject({
      total: 18500,
      basis: { quantity: 1, unit: 'each' },
      rateSourceLabel: 'Plan 58 H64 HVAC package',
      isComparison: true,
    });
  });

  it('prices an unanchored HVAC count instead of leaving the system card unpriced', () => {
    const input = {
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      itemQuantities: {},
      quickMeasurementSources: {
        hvacSystemCount: 'needs_confirmation',
        hvacSystemTons: 'needs_confirmation',
      },
      planImportTradeKey: 'hvac',
    } as const;
    const resolved = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'hvac',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'hvac',
      resolved
    );

    expect(pricing.fill).toMatchObject({
      total: 19000,
      basis: { quantity: 2, unit: 'each' },
    });
    expect(pricing.fill?.helper).toMatch(/2 complete HVAC systems/i);
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'hvac',
      block: pricing.fill!,
    });
    expect(display.quantityLine).toBe('2 systems · 5 tons');
    expect(display.unitRateLine).toBe('$9,500/system');
    expect(display.splitLine).toBe('Material $11,000 · Labor $8,000');
    expect(display.splitLine).not.toMatch(/Included:/);
  });

  it('keeps Utah comparables opt-in for national customers', () => {
    const input = {
      floorAreaSqft: '3660',
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      itemQuantities: {},
      quickMeasurementSources: {
        hvacSystemCount: 'needs_confirmation',
        hvacSystemTons: 'needs_confirmation',
      },
      planImportTradeKey: 'hvac',
    } as const;
    const resolved = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'hvac',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'hvac',
      resolved,
      { state: 'TX' }
    );

    expect(pricing.fill).toMatchObject({ total: 18050 });
    expect(pricing.fill?.helper).not.toMatch(/Plan 58/i);
  });

  it.each([
    { systems: 1, tons: 3, total: 10500 },
    { systems: 1, tons: 5, total: 14700 },
    { systems: 2, tons: 5, total: 19000 },
    { systems: 2, tons: 7, total: 21800 },
    { systems: 3, tons: 10, total: 32800 },
    { systems: 3, tons: 12, total: 35600 },
  ])(
    'keeps national package pricing logical for $systems systems / $tons tons',
    ({ systems, tons, total }) => {
      const input = {
        hvacSystemCount: String(systems),
        hvacSystemTons: String(tons),
        itemQuantities: {},
        quickMeasurementSources: {
          hvacSystemCount: 'needs_confirmation',
          hvacSystemTons: 'needs_confirmation',
        },
        planImportTradeKey: 'hvac',
      } as const;
      const resolved = resolveChecklistItemQuantity('hvac', input, {
        templateKey: 'hvac',
      });
      const pricing = resolveScopeItemSuggestedPricing(
        'hvac',
        input,
        'hvac',
        resolved
      );

      expect(pricing.fill).toMatchObject({
        total,
        basis: { quantity: systems, unit: 'each' },
      });
    }
  );

  it('uses equipment-type rates when replacement chips identify the equipment', () => {
    const input = {
      hvacEquipmentReplacementCount: '2',
      itemQuantities: {
        equipment_replace: {
          quantity: '2',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        equipment_replace__furnace: {
          quantity: 1,
          unit: 'each',
          quantitySource: 'user_entered',
        },
        equipment_replace__condenser: {
          quantity: 1,
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
      planImportTradeKey: 'hvac',
    } as const;
    const resolved = resolveChecklistItemQuantity('equipment_replace', input, {
      templateKey: 'hvac',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'equipment_replace',
      input,
      'hvac',
      resolved
    );

    expect(pricing.fill).toMatchObject({
      total: 12000,
      basis: { quantity: '2', unit: 'each' },
    });
    expect(pricing.fill?.rateSourceLabel).toMatch(/furnace replacement/i);
  });

  it('prices HVAC equipment replacement and whole-house ventilation add-ons', () => {
    const input = {
      hvacEquipmentReplacementCount: '2',
      hvacVentilationCount: '1',
      itemQuantities: {
        equipment_replace: {
          quantity: '2',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        ventilation: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
      planImportTradeKey: 'hvac',
    } as const;

    const equipment = resolveScopeItemSuggestedPricing(
      'equipment_replace',
      input,
      'hvac',
      resolveChecklistItemQuantity('equipment_replace', input, {
        templateKey: 'hvac',
      })
    );
    const ventilation = resolveScopeItemSuggestedPricing(
      'ventilation',
      input,
      'hvac',
      resolveChecklistItemQuantity('ventilation', input, {
        templateKey: 'hvac',
      })
    );

    expect(equipment.fill).toMatchObject({
      total: 18000,
      basis: { quantity: '2', unit: 'each' },
    });
    expect(ventilation.fill).toMatchObject({
      total: 3500,
      basis: { quantity: '1', unit: 'each' },
    });
  });
});
