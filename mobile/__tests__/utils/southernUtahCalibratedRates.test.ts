/**
 * Builder-budget barometer: SHV Lots 39/41/49/58 blend with national (60/40)
 * for every US market; state multipliers still apply on top.
 */
import {
  applyBuilderBudgetBarometer,
  applySouthernUtahCalibration,
  BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT,
  BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT,
  getBuilderBudgetSoftCostAllowance,
  SOUTHERN_UTAH_LOCAL_INSTALLED_UNIT_RATES,
} from '@/utils/southernUtahCalibratedRates';
import {
  getNationalAverageBudgetSplit,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

function inputWith(overrides: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    flooringSqft: '1879',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('builderBudgetBarometer', () => {
  it('blends excavation CY toward local barometer but keeps national majority', () => {
    const national = getNationalAverageBudgetSplit('excavation', 'cy')!;
    const calibrated = applyBuilderBudgetBarometer('excavation', 'cy', national)!;
    const nationalTotal = national.material + national.labor;
    const local = SOUTHERN_UTAH_LOCAL_INSTALLED_UNIT_RATES['excavation:cy'].installed;
    const expected =
      local * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
      nationalTotal * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT;
    expect(calibrated.material + calibrated.labor).toBeCloseTo(expected, 1);
    expect(calibrated.material + calibrated.labor).toBeLessThan(nationalTotal);
    expect(calibrated.material + calibrated.labor).toBeGreaterThan(local);
    expect(calibrated.sourceLabel).toMatch(/National Average/);
    expect(calibrated.sourceLabel).toMatch(/builder-budget calibrated/i);
  });

  it('blends roofing squares toward local but stays national-led', () => {
    const national = getNationalAverageBudgetSplit('roofing', 'squares')!;
    const calibrated = applySouthernUtahCalibration('roofing', 'squares', national)!;
    const nationalTotal = national.material + national.labor;
    expect(calibrated.material + calibrated.labor).toBeLessThan(nationalTotal);
    expect(calibrated.material + calibrated.labor).toBeGreaterThan(500);
  });

  it('keeps framing mat/lab from local bid lines blended with national (framed SF)', () => {
    const national = getNationalAverageBudgetSplit('framing', 'sqft')!;
    const calibrated = applyBuilderBudgetBarometer('framing', 'sqft', national)!;
    // National labor mid-band $7.50/framed SF; local ~$6.32 — blend stays in the $5–$10 band.
    expect(calibrated.labor).toBeGreaterThan(5);
    expect(calibrated.labor).toBeLessThan(10);
    expect(calibrated.material).toBeCloseTo(
      9.49 * BUILDER_BUDGET_BAROMETER_LOCAL_WEIGHT +
        national.material * BUILDER_BUDGET_BAROMETER_NATIONAL_WEIGHT,
      1
    );
  });

  it('does not calibrate unknown trades', () => {
    const national = getNationalAverageBudgetSplit('backsplash', 'sqft');
    if (!national) {
      expect(applyBuilderBudgetBarometer('backsplash', 'sqft', {
        unit: 'sqft',
        material: 10,
        labor: 10,
        sourceLabel: 'test',
      } as any)).toBeNull();
      return;
    }
    expect(applyBuilderBudgetBarometer('backsplash', 'sqft', national)).toBeNull();
  });

  it('calibrates flooring / tile_flooring from detached flooring allowances', () => {
    const national = getNationalAverageBudgetSplit('flooring', 'sqft')!;
    const calibrated = applyBuilderBudgetBarometer('flooring', 'sqft', national)!;
    expect(calibrated.material + calibrated.labor).toBeLessThan(national.material + national.labor);
    expect(applyBuilderBudgetBarometer('tile_flooring', 'sqft', national)?.unit).toBe('sqft');
  });
});

describe('Confirm Scope nationwide barometer + state multiplier', () => {
  it('applies barometer in every state (not Utah-only)', () => {
    const input = inputWith({ excavationCy: '132' });
    const resolved = resolveChecklistItemQuantity('excavation', input, { templateKey: 'ground_up' });

    const florida = resolveScopeItemSuggestedPricing(
      'excavation',
      input,
      'ground_up',
      resolved,
      { state: 'FL' }
    );
    const utah = resolveScopeItemSuggestedPricing('excavation', input, 'ground_up', resolved, {
      state: 'UT',
    });
    const california = resolveScopeItemSuggestedPricing(
      'excavation',
      input,
      'ground_up',
      resolved,
      { state: 'CA' }
    );

    // Raw national would be $6,600; barometer pulls below that everywhere.
    expect(florida.fill?.total).toBeLessThan(6600);
    expect(utah.fill?.total).toBe(florida.fill?.total);
    expect(florida.fill?.rateSourceLabel).toMatch(/National Average/);
    // CA still scales the nationwide baseline up.
    expect(california.fill?.total).toBeGreaterThan(florida.fill!.total);
  });

  it('prices foundation CY near national with a light local nudge', () => {
    const input = inputWith({ concreteCy: '69' });
    const resolved = resolveChecklistItemQuantity('foundation', input, { templateKey: 'ground_up' });
    const priced = resolveScopeItemSuggestedPricing('foundation', input, 'ground_up', resolved, {
      state: 'FL',
    });
    // National $24,150; barometer (~$322 local vs $350 nat) nudges slightly down.
    expect(priced.fill?.total).toBeGreaterThan(22000);
    expect(priced.fill?.total).toBeLessThan(24150);
  });

  it('prices roofing squares below raw national $800/square', () => {
    const input = inputWith({ roofSquares: '37.2' });
    const resolved = resolveChecklistItemQuantity('roofing', input, { templateKey: 'ground_up' });
    const priced = resolveScopeItemSuggestedPricing('roofing', input, 'ground_up', resolved);
    // National 37.2 × $800 = $29,760; barometer pulls toward local ~$395/sq.
    expect(priced.fill?.total).toBeGreaterThan(20000);
    expect(priced.fill?.total).toBeLessThan(29760);
  });

  it('uses ground-up soft-cost allowances for plans (~$3k) and permits (~$32k)', () => {
    expect(getBuilderBudgetSoftCostAllowance('plans_engineering', 'ground_up')?.amount).toBe(3000);
    expect(getBuilderBudgetSoftCostAllowance('permits', 'ground_up')?.amount).toBe(32000);
    expect(getBuilderBudgetSoftCostAllowance('permits', 'ground_up')?.note).toMatch(/impact fee/i);
    expect(getBuilderBudgetSoftCostAllowance('permits', 'kitchen')).toBeNull();

    const input = inputWith({});
    const plans = resolveScopeItemSuggestedPricing(
      'plans_engineering',
      input,
      'ground_up',
      resolveChecklistItemQuantity('plans_engineering', input, { templateKey: 'ground_up' })
    );
    const permits = resolveScopeItemSuggestedPricing(
      'permits',
      input,
      'ground_up',
      resolveChecklistItemQuantity('permits', input, { templateKey: 'ground_up' })
    );
    expect(plans.fill?.total).toBe(3000);
    expect(permits.fill?.total).toBe(32000);
    expect(permits.fill?.rateSourceLabel).toMatch(/builder-budget calibrated/i);

    // Remodel-scale national stays for non-ground-up templates.
    const kitchenPermits = resolveScopeItemSuggestedPricing(
      'permits',
      input,
      'kitchen',
      resolveChecklistItemQuantity('permits', input, { templateKey: 'kitchen' })
    );
    expect(kitchenPermits.fill?.total).toBe(3500);
  });
});
