import {
  capTakeoffTotalAtBarometerLump,
  flooringUsesBarometerLumpPackage,
  resolveElectricalRoughLumpSuggestedFill,
  resolveExteriorPaintLumpSuggestedFill,
  resolveFlooringLumpSuggestedFill,
  resolveInsulationLumpSuggestedFill,
  resolvePlumbingRoughLumpSuggestedFill,
  resolveStuccoLumpSuggestedFill,
  resolveStuccoSuggestedTotal,
} from '@/utils/groundUpBarometerLumpPackages';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { formatSuggestedUnitRateLine } from '@/utils/suggestedPricingCardUi';

describe('groundUpBarometerLumpPackages', () => {
  it('prices Lot 58 stucco near the SHV H33 package (not × inflated notes SF)', () => {
    const lump = resolveStuccoLumpSuggestedFill({ livingSf: 3660, state: 'UT' });
    expect(lump.total).toBeGreaterThan(24000);
    expect(lump.total).toBeLessThan(32000);

    const fromNotes = resolveStuccoSuggestedTotal({
      livingSf: 3660,
      wallSf: 7413,
      quantitySource: 'notes',
      state: 'UT',
    });
    expect(fromNotes.total).toBe(lump.total);
  });

  it('prices Lot 58 MEP rough near Iron Mesa lines', () => {
    const plumbing = resolvePlumbingRoughLumpSuggestedFill({ livingSf: 3660, state: 'UT' });
    const electrical = resolveElectricalRoughLumpSuggestedFill({ livingSf: 3660, state: 'UT' });
    expect(plumbing.total).toBeGreaterThan(22000);
    expect(plumbing.total).toBeLessThan(26000);
    expect(electrical.total).toBeGreaterThan(23000);
    expect(electrical.total).toBeLessThan(27000);
  });

  it('prices Lot 58 insulation and exterior paint in planning bands', () => {
    const insulation = resolveInsulationLumpSuggestedFill({ livingSf: 3660, state: 'UT' });
    const paint = resolveExteriorPaintLumpSuggestedFill({ livingSf: 3660, state: 'UT' });
    expect(insulation.total).toBeGreaterThan(9000);
    expect(insulation.total).toBeLessThan(12000);
    expect(paint.total).toBeGreaterThan(10000);
    expect(paint.total).toBeLessThan(14000);
  });

  it('prices Lot 58 flooring near H51 allowance (not tile $/SF on all living SF)', () => {
    const lump = resolveFlooringLumpSuggestedFill({ livingSf: 3660, state: 'UT' });
    expect(lump.total).toBeGreaterThan(23000);
    expect(lump.total).toBeLessThan(27000);
    expect(lump.total).toBeLessThan(3660 * 8.57);
  });

  it('uses lump for whole-house floor SF but per-SF for partial tile takeoff', () => {
    expect(
      flooringUsesBarometerLumpPackage({
        itemId: 'tile_flooring',
        livingSf: 3660,
        floorQuantity: 3660,
        flooringSqft: 3660,
        quantitySource: 'plan_vision',
      })
    ).toBe(true);
    expect(
      flooringUsesBarometerLumpPackage({
        itemId: 'tile_flooring',
        livingSf: 3660,
        floorQuantity: 1200,
        flooringTileSqft: 1200,
        quantitySource: 'user_entered',
      })
    ).toBe(false);
  });

  it('scales verified stucco wall SF at the package rate with a barometer cap', () => {
    const priced = resolveStuccoSuggestedTotal({
      livingSf: 1879,
      wallSf: 1968,
      quantitySource: 'user_entered',
      state: 'UT',
    });
    expect(priced.total).toBeGreaterThan(14000);
    expect(priced.total).toBeLessThan(24000);
  });

  it('attaches display-only $/living SF reference on Lot 58 lump package cards', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '3660',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('insulation', input, { templateKey: 'ground_up' });
    const { fill } = resolveScopeItemSuggestedPricing('insulation', input, 'ground_up', resolved);
    expect(fill?.installedBudgetBenchmark).toBe(true);
    expect(fill?.benchmarkLivingSf).toBe(3660);
    expect(fill?.impliedUnitRateLabel).toMatch(/Plan 58.*living SF/i);
    const refLine = formatSuggestedUnitRateLine(fill!);
    expect(refLine).toMatch(/Reference only.*living SF/i);
  });
});
