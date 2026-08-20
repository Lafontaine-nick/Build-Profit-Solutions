import {
  PLAN58_PLUMBING_CARD_PACKAGE,
  applySouthernUtahPlumbingPackageTakeoffDefaults,
  detachedMedianPlumbingCardPackageTotal,
  plumbingCardPackageTotalForProject,
  plumbingH60LumpForProject,
  resolvePlumbingPackageComparable,
} from '@/utils/southernUtahPlumbingComparables';
import { hydratePlumbingPlanMeasurementsFromInventory } from '@/utils/planTakeoffReviewUi';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

describe('southern Utah plumbing comparables', () => {
  it('defines Plan 58 card package reference', () => {
    expect(PLAN58_PLUMBING_CARD_PACKAGE.total).toBe(19025);
    expect(plumbingCardPackageTotalForProject('lot58')).toBe(19025);
    expect(plumbingH60LumpForProject('lot58')).toBe(23500);
  });

  it('matches plans 39/41/49/58 by living SF', () => {
    expect(resolvePlumbingPackageComparable(3660)?.projectLabel).toBe('Plan 58');
    expect(resolvePlumbingPackageComparable(1879)?.projectLabel).toBe('Plan 41');
    expect(resolvePlumbingPackageComparable(2571)?.projectLabel).toBe('Plan 49');
    expect(resolvePlumbingPackageComparable(3098)?.projectLabel).toBe('Plan 39');
  });

  it('tracks detached median card package between plans', () => {
    const median = detachedMedianPlumbingCardPackageTotal();
    expect(median).toBeGreaterThanOrEqual(16500);
    expect(median).toBeLessThanOrEqual(20500);
  });

  it('prices Plan 58 eight-card package near nineteen thousand', () => {
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
      plan58Inventory
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
        { state: 'UT' }
      );
      total += pricing.fill?.total || 0;
    }
    expect(total).toBe(19025);
  });

  it('corrects Plan 58 gas LF under-read from 30 to 35', () => {
    const corrected = applySouthernUtahPlumbingPackageTakeoffDefaults({
      floorAreaSqft: '3660',
      gasLineLf: '30',
    });
    expect(corrected.gasLineLf).toBe('35');
  });
});
