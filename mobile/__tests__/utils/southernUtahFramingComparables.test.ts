/**
 * Framing shell pricing vs SHV Plans 39/41/49/58 + national average.
 */
import {
  coveredFramedSfForProject,
  detachedMedianFramingShellRatePerFramedSf,
  framingShellPackageRateForProject,
  framingShellPackageTotalForProject,
  resolveFramingShellPackageComparable,
} from '@/utils/southernUtahFramingComparables';
import { SOUTHERN_UTAH_PLAN_FACTS } from '@/utils/southernUtahPlanFacts';
import {
  buildNormalizedScopeMeasurementsFromInput,
  getNationalAverageBudgetSplit,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { applyBuilderBudgetBarometer } from '@/utils/southernUtahCalibratedRates';

function planInput(projectId: 'lot39' | 'lot41' | 'lot49' | 'lot58') {
  const facts = SOUTHERN_UTAH_PLAN_FACTS[projectId];
  const living = facts.buildingAreas.totalLivingSqft!;
  const garage = facts.buildingAreas.garageSqft || 0;
  const framed = living + garage;
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: String(living),
    garageSqft: String(garage),
    framedAreaSqft: String(framed),
    itemQuantities: {
      framing: {
        quantity: String(framed),
        unit: 'sqft',
        quantitySource: 'plan_detected' as const,
      },
    },
  };
}

describe('southernUtahFramingComparables', () => {
  it('documents detached shell package rates for Plans 39, 41, 49, and 58', () => {
    expect(framingShellPackageTotalForProject('lot58')).toBe(72000);
    expect(coveredFramedSfForProject('lot58')).toBe(4441);
    expect(framingShellPackageRateForProject('lot58')).toBeCloseTo(16.21, 2);

    expect(framingShellPackageTotalForProject('lot41')).toBe(47500);
    expect(coveredFramedSfForProject('lot41')).toBe(2873);
    expect(framingShellPackageRateForProject('lot41')).toBeCloseTo(16.53, 2);

    expect(framingShellPackageTotalForProject('lot39')).toBe(81000);
    expect(coveredFramedSfForProject('lot39')).toBe(4070);
    expect(framingShellPackageRateForProject('lot39')).toBeCloseTo(19.9, 1);

    expect(framingShellPackageTotalForProject('lot49')).toBe(68000);
    expect(coveredFramedSfForProject('lot49')).toBe(3998);

    const median = detachedMedianFramingShellRatePerFramedSf();
    expect(median).toBeGreaterThan(16);
    expect(median).toBeLessThan(17);
  });

  it('matches Plan 58 by living SF for comparable helper', () => {
    const comparable = resolveFramingShellPackageComparable(3660);
    expect(comparable?.projectLabel).toBe('Plan 58');
    expect(comparable?.scaledTotalForFramedSf(4441)).toBeCloseTo(72000, -2);
  });
});

describe('framing template pricing vs barometer plans + national', () => {
  const plans = [
    { id: 'lot58' as const, label: 'Plan 58', framed: 4441, package: 72000 },
    { id: 'lot41' as const, label: 'Plan 41', framed: 2873, package: 47500 },
    { id: 'lot39' as const, label: 'Plan 39', framed: 4070, package: 81000 },
    { id: 'lot49' as const, label: 'Plan 49', framed: 3998, package: 68000 },
  ];

  for (const plan of plans) {
    it(`prices ${plan.label} framing using barometer + national (reference package $${plan.package.toLocaleString()})`, () => {
      const input = planInput(plan.id);
      const resolved = resolveChecklistItemQuantity(
        'framing',
        buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'framing' }),
        { templateKey: 'framing' }
      );
      expect(resolved.pricingReady).toBe(true);
      expect(resolved.quantity).toBe(plan.framed);
      const priced = resolveScopeItemSuggestedPricing(
        'framing',
        input,
        'framing',
        resolved
      );
      const fillTotal = priced.fill?.total ?? 0;
      // Blended barometer lands ~$16.2–16.7/framed SF (Plans 39/41/49/58 detached median band).
      expect(fillTotal / plan.framed).toBeGreaterThan(15.5);
      expect(fillTotal / plan.framed).toBeLessThan(17.5);
      expect(fillTotal).toBeLessThanOrEqual(plan.package * 1.02);
      expect(priced.fill?.helper).toMatch(new RegExp(plan.label));
      expect(priced.fill?.helper).toMatch(
        new RegExp(`~\\$${plan.package.toLocaleString()}`)
      );
      expect(priced.fill?.helper).toMatch(/blended with national average/i);
      expect(priced.comparison?.total).toBeGreaterThan(fillTotal);
      expect(priced.comparison?.rateSourceLabel).toMatch(/national average comparison/i);
    });
  }

  it('keeps barometer framing rate between national and local detached median', () => {
    const national = getNationalAverageBudgetSplit('framing', 'sqft')!;
    const calibrated = applyBuilderBudgetBarometer('framing', 'sqft', national)!;
    const nationalTotal = national.material + national.labor;
    const calibratedTotal = calibrated.material + calibrated.labor;
    const localMedian = detachedMedianFramingShellRatePerFramedSf();
    expect(calibratedTotal).toBeLessThan(nationalTotal);
    expect(calibratedTotal).toBeGreaterThan(localMedian - 1);
    expect(calibratedTotal).toBeLessThan(localMedian + 1);
  });

  it('does not price wall framing or openings on Plan 58 shell import', () => {
    const input = {
      ...planInput('lot58'),
      wallFramingLf: '750',
      framingOpeningCount: '75',
      sheathingSqft: '2530',
      quickMeasurementSources: {
        wallFramingLf: 'plan_detected',
        framingOpeningCount: 'plan_detected',
      },
    };
    const wall = resolveScopeItemSuggestedPricing(
      'wall_framing',
      input,
      'framing',
      resolveChecklistItemQuantity(
        'wall_framing',
        buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'framing' }),
        { templateKey: 'framing' }
      )
    );
    const openings = resolveScopeItemSuggestedPricing(
      'openings',
      input,
      'framing',
      resolveChecklistItemQuantity(
        'openings',
        buildNormalizedScopeMeasurementsFromInput(input, { templateKey: 'framing' }),
        { templateKey: 'framing' }
      )
    );
    expect(wall.fill).toBeNull();
    expect(openings.fill).toBeNull();
  });
});
