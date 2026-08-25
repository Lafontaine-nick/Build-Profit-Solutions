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
      resolved
    );

    expect(pricing.fill?.total).toBe(18500);
    expect(pricing.fill?.basis).toMatchObject({ quantity: 1, unit: 'each' });
    expect(pricing.fill?.helper).toMatch(/Plan 58 H64 HVAC package ~\$18,500/i);
    expect(pricing.fill?.helper).toMatch(/includes equipment, ductwork, registers, thermostat/i);
    expect(pricing.comparison).toMatchObject({
      total: 16000,
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

    expect(pricing.fill?.total).toBeGreaterThan(20000);
    expect(pricing.fill?.helper).toMatch(/Plan 58 H64 HVAC package ~\$18,500/i);
    expect(pricing.comparison).toMatchObject({
      total: 32000,
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
      total: 32000,
      materialSource: 'national_average',
      laborSource: 'national_average',
    });
  });

  it('builds a Plan 58 H64 barometer comparison when national is redundant', () => {
    const comparison = buildHvacPlanBarometerComparisonBlock({
      livingSf: 3660,
      fillTotal: 26400,
    });
    expect(comparison).toMatchObject({
      total: 18500,
      basis: { quantity: 1, unit: 'each' },
      rateSourceLabel: 'Plan 58 H64 HVAC package',
      isComparison: true,
    });
  });
});
