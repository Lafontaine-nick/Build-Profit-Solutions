import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import type { ScopeItemIntelligence, IntelligenceSeverity } from '@/utils/scopeIntelligence';

export const ESTIMATE_READINESS_VERSION = '1.0.0';

export type EstimateReadinessStatus = 'draft' | 'preliminary' | 'budgetary' | 'bid_ready' | 'quote_backed';
export type EstimateReadinessConfidence = 'high' | 'medium' | 'low';
export type EstimateRiskCategory =
  | 'scope'
  | 'quantity'
  | 'pricing'
  | 'unit'
  | 'inclusion'
  | 'overlap'
  | 'dependency'
  | 'markup'
  | 'location'
  | 'rate_age'
  | 'minimum_charge'
  | 'other';
export type EstimateRiskMateriality = 'low' | 'medium' | 'high' | 'critical';
export type EstimateRiskResolution =
  | 'unresolved'
  | 'confirmed_as_is'
  | 'corrected'
  | 'excluded'
  | 'priced_elsewhere'
  | 'accepted_assumption'
  | 'dismissed_low_risk';

export type EstimateReviewConfirmation = {
  riskKey: string;
  resolution: EstimateRiskResolution;
  userId?: string | null;
  timestamp?: string;
  note?: string;
  previousValue?: unknown;
};

export type EstimateTotalsForReadiness = {
  subtotal?: number | null;
  markup?: number | null;
  tax?: number | null;
  contingency?: number | null;
  total?: number | null;
};

export type EstimateRisk = {
  key: string;
  category: EstimateRiskCategory;
  severity: IntelligenceSeverity;
  materiality: EstimateRiskMateriality;
  scopeItemKey?: string;
  title: string;
  explanation: string;
  recommendedAction?: string;
  estimatedValueAtRisk?: number;
  percentOfEstimate?: number;
  isResolved: boolean;
  resolutionSource?: EstimateRiskResolution;
};

export type EstimateReadinessWeights = {
  scopeCoverage: number;
  quantityReliability: number;
  pricingReliability: number;
  unitCorrectness: number;
  inclusionCompleteness: number;
  regionalRelevance: number;
  validationHealth: number;
};

export type EstimateReadinessCategoryScores = Record<keyof EstimateReadinessWeights, number>;

export type EstimateReadinessCounts = {
  totalActiveScopeItems: number;
  confirmedScopeItems: number;
  itemsNeedingReview: number;
  missingQuantities: number;
  missingPricing: number;
  aiAssumedQuantities: number;
  calculatedQuantities: number;
  userEnteredQuantities: number;
  savedRates: number;
  nationalAverages: number;
  projectQuotes: number;
  staleRates: number;
  lowRegionalRelevanceRates: number;
  scopeGaps: number;
  possibleOverlaps: number;
  unresolvedDependencies: number;
  markupRisks: number;
  minimumChargeReviews: number;
  blockingRisks: number;
};

export type EstimateReadinessSummary = {
  headline: string;
  suitableFor: string;
  notYetReadyFor?: string;
  beforeBidReady: string[];
  strongSignals: string[];
  customerFacingLabel: string;
  customerDisclaimer?: string;
};

export type EstimateReadinessSnapshot = {
  version: string;
  score: number;
  status: EstimateReadinessStatus;
  confidence: EstimateReadinessConfidence;
  categoryScores: EstimateReadinessCategoryScores;
  unresolvedRiskKeys: string[];
  resolvedRiskKeys: string[];
  counts: EstimateReadinessCounts;
  createdAt: string;
};

export type EstimateReadinessAnalyticsSummary = {
  readinessScore: number;
  status: EstimateReadinessStatus;
  unresolvedRiskCategories: Record<string, number>;
  nationalAveragePercent: number;
  savedRatePercent: number;
  projectQuotePercent: number;
  userOverrideCount: number;
  unresolvedOverlapCount: number;
  reachedBidReady: boolean;
  reachedQuoteBacked: boolean;
};

export type EstimateReadinessResult = {
  version: string;
  score: number;
  status: EstimateReadinessStatus;
  confidence: EstimateReadinessConfidence;
  categoryScores: EstimateReadinessCategoryScores;
  unresolvedRisks: EstimateRisk[];
  blockingRisks: EstimateRisk[];
  highPriorityReviews: EstimateRisk[];
  informationalReviews: EstimateRisk[];
  summary: EstimateReadinessSummary;
  counts: EstimateReadinessCounts;
  analytics: EstimateReadinessAnalyticsSummary;
  snapshot: EstimateReadinessSnapshot;
  canContinue: boolean;
  canMarkBidReady: boolean;
  canSendWithoutReview: boolean;
};

export type EstimateReadinessInput = {
  projectContext?: string | null;
  scopeItems?: ScopeItemIntelligence[];
  estimateTotals?: EstimateTotalsForReadiness;
  userConfirmations?: EstimateReviewConfirmation[];
  weights?: EstimateReadinessWeights;
  now?: Date;
};

export const DEFAULT_READINESS_WEIGHTS: EstimateReadinessWeights = {
  scopeCoverage: 0.2,
  quantityReliability: 0.2,
  pricingReliability: 0.2,
  unitCorrectness: 0.15,
  inclusionCompleteness: 0.1,
  regionalRelevance: 0.1,
  validationHealth: 0.05,
};

export const READINESS_THRESHOLDS = {
  preliminary: 40,
  budgetary: 65,
  bidReady: 85,
  quoteBacked: 92,
};

const SEVERITY_RANK: Record<IntelligenceSeverity, number> = {
  info: 1,
  review: 2,
  warning: 3,
  blocking: 4,
};

const MATERIALITY_RANK: Record<EstimateRiskMateriality, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[], fallback = 35): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function amountForPackage(pkg: EstimateDraftScopePackage): number {
  return Number(pkg.finalApprovedTotal ?? pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? pkg.aiSuggestedSubtotal ?? 0) || 0;
}

function totalFromInput(input: EstimateReadinessInput): number {
  return Number(input.estimateTotals?.total ?? input.estimateTotals?.subtotal ?? 0) || 0;
}

function riskMateriality(value: number | undefined, total: number, severity: IntelligenceSeverity): EstimateRiskMateriality {
  if (severity === 'blocking') return 'critical';
  const pct = total > 0 && value ? (value / total) * 100 : 0;
  if (pct >= 20 || severity === 'warning') return 'high';
  if (pct >= 5 || severity === 'review') return 'medium';
  return 'low';
}

function isResolvedRisk(key: string, confirmations: EstimateReviewConfirmation[]): EstimateReviewConfirmation | null {
  const confirmation = confirmations.find((item) => item.riskKey === key && item.resolution !== 'unresolved');
  if (!confirmation) return null;
  if (['dismissed_low_risk'].includes(confirmation.resolution)) return confirmation;
  return confirmation;
}

function canResolveRisk(risk: EstimateRisk, resolution?: EstimateRiskResolution): boolean {
  if (!resolution || resolution === 'unresolved') return false;
  if ((risk.materiality === 'critical' || risk.severity === 'blocking') && resolution === 'dismissed_low_risk') return false;
  return true;
}

function makeRisk(params: Omit<EstimateRisk, 'isResolved' | 'resolutionSource'>, confirmations: EstimateReviewConfirmation[]): EstimateRisk {
  const resolution = isResolvedRisk(params.key, confirmations);
  const isResolved = canResolveRisk(params as EstimateRisk, resolution?.resolution);
  return {
    ...params,
    isResolved,
    resolutionSource: isResolved ? resolution?.resolution : undefined,
  };
}

function riskSort(a: EstimateRisk, b: EstimateRisk): number {
  return (
    Number(b.severity === 'blocking') - Number(a.severity === 'blocking') ||
    MATERIALITY_RANK[b.materiality] - MATERIALITY_RANK[a.materiality] ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    (b.percentOfEstimate || 0) - (a.percentOfEstimate || 0)
  );
}

function groupRisks(risks: EstimateRisk[]): EstimateRisk[] {
  const byKey = new Map<string, EstimateRisk>();
  for (const risk of risks) {
    const root = risk.key;
    const existing = byKey.get(root);
    if (!existing || riskSort(risk, existing) < 0) {
      byKey.set(root, { ...risk, key: root });
    }
  }
  return Array.from(byKey.values()).sort(riskSort);
}

function scopeItemValue(_item: ScopeItemIntelligence, total: number): number {
  return total > 0 ? total / 10 : 0;
}

function collectScopeItemRisks(input: EstimateReadinessInput): EstimateRisk[] {
  const total = totalFromInput(input);
  const confirmations = input.userConfirmations || [];
  const risks: EstimateRisk[] = [];
  for (const item of input.scopeItems || []) {
    const value = scopeItemValue(item, total);
    const percent = total > 0 && value ? (value / total) * 100 : undefined;
    if (item.quantity.confidence === 'missing') {
      risks.push(makeRisk({
        key: `quantity_missing:${item.scopeItemKey}`,
        category: 'quantity',
        severity: 'warning',
        materiality: riskMateriality(value, total, 'warning'),
        scopeItemKey: item.scopeItemKey,
        title: 'Missing quantity',
        explanation: `${item.scopeItemKey} needs a quantity or measurement before it can be bid-ready.`,
        recommendedAction: 'Enter a measurement, accept a calculated quantity, or price as allowance.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    if (item.pricing.confidence === 'missing') {
      risks.push(makeRisk({
        key: `pricing_missing:${item.scopeItemKey}`,
        category: 'pricing',
        severity: 'warning',
        materiality: riskMateriality(value, total, 'warning'),
        scopeItemKey: item.scopeItemKey,
        title: 'Missing pricing',
        explanation: `${item.scopeItemKey} needs a selected price source.`,
        recommendedAction: 'Enter pricing, use saved pricing, or keep as scope-only draft.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    if (item.unitValidation.status === 'invalid') {
      risks.push(makeRisk({
        key: `unit_invalid:${item.scopeItemKey}`,
        category: 'unit',
        severity: 'blocking',
        materiality: 'critical',
        scopeItemKey: item.scopeItemKey,
        title: 'Invalid unit',
        explanation: `${item.scopeItemKey} uses an incompatible unit.`,
        recommendedAction: 'Correct the unit or use a compatible pricing basis.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    } else if (item.unitValidation.status === 'review') {
      risks.push(makeRisk({
        key: `unit_review:${item.scopeItemKey}`,
        category: 'unit',
        severity: 'review',
        materiality: riskMateriality(value, total, 'review'),
        scopeItemKey: item.scopeItemKey,
        title: 'Unit needs review',
        explanation: `${item.scopeItemKey} unit should be confirmed.`,
        recommendedAction: 'Review measurement and pricing unit.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    for (const gap of item.scopeGaps || []) {
      risks.push(makeRisk({
        key: `scope_gap:${gap.scopeGroupKey}`,
        category: 'scope',
        severity: gap.severity,
        materiality: gap.severity === 'warning' ? 'high' : 'medium',
        title: gap.label,
        explanation: gap.message,
        recommendedAction: 'Confirm excluded, add scope, or price elsewhere.',
      }, confirmations));
    }
    for (const overlap of item.overlaps || []) {
      risks.push(makeRisk({
        key: `overlap:${overlap.key}`,
        category: 'overlap',
        severity: overlap.severity,
        materiality: overlap.severity === 'warning' ? 'high' : 'medium',
        scopeItemKey: item.scopeItemKey,
        title: 'Possible overlap',
        explanation: overlap.message,
        recommendedAction: overlap.resolutionOptions[0],
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    for (const dependency of item.dependencies || []) {
      risks.push(makeRisk({
        key: `dependency:${dependency.key}`,
        category: 'dependency',
        severity: dependency.severity,
        materiality: dependency.severity === 'warning' ? 'high' : 'medium',
        scopeItemKey: item.scopeItemKey,
        title: dependency.label,
        explanation: dependency.message,
        recommendedAction: 'Confirm existing conditions or price supporting scope.',
      }, confirmations));
    }
    const pricing = item.pricingCompleteness;
    if (pricing?.minimumCharge?.status === 'review') {
      risks.push(makeRisk({
        key: `minimum_charge:${item.scopeItemKey}`,
        category: 'minimum_charge',
        severity: 'review',
        materiality: riskMateriality(value, total, 'review'),
        scopeItemKey: item.scopeItemKey,
        title: 'Minimum charge may apply',
        explanation: `Saved minimum charge may exceed the unit calculation for ${item.scopeItemKey}.`,
        recommendedAction: 'Use calculated amount, accept minimum, or edit pricing.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    if (pricing?.dateRelevance?.status === 'stale' || pricing?.dateRelevance?.status === 'expired') {
      risks.push(makeRisk({
        key: `rate_age:${item.scopeItemKey}`,
        category: 'rate_age',
        severity: 'review',
        materiality: riskMateriality(value, total, 'review'),
        scopeItemKey: item.scopeItemKey,
        title: 'Rate age review',
        explanation: pricing.dateRelevance.message,
        recommendedAction: 'Confirm or update this rate.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    if (pricing?.regionalRelevance?.overall === 'low') {
      risks.push(makeRisk({
        key: `location:${item.scopeItemKey}`,
        category: 'location',
        severity: 'review',
        materiality: riskMateriality(value, total, 'review'),
        scopeItemKey: item.scopeItemKey,
        title: 'Rate location review',
        explanation: 'Selected pricing has low regional relevance.',
        recommendedAction: 'Confirm local relevance or keep as budgetary fallback.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
    if (pricing?.markupRisk?.risk === 'review' || pricing?.markupRisk?.risk === 'warning') {
      risks.push(makeRisk({
        key: `markup:${item.scopeItemKey}`,
        category: 'markup',
        severity: pricing.markupRisk.risk === 'warning' ? 'warning' : 'review',
        materiality: pricing.markupRisk.risk === 'warning' ? 'high' : 'medium',
        scopeItemKey: item.scopeItemKey,
        title: 'Markup treatment review',
        explanation: pricing.markupRisk.notices[0]?.message || 'Markup treatment needs confirmation.',
        recommendedAction: 'Confirm direct cost versus selling price.',
        estimatedValueAtRisk: value,
        percentOfEstimate: percent,
      }, confirmations));
    }
  }
  return groupRisks(risks);
}

function scoreConfidence(value: 'high' | 'medium' | 'low' | 'missing' | undefined): number {
  if (value === 'high') return 100;
  if (value === 'medium') return 75;
  if (value === 'low') return 45;
  return 15;
}

function calculateCategoryScores(scopeItems: ScopeItemIntelligence[], risks: EstimateRisk[], projectContext?: string | null): EstimateReadinessCategoryScores {
  const noItemsFallback = scopeItems.length ? undefined : 25;
  const scopeCoverage = clampScore(
    average(scopeItems.map((item) => {
      let score = 90;
      score -= (item.scopeGaps?.length || 0) * 18;
      score -= (item.dependencies?.length || 0) * 10;
      if (item.assembly?.completeness === 'incomplete') score -= 25;
      if (item.assembly?.completeness === 'unknown') score -= 10;
      return score;
    }), noItemsFallback ?? (projectContext ? 70 : 45))
  );
  const quantityReliability = clampScore(average(scopeItems.map((item) => {
    let score = scoreConfidence(item.quantity.confidence);
    if (item.formula?.confidence === 'high') score = Math.max(score, 85);
    if (item.formula?.confidence === 'medium') score = Math.max(score, 70);
    if (item.missingMeasurements.length) score -= 20;
    if (item.measurementRelationship.type === 'incompatible') score -= 30;
    return score;
  }), 30));
  const pricingReliability = clampScore(average(scopeItems.map((item) => {
    let score = scoreConfidence(item.pricing.confidence);
    if (item.pricingCompleteness?.confidence) score = Math.min(score, scoreConfidence(item.pricingCompleteness.confidence));
    if (item.pricing.source === 'project_quote') score = Math.max(score, 90);
    if (item.pricing.source === 'national_average') score = Math.min(score, 45);
    return score;
  }), 25));
  const unitCorrectness = clampScore(average(scopeItems.map((item) => {
    if (item.unitValidation.status === 'valid') return 95;
    if (item.unitValidation.status === 'unknown') return 60;
    if (item.unitValidation.status === 'review') return 50;
    return 5;
  }), 45));
  const inclusionCompleteness = clampScore(average(scopeItems.map((item) => {
    let score = scoreConfidence(item.assembly?.confidence);
    if (item.assembly?.completeness === 'complete') score = Math.max(score, 90);
    if (item.assembly?.completeness === 'incomplete') score = Math.min(score, 40);
    if (item.overlaps.length) score -= 15;
    if (item.pricingCompleteness?.status === 'incomplete') score -= 15;
    return score;
  }), 35));
  const regionalRelevance = clampScore(average(scopeItems.map((item) => {
    const pricing = item.pricingCompleteness;
    if (pricing?.regionalRelevance?.dimensions.regionalMatch === 'high') return 95;
    if (pricing?.regionalRelevance?.dimensions.regionalMatch === 'medium') return 75;
    if (pricing?.regionalRelevance?.dimensions.regionalMatch === 'low') return 35;
    if (pricing?.dateRelevance?.status === 'stale' || pricing?.dateRelevance?.status === 'expired') return 35;
    return pricing ? 55 : 35;
  }), 35));
  const validationHealth = clampScore(100 - risks.reduce((sum, risk) => {
    if (risk.isResolved) return sum;
    if (risk.severity === 'blocking') return sum + 45;
    if (risk.severity === 'warning') return sum + 20;
    if (risk.severity === 'review') return sum + 8;
    return sum + 1;
  }, 0));
  return {
    scopeCoverage,
    quantityReliability,
    pricingReliability,
    unitCorrectness,
    inclusionCompleteness,
    regionalRelevance,
    validationHealth,
  };
}

function weightedScore(scores: EstimateReadinessCategoryScores, weights: EstimateReadinessWeights): number {
  return clampScore(
    Object.entries(weights).reduce((sum, [key, weight]) => sum + scores[key as keyof EstimateReadinessWeights] * weight, 0)
  );
}

function countsFor(scopeItems: ScopeItemIntelligence[], risks: EstimateRisk[]): EstimateReadinessCounts {
  return {
    totalActiveScopeItems: scopeItems.length,
    confirmedScopeItems: scopeItems.filter((item) => item.quantity.confidence === 'high' && item.pricing.confidence !== 'missing').length,
    itemsNeedingReview: scopeItems.filter((item) => item.validation.status === 'review_required').length,
    missingQuantities: scopeItems.filter((item) => item.quantity.confidence === 'missing').length,
    missingPricing: scopeItems.filter((item) => item.pricing.confidence === 'missing').length,
    aiAssumedQuantities: scopeItems.filter((item) => item.quantity.source === 'benchmark_estimate' || item.quantity.source === 'calculated_assumption').length,
    calculatedQuantities: scopeItems.filter((item) => item.quantity.source === 'calculated_confirmed' || Boolean(item.formula)).length,
    userEnteredQuantities: scopeItems.filter((item) => item.quantity.source === 'user_entered' || item.quantity.source === 'manual_override').length,
    savedRates: scopeItems.filter((item) => item.pricing.source === 'saved_rate' || item.pricing.source === 'company_rate').length,
    nationalAverages: scopeItems.filter((item) => item.pricing.source === 'national_average').length,
    projectQuotes: scopeItems.filter((item) => item.pricing.source === 'project_quote').length,
    staleRates: scopeItems.filter((item) => item.pricingCompleteness?.dateRelevance?.status === 'stale' || item.pricingCompleteness?.dateRelevance?.status === 'expired').length,
    lowRegionalRelevanceRates: scopeItems.filter((item) => item.pricingCompleteness?.regionalRelevance?.overall === 'low').length,
    scopeGaps: scopeItems.reduce((sum, item) => sum + item.scopeGaps.length, 0),
    possibleOverlaps: scopeItems.reduce((sum, item) => sum + item.overlaps.length, 0),
    unresolvedDependencies: scopeItems.reduce((sum, item) => sum + item.dependencies.length, 0),
    markupRisks: risks.filter((risk) => risk.category === 'markup' && !risk.isResolved).length,
    minimumChargeReviews: risks.filter((risk) => risk.category === 'minimum_charge' && !risk.isResolved).length,
    blockingRisks: risks.filter((risk) => risk.severity === 'blocking' && !risk.isResolved).length,
  };
}

function statusFor(params: {
  score: number;
  risks: EstimateRisk[];
  counts: EstimateReadinessCounts;
  totals?: EstimateTotalsForReadiness;
  scopeItems: ScopeItemIntelligence[];
}): EstimateReadinessStatus {
  const unresolved = params.risks.filter((risk) => !risk.isResolved);
  const blocking = unresolved.some((risk) => risk.severity === 'blocking');
  const critical = unresolved.some((risk) => risk.materiality === 'critical');
  const high = unresolved.some((risk) => risk.materiality === 'high');
  const invalidTotal = Number(params.totals?.total ?? params.totals?.subtotal ?? 0) <= 0;
  const quoteValue = params.scopeItems.filter((item) => item.pricing.source === 'project_quote').length;
  const quoteRatio = params.scopeItems.length ? quoteValue / params.scopeItems.length : 0;
  if (invalidTotal || params.score < READINESS_THRESHOLDS.preliminary || params.counts.missingPricing > 0 || params.counts.missingQuantities > 0) return 'draft';
  if (params.score < READINESS_THRESHOLDS.budgetary || blocking || critical) return 'preliminary';
  if (params.score < READINESS_THRESHOLDS.bidReady || high || params.counts.scopeGaps > 0) return 'budgetary';
  if (blocking || critical || params.counts.possibleOverlaps > 0 || params.counts.markupRisks > 0) return 'budgetary';
  if (params.score >= READINESS_THRESHOLDS.quoteBacked && quoteRatio >= 0.6) return 'quote_backed';
  return 'bid_ready';
}

function confidenceFor(score: number, unresolved: EstimateRisk[]): EstimateReadinessConfidence {
  if (unresolved.some((risk) => risk.severity === 'blocking' || risk.materiality === 'critical')) return 'low';
  if (score >= READINESS_THRESHOLDS.bidReady && !unresolved.some((risk) => risk.materiality === 'high')) return 'high';
  if (score >= READINESS_THRESHOLDS.budgetary) return 'medium';
  return 'low';
}

function summaryFor(status: EstimateReadinessStatus, score: number, unresolved: EstimateRisk[], counts: EstimateReadinessCounts): EstimateReadinessSummary {
  const label: Record<EstimateReadinessStatus, string> = {
    draft: 'Draft estimate',
    preliminary: 'Preliminary estimate',
    budgetary: 'Budgetary estimate',
    bid_ready: 'Bid estimate',
    quote_backed: 'Quote-backed estimate',
  };
  const suitableFor: Record<EstimateReadinessStatus, string> = {
    draft: 'Saving work in progress',
    preliminary: 'Internal planning',
    budgetary: 'Early customer budgeting',
    bid_ready: 'Bid review and proposal preparation',
    quote_backed: 'Customer proposal with quote support',
  };
  const beforeBidReady = unresolved
    .filter((risk) => risk.severity !== 'info')
    .slice(0, 5)
    .map((risk) => risk.recommendedAction || risk.title);
  const strongSignals: string[] = [];
  if (counts.userEnteredQuantities > 0) strongSignals.push(`${counts.userEnteredQuantities} user-entered quantities`);
  if (counts.calculatedQuantities > 0) strongSignals.push(`${counts.calculatedQuantities} calculated/formula-supported quantities`);
  if (counts.savedRates > 0) strongSignals.push(`${counts.savedRates} saved/company rates selected`);
  if (counts.projectQuotes > 0) strongSignals.push(`${counts.projectQuotes} project quote-backed rates`);
  if (counts.blockingRisks === 0) strongSignals.push('No blocking validation errors');
  return {
    headline: `${score}% - ${label[status].replace(' estimate', '')}`,
    suitableFor: suitableFor[status],
    notYetReadyFor: status === 'draft' || status === 'preliminary' || status === 'budgetary' ? 'Final bid or contract' : undefined,
    beforeBidReady,
    strongSignals,
    customerFacingLabel: label[status],
    customerDisclaimer:
      status === 'draft' || status === 'preliminary' || status === 'budgetary'
        ? 'This estimate contains allowances, assumptions, or benchmark pricing that should be confirmed before contract execution.'
        : undefined,
  };
}

function analyticsFor(score: number, status: EstimateReadinessStatus, unresolved: EstimateRisk[], counts: EstimateReadinessCounts): EstimateReadinessAnalyticsSummary {
  const categories: Record<string, number> = {};
  for (const risk of unresolved) {
    categories[risk.category] = (categories[risk.category] || 0) + 1;
  }
  const totalRates = Math.max(1, counts.savedRates + counts.nationalAverages + counts.projectQuotes);
  return {
    readinessScore: score,
    status,
    unresolvedRiskCategories: categories,
    nationalAveragePercent: Math.round((counts.nationalAverages / totalRates) * 100),
    savedRatePercent: Math.round((counts.savedRates / totalRates) * 100),
    projectQuotePercent: Math.round((counts.projectQuotes / totalRates) * 100),
    userOverrideCount: counts.userEnteredQuantities,
    unresolvedOverlapCount: counts.possibleOverlaps,
    reachedBidReady: status === 'bid_ready' || status === 'quote_backed',
    reachedQuoteBacked: status === 'quote_backed',
  };
}

export function evaluateEstimateReadiness(input: EstimateReadinessInput): EstimateReadinessResult {
  const scopeItems = input.scopeItems || [];
  const weights = input.weights || DEFAULT_READINESS_WEIGHTS;
  const rawRisks = collectScopeItemRisks(input);
  const unresolvedRisks = rawRisks.filter((risk) => !risk.isResolved).sort(riskSort);
  const categoryScores = calculateCategoryScores(scopeItems, rawRisks, input.projectContext);
  const score = weightedScore(categoryScores, weights);
  const counts = countsFor(scopeItems, rawRisks);
  const status = statusFor({
    score,
    risks: rawRisks,
    counts,
    totals: input.estimateTotals,
    scopeItems,
  });
  const confidence = confidenceFor(score, unresolvedRisks);
  const summary = summaryFor(status, score, unresolvedRisks, counts);
  const blockingRisks = unresolvedRisks.filter((risk) => risk.severity === 'blocking');
  const highPriorityReviews = unresolvedRisks.filter((risk) => risk.materiality === 'critical' || risk.materiality === 'high' || risk.severity === 'warning');
  const informationalReviews = unresolvedRisks.filter((risk) => risk.severity === 'info' || risk.materiality === 'low');
  const snapshot: EstimateReadinessSnapshot = {
    version: ESTIMATE_READINESS_VERSION,
    score,
    status,
    confidence,
    categoryScores,
    unresolvedRiskKeys: unresolvedRisks.map((risk) => risk.key),
    resolvedRiskKeys: rawRisks.filter((risk) => risk.isResolved).map((risk) => risk.key),
    counts,
    createdAt: (input.now || new Date()).toISOString(),
  };
  return {
    version: ESTIMATE_READINESS_VERSION,
    score,
    status,
    confidence,
    categoryScores,
    unresolvedRisks,
    blockingRisks,
    highPriorityReviews,
    informationalReviews,
    summary,
    counts,
    analytics: analyticsFor(score, status, unresolvedRisks, counts),
    snapshot,
    canContinue: true,
    canMarkBidReady: status === 'bid_ready' || status === 'quote_backed',
    canSendWithoutReview: status === 'bid_ready' || status === 'quote_backed',
  };
}

function riskFromDraftPackage(pkg: EstimateDraftScopePackage, total: number, confirmations: EstimateReviewConfirmation[]): EstimateRisk[] {
  const amount = amountForPackage(pkg);
  const pct = total > 0 && amount > 0 ? (amount / total) * 100 : undefined;
  const risks: EstimateRisk[] = [];
  if (amount <= 0 || pkg.status === 'missing_price') {
    risks.push(makeRisk({
      key: `pricing_missing:${pkg.name}`,
      category: 'pricing',
      severity: 'warning',
      materiality: riskMateriality(amount || total * 0.1, total, 'warning'),
      scopeItemKey: pkg.name,
      title: 'Missing pricing',
      explanation: `${pkg.name} needs pricing before the estimate can be bid-ready.`,
      recommendedAction: `Add pricing for ${pkg.name}.`,
      estimatedValueAtRisk: amount,
      percentOfEstimate: pct,
    }, confirmations));
  }
  if (pkg.status === 'rough_price' || pkg.status === 'ai_suggested') {
    risks.push(makeRisk({
      key: `pricing_rough:${pkg.name}`,
      category: 'pricing',
      severity: 'review',
      materiality: riskMateriality(amount, total, 'review'),
      scopeItemKey: pkg.name,
      title: 'Benchmark or rough pricing',
      explanation: `${pkg.name} uses rough or suggested pricing.`,
      recommendedAction: 'Confirm saved, local, or project-specific pricing.',
      estimatedValueAtRisk: amount,
      percentOfEstimate: pct,
    }, confirmations));
  }
  return risks;
}

export function evaluateDraftReadiness(draft: EstimateAiDraft | null, options: {
  markupPct?: number | null;
  userConfirmations?: EstimateReviewConfirmation[];
  now?: Date;
} = {}): EstimateReadinessResult {
  if (!draft) {
    return evaluateEstimateReadiness({
      scopeItems: [],
      estimateTotals: { subtotal: 0, total: 0 },
      userConfirmations: options.userConfirmations,
      now: options.now,
    });
  }
  const packages = draft.scopePackages || [];
  const subtotal =
    Number(draft.calculatedLineItemTotal ?? draft.knownSubtotal ?? draft.calculatedTotal ?? 0) ||
    packages.reduce((sum, pkg) => sum + amountForPackage(pkg), 0);
  const markupPct = Math.max(0, Number(options.markupPct ?? 0) || 0);
  const total = subtotal > 0 ? subtotal * (1 + markupPct / 100) : 0;
  const confirmations = options.userConfirmations || [];
  const rawRisks = groupRisks(packages.flatMap((pkg) => riskFromDraftPackage(pkg, total, confirmations)));
  const baseScore = packages.length
    ? clampScore(100 - rawRisks.filter((risk) => !risk.isResolved).length * 12 - (draft.missingInfo?.length || 0) * 6)
    : 25;
  const categoryScores: EstimateReadinessCategoryScores = {
    scopeCoverage: draft.scopeAssumptionsConfirmed ? Math.max(65, baseScore) : Math.min(60, baseScore),
    quantityReliability: draft.scopeMeasurements ? Math.max(65, baseScore) : Math.min(55, baseScore),
    pricingReliability: packages.some((pkg) => amountForPackage(pkg) > 0) ? baseScore : 20,
    unitCorrectness: 75,
    inclusionCompleteness: draft.scopeAssumptionsConfirmed ? 70 : 45,
    regionalRelevance: 45,
    validationHealth: clampScore(100 - rawRisks.length * 15),
  };
  const score = weightedScore(categoryScores, DEFAULT_READINESS_WEIGHTS);
  const counts: EstimateReadinessCounts = {
    totalActiveScopeItems: packages.length,
    confirmedScopeItems: packages.filter((pkg) => amountForPackage(pkg) > 0 && ['confirmed', 'user_provided'].includes(pkg.status)).length,
    itemsNeedingReview: packages.filter((pkg) => ['needs_review', 'rough_price', 'ai_suggested', 'partial_pricing'].includes(pkg.status)).length,
    missingQuantities: 0,
    missingPricing: packages.filter((pkg) => amountForPackage(pkg) <= 0 || pkg.status === 'missing_price').length,
    aiAssumedQuantities: 0,
    calculatedQuantities: packages.filter((pkg) => pkg.status === 'calculated').length,
    userEnteredQuantities: packages.filter((pkg) => pkg.priceProvidedByUser).length,
    savedRates: packages.filter((pkg) => /saved|template/i.test(pkg.priceSource || '')).length,
    nationalAverages: packages.filter((pkg) => /national|rough|ai/i.test(pkg.priceSource || '')).length,
    projectQuotes: packages.filter((pkg) => /quote|notes|user/i.test(pkg.priceSource || '')).length,
    staleRates: 0,
    lowRegionalRelevanceRates: 0,
    scopeGaps: 0,
    possibleOverlaps: 0,
    unresolvedDependencies: 0,
    markupRisks: 0,
    minimumChargeReviews: 0,
    blockingRisks: 0,
  };
  const unresolvedRisks = rawRisks.filter((risk) => !risk.isResolved).sort(riskSort);
  const status = statusFor({
    score,
    risks: rawRisks,
    counts,
    totals: { subtotal, total },
    scopeItems: [],
  });
  const confidence = confidenceFor(score, unresolvedRisks);
  const summary = summaryFor(status, score, unresolvedRisks, counts);
  const snapshot: EstimateReadinessSnapshot = {
    version: ESTIMATE_READINESS_VERSION,
    score,
    status,
    confidence,
    categoryScores,
    unresolvedRiskKeys: unresolvedRisks.map((risk) => risk.key),
    resolvedRiskKeys: rawRisks.filter((risk) => risk.isResolved).map((risk) => risk.key),
    counts,
    createdAt: (options.now || new Date()).toISOString(),
  };
  return {
    version: ESTIMATE_READINESS_VERSION,
    score,
    status,
    confidence,
    categoryScores,
    unresolvedRisks,
    blockingRisks: unresolvedRisks.filter((risk) => risk.severity === 'blocking'),
    highPriorityReviews: unresolvedRisks.filter((risk) => risk.materiality === 'critical' || risk.materiality === 'high' || risk.severity === 'warning'),
    informationalReviews: unresolvedRisks.filter((risk) => risk.severity === 'info' || risk.materiality === 'low'),
    summary,
    counts,
    analytics: analyticsFor(score, status, unresolvedRisks, counts),
    snapshot,
    canContinue: true,
    canMarkBidReady: status === 'bid_ready' || status === 'quote_backed',
    canSendWithoutReview: status === 'bid_ready' || status === 'quote_backed',
  };
}
