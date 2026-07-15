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
import { normalizeScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';

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
    // Stage lump remains available as comparison on the host.
    expect(comparison?.total).toBeCloseTo(24600, 0);
  });

  it('prices excavation from excavationCy with material + labor', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'site-preconstruction', 24700));

    const input = inputWith({ excavationCy: '132' });
    const resolved = resolveChecklistItemQuantity('excavation', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 132, unit: 'cy' });

    const { fill } = resolveScopeItemSuggestedPricing('excavation', input, 'ground_up', resolved);
    // Raw national $50/CY; barometer pulls toward local ~$23/CY → below $6,600.
    expect(fill?.basis).toEqual({ quantity: 132, unit: 'cy' });
    expect(fill!.material).toBeGreaterThan(0);
    expect(fill!.labor).toBeGreaterThan(0);
    expect(fill!.total).toBeLessThan(6600);
    expect(fill!.total).toBeGreaterThan(4000);
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
    // 180 × $8 / $14
    expect(wall.fill).toMatchObject({ material: 1440, labor: 2520, total: 3960 });

    const showerFloor = resolveScopeItemSuggestedPricing(
      'shower_floor_tile',
      input,
      'ground_up',
      resolveChecklistItemQuantity('shower_floor_tile', input, { templateKey: 'ground_up' })
    );
    // 50 × $8 / $14
    expect(showerFloor.fill).toMatchObject({ material: 400, labor: 700, total: 1100 });

    const bathFloor = resolveScopeItemSuggestedPricing(
      'floor_tile',
      input,
      'ground_up',
      resolveChecklistItemQuantity('floor_tile', input, { templateKey: 'ground_up' })
    );
    // 300 × $8 / $14
    expect(bathFloor.fill).toMatchObject({ material: 2400, labor: 4200, total: 6600 });
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

  it('prices roofing from roofSquares with material + labor and locks Exterior Envelope to comparison', () => {
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'exterior-finishes', 52900));

    const input = inputWith({ roofSquares: '37.2' });
    const resolved = resolveChecklistItemQuantity('roofing', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 37.2, unit: 'squares' });

    const roofing = resolveScopeItemSuggestedPricing('roofing', input, 'ground_up', resolved);
    // Raw national 37.2 × $800 = $29,760; barometer pulls toward local installed roofing.
    expect(roofing.fill?.basis).toEqual({ quantity: 37.2, unit: 'squares' });
    expect(roofing.fill!.total).toBeGreaterThan(20000);
    expect(roofing.fill!.total).toBeLessThan(29760);
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

  it('prices drywall and paint_trim surface SF with material + labor', () => {
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
    // National $4.50/SF nudged by local drywall barometer.
    expect(drywall.fill?.basis).toEqual({ quantity: 5469, unit: 'sqft' });
    expect(drywall.fill!.total).toBeGreaterThan(15000);
    expect(drywall.fill!.total).toBeLessThan(24610.5);

    const paint = resolveScopeItemSuggestedPricing(
      'paint_trim',
      input,
      'ground_up',
      resolveChecklistItemQuantity('paint_trim', input, { templateKey: 'ground_up' })
    );
    // National $3.35/SF nudged by local paint barometer.
    expect(paint.fill?.basis).toEqual({ quantity: 5469, unit: 'sqft' });
    expect(paint.fill!.total).toBeGreaterThan(10000);
    expect(paint.fill!.total).toBeLessThan(18321.15);
  });
});
