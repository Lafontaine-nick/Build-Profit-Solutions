import * as benchmarkEngine from '@/utils/benchmarkEngine';
import {
  clearBenchmarkCache,
  type BenchmarkSuggestion,
} from '@/utils/benchmarkEngine';
import {
  benchmarkApplicationKey,
  canApplyStageBenchmarkFill,
  formatDisplayMoneyNearest100,
  isIncludedInStageChild,
  roundDisplayTotalToNearest100,
} from '@/utils/measurementSemantics';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

function lot41(): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    flooringSqft: '1879',
    itemQuantities: {},
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
    warnings: ['Benchmark pricing only — detailed takeoff still required.'],
    comparables: [
      {
        projectId: 'lot-41',
        name: 'Lot 41',
        buildingType: 'detached',
        comparableClass: 'detached',
        livingSf: 1879,
        homesInSource: 1,
        preliminaryBuildCostPerHome: 367700,
        scopeCost: 1000,
        scopeCostPerLivingSf: 1000 / 1879,
        similarityScore: 79,
        similarityConfidence: 'medium',
        similarityReasons: ['Same detached building type', 'Living area within 0%'],
        sourceStatus: 'preliminary',
        includeInDetachedMedian: true,
        notes: [],
      },
    ],
    twinHomeReferences: [],
    detachedComparables: [
      {
        projectId: 'lot-41',
        name: 'Lot 41',
        buildingType: 'detached',
        comparableClass: 'detached',
        livingSf: 1879,
        homesInSource: 1,
        preliminaryBuildCostPerHome: 367700,
        scopeCost: 1000,
        scopeCostPerLivingSf: 1000 / 1879,
        similarityScore: 79,
        similarityConfidence: 'medium',
        similarityReasons: ['Same detached building type', 'Living area within 0%'],
        sourceStatus: 'preliminary',
        includeInDetachedMedian: true,
        notes: [],
      },
    ],
  };
}

describe('stage benchmark dedupe and card presentation', () => {
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

  it('shows Interior Finishes stage total only on the host, not on child scopes', () => {
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockImplementation((id: string) =>
      stageSuggestion(id, 'interior-finishes', 92729.44)
    );

    expect(canApplyStageBenchmarkFill('interior_finishes', 'interior-finishes')).toBe(true);
    expect(canApplyStageBenchmarkFill('insulation', 'interior-finishes')).toBe(false);
    expect(isIncludedInStageChild('insulation', 'interior-finishes')).toBe(true);
    expect(isIncludedInStageChild('drywall', 'interior-finishes')).toBe(true);
    expect(isIncludedInStageChild('cabinets_counters', 'interior-finishes')).toBe(true);
    expect(isIncludedInStageChild('paint_trim', 'interior-finishes')).toBe(true);

    const host = resolveScopeItemSuggestedPricing(
      'interior_finishes',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('interior_finishes', lot41(), { templateKey: 'ground_up' })
    );
    expect(host.fill?.total).toBeCloseTo(92729.44, 0);
    expect(host.fill?.benchmarkLevel).toBe('stage');
    expect(host.fill?.benchmarkAction).toBe('benchmark_only');

    for (const child of ['insulation', 'drywall', 'cabinets_counters', 'paint_trim', 'tile_flooring'] as const) {
      const suggested = resolveScopeItemSuggestedPricing(
        child,
        lot41(),
        'ground_up',
        resolveChecklistItemQuantity(child, lot41(), { templateKey: 'ground_up' })
      );
      expect(suggested.fill).toBeNull();
      expect(suggested.comparison?.benchmarkAction).toBe('included_in_stage');
      expect(suggested.comparison?.total).toBe(0);
      expect(suggested.comparison?.includedInStageLabel).toMatch(/Interior Finishes/i);
    }
  });

  it('does not apply Exterior Finishes separately through roofing and exterior', () => {
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockImplementation((id: string) =>
      stageSuggestion(id, 'exterior-finishes', 52868.82)
    );

    const exterior = resolveScopeItemSuggestedPricing(
      'exterior',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('exterior', lot41(), { templateKey: 'ground_up' })
    );
    const roofing = resolveScopeItemSuggestedPricing(
      'roofing',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('roofing', lot41(), { templateKey: 'ground_up' })
    );

    expect(exterior.fill?.total).toBeCloseTo(52868.82, 0);
    expect(roofing.fill).toBeNull();
    expect(roofing.comparison?.benchmarkAction).toBe('included_in_stage');
    expect(roofing.comparison?.total).toBe(0);
  });

  it('does not apply Site Work / Preconstruction through both plans and sitework', () => {
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockImplementation((id: string) =>
      stageSuggestion(id, 'site-preconstruction', 24736.92)
    );

    const sitework = resolveScopeItemSuggestedPricing(
      'sitework',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('sitework', lot41(), { templateKey: 'ground_up' })
    );
    const plans = resolveScopeItemSuggestedPricing(
      'plans_engineering',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('plans_engineering', lot41(), { templateKey: 'ground_up' })
    );

    expect(sitework.fill?.total).toBeCloseTo(24736.92, 0);
    expect(plans.fill?.total).toBeCloseTo(1000, 0);
    expect(plans.fill?.benchmarkLevel).toBe('component');
    expect(plans.fill?.total).toBeLessThan(5000);
  });

  it('builds a stable benchmarkApplicationKey and rounds display only', () => {
    const key = benchmarkApplicationKey({
      datasetId: 'southern_utah_residential_benchmark_v1',
      benchmarkLevel: 'stage',
      benchmarkStageKey: 'interior-finishes',
    });
    expect(key).toBe(
      'southern_utah_residential_benchmark_v1::stage::interior-finishes'
    );
    expect(roundDisplayTotalToNearest100(45883.73)).toBe(45900);
    expect(formatDisplayMoneyNearest100(92729.44)).toBe('$92,700');
    expect(roundDisplayTotalToNearest100(45883.73)).not.toBe(45883.73);
  });

  it('marks comparison-only / included cards as non-writing', () => {
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockImplementation((id: string) =>
      stageSuggestion(id, 'interior-finishes', 92729.44)
    );
    const drywall = resolveScopeItemSuggestedPricing(
      'drywall',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('drywall', lot41(), { templateKey: 'ground_up' })
    );
    expect(drywall.comparison?.benchmarkAction).toBe('included_in_stage');
    expect(drywall.comparison?.isComparison).toBe(true);
  });

  it('keeps exact stored totals while display rounding differs', () => {
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockImplementation((id: string) =>
      stageSuggestion(id, 'framing', 45883.73)
    );
    const framing = resolveScopeItemSuggestedPricing(
      'framing',
      lot41(),
      'ground_up',
      resolveChecklistItemQuantity('framing', lot41(), { templateKey: 'ground_up' })
    );
    expect(framing.fill?.storedTotalExact).toBeCloseTo(45883.73, 1);
    expect(framing.fill?.total).toBeCloseTo(45883.73, 1);
    expect(roundDisplayTotalToNearest100(framing.fill?.total)).toBe(45900);
  });

  it('detects exact source match reasons for Lot 41 living SF', () => {
    const suggestion = stageSuggestion('plans_engineering', 'site-preconstruction', 24736.92);
    const lot41Comp = suggestion.detachedComparables[0];
    expect(lot41Comp.similarityReasons.some((r) => /within 0%/i.test(r))).toBe(true);
    expect(lot41Comp.livingSf).toBe(1879);
    expect(lot41Comp.scopeCost).toBe(1000);
  });
});
