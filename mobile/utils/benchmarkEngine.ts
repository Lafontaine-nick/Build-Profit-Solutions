import { resolveAiBaseUrl } from '@/utils/resolveAiBackendUrl';

export type BenchmarkConfidence = 'high' | 'medium' | 'low';

export type BenchmarkComparableProject = {
  projectId: string;
  name: string;
  buildingType: string;
  comparableClass: string;
  livingSf: number;
  fullBuildingLivingSf?: number | null;
  homesInSource: number;
  preliminaryBuildCostPerHome: number;
  scopeCost?: number | null;
  scopeCostPerLivingSf?: number | null;
  similarityScore: number;
  similarityConfidence: BenchmarkConfidence;
  similarityReasons: string[];
  sourceStatus: string;
  includeInDetachedMedian: boolean;
  notes: string[];
  stories?: number | null;
  garageSf?: number | null;
  patioPorchSf?: number | null;
  scopeName?: string | null;
  exactSourceMatch?: boolean;
};

export type BenchmarkProvenance = {
  datasetId: string;
  datasetVersion: string;
  benchmarkKey: string;
  selectedReason: string;
  localRate?: number | null;
  nationalRate?: number | null;
  blendedRate?: number | null;
  appliedQuantity: number;
  appliedUnit: string;
  calculatedTotal: number;
  sourceSampleCount: number;
  similarityProjectIds?: string[];
  appliedAt: string;
  overriddenByUser: boolean;
};

export type BenchmarkSuggestion = {
  scopeId: string;
  stageId: string;
  label: string;
  datasetId: string;
  datasetVersion: string;
  sourceKind: string;
  geography: string;
  dataStatus: string;
  selectedReason: string;
  selectedSuggestion: {
    total: number;
    rate: number | null;
    unit: string;
    source: string;
  } | null;
  benchmarkIsComparisonOnly: boolean;
  /** Presentation helpers attached on the mobile client. */
  benchmarkLevel?: 'scope' | 'component' | 'stage' | 'overall';
  benchmarkStageKey?: string | null;
  coversScopeKeys?: string[];
  localMedian: {
    rate: number | null;
    unit: 'living_sqft';
    total: number | null;
    sampleCount: number;
    buildingType: string;
    sourceStatus: string;
  };
  nationalBenchmark: {
    rate: number;
    adjustedRate: number;
    unit: 'living_sqft';
    total: number | null;
    sourceName: string;
    sourceUrl: string;
    sourceYear: number;
    sampleCount: number;
    limitations: string[];
  };
  blendedBenchmark: {
    rate: number;
    unit: 'living_sqft';
    total: number | null;
    appliedQuantity: number | null;
    localWeight: number;
    nationalWeight: number;
  };
  primaryTakeoff?: {
    quantity: number;
    unit: string;
    source?: string;
    confidence?: BenchmarkConfidence;
  } | null;
  benchmarkBasis: {
    quantity: number | null;
    unit: 'living_sqft';
    costPerUnit: number;
  };
  localSampleCount: number;
  sourceConfidence: BenchmarkConfidence;
  quantityConfidence: BenchmarkConfidence;
  priceConfidence: BenchmarkConfidence;
  measurementStatus?: string | null;
  quantityRoles?: {
    primaryTakeoff?: { quantity: number; unit: string } | null;
    pricing?: { quantity: number; unit: string; rate?: number } | null;
    benchmark?: { quantity: number; unit: string } | null;
  } | null;
  warnings: string[];
  comparables: BenchmarkComparableProject[];
  twinHomeReferences: BenchmarkComparableProject[];
  detachedComparables: BenchmarkComparableProject[];
  exactSourceMatch?: boolean;
  exactSourceProjectId?: string | null;
  leaveOneOut?: {
    excludedProjectId: string;
    excludedProjectName: string;
    available: boolean;
    localMedianRate?: number | null;
    blendedRate?: number | null;
    total?: number | null;
    sampleCount?: number;
    note: string;
  } | null;
};

export type BenchmarkReasonableness = {
  datasetId: string;
  datasetVersion: string;
  currentEstimate: number;
  livingSf: number;
  currentPerLivingSf: number;
  localDetachedMedianPerLivingSf: number;
  nationalPerLivingSf: number;
  blendedPlanningPerLivingSf: number;
  baselineTotal: number;
  varianceAmount: number;
  variancePercent: number | null;
  disclaimer: string;
};

export type BenchmarkSuggestionResponse = {
  suggestions: BenchmarkSuggestion[];
  reasonableness: BenchmarkReasonableness | null;
};

let cachedSuggestions: Record<string, BenchmarkSuggestion> = {};
let cachedReasonableness: BenchmarkReasonableness | null = null;

export function benchmarkEngineV1Enabled(): boolean {
  return String(process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 || '').toLowerCase() === 'true';
}

/** Synthetic stage-host cards resolve evidence from any cached child of that stage. */
const STAGE_HOST_CACHE_ALIASES: Record<string, string> = {
  interior_finishes: 'interior-finishes',
};

export function getCachedBenchmarkSuggestion(itemId: string): BenchmarkSuggestion | null {
  const direct = cachedSuggestions[itemId];
  if (direct) return direct;
  const stageKey = STAGE_HOST_CACHE_ALIASES[itemId];
  if (!stageKey) return null;
  const fromStage = Object.values(cachedSuggestions).find((row) => row.stageId === stageKey);
  if (!fromStage) return null;
  return {
    ...fromStage,
    scopeId: itemId,
    benchmarkLevel: 'stage',
    benchmarkStageKey: stageKey,
    coversScopeKeys: fromStage.coversScopeKeys,
  };
}

export function getCachedBenchmarkReasonableness(): BenchmarkReasonableness | null {
  return cachedReasonableness;
}

export function clearBenchmarkCache(): void {
  cachedSuggestions = {};
  cachedReasonableness = null;
}

export async function fetchBenchmarkSuggestions(input: {
  itemIds: string[];
  livingSf: number;
  garageSf?: number | null;
  patioPorchSf?: number | null;
  stories?: number | null;
  finishLevel?: string | null;
  buildingType?: string | null;
  estimateTotal?: number | null;
  primaryTakeoffs?: Record<string, { quantity: number; unit: string; source?: string }>;
}): Promise<BenchmarkSuggestionResponse | null> {
  if (!benchmarkEngineV1Enabled() || !input.itemIds.length || !(input.livingSf > 0)) {
    clearBenchmarkCache();
    return null;
  }
  const response = await fetch(`${resolveAiBaseUrl()}/api/benchmarks/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 404) {
    clearBenchmarkCache();
    return null;
  }
  if (!response.ok) {
    throw new Error(`Benchmark suggestions failed (${response.status}).`);
  }
  const payload = (await response.json()) as BenchmarkSuggestionResponse;
  cachedSuggestions = Object.fromEntries(
    (payload.suggestions || []).map((suggestion) => [suggestion.scopeId, suggestion])
  );
  cachedReasonableness = payload.reasonableness || null;
  return payload;
}

export function buildBenchmarkProvenance(
  suggestion: BenchmarkSuggestion
): BenchmarkProvenance | null {
  const selected = suggestion.selectedSuggestion;
  if (!selected || suggestion.benchmarkIsComparisonOnly) return null;
  return {
    datasetId: suggestion.datasetId,
    datasetVersion: suggestion.datasetVersion,
    benchmarkKey: suggestion.stageId,
    selectedReason: suggestion.selectedReason,
    localRate: suggestion.localMedian.rate,
    nationalRate: suggestion.nationalBenchmark.rate,
    blendedRate: suggestion.blendedBenchmark.rate,
    appliedQuantity: suggestion.blendedBenchmark.appliedQuantity || 0,
    appliedUnit: suggestion.blendedBenchmark.unit,
    calculatedTotal: selected.total,
    sourceSampleCount: suggestion.localSampleCount,
    similarityProjectIds: suggestion.detachedComparables.slice(0, 4).map((entry) => entry.projectId),
    appliedAt: new Date().toISOString(),
    overriddenByUser: false,
  };
}
