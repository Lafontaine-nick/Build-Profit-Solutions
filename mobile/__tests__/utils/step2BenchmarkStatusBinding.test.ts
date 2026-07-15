import * as benchmarkEngine from '@/utils/benchmarkEngine';
import {
  clearBenchmarkCache,
  type BenchmarkSuggestion,
} from '@/utils/benchmarkEngine';
import {
  canApplyStageBenchmarkFill,
  classifySuggestedPricingState,
  footerSuggestedPricingSummary,
  isGrossFlooringDerivedFromLiving,
  missingStatusDisplayLabel,
} from '@/utils/measurementSemantics';
import {
  getChecklistItemQuantityRule,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import {
  emptyQuickMeasurementInput,
  quickMeasurementFieldMeta,
  quickMeasurementPlaceholder,
} from '@/utils/scopeQuickMeasurements';

jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

function lot41Measurements(): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    garageSqft: '994',
    deckSqft: '247',
    kitchenFloorSqft: '194.1',
    flooringSqft: '1879',
    itemQuantities: {},
  } as ScopeMeasurementsInputExtended;
}

function framingSuggestion(total = 45883.73): BenchmarkSuggestion {
  return {
    scopeId: 'framing',
    stageId: 'framing',
    label: 'Framing',
    datasetId: 'southern_utah_residential_benchmark_v1',
    datasetVersion: '1',
    sourceKind: 'local_preliminary_budget',
    geography: 'Southern Utah',
    dataStatus: 'preliminary',
    selectedReason: 'blended_local_national',
    selectedSuggestion: {
      total,
      rate: 24.419229,
      unit: 'living_sqft',
      source: 'Southern Utah residential benchmark',
    },
    benchmarkIsComparisonOnly: false,
    localMedian: {
      rate: 22.82,
      unit: 'living_sqft',
      total: Math.round(1879 * 22.82),
      sampleCount: 4,
      buildingType: 'detached',
      sourceStatus: 'preliminary',
    },
    nationalBenchmark: {
      rate: 26.82,
      adjustedRate: 26.82,
      unit: 'living_sqft',
      total: Math.round(1879 * 26.82),
      sourceName: 'National',
      sourceUrl: '',
      sourceYear: 2024,
      sampleCount: 100,
      limitations: [],
    },
    blendedBenchmark: {
      rate: 24.419229,
      unit: 'living_sqft',
      total,
      appliedQuantity: 1879,
      localWeight: 0.55,
      nationalWeight: 0.45,
    },
    primaryTakeoff: null,
    benchmarkBasis: { quantity: 1879, unit: 'living_sqft', costPerUnit: 24.419229 },
    localSampleCount: 4,
    sourceConfidence: 'medium',
    quantityConfidence: 'low',
    priceConfidence: 'medium',
    measurementStatus: 'needs_takeoff',
    quantityRoles: {
      primaryTakeoff: null,
      pricing: { quantity: 1879, unit: 'living_sqft', rate: 24.419229 },
      benchmark: { quantity: 1879, unit: 'living_sqft' },
    },
    warnings: ['Benchmark pricing only — detailed takeoff still required.'],
    comparables: [],
    twinHomeReferences: [],
    detachedComparables: [],
  };
}

describe('Step 2 benchmark + measurement-status binding', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;
  const originalBenchmark = process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1;

  beforeEach(() => {
    clearBenchmarkCache();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = originalBenchmark;
    clearBenchmarkCache();
    jest.restoreAllMocks();
  });

  it('shows framing mat+labor when primary takeoff is missing; stage benchmark is comparison', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => (id === 'framing' ? framingSuggestion() : null));

    const resolved = resolveChecklistItemQuantity('framing', lot41Measurements(), {
      templateKey: 'ground_up',
    });
    expect(resolved.quantity).toBeNull();

    const suggested = resolveScopeItemSuggestedPricing(
      'framing',
      lot41Measurements(),
      'ground_up',
      resolved
    );
    expect(suggested.fill?.materialSource).toBe('national_average');
    expect(suggested.fill?.laborSource).toBe('national_average');
    expect(suggested.fill?.material).toBeGreaterThan(0);
    expect(suggested.fill?.labor).toBeGreaterThan(0);
    expect(suggested.fill?.basis).toEqual({ quantity: 1879, unit: 'sqft' });
    expect(suggested.comparison?.total).toBeCloseTo(45883.73, 0);
    expect(suggested.comparison?.benchmarkAction).toBe('comparison_only');
  });

  it('prices framing from living SF as material + labor (benchmark is comparison only)', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockReturnValue(framingSuggestion());

    const resolved = resolveChecklistItemQuantity('framing', lot41Measurements(), {
      templateKey: 'ground_up',
    });
    // Primary takeoff stays empty until package/board-foot takeoff exists.
    expect(resolved.quantity).toBeNull();
    expect(resolved.quantitySource).toBe('missing');

    const suggested = resolveScopeItemSuggestedPricing(
      'framing',
      lot41Measurements(),
      'ground_up',
      resolved
    );
    expect(suggested.fill?.material).toBeGreaterThan(0);
    expect(suggested.fill?.labor).toBeGreaterThan(0);
    expect(suggested.fill?.basis).toEqual({ quantity: 1879, unit: 'sqft' });
    expect(suggested.fill?.rateSourceLabel).toMatch(/National Average/i);
    expect(suggested.fill?.benchmarkAction).toBe('price_ready');
    // Southern Utah stage lump remains comparison-only.
    expect(suggested.comparison?.total).toBeCloseTo(45883.73, 0);
    expect(suggested.comparison?.benchmarkAction).toBe('comparison_only');
  });

  it('does not use living SF as foundation concrete quantity', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const foundation = resolveChecklistItemQuantity('foundation', lot41Measurements(), {
      templateKey: 'ground_up',
    });
    expect(foundation.quantity).toBeNull();
    // Default unit may be cy for the foundation rule; living SF must not become the quantity.
    expect(foundation.quantity).toBeNull();
    const rule = getChecklistItemQuantityRule('foundation', 'ground_up');
    expect(rule?.measurementKeys || []).not.toContain('floorAreaSqft');
  });

  it('does not treat placeholder CY/SF values as persisted or priced', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const empty = emptyQuickMeasurementInput();
    expect(empty.concreteSqft).toBe('');
    expect(empty.concreteCy).toBe('');
    expect(empty.excavationCy).toBe('');
    expect(empty.bathroomFloorSqft).toBe('');

    // Placeholders are display-only — never become measurement state.
    const field = {
      key: 'concreteCy' as const,
      label: 'Foundation',
      placeholder: '18',
      unit: 'CY',
      group: 'structure' as const,
    };
    expect(quickMeasurementPlaceholder(field)).toBe('Enter');
    expect(quickMeasurementPlaceholder(field)).not.toBe('18');

    const resolved = resolveChecklistItemQuantity(
      'foundation',
      { ...empty, floorAreaSqft: '1879', itemQuantities: {} } as ScopeMeasurementsInputExtended,
      { templateKey: 'ground_up' }
    );
    expect(resolved.quantity).toBeNull();
  });

  it('uses registry-specific missing statuses on scope cards', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(missingStatusDisplayLabel('sitework')).toBe('Needs site takeoff');
    expect(missingStatusDisplayLabel('foundation')).toBe('Needs structural takeoff');
    expect(missingStatusDisplayLabel('framing')).toBe('Needs detailed framing takeoff');
    expect(missingStatusDisplayLabel('roofing')).toBe('Needs roof area / roof squares');
    expect(missingStatusDisplayLabel('exterior')).toBe('Needs exterior wall and opening takeoff');
    expect(missingStatusDisplayLabel('mep_rough')).toBe(
      'Needs trade counts or installed-package pricing'
    );
    expect(missingStatusDisplayLabel('insulation')).toBe('Needs envelope surface SF');
    expect(missingStatusDisplayLabel('drywall')).toBe('Needs wall and ceiling surface SF');
    expect(missingStatusDisplayLabel('paint_trim')).toBe('Needs paintable wall and ceiling SF');
    expect(missingStatusDisplayLabel('appliances')).toBe('Needs appliance count');
    expect(missingStatusDisplayLabel('framing')).not.toMatch(/^Needs sqft$/i);
  });

  it('treats living-copied flooring SF as gross interior area, not finish takeoff', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(
      isGrossFlooringDerivedFromLiving({ flooringSqft: 1879, floorAreaSqft: 1879 })
    ).toBe(true);

    const tile = resolveChecklistItemQuantity('tile_flooring', lot41Measurements(), {
      templateKey: 'ground_up',
    });
    expect(tile.quantity).toBeNull();
    expect(missingStatusDisplayLabel('tile_flooring')).toMatch(/finish allocation/i);
  });

  it('prevents parent/stage benchmarks from double-counting child scopes', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(canApplyStageBenchmarkFill('framing', 'framing')).toBe(true);
    expect(canApplyStageBenchmarkFill('foundation', 'foundations')).toBe(true);
    expect(canApplyStageBenchmarkFill('exterior', 'exterior-finishes')).toBe(true);
    expect(canApplyStageBenchmarkFill('roofing', 'exterior-finishes')).toBe(false);
    // Synthetic Interior Finishes card owns the stage; trade children cannot.
    expect(canApplyStageBenchmarkFill('interior_finishes', 'interior-finishes')).toBe(true);
    expect(canApplyStageBenchmarkFill('insulation', 'interior-finishes')).toBe(false);
    expect(canApplyStageBenchmarkFill('drywall', 'interior-finishes')).toBe(false);
    expect(canApplyStageBenchmarkFill('tile_flooring', 'interior-finishes')).toBe(false);
  });

  it('keeps saved framing price selected over benchmark fill', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    const saved = {
      ...framingSuggestion(),
      selectedReason: 'saved_contractor_price',
      selectedSuggestion: {
        total: 47500,
        rate: null,
        unit: 'ls',
        source: 'Saved contractor pricing',
      },
      benchmarkIsComparisonOnly: true,
    } as BenchmarkSuggestion;
    jest.spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion').mockReturnValue(saved);

    const resolved = resolveChecklistItemQuantity('framing', lot41Measurements(), {
      templateKey: 'ground_up',
    });
    const suggested = resolveScopeItemSuggestedPricing(
      'framing',
      lot41Measurements(),
      'ground_up',
      resolved
    );
    // Planning mat+labor remains available; saved contractor total stays on comparison.
    expect(suggested.fill?.material).toBeGreaterThan(0);
    expect(suggested.fill?.labor).toBeGreaterThan(0);
    expect(suggested.comparison?.benchmarkEvidence?.selectedSuggestion?.total).toBe(47500);
    expect(suggested.comparison?.isComparison).toBe(true);
  });

  it('footer separates ready prices from planning benchmarks', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(
      footerSuggestedPricingSummary({
        readyCount: 1,
        benchmarkOnlyCount: 4,
        needsMeasurementCount: 13,
      })
    ).toBe('1 price ready · 4 planning benchmarks');
    expect(
      classifySuggestedPricingState({
        itemId: 'framing',
        hasPrimaryTakeoff: false,
        isLocalBenchmark: true,
      })
    ).toBe('benchmark_available');
  });

  it('preserves legacy behavior when feature flags are off', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'false';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'false';
    const field = {
      key: 'concreteCy' as const,
      label: 'Foundation',
      placeholder: '18',
      unit: 'CY',
      group: 'structure' as const,
    };
    expect(quickMeasurementPlaceholder(field)).toBe('18');
    expect(quickMeasurementFieldMeta('flooringSqft').label).toBe('Flooring');

    const framing = resolveChecklistItemQuantity(
      'framing',
      lot41Measurements(),
      { templateKey: 'ground_up' }
    );
    // Legacy may still resolve living SF as quantity for framing.
    expect(framing.quantity === 1879 || framing.quantity == null).toBe(true);
  });
});
