import type { AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';

export type BenchmarkScopeAssumptionStatus = 'included' | 'excluded' | 'conditional' | 'unknown';

export type ScopeProfileSource =
  | 'verified_external_source'
  | 'verified_supplier_scope'
  | 'verified_subcontractor_scope'
  | 'bps_standard_assumption'
  | 'company_defined'
  | 'user_defined'
  | 'unknown';

export type BenchmarkRecommendedContractorAction =
  | 'keep_included'
  | 'add_separate_item'
  | 'covered_elsewhere'
  | 'confirm_conditions'
  | 'confirm_before_excluding';

export type BenchmarkScopeAssumption = {
  scopeKey: string;
  status: BenchmarkScopeAssumptionStatus;
  displayLabel?: string;
  conditionText?: string;
  notes?: string;
  sourceReference?: string;
  source?: ScopeProfileSource;
  confidence?: 'high' | 'medium' | 'low';
  impact?: 'high' | 'medium' | 'low';
  riskLevel?: 'high' | 'medium' | 'low';
  recommendedContractorAction?: BenchmarkRecommendedContractorAction;
};

export type BenchmarkScopeAssumptionProfile = {
  sourceRecordId?: string;
  parentPricingRecordId?: string;
  pricingSource?: string;
  rateSource?: string;
  rateSourceReference?: string;
  geographicBasis?: string;
  effectiveDate?: string | null;
  verifiedAt?: string | null;
  scopeProfileSource?: ScopeProfileSource;
  scopeAssumptionsDefined: boolean;
  scopeAssumptions: BenchmarkScopeAssumption[];
  confidence?: 'high' | 'medium' | 'low';
  confidenceReasons?: string[];
  productionStatus?: 'production_ready' | 'review_required' | 'fallback_only' | 'disabled';
  audit?: {
    quantity?: number | null;
    unit?: string | null;
    materialRate?: number | null;
    laborRate?: number | null;
    equipmentRate?: number | null;
    total?: number | null;
    rootCause?: string;
  };
};

export type BenchmarkAssumptionReviewRequirement = {
  requiresReview: boolean;
  reason?: string;
  recommendedResolution?: string;
};

export type BenchmarkAssumptionResolutionSeed = {
  requiresReview: boolean;
  status: 'not_confirmed' | 'included';
};

export const BENCHMARK_SCOPE_KEY_ALIASES: Record<string, string> = {
  export: 'haul_off',
  spoils_export: 'haul_off',
  disposal_haul_off: 'haul_off',
  material_export: 'haul_off',
  cleanup_or_hauloff: 'haul_off',
  disposal: 'disposal',
  dump_fee: 'dump_fees',
  dump_fees: 'dump_fees',
};

export function canonicalBenchmarkScopeKey(scopeKey: string): string {
  return BENCHMARK_SCOPE_KEY_ALIASES[scopeKey] || scopeKey;
}

export const HIGH_IMPACT_FALLBACK_SCOPE_KEYS: Record<string, readonly string[]> = {
  excavation: ['export', 'haul_off', 'spoils_export', 'dump_fees', 'backfill', 'compaction', 'shoring', 'rock_excavation', 'groundwater'],
  utility_trenching: ['spoils_export', 'dump_fees', 'backfill', 'compaction', 'surface_restoration'],
  grading: ['export', 'dump_fees', 'fill', 'import', 'compaction'],
  concrete: ['pumping', 'reinforcement', 'finishing', 'sawcutting', 'disposal'],
  flooring: ['floor_demo', 'floor_prep', 'underlayment', 'transitions', 'disposal'],
  roofing: ['tear_off', 'disposal', 'underlayment', 'flashing', 'deck_repair', 'permits'],
  paint: ['prep', 'primer', 'repairs', 'protection', 'cleanup'],
  plumbing_rough: ['fixtures', 'trenching', 'permits', 'testing', 'patching'],
  electrical_rough: ['permits', 'trenching', 'patching', 'fixtures'],
};

export function createUndefinedBenchmarkScopeProfile(params: {
  itemId: string;
  pricingSource: string;
  quantity?: number | null;
  unit?: string | null;
  materialRate?: number | null;
  laborRate?: number | null;
  equipmentRate?: number | null;
  total?: number | null;
  geographicBasis?: string;
  effectiveDate?: string | null;
}): BenchmarkScopeAssumptionProfile {
  return {
    sourceRecordId: `${params.pricingSource}:${params.itemId}:${params.unit || 'unit'}`,
    pricingSource: params.pricingSource,
    geographicBasis: params.geographicBasis,
    effectiveDate: params.effectiveDate ?? null,
    scopeAssumptionsDefined: false,
    scopeAssumptions: [],
    audit: {
      quantity: params.quantity,
      unit: params.unit,
      materialRate: params.materialRate,
      laborRate: params.laborRate,
      equipmentRate: params.equipmentRate,
      total: params.total,
      rootCause:
        'Legacy national-average budget split has rates and source labels but no documented inclusion profile.',
    },
  };
}

export function findBenchmarkAssumption(
  profile: BenchmarkScopeAssumptionProfile | null | undefined,
  componentKey: string
): BenchmarkScopeAssumption | null {
  const canonicalKey = canonicalBenchmarkScopeKey(componentKey);
  return (
    profile?.scopeAssumptions.find(
      (assumption) => canonicalBenchmarkScopeKey(assumption.scopeKey) === canonicalKey
    ) || null
  );
}

export function benchmarkAssumptionLabel(
  assumption: BenchmarkScopeAssumption | null | undefined,
  profile?: BenchmarkScopeAssumptionProfile | null
): string {
  if (!profile?.scopeAssumptionsDefined) return 'Source does not specify';
  switch (assumption?.status) {
    case 'included':
      return 'Included in suggested price';
    case 'excluded':
      return 'Not included in suggested price';
    case 'conditional':
      return assumption.conditionText ? `Conditional - ${assumption.conditionText}` : 'Conditional';
    default:
      return 'Source does not specify';
  }
}

export function benchmarkRecommendedResolution(
  assumption: BenchmarkScopeAssumption | null | undefined,
  profile?: BenchmarkScopeAssumptionProfile | null
): 'included' | 'price_separately' | null {
  if (!profile?.scopeAssumptionsDefined || !assumption) return null;
  switch (assumption.status) {
    case 'included':
      return assumption.riskLevel === 'high' ? null : 'included';
    case 'excluded':
      return null;
    case 'conditional':
    case 'unknown':
    default:
      return null;
  }
}

export function getBenchmarkAssumptionReviewRequirement(params: {
  assumption?: BenchmarkScopeAssumption | null;
  component: AssemblyComponentStatus;
  scopeKey: string;
  profile?: BenchmarkScopeAssumptionProfile | null;
}): BenchmarkAssumptionReviewRequirement {
  const { assumption, component, scopeKey, profile } = params;
  if (!profile?.scopeAssumptionsDefined) {
    const highImpact = HIGH_IMPACT_FALLBACK_SCOPE_KEYS[scopeKey]?.includes(component.key);
    return {
      requiresReview: Boolean(highImpact),
      reason: highImpact ? 'High-impact item with undefined benchmark inclusions.' : undefined,
    };
  }
  if (!assumption || assumption.status === 'unknown') {
    return { requiresReview: true, reason: 'Benchmark does not define this inclusion.' };
  }
  if (assumption.status === 'excluded') {
    return {
      requiresReview: true,
      reason: 'Benchmark excludes this from the suggested price; contractor must decide how to handle it.',
      recommendedResolution: 'add_separate_item',
    };
  }
  if (assumption.status === 'conditional') {
    return { requiresReview: true, reason: assumption.conditionText || 'Benchmark inclusion is conditional.' };
  }
  const highRiskIncluded = assumption.riskLevel === 'high';
  return {
    requiresReview: highRiskIncluded,
    reason: highRiskIncluded ? 'High-risk included assumption should be confirmed.' : undefined,
    recommendedResolution: 'keep_included',
  };
}

export const NATIONAL_AVERAGE_BASE_SCOPE_NOTE =
  'Base national average only. Related work like haul-off, backfill, pumping, reinforcement, and disposal may need to be added separately.';

export function buildConciseBenchmarkScopeWarning(params: {
  profile: BenchmarkScopeAssumptionProfile | null | undefined;
  pricingSource?: string;
  assumptionCount: number;
  pricingAccepted?: boolean;
}): string | null {
  if (params.assumptionCount <= 0) return null;
  const countLabel =
    params.assumptionCount === 1
      ? '1 scope assumption'
      : `${params.assumptionCount} scope assumptions`;
  const timing = params.pricingAccepted ? 'before sending the estimate' : 'before applying it';
  const reviewCallToAction = `Review ${countLabel} ${timing}.`;
  if (params.pricingSource === 'national_average') {
    return `${NATIONAL_AVERAGE_BASE_SCOPE_NOTE} ${reviewCallToAction}`;
  }
  const quality = benchmarkScopeDefinitionQuality(params.profile);
  if (quality === 'undefined') {
    return `This price source does not define all included work. ${reviewCallToAction}`;
  }
  return null;
}

export function benchmarkScopeDefinitionQuality(
  profile: BenchmarkScopeAssumptionProfile | null | undefined
): 'defined' | 'partial' | 'undefined' {
  if (!profile?.scopeAssumptionsDefined) return 'undefined';
  if (!profile.scopeAssumptions.length) return 'undefined';
  const unknown = profile.scopeAssumptions.filter((item) => item.status === 'unknown').length;
  if (unknown > profile.scopeAssumptions.length / 2) return 'partial';
  return 'defined';
}
