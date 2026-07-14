import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  clearBenchmarkCache,
  fetchBenchmarkSuggestions,
  type BenchmarkSuggestion,
} from '@/utils/benchmarkEngine';
import {
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import {
  buildAcceptanceFromSuggestedBlock,
  markManualPricingAdjustment,
} from '@/utils/acceptedPricingSummaryUi';

jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

const suggestion: BenchmarkSuggestion = {
  scopeId: 'framing',
  stageId: 'framing',
  label: 'Framing',
  datasetId: 'southern-utah-residential-benchmark-v1',
  datasetVersion: '1.0.0',
  sourceKind: 'local_preliminary_budget',
  geography: 'Southern Utah',
  dataStatus: 'preliminary',
  selectedReason: 'blended_local_national',
  selectedSuggestion: {
    total: 45883.73,
    rate: 24.419229,
    unit: 'living_sqft',
    source: 'Southern Utah benchmark',
  },
  benchmarkIsComparisonOnly: false,
  localMedian: {
    rate: 22.818715,
    unit: 'living_sqft',
    total: 42873.37,
    sampleCount: 4,
    buildingType: 'detached',
    sourceStatus: 'preliminary',
  },
  nationalBenchmark: {
    rate: 26.82,
    adjustedRate: 26.82,
    unit: 'living_sqft',
    total: 50391.78,
    sourceName: 'NAHB',
    sourceUrl: 'https://example.com',
    sourceYear: 2024,
    sampleCount: 4000,
    limitations: [],
  },
  blendedBenchmark: {
    rate: 24.419229,
    unit: 'living_sqft',
    total: 45883.73,
    appliedQuantity: 1879,
    localWeight: 0.6,
    nationalWeight: 0.4,
  },
  primaryTakeoff: null,
  benchmarkBasis: { quantity: 1879, unit: 'living_sqft', costPerUnit: 24.419229 },
  localSampleCount: 4,
  sourceConfidence: 'medium',
  quantityConfidence: 'medium',
  priceConfidence: 'medium',
  warnings: ['Benchmark pricing only.'],
  comparables: [],
  twinHomeReferences: [],
  detachedComparables: [],
};

function measurements(): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    itemQuantities: {},
  } as ScopeMeasurementsInputExtended;
}

describe('Phase 3 benchmark pricing integration', () => {
  const originalFlag = process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1;

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = originalFlag;
    clearBenchmarkCache();
    jest.restoreAllMocks();
  });

  it('keeps current national pricing unchanged with flag off', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'false';
    const result = resolveScopeItemSuggestedPricing(
      'framing',
      measurements(),
      'ground_up',
      { quantity: 1879, unit: 'sqft', quantitySource: 'plan_vision' }
    );
    expect(result.fill?.materialSource).toBe('national_average');
    expect(result.fill?.benchmarkEvidence).toBeUndefined();
  });

  it('fills an empty saved/template slot with benchmark and provenance when enabled', async () => {
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ suggestions: [suggestion], reasonableness: null }),
    } as Response);
    await fetchBenchmarkSuggestions({ itemIds: ['framing'], livingSf: 1879 });

    const result = resolveScopeItemSuggestedPricing(
      'framing',
      measurements(),
      'ground_up',
      { quantity: 1879, unit: 'sqft', quantitySource: 'plan_vision' }
    );
    expect(result.fill).toMatchObject({
      total: 45883.73,
      laborSource: 'local_benchmark',
      lumpSumOnly: true,
      basis: { quantity: 1879, unit: 'living_sqft' },
    });
    expect(result.fill?.benchmarkProvenance).toMatchObject({
      datasetId: 'southern-utah-residential-benchmark-v1',
      benchmarkKey: 'framing',
      calculatedTotal: 45883.73,
      overriddenByUser: false,
    });
    const acceptance = buildAcceptanceFromSuggestedBlock(result.fill!);
    expect(acceptance).toMatchObject({
      pricingSourceKind: 'local_benchmark',
      geographicBasis: 'Southern Utah',
      benchmarkProvenance: {
        datasetId: 'southern-utah-residential-benchmark-v1',
        overriddenByUser: false,
      },
    });
    const adjusted = markManualPricingAdjustment(
      acceptance,
      'framing',
      { framing: acceptance },
      46000
    );
    expect(adjusted?.framing.benchmarkProvenance?.overriddenByUser).toBe(true);
  });
});
