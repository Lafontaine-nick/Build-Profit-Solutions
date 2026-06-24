import type { EstimateReadinessSnapshot } from '@/utils/estimateReadiness';
import type { RateMetadata } from '@/utils/scopePricingIntelligence';
import type { PricingSourceKind, UnitCode } from '@/utils/scopeIntelligence';

export const ESTIMATE_FEEDBACK_VERSION = '1.0.0';

export type FeedbackConfidence = 'high' | 'medium' | 'low';
export type FeedbackStatus =
  | 'insufficient_data'
  | 'partial'
  | 'ready_for_review'
  | 'reviewed'
  | 'calibration_applied';
export type ActualCompletionStatus = 'in_progress' | 'substantially_complete' | 'complete' | 'closed';
export type ActualDataSourceType =
  | 'manual_entry'
  | 'job_cost_record'
  | 'material_invoice'
  | 'supplier_receipt'
  | 'subcontractor_invoice'
  | 'employee_time_entry'
  | 'equipment_log'
  | 'purchase_order'
  | 'change_order'
  | 'accounting_integration'
  | 'imported_csv'
  | 'imported_pdf'
  | 'imported_image'
  | 'final_customer_invoice'
  | 'project_closeout';
export type ActualMappingStatus =
  | 'exact_match'
  | 'likely_match'
  | 'split_across_scopes'
  | 'combined_actual'
  | 'unmatched'
  | 'user_confirmed';
export type VarianceClassification =
  | 'quantity_variance'
  | 'unit_rate_variance'
  | 'scope_change'
  | 'owner_upgrade'
  | 'unforeseen_condition'
  | 'rework'
  | 'waste_variance'
  | 'productivity_variance'
  | 'supplier_price_change'
  | 'minimum_charge'
  | 'mobilization'
  | 'tax_variance'
  | 'markup_variance'
  | 'mapping_uncertainty'
  | 'other';
export type ComparisonStatus =
  | 'directly_comparable'
  | 'normalized_comparison'
  | 'partially_comparable'
  | 'not_comparable';
export type CalibrationFindingSeverity = 'info' | 'review' | 'warning';
export type CalibrationFindingCategory =
  | 'quantity'
  | 'pricing'
  | 'formula'
  | 'assumption'
  | 'benchmark'
  | 'mapping'
  | 'profit'
  | 'change_order';
export type CalibrationTarget = 'project_rate' | 'saved_rate' | 'company_rate';
export type CalibrationReason =
  | 'consistent_underestimate'
  | 'consistent_overestimate'
  | 'stale_rate'
  | 'minimum_charge_pattern'
  | 'regional_difference'
  | 'quantity_scale_pattern'
  | 'supplier_change'
  | 'labor_productivity_change'
  | 'other';
export type FeedbackUserRole = 'field' | 'foreman' | 'manager' | 'admin' | 'owner' | 'view_only';

export type RateRegion = {
  country?: string;
  state?: string;
  metro?: string;
  zipCode?: string;
  marketLabel?: string;
};

export type EstimateSnapshotScopeItem = {
  scopeItemKey: string;
  name?: string;
  trade?: string;
  description?: string;
  quantity?: number | null;
  unit?: UnitCode | string | null;
  quantitySource?: string;
  materialCost?: number | null;
  laborCost?: number | null;
  laborHours?: number | null;
  equipmentCost?: number | null;
  subcontractorCost?: number | null;
  otherDirectCost?: number | null;
  totalDirectCost?: number | null;
  sellingPrice?: number | null;
  unitRate?: number | null;
  pricingSource?: PricingSourceKind | string;
  rateType?: string;
  rateId?: string;
  rateVersionId?: string;
  rateMetadata?: RateMetadata | null;
  formulaKey?: string | null;
  expectedQuantityRange?: { low: number; high: number } | null;
  assumptions?: Array<{ assumptionKey: string; value: number; unit?: string }>;
  costBasis?: 'direct_cost' | 'selling_price' | 'installed_unit_rate' | 'material_only' | 'labor_only' | 'allowance' | 'unknown';
};

export type EstimateSnapshot = {
  estimateId: string;
  estimateVersion?: string;
  createdAt: string;
  scopeItems: EstimateSnapshotScopeItem[];
  totals?: {
    directCost?: number | null;
    materialCost?: number | null;
    laborCost?: number | null;
    equipmentCost?: number | null;
    subcontractorCost?: number | null;
    otherDirectCost?: number | null;
    markup?: number | null;
    overhead?: number | null;
    profit?: number | null;
    contingency?: number | null;
    sellingPrice?: number | null;
  };
  markupPercent?: number | null;
  readinessSnapshot?: EstimateReadinessSnapshot | null;
};

export type ActualSourceReference = {
  sourceType: ActualDataSourceType;
  sourceId: string;
  date?: string;
  vendorOrEmployee?: string;
  mappedScopeItemKeys?: string[];
  confidence: FeedbackConfidence;
  userConfirmed?: boolean;
  extracted?: boolean;
};

export type ActualScopeRecord = {
  scopeItemKey?: string;
  mappedScopeItemKeys?: string[];
  trade?: string;
  description?: string;
  actualQuantity?: number | null;
  actualUnit?: UnitCode | string | null;
  materialCost?: number | null;
  laborCost?: number | null;
  laborHours?: number | null;
  equipmentCost?: number | null;
  subcontractorCost?: number | null;
  otherDirectCost?: number | null;
  taxCost?: number | null;
  deliveryCost?: number | null;
  mobilizationCost?: number | null;
  disposalCost?: number | null;
  totalDirectCost?: number | null;
  finalSellingPrice?: number | null;
  sourceRecords: ActualSourceReference[];
  confidence: FeedbackConfidence;
  notes?: string[];
  mappingStatus?: ActualMappingStatus;
  userConfirmedMapping?: boolean;
  varianceClassification?: VarianceClassification;
  excludeFromCalibration?: boolean;
  exclusionReason?: string;
  costBasis?: 'direct_cost' | 'selling_price' | 'mixed' | 'unknown';
};

export type ActualChangeOrder = {
  id: string;
  title: string;
  amount: number;
  directCost?: number | null;
  sellingPrice?: number | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  classification?: 'scope_change' | 'owner_upgrade' | 'unforeseen_condition' | 'rework' | 'warranty' | 'estimating_error' | 'other';
  scopeItemKeys?: string[];
  excludeFromCalibration?: boolean;
};

export type ActualExclusion = {
  scopeItemKey?: string;
  reason: string;
  amount?: number;
};

export type ActualDataSource = {
  sourceType: ActualDataSourceType;
  sourceId: string;
  date?: string;
  confidence: FeedbackConfidence;
  userConfirmed?: boolean;
  recordCount?: number;
};

export type ActualProjectData = {
  projectId: string;
  completionStatus: ActualCompletionStatus;
  scopeActuals: ActualScopeRecord[];
  projectLevelActuals?: {
    generalConditions?: number;
    overhead?: number;
    profit?: number;
    tax?: number;
    contingencyUsed?: number;
    permits?: number;
    cleanup?: number;
    totalActualCost?: number;
    finalCustomerPrice?: number;
  };
  changeOrders?: ActualChangeOrder[];
  exclusions?: ActualExclusion[];
  dataSources: ActualDataSource[];
};

export type ActualMappingIssue = {
  key: string;
  status: ActualMappingStatus;
  actualRecordDescription?: string;
  candidateScopeKeys?: string[];
  explanation: string;
  recommendedAction: string;
};

export type ScopeActualComparison = {
  scopeItemKey: string;
  estimateItem: EstimateSnapshotScopeItem;
  actualRecord?: ActualScopeRecord;
  mappingStatus: ActualMappingStatus;
  comparisonStatus: ComparisonStatus;
  normalizationSteps: string[];
  estimatedQuantity?: number | null;
  actualQuantity?: number | null;
  quantityVariance?: number | null;
  quantityVariancePercent?: number | null;
  estimatedDirectCost?: number | null;
  actualDirectCost?: number | null;
  costVariance?: number | null;
  costVariancePercent?: number | null;
  estimatedEffectiveRate?: number | null;
  actualEffectiveRate?: number | null;
  rateVariancePercent?: number | null;
  actualProductionRate?: number | null;
  varianceClassification?: VarianceClassification;
  confidence: FeedbackConfidence;
  notices: string[];
  excludedFromCalibration: boolean;
};

export type ProjectActualSummary = {
  estimatedDirectCost?: number;
  actualDirectCost?: number;
  directCostVariance?: number;
  directCostVariancePercent?: number | null;
  estimatedSellingPrice?: number;
  finalSellingPrice?: number;
  estimatedGrossProfit?: number;
  actualGrossProfit?: number;
  estimatedMarginPercent?: number | null;
  actualMarginPercent?: number | null;
  changeOrderTotal?: number;
  contingencyUsed?: number;
  mappedActualCoveragePercent: number;
  highConfidenceCoveragePercent: number;
  estimateAccuracyScore?: number;
};

export type CalibrationEvidence = {
  evidenceId: string;
  estimateId: string;
  projectId?: string;
  scopeKey: string;
  unit?: UnitCode | string | null;
  estimatedRate?: number | null;
  actualRate?: number | null;
  variancePercent?: number | null;
  quantity?: number | null;
  confidence: FeedbackConfidence;
  region?: RateRegion;
  projectContext?: string;
  sourceType?: string;
  excluded?: boolean;
  exclusionReason?: string;
  completedAt?: string;
};

export type CalibrationFinding = {
  key: string;
  category: CalibrationFindingCategory;
  severity: CalibrationFindingSeverity;
  title: string;
  explanation: string;
  scopeItemKey?: string;
  variancePercent?: number | null;
  evidence: CalibrationEvidence[];
  recommendedAction?: string;
};

export type RateCalibrationSuggestion = {
  key: string;
  scopeKey: string;
  trade?: string;
  unit: UnitCode | string;
  target: CalibrationTarget;
  currentRate?: number;
  suggestedRate: number;
  expectedRange?: { low: number; high: number };
  evidence: CalibrationEvidence[];
  comparableProjectCount: number;
  weightedSampleQuantity?: number;
  region?: RateRegion;
  projectContexts?: string[];
  finishLevels?: string[];
  confidence: FeedbackConfidence;
  reason: CalibrationReason;
  requiresUserApproval: true;
};

export type AssumptionCalibrationSuggestion = {
  assumptionKey: string;
  currentValue: number;
  suggestedValue: number;
  suggestedRange?: { low: number; high: number };
  applicableScopeKeys: string[];
  applicableProjectContexts?: string[];
  region?: RateRegion;
  evidenceCount: number;
  confidence: FeedbackConfidence;
  requiresUserApproval: true;
};

export type FormulaPerformanceResult = {
  formulaKey: string;
  sampleCount: number;
  medianQuantityVariancePercent?: number | null;
  meanAbsolutePercentError?: number | null;
  bias?: 'under' | 'over' | 'neutral';
  insideExpectedRangePercent?: number;
  status: 'performing_well' | 'slight_underestimate_bias' | 'slight_overestimate_bias' | 'review_recommended' | 'insufficient_data';
};

export type BenchmarkPerformanceResult = {
  sourceType: PricingSourceKind | string;
  sourceId?: string;
  scopeKey: string;
  unit: UnitCode | string;
  region?: RateRegion;
  sampleCount: number;
  medianVariancePercent?: number | null;
  meanAbsoluteVariancePercent?: number | null;
  bias?: 'under' | 'over' | 'neutral';
  withinTolerancePercent?: number;
  status: 'performing_well' | 'review' | 'poor_fit' | 'insufficient_data';
};

export type AccuracyTolerance = {
  excellentPercent: number;
  acceptablePercent: number;
  reviewPercent: number;
};

export type CalibrationThresholds = {
  minimumProjectsForSavedRateSuggestion: number;
  minimumProjectsForCompanyRateSuggestion: number;
  minimumProjectsForAssumptionSuggestion: number;
  minimumProjectsForBenchmarkConcern: number;
};

export type RateVersion = {
  versionId: string;
  parentRateId: string;
  value: number;
  unit: UnitCode | string;
  metadata: RateMetadata;
  effectiveDate: string;
  supersedesVersionId?: string;
  changeReason: 'manual_update' | 'actual_cost_calibration' | 'supplier_update' | 'regional_update' | 'other';
  evidenceReferences?: Array<{ evidenceId: string; projectId?: string; estimateId?: string }>;
  createdBy: string;
  createdAt: string;
};

export type FeedbackAlgorithmInput = {
  estimateId: string;
  projectId?: string;
  estimateSnapshot?: EstimateSnapshot | null;
  actualProjectData?: ActualProjectData | null;
  readinessSnapshot?: EstimateReadinessSnapshot | null;
  projectContext?: string;
  projectLocation?: RateRegion;
  comparableEvidence?: CalibrationEvidence[];
  assumptionEvidence?: Array<{
    assumptionKey: string;
    currentValue: number;
    observedValue: number;
    scopeItemKey: string;
    confidence: FeedbackConfidence;
    excluded?: boolean;
  }>;
  formulaEvidence?: Array<{
    formulaKey: string;
    quantityVariancePercent?: number | null;
    insideExpectedRange?: boolean;
    confidence: FeedbackConfidence;
    excluded?: boolean;
  }>;
  thresholds?: CalibrationThresholds;
  tolerance?: AccuracyTolerance;
  now?: Date;
};

export type FeedbackAnalyticsSummary = {
  accuracyByTrade: Record<string, number>;
  quantityAccuracyByScope: Record<string, number>;
  pricingAccuracyBySource: Record<string, number>;
  commonVarianceCauses: Record<string, number>;
  actualDataCoveragePercent: number;
  unresolvedMappingCount: number;
  rateSuggestionCount: number;
  assumptionSuggestionCount: number;
};

export type EstimateFeedbackResult = {
  estimateId: string;
  projectId?: string;
  status: FeedbackStatus;
  scopeComparisons: ScopeActualComparison[];
  projectSummary: ProjectActualSummary;
  quantityFindings: CalibrationFinding[];
  pricingFindings: CalibrationFinding[];
  formulaFindings: CalibrationFinding[];
  assumptionFindings: CalibrationFinding[];
  benchmarkFindings: CalibrationFinding[];
  rateSuggestions: RateCalibrationSuggestion[];
  assumptionSuggestions: AssumptionCalibrationSuggestion[];
  formulaPerformance: FormulaPerformanceResult[];
  benchmarkPerformance: BenchmarkPerformanceResult[];
  unresolvedMappings: ActualMappingIssue[];
  analytics: FeedbackAnalyticsSummary;
  confidence: FeedbackConfidence;
  createdAt: string;
  algorithmVersion: string;
};

export const CALIBRATION_THRESHOLDS: CalibrationThresholds = {
  minimumProjectsForSavedRateSuggestion: 2,
  minimumProjectsForCompanyRateSuggestion: 3,
  minimumProjectsForAssumptionSuggestion: 5,
  minimumProjectsForBenchmarkConcern: 5,
};

export const DEFAULT_ACCURACY_TOLERANCE: AccuracyTolerance = {
  excellentPercent: 5,
  acceptablePercent: 12,
  reviewPercent: 20,
};

function safeNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value: unknown): number | null {
  const n = safeNumber(value);
  return n != null && n > 0 ? n : null;
}

function round(value: number | null | undefined, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function percentVariance(actual: number | null | undefined, estimated: number | null | undefined): number | null {
  if (actual == null || estimated == null || !Number.isFinite(actual) || !Number.isFinite(estimated) || estimated === 0) {
    return null;
  }
  return round(((actual - estimated) / estimated) * 100, 2);
}

function sumDefined(...values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0);
}

function estimateDirectCost(item: EstimateSnapshotScopeItem): number | null {
  return (
    positive(item.totalDirectCost) ??
    sumDefined(item.materialCost, item.laborCost, item.equipmentCost, item.subcontractorCost, item.otherDirectCost)
  );
}

function actualDirectCost(actual: ActualScopeRecord): number | null {
  return (
    positive(actual.totalDirectCost) ??
    sumDefined(
      actual.materialCost,
      actual.laborCost,
      actual.equipmentCost,
      actual.subcontractorCost,
      actual.otherDirectCost,
      actual.taxCost,
      actual.deliveryCost,
      actual.mobilizationCost,
      actual.disposalCost
    )
  );
}

function median(values: number[]): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function percentile(values: number[], pct: number): number | null {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const idx = Math.min(clean.length - 1, Math.max(0, Math.floor((pct / 100) * (clean.length - 1))));
  return clean[idx];
}

function mean(values: number[]): number | null {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function robustRateStats(evidence: CalibrationEvidence[]) {
  const rates = evidence
    .filter((sample) => !sample.excluded && sample.actualRate != null && sample.confidence !== 'low')
    .map((sample) => Number(sample.actualRate));
  const q1 = percentile(rates, 25);
  const q3 = percentile(rates, 75);
  const iqr = q1 != null && q3 != null ? q3 - q1 : null;
  const trimmed = iqr == null
    ? rates
    : rates.filter((rate) => rate >= q1! - 1.5 * iqr && rate <= q3! + 1.5 * iqr);
  return {
    sampleCount: rates.length,
    median: round(median(trimmed), 4),
    trimmedMean: round(mean(trimmed), 4),
    q1: round(q1, 4),
    q3: round(q3, 4),
    excludedOutlierCount: rates.length - trimmed.length,
    weightedSampleQuantity: round(
      evidence.reduce((sum, sample) => sum + (sample.excluded ? 0 : Number(sample.quantity || 0)), 0),
      2
    ),
  };
}

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function resolveMapping(actual: ActualScopeRecord, items: EstimateSnapshotScopeItem[]): {
  item?: EstimateSnapshotScopeItem;
  status: ActualMappingStatus;
  issue?: ActualMappingIssue;
} {
  const explicitKeys = [actual.scopeItemKey, ...(actual.mappedScopeItemKeys || [])].filter(Boolean).map(String);
  if (actual.userConfirmedMapping && explicitKeys.length === 1) {
    const item = items.find((candidate) => candidate.scopeItemKey === explicitKeys[0]);
    if (item) return { item, status: 'user_confirmed' };
  }
  if (actual.mappingStatus === 'split_across_scopes' || explicitKeys.length > 1) {
    return {
      status: 'split_across_scopes',
      issue: {
        key: `mapping_split:${explicitKeys.join(',') || normalizeText(actual.description)}`,
        status: 'split_across_scopes',
        actualRecordDescription: actual.description,
        candidateScopeKeys: explicitKeys,
        explanation: 'Actual record appears to cover more than one scope item.',
        recommendedAction: 'Split or assign the actual cost before using it for calibration.',
      },
    };
  }
  if (explicitKeys.length === 1) {
    const item = items.find((candidate) => candidate.scopeItemKey === explicitKeys[0]);
    if (item) return { item, status: 'exact_match' };
  }
  const tradeMatches = actual.trade ? items.filter((item) => normalizeText(item.trade) === normalizeText(actual.trade)) : [];
  if (tradeMatches.length === 1) {
    return {
      item: tradeMatches[0],
      status: 'likely_match',
      issue: {
        key: `mapping_likely:${tradeMatches[0].scopeItemKey}`,
        status: 'likely_match',
        actualRecordDescription: actual.description,
        candidateScopeKeys: [tradeMatches[0].scopeItemKey],
        explanation: 'Actual record was matched by trade only.',
        recommendedAction: 'Confirm the mapping before high-confidence calibration.',
      },
    };
  }
  const text = normalizeText(`${actual.description || ''} ${actual.sourceRecords?.[0]?.vendorOrEmployee || ''}`);
  const textMatches = items.filter((item) => text.includes(normalizeText(item.scopeItemKey)) || text.includes(normalizeText(item.name)));
  if (textMatches.length === 1) {
    return {
      item: textMatches[0],
      status: 'likely_match',
      issue: {
        key: `mapping_likely:${textMatches[0].scopeItemKey}`,
        status: 'likely_match',
        actualRecordDescription: actual.description,
        candidateScopeKeys: [textMatches[0].scopeItemKey],
        explanation: 'Actual record was matched by description.',
        recommendedAction: 'Confirm the mapping before high-confidence calibration.',
      },
    };
  }
  return {
    status: actual.mappingStatus || 'unmatched',
    issue: {
      key: `mapping_unmatched:${normalizeText(actual.description || actual.sourceRecords?.[0]?.sourceId || 'actual')}`,
      status: actual.mappingStatus || 'unmatched',
      actualRecordDescription: actual.description,
      candidateScopeKeys: textMatches.map((item) => item.scopeItemKey),
      explanation: 'Actual record could not be confidently mapped to an estimate scope item.',
      recommendedAction: 'Assign, split, or exclude the actual record before calibration.',
    },
  };
}

function comparisonStatus(estimate: EstimateSnapshotScopeItem, actual: ActualScopeRecord): {
  status: ComparisonStatus;
  steps: string[];
} {
  const estimatedBasis = estimate.costBasis || estimate.rateType || 'unknown';
  const actualBasis = actual.costBasis || 'direct_cost';
  if (estimatedBasis === 'selling_price' && actualBasis === 'direct_cost') {
    return {
      status: 'not_comparable',
      steps: ['Estimated value is selling price while actual value is direct cost.'],
    };
  }
  if (estimatedBasis === 'allowance') {
    return {
      status: 'partially_comparable',
      steps: ['Estimated allowance is compared as a budget placeholder, not a like-for-like installed rate.'],
    };
  }
  if (estimatedBasis === 'material_only' && (actual.laborCost || actual.subcontractorCost)) {
    return {
      status: 'partially_comparable',
      steps: ['Estimated material-only basis is compared against actuals that include additional cost components.'],
    };
  }
  if (actual.taxCost || actual.deliveryCost || actual.mobilizationCost || actual.disposalCost) {
    return {
      status: 'normalized_comparison',
      steps: ['Actual direct cost includes tax, delivery, mobilization, or disposal components.'],
    };
  }
  return { status: 'directly_comparable', steps: [] };
}

function compareScope(estimate: EstimateSnapshotScopeItem, actual: ActualScopeRecord, mappingStatus: ActualMappingStatus): ScopeActualComparison {
  const estimatedQuantity = positive(estimate.quantity);
  const actualQuantity = positive(actual.actualQuantity);
  const estimatedCost = estimateDirectCost(estimate);
  const actualCost = actualDirectCost(actual);
  const estimatedRate = estimatedQuantity && estimatedCost ? estimatedCost / estimatedQuantity : positive(estimate.unitRate);
  const actualRate = actualQuantity && actualCost ? actualCost / actualQuantity : null;
  const basis = comparisonStatus(estimate, actual);
  const unitsMatch = !estimate.unit || !actual.actualUnit || normalizeText(estimate.unit) === normalizeText(actual.actualUnit);
  const notices: string[] = [];
  if (!unitsMatch) notices.push('Actual unit does not match estimated unit.');
  if (basis.status === 'not_comparable') notices.push('Cost basis is not comparable without user normalization.');
  if (mappingStatus === 'likely_match') notices.push('Mapping should be confirmed before calibration.');
  if (actual.excludeFromCalibration) notices.push(actual.exclusionReason || 'Actual record excluded from calibration.');
  const calibrationAllowed =
    unitsMatch &&
    (basis.status === 'directly_comparable' || basis.status === 'normalized_comparison') &&
    (mappingStatus === 'exact_match' || mappingStatus === 'user_confirmed') &&
    !actual.excludeFromCalibration &&
    !['scope_change', 'owner_upgrade', 'unforeseen_condition', 'rework'].includes(actual.varianceClassification || 'other');
  return {
    scopeItemKey: estimate.scopeItemKey,
    estimateItem: estimate,
    actualRecord: actual,
    mappingStatus,
    comparisonStatus: basis.status,
    normalizationSteps: basis.steps,
    estimatedQuantity,
    actualQuantity,
    quantityVariance: estimatedQuantity != null && actualQuantity != null ? round(actualQuantity - estimatedQuantity) : null,
    quantityVariancePercent: percentVariance(actualQuantity, estimatedQuantity),
    estimatedDirectCost: estimatedCost,
    actualDirectCost: actualCost,
    costVariance: estimatedCost != null && actualCost != null ? round(actualCost - estimatedCost) : null,
    costVariancePercent: percentVariance(actualCost, estimatedCost),
    estimatedEffectiveRate: round(estimatedRate, 4),
    actualEffectiveRate: round(actualRate, 4),
    rateVariancePercent: percentVariance(actualRate, estimatedRate),
    actualProductionRate: actualQuantity && actual.laborHours ? round(actualQuantity / actual.laborHours, 4) : null,
    varianceClassification: actual.varianceClassification,
    confidence: actual.confidence,
    notices,
    excludedFromCalibration: !calibrationAllowed,
  };
}

function buildComparisons(input: FeedbackAlgorithmInput): {
  comparisons: ScopeActualComparison[];
  unresolved: ActualMappingIssue[];
} {
  const items = input.estimateSnapshot?.scopeItems || [];
  const unresolved: ActualMappingIssue[] = [];
  const comparisons: ScopeActualComparison[] = [];
  const actuals = input.actualProjectData?.scopeActuals || [];
  const matchedKeys = new Set<string>();
  for (const actual of actuals) {
    const mapping = resolveMapping(actual, items);
    if (mapping.issue) unresolved.push(mapping.issue);
    if (!mapping.item) continue;
    matchedKeys.add(mapping.item.scopeItemKey);
    comparisons.push(compareScope(mapping.item, actual, mapping.status));
  }
  for (const item of items) {
    if (matchedKeys.has(item.scopeItemKey)) continue;
    comparisons.push({
      scopeItemKey: item.scopeItemKey,
      estimateItem: item,
      mappingStatus: 'unmatched',
      comparisonStatus: 'not_comparable',
      normalizationSteps: [],
      estimatedQuantity: positive(item.quantity),
      actualQuantity: null,
      quantityVariance: null,
      quantityVariancePercent: null,
      estimatedDirectCost: estimateDirectCost(item),
      actualDirectCost: null,
      costVariance: null,
      costVariancePercent: null,
      estimatedEffectiveRate: positive(item.quantity) && estimateDirectCost(item) ? round(estimateDirectCost(item)! / positive(item.quantity)!, 4) : positive(item.unitRate),
      actualEffectiveRate: null,
      rateVariancePercent: null,
      confidence: 'low',
      notices: ['No actual record mapped to this estimate scope item.'],
      excludedFromCalibration: true,
    });
  }
  return { comparisons, unresolved };
}

function changeOrderTotal(actualData?: ActualProjectData | null): number {
  return (actualData?.changeOrders || [])
    .filter((co) => co.status === 'approved')
    .reduce((sum, co) => sum + (positive(co.sellingPrice) ?? positive(co.amount) ?? positive(co.directCost) ?? 0), 0);
}

function projectSummary(input: FeedbackAlgorithmInput, comparisons: ScopeActualComparison[]): ProjectActualSummary {
  const estimatedDirectCost =
    positive(input.estimateSnapshot?.totals?.directCost) ??
    sumDefined(...(input.estimateSnapshot?.scopeItems || []).map(estimateDirectCost)) ??
    undefined;
  const mappedActualCost = sumDefined(...comparisons.map((comparison) => comparison.actualDirectCost)) ?? 0;
  const actualDirectCost =
    positive(input.actualProjectData?.projectLevelActuals?.totalActualCost) ?? mappedActualCost;
  const estimatedSellingPrice = positive(input.estimateSnapshot?.totals?.sellingPrice);
  const finalSellingPrice = positive(input.actualProjectData?.projectLevelActuals?.finalCustomerPrice);
  const mappedEstimateValue = comparisons.reduce((sum, comparison) => {
    return sum + (comparison.actualDirectCost != null ? Number(comparison.estimatedDirectCost || 0) : 0);
  }, 0);
  const highConfidenceMappedValue = comparisons.reduce((sum, comparison) => {
    return sum + (comparison.actualDirectCost != null && comparison.confidence === 'high' ? Number(comparison.estimatedDirectCost || 0) : 0);
  }, 0);
  const coverageBase = estimatedDirectCost || 0;
  const mappedActualCoveragePercent = coverageBase > 0 ? round((mappedEstimateValue / coverageBase) * 100, 1) || 0 : 0;
  const highConfidenceCoveragePercent = coverageBase > 0 ? round((highConfidenceMappedValue / coverageBase) * 100, 1) || 0 : 0;
  const directCostVariance = estimatedDirectCost != null && actualDirectCost != null ? round(actualDirectCost - estimatedDirectCost) ?? undefined : undefined;
  const directCostVariancePercent = percentVariance(actualDirectCost, estimatedDirectCost);
  const estimatedGrossProfit = estimatedSellingPrice != null && estimatedDirectCost != null ? round(estimatedSellingPrice - estimatedDirectCost) ?? undefined : undefined;
  const actualGrossProfit = finalSellingPrice != null && actualDirectCost != null ? round(finalSellingPrice - actualDirectCost) ?? undefined : undefined;
  const accuracyScore =
    mappedActualCoveragePercent >= 60 && directCostVariancePercent != null
      ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(directCostVariancePercent))))
      : undefined;
  return {
    estimatedDirectCost,
    actualDirectCost,
    directCostVariance,
    directCostVariancePercent,
    estimatedSellingPrice: estimatedSellingPrice ?? undefined,
    finalSellingPrice: finalSellingPrice ?? undefined,
    estimatedGrossProfit,
    actualGrossProfit,
    estimatedMarginPercent: estimatedSellingPrice ? round(((estimatedSellingPrice - (estimatedDirectCost || 0)) / estimatedSellingPrice) * 100, 2) : null,
    actualMarginPercent: finalSellingPrice ? round(((finalSellingPrice - (actualDirectCost || 0)) / finalSellingPrice) * 100, 2) : null,
    changeOrderTotal: changeOrderTotal(input.actualProjectData),
    contingencyUsed: positive(input.actualProjectData?.projectLevelActuals?.contingencyUsed) ?? undefined,
    mappedActualCoveragePercent,
    highConfidenceCoveragePercent,
    estimateAccuracyScore: accuracyScore,
  };
}

function evidenceFromComparison(comparison: ScopeActualComparison, input: FeedbackAlgorithmInput): CalibrationEvidence {
  return {
    evidenceId: `${input.estimateId}:${comparison.scopeItemKey}`,
    estimateId: input.estimateId,
    projectId: input.projectId,
    scopeKey: comparison.scopeItemKey,
    unit: comparison.estimateItem.unit,
    estimatedRate: comparison.estimatedEffectiveRate,
    actualRate: comparison.actualEffectiveRate,
    variancePercent: comparison.rateVariancePercent,
    quantity: comparison.actualQuantity,
    confidence: comparison.confidence,
    region: input.projectLocation,
    projectContext: input.projectContext,
    sourceType: comparison.estimateItem.pricingSource,
    excluded: comparison.excludedFromCalibration,
    exclusionReason: comparison.excludedFromCalibration ? comparison.notices.join(' ') || 'Excluded from calibration' : undefined,
  };
}

function findingsFor(comparisons: ScopeActualComparison[], input: FeedbackAlgorithmInput): {
  quantityFindings: CalibrationFinding[];
  pricingFindings: CalibrationFinding[];
} {
  const tolerance = input.tolerance || DEFAULT_ACCURACY_TOLERANCE;
  const quantityFindings: CalibrationFinding[] = [];
  const pricingFindings: CalibrationFinding[] = [];
  for (const comparison of comparisons) {
    const evidence = [evidenceFromComparison(comparison, input)];
    if (comparison.quantityVariancePercent != null && Math.abs(comparison.quantityVariancePercent) >= tolerance.reviewPercent) {
      quantityFindings.push({
        key: `quantity_variance:${comparison.scopeItemKey}`,
        category: 'quantity',
        severity: Math.abs(comparison.quantityVariancePercent) >= tolerance.reviewPercent * 1.5 ? 'warning' : 'review',
        title: 'Quantity variance',
        explanation: `${comparison.scopeItemKey} actual quantity varied by ${comparison.quantityVariancePercent}%.`,
        scopeItemKey: comparison.scopeItemKey,
        variancePercent: comparison.quantityVariancePercent,
        evidence,
        recommendedAction: 'Review measurement source, waste, and formula assumptions.',
      });
    }
    if (comparison.rateVariancePercent != null && Math.abs(comparison.rateVariancePercent) >= tolerance.reviewPercent) {
      pricingFindings.push({
        key: `rate_variance:${comparison.scopeItemKey}`,
        category: 'pricing',
        severity: Math.abs(comparison.rateVariancePercent) >= tolerance.reviewPercent * 1.5 ? 'warning' : 'review',
        title: 'Rate variance',
        explanation: `${comparison.scopeItemKey} actual effective rate varied by ${comparison.rateVariancePercent}%.`,
        scopeItemKey: comparison.scopeItemKey,
        variancePercent: comparison.rateVariancePercent,
        evidence,
        recommendedAction: 'Review saved rate, supplier cost, productivity, and inclusion basis.',
      });
    }
  }
  return { quantityFindings, pricingFindings };
}

function groupEvidence(evidence: CalibrationEvidence[]): Map<string, CalibrationEvidence[]> {
  const groups = new Map<string, CalibrationEvidence[]>();
  for (const sample of evidence) {
    const key = `${sample.scopeKey}:${sample.unit || 'unit'}:${sample.region?.state || ''}:${sample.projectContext || ''}`;
    const list = groups.get(key) || [];
    list.push(sample);
    groups.set(key, list);
  }
  return groups;
}

function reasonFromVariance(medianVariance: number | null): CalibrationReason {
  if (medianVariance == null) return 'other';
  if (medianVariance > 0) return 'consistent_underestimate';
  if (medianVariance < 0) return 'consistent_overestimate';
  return 'other';
}

function rateSuggestions(comparisons: ScopeActualComparison[], input: FeedbackAlgorithmInput): RateCalibrationSuggestion[] {
  const thresholds = input.thresholds || CALIBRATION_THRESHOLDS;
  const currentEvidence = comparisons
    .filter((comparison) => comparison.actualEffectiveRate != null && comparison.estimatedEffectiveRate != null)
    .map((comparison) => evidenceFromComparison(comparison, input));
  const allEvidence = [...currentEvidence, ...(input.comparableEvidence || [])];
  const suggestions: RateCalibrationSuggestion[] = [];
  for (const samples of groupEvidence(allEvidence).values()) {
    const usable = samples.filter((sample) => !sample.excluded && sample.actualRate != null);
    if (!usable.length) continue;
    const stats = robustRateStats(usable);
    if (stats.median == null) continue;
    const first = usable[0];
    const varianceMedian = median(usable.map((sample) => Number(sample.variancePercent || 0)));
    const comparableProjectCount = new Set(usable.map((sample) => sample.projectId || sample.estimateId)).size;
    const target: CalibrationTarget =
      comparableProjectCount >= thresholds.minimumProjectsForCompanyRateSuggestion
        ? 'company_rate'
        : comparableProjectCount >= thresholds.minimumProjectsForSavedRateSuggestion
          ? 'saved_rate'
          : 'project_rate';
    const confidence: FeedbackConfidence =
      target === 'company_rate' && usable.every((sample) => sample.confidence === 'high')
        ? 'high'
        : target === 'project_rate'
          ? 'low'
          : 'medium';
    suggestions.push({
      key: `rate_calibration:${target}:${first.scopeKey}:${first.unit || 'unit'}`,
      scopeKey: first.scopeKey,
      unit: first.unit || 'unit',
      target,
      currentRate: usable.find((sample) => sample.estimatedRate != null)?.estimatedRate ?? undefined,
      suggestedRate: stats.median,
      expectedRange: stats.q1 != null && stats.q3 != null ? { low: stats.q1, high: stats.q3 } : undefined,
      evidence: usable,
      comparableProjectCount,
      weightedSampleQuantity: stats.weightedSampleQuantity ?? undefined,
      region: first.region,
      projectContexts: Array.from(new Set(usable.map((sample) => sample.projectContext).filter(Boolean))) as string[],
      confidence,
      reason: reasonFromVariance(varianceMedian),
      requiresUserApproval: true,
    });
  }
  return suggestions;
}

function assumptionSuggestions(input: FeedbackAlgorithmInput): {
  findings: CalibrationFinding[];
  suggestions: AssumptionCalibrationSuggestion[];
} {
  const thresholds = input.thresholds || CALIBRATION_THRESHOLDS;
  const findings: CalibrationFinding[] = [];
  const suggestions: AssumptionCalibrationSuggestion[] = [];
  const groups = new Map<string, NonNullable<FeedbackAlgorithmInput['assumptionEvidence']>>();
  for (const sample of input.assumptionEvidence || []) {
    const list = groups.get(sample.assumptionKey) || [];
    list.push(sample);
    groups.set(sample.assumptionKey, list);
  }
  for (const [assumptionKey, samples] of groups.entries()) {
    const usable = samples.filter((sample) => !sample.excluded && sample.confidence !== 'low');
    const observed = usable.map((sample) => sample.observedValue);
    const suggested = median(observed);
    if (suggested == null || !usable.length) continue;
    findings.push({
      key: `assumption:${assumptionKey}`,
      category: 'assumption',
      severity: usable.length >= thresholds.minimumProjectsForAssumptionSuggestion ? 'review' : 'info',
      title: 'Assumption performance',
      explanation: `${assumptionKey} has ${usable.length} comparable actual result${usable.length === 1 ? '' : 's'}.`,
      evidence: [],
      recommendedAction: 'Review before changing the approved assumption registry.',
    });
    if (usable.length >= thresholds.minimumProjectsForAssumptionSuggestion) {
      suggestions.push({
        assumptionKey,
        currentValue: usable[0].currentValue,
        suggestedValue: round(suggested, 4) || suggested,
        suggestedRange: {
          low: percentile(observed, 25) || suggested,
          high: percentile(observed, 75) || suggested,
        },
        applicableScopeKeys: Array.from(new Set(usable.map((sample) => sample.scopeItemKey))),
        evidenceCount: usable.length,
        confidence: usable.every((sample) => sample.confidence === 'high') ? 'high' : 'medium',
        requiresUserApproval: true,
      });
    }
  }
  return { findings, suggestions };
}

function formulaPerformance(input: FeedbackAlgorithmInput): FormulaPerformanceResult[] {
  const groups = new Map<string, NonNullable<FeedbackAlgorithmInput['formulaEvidence']>>();
  for (const sample of input.formulaEvidence || []) {
    const list = groups.get(sample.formulaKey) || [];
    list.push(sample);
    groups.set(sample.formulaKey, list);
  }
  return Array.from(groups.entries()).map(([formulaKey, samples]) => {
    const usable = samples.filter((sample) => !sample.excluded && sample.quantityVariancePercent != null);
    if (usable.length < 2) {
      return { formulaKey, sampleCount: usable.length, status: 'insufficient_data' };
    }
    const variances = usable.map((sample) => Number(sample.quantityVariancePercent));
    const medianVariance = median(variances);
    const mape = mean(variances.map((value) => Math.abs(value)));
    const inside = usable.filter((sample) => sample.insideExpectedRange).length;
    const bias = medianVariance != null && medianVariance > 5 ? 'under' : medianVariance != null && medianVariance < -5 ? 'over' : 'neutral';
    const status =
      mape != null && mape <= DEFAULT_ACCURACY_TOLERANCE.acceptablePercent
        ? 'performing_well'
        : bias === 'under'
          ? 'slight_underestimate_bias'
          : bias === 'over'
            ? 'slight_overestimate_bias'
            : 'review_recommended';
    return {
      formulaKey,
      sampleCount: usable.length,
      medianQuantityVariancePercent: round(medianVariance),
      meanAbsolutePercentError: round(mape),
      bias,
      insideExpectedRangePercent: round((inside / usable.length) * 100, 1) || 0,
      status,
    };
  });
}

function benchmarkPerformance(comparisons: ScopeActualComparison[], input: FeedbackAlgorithmInput): BenchmarkPerformanceResult[] {
  const thresholds = input.thresholds || CALIBRATION_THRESHOLDS;
  const tolerance = input.tolerance || DEFAULT_ACCURACY_TOLERANCE;
  const evidence = [
    ...comparisons.map((comparison) => evidenceFromComparison(comparison, input)),
    ...(input.comparableEvidence || []),
  ].filter((sample) => sample.actualRate != null && sample.variancePercent != null);
  const groups = new Map<string, CalibrationEvidence[]>();
  for (const sample of evidence) {
    const key = `${sample.sourceType || 'unknown'}:${sample.scopeKey}:${sample.unit || 'unit'}`;
    const list = groups.get(key) || [];
    list.push(sample);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([key, samples]) => {
    const [sourceType, scopeKey, unit] = key.split(':');
    const usable = samples.filter((sample) => !sample.excluded);
    if (usable.length < thresholds.minimumProjectsForBenchmarkConcern && sourceType !== 'saved_rate') {
      return {
        sourceType,
        scopeKey,
        unit,
        sampleCount: usable.length,
        status: 'insufficient_data',
      };
    }
    const variances = usable.map((sample) => Number(sample.variancePercent));
    const medianVariance = median(variances);
    const meanAbs = mean(variances.map((value) => Math.abs(value)));
    const within = usable.filter((sample) => Math.abs(Number(sample.variancePercent)) <= tolerance.acceptablePercent).length;
    const bias = medianVariance != null && medianVariance > 5 ? 'under' : medianVariance != null && medianVariance < -5 ? 'over' : 'neutral';
    const status =
      meanAbs != null && meanAbs <= tolerance.acceptablePercent
        ? 'performing_well'
        : meanAbs != null && meanAbs > tolerance.reviewPercent
          ? 'poor_fit'
          : 'review';
    return {
      sourceType,
      scopeKey,
      unit,
      sampleCount: usable.length,
      medianVariancePercent: round(medianVariance),
      meanAbsoluteVariancePercent: round(meanAbs),
      bias,
      withinTolerancePercent: round((within / Math.max(1, usable.length)) * 100, 1) || 0,
      status,
    };
  });
}

function feedbackConfidence(data?: ActualProjectData | null, summary?: ProjectActualSummary): FeedbackConfidence {
  if (!data) return 'low';
  const completed = data.completionStatus === 'complete' || data.completionStatus === 'closed';
  const confirmedSourceShare = data.dataSources.length
    ? data.dataSources.filter((source) => source.userConfirmed && source.confidence !== 'low').length / data.dataSources.length
    : 0;
  if (completed && (summary?.highConfidenceCoveragePercent || 0) >= 75 && confirmedSourceShare >= 0.75) return 'high';
  if ((summary?.mappedActualCoveragePercent || 0) >= 50) return 'medium';
  return 'low';
}

function statusFor(data: ActualProjectData | null | undefined, summary: ProjectActualSummary, unresolved: ActualMappingIssue[], confidence: FeedbackConfidence): FeedbackStatus {
  if (!data || !data.scopeActuals.length) return 'insufficient_data';
  if (data.completionStatus === 'in_progress') return 'partial';
  if (summary.mappedActualCoveragePercent < 50 || unresolved.length > 0 || confidence === 'low') return 'partial';
  return 'ready_for_review';
}

function analytics(comparisons: ScopeActualComparison[], unresolved: ActualMappingIssue[], suggestions: RateCalibrationSuggestion[], assumptionSuggestionList: AssumptionCalibrationSuggestion[], summary: ProjectActualSummary): FeedbackAnalyticsSummary {
  const accuracyByTrade: Record<string, number> = {};
  const quantityAccuracyByScope: Record<string, number> = {};
  const pricingAccuracyBySource: Record<string, number> = {};
  const commonVarianceCauses: Record<string, number> = {};
  for (const comparison of comparisons) {
    if (comparison.costVariancePercent != null) {
      accuracyByTrade[comparison.estimateItem.trade || 'unknown'] = Math.abs(comparison.costVariancePercent);
    }
    if (comparison.quantityVariancePercent != null) {
      quantityAccuracyByScope[comparison.scopeItemKey] = Math.abs(comparison.quantityVariancePercent);
    }
    if (comparison.rateVariancePercent != null) {
      pricingAccuracyBySource[String(comparison.estimateItem.pricingSource || 'unknown')] = Math.abs(comparison.rateVariancePercent);
    }
    const cause = comparison.varianceClassification || 'other';
    commonVarianceCauses[cause] = (commonVarianceCauses[cause] || 0) + 1;
  }
  return {
    accuracyByTrade,
    quantityAccuracyByScope,
    pricingAccuracyBySource,
    commonVarianceCauses,
    actualDataCoveragePercent: summary.mappedActualCoveragePercent,
    unresolvedMappingCount: unresolved.length,
    rateSuggestionCount: suggestions.length,
    assumptionSuggestionCount: assumptionSuggestionList.length,
  };
}

export function evaluateEstimateFeedback(input: FeedbackAlgorithmInput): EstimateFeedbackResult {
  const now = (input.now || new Date()).toISOString();
  if (!input.estimateSnapshot || !input.actualProjectData) {
    const emptySummary: ProjectActualSummary = {
      mappedActualCoveragePercent: 0,
      highConfidenceCoveragePercent: 0,
    };
    return {
      estimateId: input.estimateId,
      projectId: input.projectId,
      status: 'insufficient_data',
      scopeComparisons: [],
      projectSummary: emptySummary,
      quantityFindings: [],
      pricingFindings: [],
      formulaFindings: [],
      assumptionFindings: [],
      benchmarkFindings: [],
      rateSuggestions: [],
      assumptionSuggestions: [],
      formulaPerformance: [],
      benchmarkPerformance: [],
      unresolvedMappings: [],
      analytics: analytics([], [], [], [], emptySummary),
      confidence: 'low',
      createdAt: now,
      algorithmVersion: ESTIMATE_FEEDBACK_VERSION,
    };
  }
  const { comparisons, unresolved } = buildComparisons(input);
  const summary = projectSummary(input, comparisons);
  const { quantityFindings, pricingFindings } = findingsFor(comparisons, input);
  const suggestions = rateSuggestions(comparisons, input);
  const assumptions = assumptionSuggestions(input);
  const formulas = formulaPerformance(input);
  const benchmarks = benchmarkPerformance(comparisons, input);
  const benchmarkFindings: CalibrationFinding[] = benchmarks
    .filter((result) => result.status === 'poor_fit')
    .map((result) => ({
      key: `benchmark:${result.sourceType}:${result.scopeKey}`,
      category: 'benchmark',
      severity: 'review',
      title: 'Benchmark performance review',
      explanation: `${result.sourceType} for ${result.scopeKey} is outside tolerance across ${result.sampleCount} sample${result.sampleCount === 1 ? '' : 's'}.`,
      evidence: [],
      recommendedAction: 'Review benchmark fit before relying on it for future estimates.',
    }));
  const formulaFindings: CalibrationFinding[] = formulas
    .filter((result) => result.status !== 'performing_well' && result.status !== 'insufficient_data')
    .map((result) => ({
      key: `formula:${result.formulaKey}`,
      category: 'formula',
      severity: 'review',
      title: 'Formula performance review',
      explanation: `${result.formulaKey} shows ${result.status.replace(/_/g, ' ')}.`,
      evidence: [],
      recommendedAction: 'Review formula assumptions before changing approved formula definitions.',
    }));
  const confidence = feedbackConfidence(input.actualProjectData, summary);
  return {
    estimateId: input.estimateId,
    projectId: input.projectId,
    status: statusFor(input.actualProjectData, summary, unresolved, confidence),
    scopeComparisons: comparisons,
    projectSummary: summary,
    quantityFindings,
    pricingFindings,
    formulaFindings,
    assumptionFindings: assumptions.findings,
    benchmarkFindings,
    rateSuggestions: suggestions,
    assumptionSuggestions: assumptions.suggestions,
    formulaPerformance: formulas,
    benchmarkPerformance: benchmarks,
    unresolvedMappings: unresolved,
    analytics: analytics(comparisons, unresolved, suggestions, assumptions.suggestions, summary),
    confidence,
    createdAt: now,
    algorithmVersion: ESTIMATE_FEEDBACK_VERSION,
  };
}

export function permissionForCalibration(role: FeedbackUserRole, target: CalibrationTarget | 'assumption' | 'benchmark') {
  const mayEnterActuals = role !== 'view_only';
  const mayReviewMappings = role === 'foreman' || role === 'manager' || role === 'admin' || role === 'owner';
  const mayProposeCalibration = mayReviewMappings;
  const mayApprove =
    role === 'admin' ||
    role === 'owner' ||
    (role === 'manager' && (target === 'project_rate' || target === 'saved_rate'));
  return {
    mayEnterActuals,
    mayReviewMappings,
    mayProposeCalibration,
    mayApproveCalibration: mayApprove,
    mayViewProfitAnalysis: role === 'manager' || role === 'admin' || role === 'owner',
  };
}

export function createRateVersionFromSuggestion(params: {
  suggestion: RateCalibrationSuggestion;
  parentRateId: string;
  supersedesVersionId?: string;
  metadata: RateMetadata;
  approvedBy: string;
  approvedByRole: FeedbackUserRole;
  now?: Date;
}): RateVersion {
  const permission = permissionForCalibration(params.approvedByRole, params.suggestion.target);
  if (!permission.mayApproveCalibration) {
    throw new Error('User role cannot approve this calibration target.');
  }
  const createdAt = (params.now || new Date()).toISOString();
  return {
    versionId: `${params.parentRateId}:${ESTIMATE_FEEDBACK_VERSION}:${createdAt}`,
    parentRateId: params.parentRateId,
    value: params.suggestion.suggestedRate,
    unit: params.suggestion.unit,
    metadata: {
      ...params.metadata,
      unit: params.suggestion.unit as UnitCode,
      effectiveDate: createdAt.slice(0, 10),
      notes: [
        ...(params.metadata.notes || []),
        `Created from actual-cost calibration ${ESTIMATE_FEEDBACK_VERSION}.`,
      ],
    },
    effectiveDate: createdAt,
    supersedesVersionId: params.supersedesVersionId,
    changeReason: 'actual_cost_calibration',
    evidenceReferences: params.suggestion.evidence.map((sample) => ({
      evidenceId: sample.evidenceId,
      projectId: sample.projectId,
      estimateId: sample.estimateId,
    })),
    createdBy: params.approvedBy,
    createdAt,
  };
}

export function deriveEstimateFeedbackFromBudgetData(data: {
  projectId?: string;
  status?: string;
  lines?: Array<{ id: string; category: string; description?: string; qty?: number; unit?: string; unitCost?: number; spent?: number; markupPct?: number }>;
  expenses?: Array<{ id: string; category?: string; description?: string; vendor?: string; amount?: number; date?: string; receiptUri?: string; aiConfidence?: number; linkedLineId?: string }>;
  changeOrders?: Array<{ id: string; title?: string; amount?: number; status?: string; approved?: boolean; materialsAmount?: number; laborAmount?: number }>;
  plannedBudget?: number;
  finalCustomerPrice?: number;
}, options: { now?: Date } = {}): EstimateFeedbackResult {
  const lines = data.lines || [];
  const estimateSnapshot: EstimateSnapshot = {
    estimateId: data.projectId || 'budget-tab-estimate',
    createdAt: (options.now || new Date()).toISOString(),
    scopeItems: lines.map((line) => ({
      scopeItemKey: line.id,
      name: line.category,
      trade: line.category,
      description: line.description,
      quantity: positive(line.qty),
      unit: line.unit,
      totalDirectCost: positive(line.qty) && positive(line.unitCost) ? Number(line.qty) * Number(line.unitCost) : positive(line.unitCost),
      unitRate: positive(line.unitCost),
      pricingSource: 'saved_rate',
      rateType: 'direct_cost',
      costBasis: 'direct_cost',
    })),
    totals: {
      directCost: positive(data.plannedBudget) ?? sumDefined(...lines.map((line) => (positive(line.qty) || 1) * (positive(line.unitCost) || 0))),
      sellingPrice: positive(data.finalCustomerPrice),
    },
  };
  const actualByLine = lines.map((line) => {
    const matched = (data.expenses || []).filter((expense) => {
      if (expense.linkedLineId === line.id) return true;
      return normalizeText(expense.category) === normalizeText(line.category);
    });
    return {
      scopeItemKey: line.id,
      trade: line.category,
      description: line.description || line.category,
      totalDirectCost: matched.reduce((sum, expense) => sum + (positive(expense.amount) || 0), 0) || null,
      sourceRecords: matched.map((expense) => ({
        sourceType: expense.receiptUri ? 'supplier_receipt' : 'manual_entry',
        sourceId: expense.id,
        date: expense.date,
        vendorOrEmployee: expense.vendor,
        mappedScopeItemKeys: [line.id],
        confidence: expense.receiptUri || (expense.aiConfidence || 0) >= 0.8 ? 'high' : 'medium',
        userConfirmed: !expense.aiConfidence || expense.aiConfidence >= 0.8,
        extracted: Boolean(expense.aiConfidence),
      })) as ActualSourceReference[],
      confidence: matched.some((expense) => expense.receiptUri) ? 'high' : matched.length ? 'medium' : 'low',
    } as ActualScopeRecord;
  }).filter((record) => positive(record.totalDirectCost));
  const actualProjectData: ActualProjectData = {
    projectId: data.projectId || 'budget-tab-project',
    completionStatus: /complete|closed|done/i.test(String(data.status || '')) ? 'complete' : 'in_progress',
    scopeActuals: actualByLine,
    projectLevelActuals: {
      totalActualCost: (data.expenses || []).reduce((sum, expense) => sum + (positive(expense.amount) || 0), 0),
      finalCustomerPrice: positive(data.finalCustomerPrice) ?? undefined,
    },
    changeOrders: (data.changeOrders || []).map((co) => ({
      id: co.id,
      title: co.title || 'Change order',
      amount: positive(co.amount) || 0,
      directCost: sumDefined(co.materialsAmount, co.laborAmount),
      status: co.approved || /approved/i.test(String(co.status || '')) ? 'approved' : 'draft',
      classification: 'scope_change',
      excludeFromCalibration: true,
    })),
    dataSources: (data.expenses || []).map((expense) => ({
      sourceType: expense.receiptUri ? 'supplier_receipt' : 'manual_entry',
      sourceId: expense.id,
      date: expense.date,
      confidence: expense.receiptUri ? 'high' : 'medium',
      userConfirmed: !expense.aiConfidence || expense.aiConfidence >= 0.8,
    })),
  };
  return evaluateEstimateFeedback({
    estimateId: estimateSnapshot.estimateId,
    projectId: data.projectId,
    estimateSnapshot,
    actualProjectData,
    now: options.now,
  });
}
