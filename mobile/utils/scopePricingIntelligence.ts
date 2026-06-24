import type { IntelligenceConfidence, IntelligenceSeverity, PricingSourceKind, ScopeValidationNotice, UnitCode } from '@/utils/scopeIntelligence';
import type { ResolvedItemQuantity, SuggestedPricingBlock } from '@/utils/scopeItemQuantities';

export type RateType =
  | 'material_only'
  | 'labor_only'
  | 'equipment_only'
  | 'subcontractor'
  | 'installed_unit_rate'
  | 'direct_cost'
  | 'selling_price'
  | 'lump_sum'
  | 'allowance'
  | 'project_quote'
  | 'unknown';

export type RateMetadata = {
  rateId?: string;
  scopeKey?: string;
  trade?: string;
  rateType?: RateType;
  unit?: UnitCode;
  region?: {
    country?: string;
    state?: string;
    metro?: string;
    zipCode?: string;
    marketLabel?: string;
  };
  projectContext?: string[];
  buildingTypes?: string[];
  finishLevels?: string[];
  materialSpecifications?: string[];
  originalQuantity?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  minimumCharge?: number;
  mobilizationCharge?: number;
  tripCharge?: number;
  deliveryCharge?: number;
  materialIncluded?: boolean;
  laborIncluded?: boolean;
  equipmentIncluded?: boolean;
  subcontractorIncluded?: boolean;
  wasteIncluded?: boolean;
  taxIncluded?: boolean;
  deliveryIncluded?: boolean;
  mobilizationIncluded?: boolean;
  cleanupIncluded?: boolean;
  overheadIncluded?: boolean;
  profitIncluded?: boolean;
  contingencyIncluded?: boolean;
  permitIncluded?: boolean;
  markupPercentIncluded?: number;
  marginPercentIncluded?: number;
  effectiveDate?: string;
  expirationDate?: string;
  lastConfirmedAt?: string;
  lastUsedAt?: string;
  source?: RateMetadataSource;
  sourceReference?: string;
  notes?: string[];
};

export type RateMetadataSource =
  | 'project_quote'
  | 'user_entered'
  | 'saved_rate'
  | 'company_rate'
  | 'supplier'
  | 'subcontractor'
  | 'localized_benchmark'
  | 'national_average'
  | 'allowance'
  | 'unknown';

export type RelevanceLevel = 'high' | 'medium' | 'low' | 'unknown';
export type RateAgeStatus = 'current' | 'aging' | 'stale' | 'expired' | 'unknown';
export type QuantityScaleStatus = 'matched' | 'small_job_review' | 'large_job_review' | 'outside_saved_range' | 'unknown';
export type MinimumChargeStatus = 'not_applicable' | 'review' | 'confirmed' | 'unknown';
export type PricingCompletenessStatus = 'complete' | 'mostly_complete' | 'incomplete' | 'unknown';
export type CostComponentKey =
  | 'material'
  | 'labor'
  | 'equipment'
  | 'subcontractor'
  | 'tax'
  | 'delivery'
  | 'mobilization'
  | 'cleanup'
  | 'overhead'
  | 'profit'
  | 'contingency'
  | 'permit';

export type ProjectLocation = {
  country?: string;
  state?: string;
  metro?: string;
  zipCode?: string;
  marketLabel?: string;
};

export type RateRelevanceResult = {
  overall: RelevanceLevel;
  dimensions: {
    unitMatch: RelevanceLevel;
    scopeMatch: RelevanceLevel;
    projectContextMatch: RelevanceLevel;
    regionalMatch: RelevanceLevel;
    dateRelevance: RelevanceLevel;
    quantityScaleMatch: RelevanceLevel;
    inclusionMatch: RelevanceLevel;
  };
  notices: ScopeValidationNotice[];
};

export type RateAgeResult = {
  status: RateAgeStatus;
  ageMonths?: number;
  thresholdMonths?: number;
  message: string;
};

export type QuantityScaleResult = {
  status: QuantityScaleStatus;
  currentQuantity?: number;
  originalQuantity?: number;
  minimumQuantity?: number;
  maximumQuantity?: number;
  message: string;
};

export type MinimumChargeEvaluation = {
  applies: boolean;
  chargeType?:
    | 'labor_minimum'
    | 'service_call'
    | 'mobilization'
    | 'short_load'
    | 'delivery'
    | 'equipment_minimum'
    | 'subcontractor_minimum'
    | 'project_minimum';
  calculatedUnitTotal?: number;
  minimumCharge?: number;
  recommendedWorkingTotal?: number;
  status: MinimumChargeStatus;
};

export type MarkupRiskResult = {
  risk: 'none' | 'review' | 'warning' | 'unknown';
  notices: ScopeValidationNotice[];
};

export type PricingCompletenessResult = {
  status: PricingCompletenessStatus;
  rateType: RateType;
  includedCostComponents: CostComponentKey[];
  missingCostComponents: CostComponentKey[];
  unknownCostComponents: CostComponentKey[];
  minimumCharge?: MinimumChargeEvaluation;
  regionalRelevance?: RateRelevanceResult;
  dateRelevance?: RateAgeResult;
  quantityScale?: QuantityScaleResult;
  markupRisk?: MarkupRiskResult;
  confidence: IntelligenceConfidence;
  notices: ScopeValidationNotice[];
};

export type EstimatePricingReviewResult = {
  pricingReadiness: number;
  projectQuoteCount: number;
  userEnteredCount: number;
  savedRateCount: number;
  localizedRateCount: number;
  nationalAverageCount: number;
  staleRateCount: number;
  unknownMarkupCount: number;
  minimumChargeIssueCount: number;
  incompletePriceDefinitionCount: number;
  markupDuplicationRiskCount: number;
};

const COST_COMPONENTS: CostComponentKey[] = [
  'material',
  'labor',
  'equipment',
  'subcontractor',
  'tax',
  'delivery',
  'mobilization',
  'cleanup',
  'overhead',
  'profit',
  'contingency',
  'permit',
];

const VOLATILE_TRADES = new Set(['concrete', 'roofing', 'flooring', 'lumber', 'framing', 'fuel', 'sitework']);
const PERMIT_SCOPES = new Set(['permits', 'plans_engineering', 'utility_coordination']);
const SERVICE_SCOPES = new Set(['plumbing_trim', 'sink_faucet', 'toilet', 'vanity', 'electrical_trim', 'lighting', 'hvac_startup']);

function notice(ruleKey: string, severity: IntelligenceSeverity, title: string, message: string, recommendedResolution?: string): ScopeValidationNotice {
  return {
    ruleKey,
    severity,
    title,
    message,
    recommendedResolution,
    pricingMayContinue: true,
  };
}

function sourceFromPricingKind(source: PricingSourceKind): RateMetadataSource {
  if (source === 'local_average') return 'localized_benchmark';
  if (source === 'parsed_from_notes') return 'project_quote';
  if (source === 'manual_pricing_required') return 'unknown';
  return source;
}

export function classifyRateType(params: {
  metadata?: RateMetadata | null;
  pricingSource?: PricingSourceKind;
  suggestedPricing?: SuggestedPricingBlock | null;
  resolved?: ResolvedItemQuantity | null;
}): RateType {
  if (params.metadata?.rateType) return params.metadata.rateType;
  if (params.pricingSource === 'allowance' || params.suggestedPricing?.lumpSumOnly || params.resolved?.unit === 'allowance') return 'allowance';
  if (params.resolved?.unit === 'lump_sum') return 'lump_sum';
  if (params.pricingSource === 'project_quote' || params.pricingSource === 'parsed_from_notes') return 'project_quote';
  const block = params.suggestedPricing;
  if (block) {
    if (block.material > 0 && block.labor > 0) return 'installed_unit_rate';
    if (block.material > 0) return 'material_only';
    if (block.labor > 0) return 'labor_only';
  }
  return 'unknown';
}

function unitRelevance(metadata: RateMetadata | null | undefined, selectedUnit?: string | null): RelevanceLevel {
  if (!metadata?.unit || !selectedUnit) return 'unknown';
  return String(metadata.unit).toLowerCase() === String(selectedUnit).toLowerCase() ? 'high' : 'low';
}

function scopeRelevance(metadata: RateMetadata | null | undefined, scopeKey: string): RelevanceLevel {
  if (!metadata?.scopeKey) return 'unknown';
  return metadata.scopeKey === scopeKey ? 'high' : 'low';
}

function projectContextRelevance(metadata: RateMetadata | null | undefined, projectContext?: string | null): RelevanceLevel {
  if (!metadata?.projectContext?.length || !projectContext) return 'unknown';
  return metadata.projectContext.includes(projectContext) ? 'high' : 'medium';
}

export function evaluateRegionalRelevance(params: {
  metadata?: RateMetadata | null;
  pricingSource?: PricingSourceKind;
  projectLocation?: ProjectLocation | null;
}): RelevanceLevel {
  const rateRegion = params.metadata?.region;
  const project = params.projectLocation;
  if (params.pricingSource === 'national_average' || params.metadata?.source === 'national_average') return 'low';
  if (!rateRegion || !project) return 'unknown';
  if (rateRegion.zipCode && project.zipCode && rateRegion.zipCode === project.zipCode) return 'high';
  if (rateRegion.metro && project.metro && rateRegion.metro.toLowerCase() === project.metro.toLowerCase()) return 'high';
  if (rateRegion.marketLabel && project.marketLabel && rateRegion.marketLabel.toLowerCase() === project.marketLabel.toLowerCase()) return 'high';
  if (rateRegion.state && project.state && rateRegion.state.toLowerCase() === project.state.toLowerCase()) return 'medium';
  if (rateRegion.state && project.state && rateRegion.state.toLowerCase() !== project.state.toLowerCase()) return 'low';
  return 'unknown';
}

function monthsSince(dateText?: string | null, now = new Date()): number | null {
  if (!dateText) return null;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
}

function ageThresholdMonths(scopeKey: string, trade: string | undefined, source: RateMetadataSource | undefined): number {
  if (source === 'project_quote' || source === 'supplier' || source === 'subcontractor') return 3;
  if (PERMIT_SCOPES.has(scopeKey)) return 12;
  if (VOLATILE_TRADES.has(scopeKey) || (trade && VOLATILE_TRADES.has(trade))) return 6;
  if (source === 'company_rate' || source === 'user_entered') return 18;
  return 12;
}

export function evaluateRateAge(params: {
  scopeKey: string;
  trade?: string;
  metadata?: RateMetadata | null;
  pricingSource?: PricingSourceKind;
  now?: Date;
}): RateAgeResult {
  const source = params.metadata?.source || sourceFromPricingKind(params.pricingSource || 'unknown');
  const expirationAge = monthsSince(params.metadata?.expirationDate, params.now);
  if (expirationAge != null && expirationAge > 0) {
    return { status: 'expired', message: 'Quote or rate expiration date has passed.' };
  }
  const age = monthsSince(params.metadata?.lastConfirmedAt || params.metadata?.effectiveDate || params.metadata?.lastUsedAt, params.now);
  if (age == null) return { status: 'unknown', message: 'Rate effective date is unknown.' };
  const threshold = ageThresholdMonths(params.scopeKey, params.trade, source);
  if (age <= threshold) return { status: 'current', ageMonths: Math.round(age), thresholdMonths: threshold, message: 'Rate is current for this source and trade.' };
  if (age <= threshold * 2) return { status: 'aging', ageMonths: Math.round(age), thresholdMonths: threshold, message: `Rate was last confirmed ${Math.round(age)} months ago.` };
  return { status: 'stale', ageMonths: Math.round(age), thresholdMonths: threshold, message: `Rate is stale: last confirmed ${Math.round(age)} months ago.` };
}

export function evaluateQuantityScale(params: {
  currentQuantity?: number | null;
  metadata?: RateMetadata | null;
}): QuantityScaleResult {
  const current = params.currentQuantity ?? null;
  const original = params.metadata?.originalQuantity;
  const min = params.metadata?.minimumQuantity;
  const max = params.metadata?.maximumQuantity;
  if (!current || current <= 0) return { status: 'unknown', message: 'Current quantity is unavailable.' };
  if (min && current < min) return { status: 'outside_saved_range', currentQuantity: current, originalQuantity: original, minimumQuantity: min, maximumQuantity: max, message: 'Current quantity is below the saved rate range.' };
  if (max && current > max) return { status: 'outside_saved_range', currentQuantity: current, originalQuantity: original, minimumQuantity: min, maximumQuantity: max, message: 'Current quantity is above the saved rate range.' };
  if (!original || original <= 0) return { status: 'unknown', currentQuantity: current, minimumQuantity: min, maximumQuantity: max, message: 'Saved-rate quantity basis is unknown.' };
  if (current < original * 0.25) return { status: 'small_job_review', currentQuantity: current, originalQuantity: original, minimumQuantity: min, maximumQuantity: max, message: 'Current quantity is much smaller than the saved-rate job.' };
  if (current > original * 3) return { status: 'large_job_review', currentQuantity: current, originalQuantity: original, minimumQuantity: min, maximumQuantity: max, message: 'Current quantity is much larger than the saved-rate job.' };
  return { status: 'matched', currentQuantity: current, originalQuantity: original, minimumQuantity: min, maximumQuantity: max, message: 'Current quantity is in range for the saved rate.' };
}

export function evaluateMinimumCharge(params: {
  scopeKey: string;
  metadata?: RateMetadata | null;
  suggestedPricing?: SuggestedPricingBlock | null;
  resolved?: ResolvedItemQuantity | null;
}): MinimumChargeEvaluation {
  const unitTotal = params.suggestedPricing?.total ?? params.resolved?.quantity ?? undefined;
  const charges = [
    params.metadata?.minimumCharge,
    params.metadata?.mobilizationCharge,
    params.metadata?.tripCharge,
    params.metadata?.deliveryCharge,
  ].filter((value): value is number => Number.isFinite(value) && value > 0);
  const minimumCharge = charges.length ? Math.max(...charges) : undefined;
  if (!minimumCharge) {
    return {
      applies: false,
      status: SERVICE_SCOPES.has(params.scopeKey) ? 'unknown' : 'not_applicable',
    };
  }
  if (!unitTotal || unitTotal <= 0) {
    return { applies: true, status: 'unknown', minimumCharge };
  }
  if (unitTotal < minimumCharge) {
    return {
      applies: true,
      chargeType: params.metadata?.mobilizationCharge === minimumCharge ? 'mobilization' : params.metadata?.deliveryCharge === minimumCharge ? 'delivery' : params.metadata?.tripCharge === minimumCharge ? 'service_call' : 'project_minimum',
      calculatedUnitTotal: unitTotal,
      minimumCharge,
      recommendedWorkingTotal: minimumCharge,
      status: 'review',
    };
  }
  return { applies: false, calculatedUnitTotal: unitTotal, minimumCharge, status: 'confirmed' };
}

function includedComponents(metadata: RateMetadata | null | undefined, rateType: RateType, block?: SuggestedPricingBlock | null): CostComponentKey[] {
  const out = new Set<CostComponentKey>();
  if (metadata?.materialIncluded || block?.material) out.add('material');
  if (metadata?.laborIncluded || block?.labor) out.add('labor');
  if (metadata?.equipmentIncluded) out.add('equipment');
  if (metadata?.subcontractorIncluded || rateType === 'subcontractor') out.add('subcontractor');
  if (metadata?.taxIncluded) out.add('tax');
  if (metadata?.deliveryIncluded) out.add('delivery');
  if (metadata?.mobilizationIncluded) out.add('mobilization');
  if (metadata?.cleanupIncluded) out.add('cleanup');
  if (metadata?.overheadIncluded) out.add('overhead');
  if (metadata?.profitIncluded) out.add('profit');
  if (metadata?.contingencyIncluded) out.add('contingency');
  if (metadata?.permitIncluded) out.add('permit');
  if (rateType === 'project_quote' || rateType === 'selling_price') {
    out.add('material');
    out.add('labor');
  }
  if (rateType === 'allowance' || rateType === 'lump_sum') {
    out.add('material');
    out.add('labor');
  }
  return Array.from(out);
}

function requiredCostComponents(scopeKey: string, rateType: RateType): CostComponentKey[] {
  if (rateType === 'material_only') return ['material'];
  if (rateType === 'labor_only') return ['labor'];
  if (rateType === 'equipment_only') return ['equipment'];
  if (rateType === 'subcontractor') return ['subcontractor'];
  if (rateType === 'allowance' || rateType === 'lump_sum') return [];
  if (PERMIT_SCOPES.has(scopeKey)) return ['permit'];
  return ['material', 'labor'];
}

export function evaluateMarkupRisk(params: {
  metadata?: RateMetadata | null;
  rateType: RateType;
  projectMarkupPercent?: number | null;
  projectMarginPercent?: number | null;
  pricingSource?: PricingSourceKind;
}): MarkupRiskResult {
  const notices: ScopeValidationNotice[] = [];
  const markupApplied = Number(params.projectMarkupPercent || 0) > 0 || Number(params.projectMarginPercent || 0) > 0;
  if (markupApplied && (params.rateType === 'selling_price' || params.metadata?.overheadIncluded || params.metadata?.profitIncluded)) {
    notices.push(notice('pricing_markup_possible_duplication', 'review', 'Markup review', 'Selected rate may already include overhead or profit, while project markup may also apply.', 'Confirm whether this rate is direct cost or selling price.'));
  }
  if (params.metadata?.marginPercentIncluded != null && params.projectMarkupPercent != null) {
    notices.push(notice('pricing_markup_margin_review', 'info', 'Markup vs margin review', 'Saved metadata includes margin while project settings may use markup. These are not interchangeable.', 'Confirm markup/margin treatment.'));
  }
  if (params.pricingSource === 'national_average' && markupApplied) {
    notices.push(notice('pricing_national_markup_review', 'info', 'National benchmark review', 'National installed pricing may already resemble a customer-facing price.', 'Review before applying additional markup.'));
  }
  if (!params.metadata && params.rateType !== 'allowance') {
    notices.push(notice('pricing_markup_unknown', 'info', 'Markup unknown', 'Markup, overhead, and profit treatment are unknown for this rate.', 'Confirm rate details when saving.'));
  }
  const maxSeverity = notices.some((n) => n.severity === 'warning')
    ? 'warning'
    : notices.some((n) => n.severity === 'review')
      ? 'review'
      : notices.length
        ? 'unknown'
        : 'none';
  return { risk: maxSeverity, notices };
}

function relevanceOverall(levels: RelevanceLevel[]): RelevanceLevel {
  if (levels.includes('low')) return 'low';
  if (levels.includes('unknown')) return 'unknown';
  if (levels.includes('medium')) return 'medium';
  return 'high';
}

export function evaluateRateRelevance(params: {
  scopeKey: string;
  projectContext?: string | null;
  selectedUnit?: string | null;
  metadata?: RateMetadata | null;
  pricingSource?: PricingSourceKind;
  projectLocation?: ProjectLocation | null;
  age?: RateAgeResult;
  quantityScale?: QuantityScaleResult;
  inclusionCompleteness?: RelevanceLevel;
}): RateRelevanceResult {
  const regionalMatch = evaluateRegionalRelevance(params);
  const dateRelevance: RelevanceLevel =
    params.age?.status === 'current'
      ? 'high'
      : params.age?.status === 'aging'
        ? 'medium'
        : params.age?.status === 'stale' || params.age?.status === 'expired'
          ? 'low'
          : 'unknown';
  const quantityScaleMatch: RelevanceLevel =
    params.quantityScale?.status === 'matched'
      ? 'high'
      : params.quantityScale?.status === 'small_job_review' || params.quantityScale?.status === 'large_job_review'
        ? 'medium'
        : params.quantityScale?.status === 'outside_saved_range'
          ? 'low'
          : 'unknown';
  const dimensions = {
    unitMatch: unitRelevance(params.metadata, params.selectedUnit),
    scopeMatch: scopeRelevance(params.metadata, params.scopeKey),
    projectContextMatch: projectContextRelevance(params.metadata, params.projectContext),
    regionalMatch,
    dateRelevance,
    quantityScaleMatch,
    inclusionMatch: params.inclusionCompleteness || 'unknown',
  };
  const notices: ScopeValidationNotice[] = [];
  if (regionalMatch === 'low') {
    notices.push(notice('pricing_region_low_relevance', 'review', 'Regional pricing review', params.pricingSource === 'national_average' ? 'Pricing uses a national average because no local rate was selected.' : 'Selected rate may be from a different market.', 'Confirm local relevance or keep as fallback.'));
  }
  if (dateRelevance === 'low' && params.age) {
    notices.push(notice('pricing_rate_stale', 'review', 'Rate age review', params.age.message, 'Review before using this rate.'));
  }
  if (quantityScaleMatch === 'low' || quantityScaleMatch === 'medium') {
    notices.push(notice('pricing_quantity_scale_review', 'review', 'Quantity scale review', params.quantityScale?.message || 'Current quantity may not match the saved-rate scale.', 'Review minimums or edit pricing.'));
  }
  return {
    overall: relevanceOverall(Object.values(dimensions)),
    dimensions,
    notices,
  };
}

export function evaluatePricingCompleteness(params: {
  scopeKey: string;
  trade?: string;
  projectContext?: string | null;
  pricingSource: PricingSourceKind;
  suggestedPricing?: SuggestedPricingBlock | null;
  resolved?: ResolvedItemQuantity | null;
  metadata?: RateMetadata | null;
  projectLocation?: ProjectLocation | null;
  projectMarkupPercent?: number | null;
  projectMarginPercent?: number | null;
  now?: Date;
}): PricingCompletenessResult {
  const rateType = classifyRateType(params);
  const source = params.metadata?.source || sourceFromPricingKind(params.pricingSource);
  const currentQuantity = params.suggestedPricing?.basis?.quantity ?? params.resolved?.quantity ?? null;
  const dateRelevance = evaluateRateAge({
    scopeKey: params.scopeKey,
    trade: params.trade,
    metadata: { ...params.metadata, source },
    pricingSource: params.pricingSource,
    now: params.now,
  });
  const quantityScale = evaluateQuantityScale({ currentQuantity, metadata: params.metadata });
  const minimumCharge = evaluateMinimumCharge({
    scopeKey: params.scopeKey,
    metadata: params.metadata,
    suggestedPricing: params.suggestedPricing,
    resolved: params.resolved,
  });
  const included = includedComponents(params.metadata, rateType, params.suggestedPricing);
  const required = requiredCostComponents(params.scopeKey, rateType);
  const missing = required.filter((component) => !included.includes(component));
  const unknown = COST_COMPONENTS.filter((component) => !included.includes(component) && !missing.includes(component));
  const inclusionMatch: RelevanceLevel = missing.length ? 'low' : params.metadata ? 'high' : params.suggestedPricing ? 'medium' : 'unknown';
  const regionalRelevance = evaluateRateRelevance({
    scopeKey: params.scopeKey,
    projectContext: params.projectContext,
    selectedUnit: params.suggestedPricing?.basis?.unit || params.resolved?.unit,
    metadata: params.metadata,
    pricingSource: params.pricingSource,
    projectLocation: params.projectLocation,
    age: dateRelevance,
    quantityScale,
    inclusionCompleteness: inclusionMatch,
  });
  const markupRisk = evaluateMarkupRisk({
    metadata: params.metadata,
    rateType,
    projectMarkupPercent: params.projectMarkupPercent,
    projectMarginPercent: params.projectMarginPercent,
    pricingSource: params.pricingSource,
  });
  const notices: ScopeValidationNotice[] = [...regionalRelevance.notices, ...markupRisk.notices];
  if (rateType === 'allowance') {
    notices.push(notice('pricing_allowance_placeholder', 'review', 'Allowance pricing', 'Allowance is a budget placeholder, not a confirmed installed cost.', 'Confirm scope or keep as allowance.'));
  }
  if (rateType === 'unknown') {
    notices.push(notice('pricing_rate_type_unknown', 'review', 'Rate type unknown', 'The app cannot determine whether this is direct cost, installed cost, selling price, or allowance.', 'Confirm rate details when available.'));
  }
  if (missing.length) {
    notices.push(notice('pricing_components_missing', 'review', 'Pricing components may be incomplete', `Missing cost components: ${missing.join(', ')}.`, 'Confirm whether included or price separately.'));
  }
  if (minimumCharge.status === 'review') {
    notices.push(notice('pricing_minimum_charge_review', 'review', 'Minimum charge may apply', `Unit calculation is below the saved minimum charge of $${minimumCharge.minimumCharge?.toLocaleString()}.`, 'Use calculated amount, minimum charge, or edit pricing.'));
  }
  if (dateRelevance.status === 'expired' || dateRelevance.status === 'stale') {
    notices.push(notice('pricing_rate_age_review', 'review', 'Rate age review', dateRelevance.message, 'Confirm rate is still current.'));
  }

  const status: PricingCompletenessStatus =
    missing.length > 0 || minimumCharge.status === 'review'
      ? 'incomplete'
      : rateType === 'unknown'
        ? 'unknown'
        : !params.metadata
          ? 'mostly_complete'
        : regionalRelevance.overall === 'low'
          ? 'mostly_complete'
          : 'complete';
  const confidence: IntelligenceConfidence =
    status === 'complete' &&
    regionalRelevance.dimensions.regionalMatch !== 'unknown' &&
    dateRelevance.status !== 'unknown'
      ? 'high'
      : status === 'mostly_complete'
        ? 'medium'
        : status === 'unknown'
          ? 'missing'
          : 'low';

  return {
    status,
    rateType,
    includedCostComponents: included,
    missingCostComponents: missing,
    unknownCostComponents: unknown,
    minimumCharge,
    regionalRelevance,
    dateRelevance,
    quantityScale,
    markupRisk,
    confidence,
    notices,
  };
}

export function summarizeEstimatePricingReview(results: PricingCompletenessResult[]): EstimatePricingReviewResult {
  const total = Math.max(1, results.length);
  const reviewCount = results.filter((result) => result.confidence === 'low' || result.confidence === 'missing').length;
  return {
    pricingReadiness: Math.max(0, Math.round(((total - reviewCount) / total) * 100)),
    projectQuoteCount: results.filter((result) => result.rateType === 'project_quote').length,
    userEnteredCount: 0,
    savedRateCount: 0,
    localizedRateCount: results.filter((result) => result.regionalRelevance?.dimensions.regionalMatch === 'high').length,
    nationalAverageCount: results.filter((result) => result.regionalRelevance?.dimensions.regionalMatch === 'low').length,
    staleRateCount: results.filter((result) => result.dateRelevance?.status === 'stale' || result.dateRelevance?.status === 'expired').length,
    unknownMarkupCount: results.filter((result) => result.markupRisk?.risk === 'unknown').length,
    minimumChargeIssueCount: results.filter((result) => result.minimumCharge?.status === 'review').length,
    incompletePriceDefinitionCount: results.filter((result) => result.status === 'incomplete' || result.status === 'unknown').length,
    markupDuplicationRiskCount: results.filter((result) => result.markupRisk?.risk === 'review' || result.markupRisk?.risk === 'warning').length,
  };
}
