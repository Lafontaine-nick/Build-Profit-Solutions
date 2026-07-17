/**
 * Ground-up Confirm Scope: physical Quick Measurements must produce
 * material + labor fills (not only living-SF stage lumps) so Projects
 * can track trade costs.
 */
jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import * as benchmarkEngine from '@/utils/benchmarkEngine';
import { clearBenchmarkCache, type BenchmarkSuggestion } from '@/utils/benchmarkEngine';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  normalizeScopeChecklistItems,
  SCOPE_CHECKLIST_GROUPS,
} from '@/utils/estimateScopeChecklistUi';

function inputWith(overrides: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    flooringSqft: '1879',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

function stageSuggestion(scopeId: string, stageId: string, total: number): BenchmarkSuggestion {
  return {
    scopeId,
    stageId,
    label: stageId,
    datasetId: 'southern_utah_residential_benchmark_v1',
    datasetVersion: '1',
    sourceKind: 'local_preliminary_budget',
    geography: 'Southern Utah',
    dataStatus: 'preliminary',
    selectedReason: 'blended_local_national',
    selectedSuggestion: {
      total,
      rate: total / 1879,
      unit: 'living_sqft',
      source: 'Southern Utah residential benchmark',
    },
    benchmarkIsComparisonOnly: false,
    localMedian: {
      rate: total / 1879,
      unit: 'living_sqft',
      total,
      sampleCount: 4,
      buildingType: 'detached',
      sourceStatus: 'preliminary',
    },
    nationalBenchmark: {
      rate: total / 1879,
      adjustedRate: total / 1879,
      unit: 'living_sqft',
      total,
      sourceName: 'National',
      sourceUrl: '',
      sourceYear: 2024,
      sampleCount: 100,
      limitations: [],
    },
    blendedBenchmark: {
      rate: total / 1879,
      unit: 'living_sqft',
      total,
      appliedQuantity: 1879,
      localWeight: 0.6,
      nationalWeight: 0.4,
    },
    primaryTakeoff: null,
    benchmarkBasis: { quantity: 1879, unit: 'living_sqft', costPerUnit: total / 1879 },
    localSampleCount: 4,
    sourceConfidence: 'medium',
    quantityConfidence: 'low',
    priceConfidence: 'medium',
    measurementStatus: 'needs_takeoff',
    quantityRoles: {
      primaryTakeoff: null,
      pricing: { quantity: 1879, unit: 'living_sqft', rate: total / 1879 },
      benchmark: { quantity: 1879, unit: 'living_sqft' },
    },
    warnings: [],
    comparables: [],
    twinHomeReferences: [],
    detachedComparables: [],
  };
}

describe('ground-up takeoff → material/labor pricing', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;
  const originalBenchmark = process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1;

  beforeEach(() => {
    clearBenchmarkCache();
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = originalBenchmark;
    clearBenchmarkCache();
    jest.restoreAllMocks();
  });

  it('prices foundation from concreteCy with material + labor (not living-SF stage lump)', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'foundations', 24600));

    const input = inputWith({ concreteCy: '69' });
    const resolved = resolveChecklistItemQuantity('foundation', input, { templateKey: 'ground_up' });
    expect(resolved.quantity).toBe(69);
    expect(resolved.unit).toBe('cy');

    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'foundation',
      input,
      'ground_up',
      resolved
    );
    // National $350/CY nudged by builder-budget barometer (still mat+labor, not living-SF lump).
    expect(fill?.basis).toEqual({ quantity: 69, unit: 'cy' });
    expect(fill?.materialSource).toBe('national_average');
    expect(fill?.laborSource).toBe('national_average');
    expect(fill!.material).toBeGreaterThan(0);
    expect(fill!.labor).toBeGreaterThan(0);
    expect(fill!.total).toBeGreaterThan(22000);
    expect(fill!.total).toBeLessThan(24150);
    // Pure national on same CY (69 × $350), not living-SF stage lump.
    expect(comparison?.total).toBeCloseTo(24150, 0);
    expect(comparison?.basis).toEqual({ quantity: 69, unit: 'cy' });
    expect(comparison?.rateSourceLabel).toMatch(/national average comparison/i);
  });

  it('prices excavation from excavationCy with material + labor', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'site-preconstruction', 24700));

    const input = inputWith({ excavationCy: '132' });
    const resolved = resolveChecklistItemQuantity('excavation', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 132, unit: 'cy' });

    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'excavation',
      input,
      'ground_up',
      resolved
    );
    // Raw national $50/CY; barometer pulls toward local ~$23/CY → below $6,600.
    expect(fill?.basis).toEqual({ quantity: 132, unit: 'cy' });
    expect(fill!.material).toBeGreaterThan(0);
    expect(fill!.labor).toBeGreaterThan(0);
    expect(fill!.total).toBeLessThan(6600);
    expect(fill!.total).toBeGreaterThan(4000);
    // Pure national on same CY (132 × $50).
    expect(comparison?.total).toBeCloseTo(6600, 0);
    expect(comparison?.basis).toEqual({ quantity: 132, unit: 'cy' });
  });

  it('prices cabinets LF and counters sqft separately', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'interior-finishes', 92700));

    const input = inputWith({ cabinetLf: '100', countertopSqft: '300' });

    const cabResolved = resolveChecklistItemQuantity('cabinets', input, { templateKey: 'ground_up' });
    const cab = resolveScopeItemSuggestedPricing('cabinets', input, 'ground_up', cabResolved);
    expect(cab.fill?.total).toBeGreaterThan(20000);
    expect(cab.fill?.total).toBeLessThan(25000);
    expect(cab.fill!.material).toBeGreaterThan(cab.fill!.labor);

    const ctrResolved = resolveChecklistItemQuantity('countertops', input, { templateKey: 'ground_up' });
    const ctr = resolveScopeItemSuggestedPricing('countertops', input, 'ground_up', ctrResolved);
    // National $60/SF nudged up by higher local countertop barometer.
    expect(ctr.fill?.total).toBeGreaterThan(18000);
    expect(ctr.fill!.material).toBeGreaterThan(0);
    expect(ctr.fill!.labor).toBeGreaterThan(0);
  });

  it('prices wet-area tile SF with material + labor', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'interior-finishes', 92700));

    const input = inputWith({
      bathroomFloorSqft: '300',
      showerWallTileSqft: '180',
      showerFloorTileSqft: '50',
    });

    const wall = resolveScopeItemSuggestedPricing(
      'shower_tile',
      input,
      'ground_up',
      resolveChecklistItemQuantity('shower_tile', input, { templateKey: 'ground_up' })
    );
    // 180 × $8 / $18 (shower wall — not generic floor labor)
    expect(wall.fill).toMatchObject({ material: 1440, labor: 3240, total: 4680 });
    expect(wall.fill?.rateSourceLabel).toMatch(/shower wall tile/i);

    const showerFloor = resolveScopeItemSuggestedPricing(
      'shower_floor_tile',
      input,
      'ground_up',
      resolveChecklistItemQuantity('shower_floor_tile', input, { templateKey: 'ground_up' })
    );
    // 50 × $8 / $17
    expect(showerFloor.fill).toMatchObject({ material: 400, labor: 850, total: 1250 });

    const bathFloor = resolveScopeItemSuggestedPricing(
      'floor_tile',
      input,
      'ground_up',
      resolveChecklistItemQuantity('floor_tile', input, { templateKey: 'ground_up' })
    );
    // 300 × $8 / $13 (bath floor — not shower wall labor)
    expect(bathFloor.fill).toMatchObject({ material: 2400, labor: 3900, total: 6300 });
  });

  it('migrates legacy cabinets_counters into cabinets + countertops on ground_up', () => {
    const migrated = normalizeScopeChecklistItems(
      [
        {
          id: 'cabinets_counters',
          label: 'Cabinets & countertops',
          inputType: 'yes_no',
          state: 'included',
        },
        { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const ids = migrated.map((i) => i.id);
    expect(ids).toContain('cabinets');
    expect(ids).toContain('countertops');
    expect(ids).not.toContain('cabinets_counters');
    expect(migrated.find((i) => i.id === 'cabinets')?.state).toBe('included');
    expect(migrated.find((i) => i.id === 'countertops')?.state).toBe('included');
  });

  it('injects Shower doors & mirrors under wet area finish and prices national each rates', () => {
    const migrated = normalizeScopeChecklistItems(
      [
        { id: 'shower_floor_tile', label: 'Shower floor tile', inputType: 'yes_no', state: 'included' },
        { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const door = migrated.find((i) => i.id === 'glass_door');
    expect(door).toMatchObject({
      id: 'glass_door',
      label: 'Shower doors & mirrors',
    });
    // Promoted with other finish children when wet tile / drywall is already Yes.
    expect(door?.state).toBe('included');
    const wetGroup = SCOPE_CHECKLIST_GROUPS.ground_up.find((g) => g.title === 'Wet area finish');
    expect(wetGroup?.itemIds).toEqual(['floor_tile', 'shower_tile', 'shower_floor_tile', 'glass_door']);

    const input = inputWith({ bathCount: 2, prefabBathCount: 1 } as any);
    const resolved = resolveChecklistItemQuantity('glass_door', input as any, {
      templateKey: 'ground_up',
    });
    // Inferred from tile + prefab when showerDoorCount is unset.
    expect(resolved).toMatchObject({ quantity: 3, unit: 'each' });
    const priced = resolveScopeItemSuggestedPricing('glass_door', input as any, 'ground_up', resolved);
    // Builder mid door+mirror $2,100 + $1,150 = $3,250 each × 3
    expect(priced.fill).toMatchObject({ material: 6300, labor: 3450, total: 9750 });

    const twoDoorInput = inputWith({ showerDoorCount: 2, bathCount: 3 } as any);
    const explicit = resolveChecklistItemQuantity('glass_door', twoDoorInput as any, {
      templateKey: 'ground_up',
    });
    expect(explicit).toMatchObject({ quantity: 2, unit: 'each' });
    const pricedTwo = resolveScopeItemSuggestedPricing(
      'glass_door',
      twoDoorInput as any,
      'ground_up',
      explicit
    );
    expect(pricedTwo.fill).toMatchObject({ material: 4200, labor: 2300, total: 6500 });
  });

  it('prices roofing from roofSquares with material + labor and locks Exterior Envelope to comparison', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'exterior-finishes', 52900));

    const input = inputWith({ roofSquares: '37.2' });
    const resolved = resolveChecklistItemQuantity('roofing', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 37.2, unit: 'squares' });

    const roofing = resolveScopeItemSuggestedPricing('roofing', input, 'ground_up', resolved);
    // Raw national 37.2 × $575 ≈ $21.4k; barometer pulls toward ~$17k (NAHB ~$16.7k band).
    expect(roofing.fill?.basis).toEqual({ quantity: 37.2, unit: 'squares' });
    expect(roofing.fill!.total).toBeGreaterThan(15000);
    expect(roofing.fill!.total).toBeLessThan(21400);
    const roofingTotal = roofing.fill!.total;

    input.pricingAcceptance = {
      roofing: {
        selectionStatus: 'accepted',
        pricingSourceLabel: 'National average',
        pricingSourceKind: 'national_average',
        pricingTypeLabel: 'Material + labor',
        totalAmount: roofingTotal,
      },
    };
    const exterior = resolveScopeItemSuggestedPricing(
      'exterior',
      input,
      'ground_up',
      resolveChecklistItemQuantity('exterior', input, { templateKey: 'ground_up' })
    );
    expect(exterior.fill).toBeNull();
    expect(exterior.comparison?.benchmarkAction).toBe('comparison_only');
  });

  it('prices drywall surface SF and Plan 41 interior paint installed comparable', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'interior-finishes', 92700));

    const input = inputWith({ drywallSqft: '5469', wallPaintSqft: '5469' });

    const drywall = resolveScopeItemSuggestedPricing(
      'drywall',
      input,
      'ground_up',
      resolveChecklistItemQuantity('drywall', input, { templateKey: 'ground_up' })
    );
    // National ~$2.10/SF blended with local ~$2.21/SF barometer (not old $4.50/SF).
    expect(drywall.fill?.basis).toEqual({ quantity: 5469, unit: 'sqft' });
    expect(drywall.fill!.total).toBeGreaterThan(11000);
    expect(drywall.fill!.total).toBeLessThan(14000);

    const paint = resolveScopeItemSuggestedPricing(
      'interior_paint',
      input,
      'ground_up',
      resolveChecklistItemQuantity('interior_paint', input, { templateKey: 'ground_up' })
    );
    // Blended Plan 41 barometer + NAHB paint — not bare national surface-SF rate.
    expect(paint.fill?.total).toBe(8900);
    expect(paint.fill?.installedBudgetBenchmark).toBe(true);
    expect(paint.fill?.rateSourceLabel).toMatch(/Blended national/);
    expect(Number(paint.fill?.basis?.quantity)).toBe(5469);
  });
});
