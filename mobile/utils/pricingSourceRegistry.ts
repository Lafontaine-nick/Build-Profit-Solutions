import type { RateType } from '@/utils/scopePricingIntelligence';
import type { UnitCode } from '@/utils/scopeIntelligence';

export const PRICING_SOURCE_REGISTRY_VERSION = '1.0.0';
export const PRICING_NORMALIZATION_VERSION = '1.0.0';
export const PRICING_SELECTION_VERSION = '1.0.0';
export const PRICING_COVERAGE_MATRIX_VERSION = '1.0.0';

export type PricingExpandedSourceType =
  | 'project_quote'
  | 'user_entered'
  | 'saved_rate'
  | 'company_rate'
  | 'supplier'
  | 'subcontractor'
  | 'labor_dataset'
  | 'local_benchmark'
  | 'localized_benchmark'
  | 'national_average'
  | 'internal_calibrated'
  | 'allowance'
  | 'manual';

export type PricingUpdateMethod = 'live' | 'scheduled' | 'manual' | 'user_generated' | 'calibrated';
export type PricingSourceHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'authentication_failed'
  | 'rate_limited'
  | 'stale'
  | 'partial_coverage';
export type ProductMatchStatus = 'exact' | 'strong' | 'compatible' | 'approximate' | 'unmatched';
export type GeographicMatchLevel =
  | 'same_zip'
  | 'same_city'
  | 'same_metro'
  | 'same_county'
  | 'same_state'
  | 'regional_market'
  | 'national'
  | 'unknown';
export type PricingCoverageStatus =
  | 'launch_ready'
  | 'covered_with_fallback'
  | 'partial'
  | 'manual_required'
  | 'unsupported';
export type RetailPricingBasis =
  | 'consumer_retail'
  | 'contractor_pro'
  | 'bulk'
  | 'supplier_quote'
  | 'subcontractor_quote'
  | 'benchmark'
  | 'unknown';
export type LaborRateType =
  | 'base_wage'
  | 'burdened_cost'
  | 'crew_cost'
  | 'installed_unit_labor'
  | 'subcontractor_rate'
  | 'selling_rate';

export type RateRegion = {
  country?: string;
  state?: string;
  metro?: string;
  county?: string;
  city?: string;
  zipCode?: string;
  marketLabel?: string;
};

export type RegionDefinition = RateRegion & {
  key: string;
  label: string;
};

export type PricingSourceDefinition = {
  key: string;
  name: string;
  sourceType: PricingExpandedSourceType;
  priority: number;
  supportedTrades?: string[];
  supportedScopeKeys?: string[];
  supportedUnits?: Array<UnitCode | string>;
  supportedRegions?: RegionDefinition[];
  updateMethod: PricingUpdateMethod;
  freshnessPolicyKey?: string;
  normalizationAdapterKey?: string;
  enabled: boolean;
  featureFlag?: string;
  fallbackSourceKeys?: string[];
  privateToCompany?: boolean;
  notes?: string[];
};

export type PricingFreshnessPolicy = {
  key: string;
  currentForDays: number;
  agingForDays: number;
  staleAfterDays: number;
  refreshMethod: 'live' | 'scheduled' | 'manual';
  tradeOverrides?: Record<string, Partial<PricingFreshnessPolicy>>;
};

export type PricingSearchRequest = {
  scopeKey: string;
  trade: string;
  desiredRateTypes?: RateType[];
  unit: UnitCode | string;
  quantity?: number;
  projectContext?: string;
  buildingType?: string;
  finishLevel?: string;
  materialSpecification?: string;
  productCategory?: string;
  manufacturer?: string;
  sku?: string;
  upc?: string;
  region?: RateRegion;
  effectiveDate?: string;
};

export type NormalizedPricingRecord = {
  id: string;
  sourceKey: string;
  externalReferenceId?: string;
  trade: string;
  scopeKey: string;
  description: string;
  materialSpecification?: string;
  manufacturer?: string;
  productName?: string;
  sku?: string;
  upc?: string;
  rateType: Exclude<RateType, 'project_quote' | 'lump_sum'> | 'subcontractor' | 'unknown';
  value: number;
  currency: string;
  unit: UnitCode | string;
  quantityBasis?: number;
  packageQuantity?: number;
  packageUnit?: UnitCode | string;
  sourcePackagePrice?: number;
  sourcePackageUnit?: UnitCode | string;
  retailBasis?: RetailPricingBasis;
  region?: RateRegion;
  includedComponents?: string[];
  excludedComponents?: string[];
  taxIncluded?: boolean;
  deliveryIncluded?: boolean;
  wasteIncluded?: boolean;
  equipmentIncluded?: boolean;
  laborIncluded?: boolean;
  markupIncluded?: boolean;
  overheadIncluded?: boolean;
  profitIncluded?: boolean;
  effectiveDate: string;
  expirationDate?: string;
  fetchedAt?: string;
  confidence: 'high' | 'medium' | 'low';
  metadataCompleteness: 'complete' | 'partial' | 'minimal';
  productMatchStatus?: ProductMatchStatus;
  geographicMatchLevel?: GeographicMatchLevel;
  sourceUrlReference?: string;
  sourceNotes?: string[];
  registryVersion?: string;
  normalizationVersion?: string;
};

export type PriceNormalizationNotice = {
  code:
    | 'missing_package_quantity'
    | 'missing_coverage'
    | 'missing_density'
    | 'unsupported_conversion'
    | 'retail_price_label'
    | 'package_quantity_changed';
  severity: 'info' | 'review' | 'warning';
  message: string;
};

export type PriceNormalizationResult = {
  sourcePrice: number;
  sourceUnit: UnitCode | string;
  packageQuantity?: number;
  packageUnit?: UnitCode | string;
  normalizedPrice?: number;
  normalizedUnit?: UnitCode | string;
  conversionFormula?: string;
  coverageSource?: string;
  confidence: 'high' | 'medium' | 'low';
  notices: PriceNormalizationNotice[];
};

export type ProductMatchInput = {
  trade?: string;
  scopeKey?: string;
  materialSpecification?: string;
  productCategory?: string;
  manufacturer?: string;
  sku?: string;
  upc?: string;
  size?: string;
  thickness?: string;
  grade?: string;
  finish?: string;
  color?: string;
};

export type ProductMatchResult = {
  status: ProductMatchStatus;
  score: number;
  reasons: string[];
};

export type LaborPricingRecord = {
  trade: string;
  role?: string;
  crewType?: string;
  rateType: LaborRateType;
  value: number;
  unit: 'hour' | 'day' | 'sqft' | 'LF' | 'CY' | 'each' | 'lump_sum';
  region?: RateRegion;
  effectiveDate: string;
  burdenIncluded?: boolean;
  workersCompIncluded?: boolean;
  payrollTaxIncluded?: boolean;
  insuranceIncluded?: boolean;
  smallToolsIncluded?: boolean;
  supervisionIncluded?: boolean;
  overheadIncluded?: boolean;
  profitIncluded?: boolean;
  sourceKey: string;
  confidence: 'high' | 'medium' | 'low';
};

export type LaborBurdenConfig = {
  payrollBurdenPercent?: number;
  insuranceBurdenPercent?: number;
  benefitsPercent?: number;
  paidTimeOffPercent?: number;
  vehicleAllowancePerHour?: number;
  smallToolsPercent?: number;
  supervisionPercent?: number;
  nonproductiveTimePercent?: number;
};

export type PricingSourceHealth = {
  sourceKey: string;
  status: PricingSourceHealthStatus;
  checkedAt: string;
  message?: string;
};

export type PricingSearchResult = {
  sourceKey: string;
  records: NormalizedPricingRecord[];
  health: PricingSourceHealth;
  fromCache?: boolean;
};

export type PricingSourceAdapter = {
  sourceKey: string;
  search(request: PricingSearchRequest): Promise<PricingSearchResult>;
  normalize(rawRecord: unknown): NormalizedPricingRecord | null;
  healthCheck(): Promise<PricingSourceHealth>;
  supports(request: PricingSearchRequest): boolean;
};

export type PricingSelectionResult = {
  selected: NormalizedPricingRecord | null;
  alternatives: NormalizedPricingRecord[];
  selectedSource?: PricingSourceDefinition;
  reason: string;
  fallbackReason?: string;
  sourcePriority: number;
  comparisonMetadata: {
    selectionVersion: string;
    currentSourcePreserved: boolean;
    consideredSourceKeys: string[];
    unavailableSourceKeys: string[];
  };
};

export type PricingAnomaly = {
  code:
    | 'zero_price'
    | 'negative_price'
    | 'extreme_price_change'
    | 'unit_mismatch'
    | 'package_conversion_failure'
    | 'product_description_mismatch'
    | 'duplicate_product_record'
    | 'incorrect_region'
    | 'stale_timestamp'
    | 'missing_currency'
    | 'suspicious_labor_rate'
    | 'suspicious_material_rate';
  severity: 'review' | 'quarantine';
  recordId: string;
  message: string;
};

export type PricingCoverageRow = {
  trade: string;
  tier: 1 | 2;
  scopeKeys: string[];
  units: string[];
  sourceTypes: PricingExpandedSourceType[];
  materialPricing: PricingCoverageStatus;
  laborPricing: PricingCoverageStatus;
  installedPricing: PricingCoverageStatus;
  freshness: PricingCoverageStatus;
  confidence: 'high' | 'medium' | 'low';
  fallbackAvailable: boolean;
  status: PricingCoverageStatus;
};

export type SharedBenchmarkPrivacyCheck = {
  allowed: boolean;
  reasons: string[];
  minimumCompanyCount: number;
  minimumProjectCount: number;
};

export const LAUNCH_MARKETS: RegionDefinition[] = [
  { key: 'utah_st_george', label: 'St. George / Washington County, UT', country: 'US', state: 'UT', metro: 'St. George', county: 'Washington' },
  { key: 'utah_salt_lake', label: 'Salt Lake City metro, UT', country: 'US', state: 'UT', metro: 'Salt Lake City' },
  { key: 'nevada_las_vegas', label: 'Las Vegas metro, NV', country: 'US', state: 'NV', metro: 'Las Vegas' },
  { key: 'arizona_phoenix', label: 'Phoenix metro, AZ', country: 'US', state: 'AZ', metro: 'Phoenix' },
  { key: 'national', label: 'National fallback', country: 'US' },
];

export const PRICING_FRESHNESS_POLICIES: Record<string, PricingFreshnessPolicy> = {
  live_supplier: {
    key: 'live_supplier',
    currentForDays: 3,
    agingForDays: 7,
    staleAfterDays: 14,
    refreshMethod: 'live',
    tradeOverrides: {
      concrete: { currentForDays: 2, staleAfterDays: 7 },
      roofing: { currentForDays: 3, staleAfterDays: 10 },
      framing: { currentForDays: 3, staleAfterDays: 10 },
    },
  },
  cached_supplier: {
    key: 'cached_supplier',
    currentForDays: 7,
    agingForDays: 14,
    staleAfterDays: 30,
    refreshMethod: 'scheduled',
  },
  saved_company_rate: {
    key: 'saved_company_rate',
    currentForDays: 180,
    agingForDays: 270,
    staleAfterDays: 365,
    refreshMethod: 'manual',
  },
  labor_dataset: {
    key: 'labor_dataset',
    currentForDays: 90,
    agingForDays: 180,
    staleAfterDays: 365,
    refreshMethod: 'scheduled',
  },
  national_benchmark: {
    key: 'national_benchmark',
    currentForDays: 180,
    agingForDays: 365,
    staleAfterDays: 540,
    refreshMethod: 'scheduled',
  },
  project_quote: {
    key: 'project_quote',
    currentForDays: 30,
    agingForDays: 45,
    staleAfterDays: 60,
    refreshMethod: 'manual',
  },
};

export const PRICING_SOURCE_REGISTRY: PricingSourceDefinition[] = [
  {
    key: 'project_quote',
    name: 'Project-specific quote',
    sourceType: 'project_quote',
    priority: 100,
    updateMethod: 'manual',
    freshnessPolicyKey: 'project_quote',
    enabled: true,
    fallbackSourceKeys: ['user_entered', 'saved_rate'],
    privateToCompany: true,
  },
  {
    key: 'user_entered',
    name: 'User-entered price',
    sourceType: 'user_entered',
    priority: 95,
    updateMethod: 'user_generated',
    enabled: true,
    fallbackSourceKeys: ['saved_rate'],
    privateToCompany: true,
  },
  {
    key: 'saved_rate',
    name: 'Saved contractor rate',
    sourceType: 'saved_rate',
    priority: 90,
    updateMethod: 'user_generated',
    freshnessPolicyKey: 'saved_company_rate',
    enabled: true,
    fallbackSourceKeys: ['company_rate', 'supplier_retail'],
    privateToCompany: true,
  },
  {
    key: 'company_rate',
    name: 'Company or team rate',
    sourceType: 'company_rate',
    priority: 85,
    updateMethod: 'manual',
    freshnessPolicyKey: 'saved_company_rate',
    enabled: true,
    fallbackSourceKeys: ['supplier_retail'],
    privateToCompany: true,
  },
  {
    key: 'supplier_retail',
    name: 'Retail supplier material price',
    sourceType: 'supplier',
    priority: 70,
    supportedTrades: ['framing', 'roofing', 'drywall', 'painting', 'flooring', 'tile', 'plumbing', 'electrical', 'landscaping'],
    supportedUnits: ['each', 'sqft', 'lf', 'ton', 'cy'],
    supportedRegions: LAUNCH_MARKETS,
    updateMethod: 'live',
    freshnessPolicyKey: 'live_supplier',
    normalizationAdapterKey: 'retail_product_package',
    enabled: true,
    featureFlag: 'supplierPricing',
    fallbackSourceKeys: ['localized_benchmark', 'national_average'],
  },
  {
    key: 'subcontractor_quote',
    name: 'Subcontractor quote',
    sourceType: 'subcontractor',
    priority: 70,
    updateMethod: 'manual',
    freshnessPolicyKey: 'project_quote',
    enabled: true,
    featureFlag: 'subcontractorPricing',
    fallbackSourceKeys: ['localized_benchmark', 'national_average'],
    privateToCompany: true,
  },
  {
    key: 'internal_calibrated',
    name: 'Approved local calibrated rate',
    sourceType: 'internal_calibrated',
    priority: 65,
    updateMethod: 'calibrated',
    freshnessPolicyKey: 'saved_company_rate',
    enabled: true,
    featureFlag: 'internalCalibratedRates',
    fallbackSourceKeys: ['localized_benchmark', 'national_average'],
    privateToCompany: true,
  },
  {
    key: 'local_benchmark',
    name: 'Southern Utah residential benchmark',
    sourceType: 'local_benchmark',
    priority: 58,
    updateMethod: 'scheduled',
    freshnessPolicyKey: 'national_benchmark',
    enabled: true,
    featureFlag: 'benchmarkEngine',
    fallbackSourceKeys: ['localized_benchmark', 'national_average'],
    notes: ['Preliminary planning benchmark; detailed trade takeoff and quotes remain authoritative.'],
  },
  {
    key: 'localized_benchmark',
    name: 'Localized benchmark',
    sourceType: 'localized_benchmark',
    priority: 55,
    updateMethod: 'scheduled',
    freshnessPolicyKey: 'national_benchmark',
    enabled: true,
    featureFlag: 'localizedBenchmarks',
    fallbackSourceKeys: ['national_average'],
  },
  {
    key: 'national_average',
    name: 'National average benchmark',
    sourceType: 'national_average',
    priority: 45,
    updateMethod: 'scheduled',
    freshnessPolicyKey: 'national_benchmark',
    enabled: true,
    fallbackSourceKeys: ['allowance', 'manual_required'],
  },
  {
    key: 'allowance',
    name: 'Allowance',
    sourceType: 'allowance',
    priority: 20,
    updateMethod: 'manual',
    enabled: true,
    fallbackSourceKeys: ['manual_required'],
  },
  {
    key: 'manual_required',
    name: 'Manual pricing required',
    sourceType: 'manual',
    priority: 0,
    updateMethod: 'manual',
    enabled: true,
  },
];

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function daysBetween(fromIso: string | undefined, toIso: string): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

export function getPricingSourceDefinition(sourceKey: string): PricingSourceDefinition | null {
  return PRICING_SOURCE_REGISTRY.find((source) => source.key === sourceKey) || null;
}

export function getEnabledPricingSources(flags: Record<string, boolean | undefined> = {}): PricingSourceDefinition[] {
  return PRICING_SOURCE_REGISTRY.filter((source) => {
    if (!source.enabled) return false;
    if (source.featureFlag && flags[source.featureFlag] === false) return false;
    return true;
  }).sort((a, b) => b.priority - a.priority);
}

export function sourceSupportsRequest(source: PricingSourceDefinition, request: PricingSearchRequest): boolean {
  if (source.supportedTrades?.length && !source.supportedTrades.map(normalize).includes(normalize(request.trade))) return false;
  if (source.supportedScopeKeys?.length && !source.supportedScopeKeys.map(normalize).includes(normalize(request.scopeKey))) return false;
  if (source.supportedUnits?.length && !source.supportedUnits.map(normalize).includes(normalize(request.unit))) return false;
  if (source.supportedRegions?.length && request.region) {
    const hasMatch = source.supportedRegions.some((region) => regionalMatchLevel(region, request.region!) !== 'unknown');
    if (!hasMatch) return false;
  }
  return true;
}

export function evaluateFreshness(params: {
  sourceKey?: string;
  policyKey?: string;
  trade?: string;
  effectiveDate?: string;
  expirationDate?: string;
  now?: string;
}) {
  const now = params.now || new Date().toISOString();
  if (params.expirationDate && new Date(params.expirationDate).getTime() < new Date(now).getTime()) {
    return { status: 'expired' as const, ageDays: daysBetween(params.effectiveDate, now), policyKey: params.policyKey };
  }
  const source = params.sourceKey ? getPricingSourceDefinition(params.sourceKey) : null;
  const policyKey = params.policyKey || source?.freshnessPolicyKey || 'national_benchmark';
  const basePolicy = PRICING_FRESHNESS_POLICIES[policyKey] || PRICING_FRESHNESS_POLICIES.national_benchmark;
  const override = params.trade ? basePolicy.tradeOverrides?.[normalize(params.trade)] : undefined;
  const policy = { ...basePolicy, ...(override || {}) };
  const ageDays = daysBetween(params.effectiveDate, now);
  if (ageDays == null) return { status: 'unknown' as const, ageDays, policyKey };
  if (ageDays <= policy.currentForDays) return { status: 'current' as const, ageDays, policyKey };
  if (ageDays <= policy.agingForDays) return { status: 'aging' as const, ageDays, policyKey };
  if (ageDays <= policy.staleAfterDays) return { status: 'stale' as const, ageDays, policyKey };
  return { status: 'expired' as const, ageDays, policyKey };
}

export function regionalMatchLevel(source: RateRegion | undefined, project: RateRegion | undefined): GeographicMatchLevel {
  if (!source || !project) return source?.country === 'US' && !source.state ? 'national' : 'unknown';
  if (source.zipCode && project.zipCode && source.zipCode === project.zipCode) return 'same_zip';
  if (source.city && project.city && normalize(source.city) === normalize(project.city) && source.state === project.state) return 'same_city';
  if (source.metro && project.metro && normalize(source.metro) === normalize(project.metro) && source.state === project.state) return 'same_metro';
  if (source.county && project.county && normalize(source.county) === normalize(project.county) && source.state === project.state) return 'same_county';
  if (source.state && project.state && source.state === project.state) return 'same_state';
  if (source.marketLabel && project.marketLabel && normalize(source.marketLabel) === normalize(project.marketLabel)) return 'regional_market';
  if (source.country === 'US' && !source.state) return 'national';
  return 'unknown';
}

export function matchProduct(requirement: ProductMatchInput, product: ProductMatchInput): ProductMatchResult {
  const reasons: string[] = [];
  let score = 0;
  if (requirement.sku && product.sku && normalize(requirement.sku) === normalize(product.sku)) {
    score += 60;
    reasons.push('SKU match');
  }
  if (requirement.upc && product.upc && normalize(requirement.upc) === normalize(product.upc)) {
    score += 60;
    reasons.push('UPC match');
  }
  if (requirement.manufacturer && product.manufacturer && normalize(requirement.manufacturer) === normalize(product.manufacturer)) {
    score += 15;
    reasons.push('Manufacturer match');
  }
  if (requirement.productCategory && product.productCategory && normalize(requirement.productCategory) === normalize(product.productCategory)) {
    score += 15;
    reasons.push('Product category match');
  }
  for (const field of ['size', 'thickness', 'grade', 'finish', 'color'] as const) {
    if (requirement[field] && product[field] && normalize(requirement[field]) === normalize(product[field])) {
      score += 6;
      reasons.push(`${field} match`);
    }
  }
  if (requirement.scopeKey && product.scopeKey && normalize(requirement.scopeKey) === normalize(product.scopeKey)) score += 8;
  if (requirement.trade && product.trade && normalize(requirement.trade) === normalize(product.trade)) score += 6;
  const status: ProductMatchStatus =
    score >= 60 && (reasons.includes('SKU match') || reasons.includes('UPC match'))
      ? 'exact'
      : score >= 35
        ? 'strong'
        : score >= 25
          ? 'compatible'
          : score >= 10
            ? 'approximate'
            : 'unmatched';
  return { status, score, reasons };
}

export function normalizePackagePrice(input: {
  sourcePrice: number;
  sourceUnit: UnitCode | string;
  packageQuantity?: number;
  packageUnit?: UnitCode | string;
  desiredUnit: UnitCode | string;
  coverageQuantity?: number;
  coverageUnit?: UnitCode | string;
  densityTonPerCy?: number;
  coverageSource?: string;
  retailBasis?: RetailPricingBasis;
}): PriceNormalizationResult {
  const notices: PriceNormalizationNotice[] = [];
  const sourcePrice = Number(input.sourcePrice);
  const sourceUnit = input.sourceUnit;
  const desired = normalize(input.desiredUnit);
  const packageUnit = normalize(input.packageUnit);
  const coverageUnit = normalize(input.coverageUnit);
  let normalizedPrice: number | undefined;
  let normalizedUnit: string | undefined;
  let conversionFormula: string | undefined;
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  if (input.retailBasis === 'consumer_retail') {
    notices.push({ code: 'retail_price_label', severity: 'info', message: 'Consumer retail price is not guaranteed contractor cost.' });
    confidence = 'low';
  }

  if (input.packageQuantity && normalize(sourceUnit) === desired) {
    normalizedPrice = sourcePrice / input.packageQuantity;
    normalizedUnit = input.desiredUnit;
    conversionFormula = `${sourcePrice} / ${input.packageQuantity} ${input.desiredUnit}`;
    confidence = confidence === 'low' ? 'low' : 'high';
  } else if (input.coverageQuantity && coverageUnit === desired) {
    normalizedPrice = sourcePrice / input.coverageQuantity;
    normalizedUnit = input.desiredUnit;
    conversionFormula = `${sourcePrice} / ${input.coverageQuantity} ${input.desiredUnit} coverage`;
    confidence = confidence === 'low' ? 'low' : 'high';
  } else if (desired === 'sqft' && ['box', 'bundle', 'roll', 'sheet', 'gallon'].includes(packageUnit) && input.coverageQuantity) {
    normalizedPrice = sourcePrice / input.coverageQuantity;
    normalizedUnit = input.desiredUnit;
    conversionFormula = `${sourcePrice} / ${input.coverageQuantity} sqft per ${packageUnit}`;
  } else if (desired === 'square' && packageUnit === 'bundle' && input.coverageQuantity) {
    normalizedPrice = sourcePrice / input.coverageQuantity;
    normalizedUnit = input.desiredUnit;
    conversionFormula = `${sourcePrice} / ${input.coverageQuantity} roofing squares per bundle`;
  } else if (desired === 'lf' && ['piece', 'each'].includes(packageUnit) && input.packageQuantity) {
    normalizedPrice = sourcePrice / input.packageQuantity;
    normalizedUnit = input.desiredUnit;
    conversionFormula = `${sourcePrice} / ${input.packageQuantity} LF per piece`;
  } else if (desired === 'cy' && normalize(sourceUnit) === 'ton') {
    if (input.densityTonPerCy && input.densityTonPerCy > 0) {
      normalizedPrice = sourcePrice * input.densityTonPerCy;
      normalizedUnit = input.desiredUnit;
      conversionFormula = `${sourcePrice} per ton * ${input.densityTonPerCy} tons/CY`;
      confidence = confidence === 'low' ? 'low' : 'medium';
    } else {
      notices.push({ code: 'missing_density', severity: 'review', message: 'Ton to CY conversion requires density.' });
      confidence = 'low';
    }
  } else {
    notices.push({ code: 'unsupported_conversion', severity: 'warning', message: 'No supported conversion for this package/unit combination.' });
    confidence = 'low';
  }

  if (!input.packageQuantity && !input.coverageQuantity && normalizedPrice == null) {
    notices.push({ code: 'missing_package_quantity', severity: 'review', message: 'Package quantity or coverage is required for normalization.' });
  }

  return {
    sourcePrice,
    sourceUnit,
    packageQuantity: input.packageQuantity,
    packageUnit: input.packageUnit,
    normalizedPrice: normalizedPrice != null ? Math.round(normalizedPrice * 10000) / 10000 : undefined,
    normalizedUnit,
    conversionFormula,
    coverageSource: input.coverageSource,
    confidence,
    notices,
  };
}

export function normalizeExternalPricingRecord(raw: Record<string, unknown>, defaults: Partial<NormalizedPricingRecord> = {}): NormalizedPricingRecord | null {
  const value = Number(raw.value ?? raw.price ?? raw.unitPrice ?? defaults.value);
  const sourceKey = String(raw.sourceKey ?? defaults.sourceKey ?? '').trim();
  const trade = String(raw.trade ?? defaults.trade ?? '').trim();
  const scopeKey = String(raw.scopeKey ?? defaults.scopeKey ?? '').trim();
  const unit = String(raw.unit ?? defaults.unit ?? '').trim();
  const effectiveDate = String(raw.effectiveDate ?? defaults.effectiveDate ?? new Date().toISOString().slice(0, 10));
  if (!sourceKey || !trade || !scopeKey || !unit || !Number.isFinite(value) || value <= 0) return null;
  return {
    id: String(raw.id ?? `${sourceKey}:${scopeKey}:${unit}:${effectiveDate}`),
    sourceKey,
    externalReferenceId: raw.externalReferenceId ? String(raw.externalReferenceId) : undefined,
    trade,
    scopeKey,
    description: String(raw.description ?? defaults.description ?? scopeKey),
    materialSpecification: raw.materialSpecification ? String(raw.materialSpecification) : defaults.materialSpecification,
    manufacturer: raw.manufacturer ? String(raw.manufacturer) : defaults.manufacturer,
    productName: raw.productName ? String(raw.productName) : defaults.productName,
    sku: raw.sku ? String(raw.sku) : defaults.sku,
    upc: raw.upc ? String(raw.upc) : defaults.upc,
    rateType: (raw.rateType as NormalizedPricingRecord['rateType']) || defaults.rateType || 'unknown',
    value,
    currency: String(raw.currency ?? defaults.currency ?? 'USD'),
    unit,
    quantityBasis: Number(raw.quantityBasis ?? defaults.quantityBasis) || undefined,
    packageQuantity: Number(raw.packageQuantity ?? defaults.packageQuantity) || undefined,
    packageUnit: raw.packageUnit ? String(raw.packageUnit) : defaults.packageUnit,
    sourcePackagePrice: Number(raw.sourcePackagePrice ?? defaults.sourcePackagePrice) || undefined,
    sourcePackageUnit: raw.sourcePackageUnit ? String(raw.sourcePackageUnit) : defaults.sourcePackageUnit,
    retailBasis: (raw.retailBasis as RetailPricingBasis) || defaults.retailBasis,
    region: (raw.region as RateRegion) || defaults.region,
    includedComponents: (raw.includedComponents as string[]) || defaults.includedComponents,
    excludedComponents: (raw.excludedComponents as string[]) || defaults.excludedComponents,
    taxIncluded: raw.taxIncluded as boolean | undefined,
    deliveryIncluded: raw.deliveryIncluded as boolean | undefined,
    wasteIncluded: raw.wasteIncluded as boolean | undefined,
    equipmentIncluded: raw.equipmentIncluded as boolean | undefined,
    laborIncluded: raw.laborIncluded as boolean | undefined,
    markupIncluded: raw.markupIncluded as boolean | undefined,
    overheadIncluded: raw.overheadIncluded as boolean | undefined,
    profitIncluded: raw.profitIncluded as boolean | undefined,
    effectiveDate,
    expirationDate: raw.expirationDate ? String(raw.expirationDate) : defaults.expirationDate,
    fetchedAt: raw.fetchedAt ? String(raw.fetchedAt) : defaults.fetchedAt,
    confidence: (raw.confidence as NormalizedPricingRecord['confidence']) || defaults.confidence || 'medium',
    metadataCompleteness: (raw.metadataCompleteness as NormalizedPricingRecord['metadataCompleteness']) || defaults.metadataCompleteness || 'partial',
    productMatchStatus: (raw.productMatchStatus as ProductMatchStatus) || defaults.productMatchStatus,
    geographicMatchLevel: (raw.geographicMatchLevel as GeographicMatchLevel) || defaults.geographicMatchLevel,
    sourceUrlReference: raw.sourceUrlReference ? String(raw.sourceUrlReference) : defaults.sourceUrlReference,
    sourceNotes: (raw.sourceNotes as string[]) || defaults.sourceNotes,
    registryVersion: PRICING_SOURCE_REGISTRY_VERSION,
    normalizationVersion: PRICING_NORMALIZATION_VERSION,
  };
}

export function selectPricingSource(params: {
  request: PricingSearchRequest;
  records: NormalizedPricingRecord[];
  currentRecord?: NormalizedPricingRecord | null;
  featureFlags?: Record<string, boolean | undefined>;
  unavailableSourceKeys?: string[];
}): PricingSelectionResult {
  const enabledSources = getEnabledPricingSources(params.featureFlags);
  const unavailable = new Set(params.unavailableSourceKeys || []);
  const sourceByKey = new Map(enabledSources.map((source) => [source.key, source]));
  const currentSource = params.currentRecord ? sourceByKey.get(params.currentRecord.sourceKey) || getPricingSourceDefinition(params.currentRecord.sourceKey) : null;
  const compatible = params.records
    .filter((record) => sourceByKey.has(record.sourceKey))
    .filter((record) => !unavailable.has(record.sourceKey))
    .filter((record) => normalize(record.scopeKey) === normalize(params.request.scopeKey))
    .filter((record) => normalize(record.trade) === normalize(params.request.trade))
    .filter((record) => normalize(record.unit) === normalize(params.request.unit))
    .sort((a, b) => (sourceByKey.get(b.sourceKey)?.priority || 0) - (sourceByKey.get(a.sourceKey)?.priority || 0));
  const highestAlternative = compatible[0] || null;

  if (params.currentRecord && currentSource) {
    const alternativeHigher = highestAlternative && (sourceByKey.get(highestAlternative.sourceKey)?.priority || 0) > currentSource.priority;
    const mustPreserveCurrent = ['project_quote', 'user_entered', 'saved_rate', 'company_rate'].includes(currentSource.sourceType);
    if (mustPreserveCurrent || !alternativeHigher) {
      return {
        selected: params.currentRecord,
        alternatives: compatible.filter((record) => record.id !== params.currentRecord?.id),
        selectedSource: currentSource,
        reason: `${currentSource.name} selected because it preserves the established pricing hierarchy.`,
        fallbackReason: highestAlternative && highestAlternative.id !== params.currentRecord.id ? 'External or lower-priority source available as alternative only.' : undefined,
        sourcePriority: currentSource.priority,
        comparisonMetadata: {
          selectionVersion: PRICING_SELECTION_VERSION,
          currentSourcePreserved: true,
          consideredSourceKeys: compatible.map((record) => record.sourceKey),
          unavailableSourceKeys: Array.from(unavailable),
        },
      };
    }
  }

  const selected = highestAlternative;
  const selectedSource = selected ? sourceByKey.get(selected.sourceKey) : undefined;
  return {
    selected,
    alternatives: selected ? compatible.slice(1) : [],
    selectedSource,
    reason: selectedSource ? `${selectedSource.name} selected as highest-priority compatible available source.` : 'No compatible pricing source available.',
    fallbackReason: selectedSource?.sourceType === 'national_average' ? 'National average used because no higher-priority compatible source was available.' : undefined,
    sourcePriority: selectedSource?.priority || 0,
    comparisonMetadata: {
      selectionVersion: PRICING_SELECTION_VERSION,
      currentSourcePreserved: Boolean(params.currentRecord),
      consideredSourceKeys: compatible.map((record) => record.sourceKey),
      unavailableSourceKeys: Array.from(unavailable),
    },
  };
}

export function calculateBurdenedLaborCost(baseWage: number, config: LaborBurdenConfig): number {
  const percent =
    (config.payrollBurdenPercent || 0) +
    (config.insuranceBurdenPercent || 0) +
    (config.benefitsPercent || 0) +
    (config.paidTimeOffPercent || 0) +
    (config.smallToolsPercent || 0) +
    (config.supervisionPercent || 0) +
    (config.nonproductiveTimePercent || 0);
  const hourly = baseWage * (1 + percent / 100) + (config.vehicleAllowancePerHour || 0);
  return Math.round(hourly * 100) / 100;
}

export function detectPricingAnomalies(record: NormalizedPricingRecord, previousRecord?: NormalizedPricingRecord | null): PricingAnomaly[] {
  const anomalies: PricingAnomaly[] = [];
  if (record.value === 0) anomalies.push({ code: 'zero_price', severity: 'quarantine', recordId: record.id, message: 'Price is zero.' });
  if (record.value < 0) anomalies.push({ code: 'negative_price', severity: 'quarantine', recordId: record.id, message: 'Price is negative.' });
  if (!record.currency) anomalies.push({ code: 'missing_currency', severity: 'quarantine', recordId: record.id, message: 'Currency is missing.' });
  if (evaluateFreshness({ sourceKey: record.sourceKey, trade: record.trade, effectiveDate: record.effectiveDate }).status === 'expired') {
    anomalies.push({ code: 'stale_timestamp', severity: 'review', recordId: record.id, message: 'Pricing record is expired.' });
  }
  if (record.rateType === 'labor_only' && record.unit === 'hour' && record.value > 0 && record.value < 15) {
    anomalies.push({ code: 'suspicious_labor_rate', severity: 'review', recordId: record.id, message: 'Labor rate is suspiciously low.' });
  }
  if (record.rateType === 'material_only' && record.value > 100000) {
    anomalies.push({ code: 'suspicious_material_rate', severity: 'review', recordId: record.id, message: 'Material rate is suspiciously high.' });
  }
  if (previousRecord && previousRecord.value > 0) {
    const change = Math.abs((record.value - previousRecord.value) / previousRecord.value) * 100;
    if (change > 35) anomalies.push({ code: 'extreme_price_change', severity: 'review', recordId: record.id, message: `Price moved ${Math.round(change)}% from previous record.` });
  }
  return anomalies;
}

export function createPricingCacheKey(request: PricingSearchRequest, sourceKey: string): string {
  const region = request.region || {};
  return [
    sourceKey,
    request.scopeKey,
    request.trade,
    request.unit,
    request.quantity ? Math.round(request.quantity) : 'any_qty',
    region.zipCode || region.city || region.metro || region.county || region.state || 'national',
    request.sku || request.upc || request.productCategory || 'generic',
  ].map((part) => String(part).toLowerCase().replace(/\s+/g, '_')).join(':');
}

export function evaluateBenchmarkPrivacy(params: {
  companyCount: number;
  projectCount: number;
  minimumCompanyCount?: number;
  minimumProjectCount?: number;
  includesDirectCostAndSellingPrice?: boolean;
}): SharedBenchmarkPrivacyCheck {
  const minimumCompanyCount = params.minimumCompanyCount ?? 5;
  const minimumProjectCount = params.minimumProjectCount ?? 20;
  const reasons: string[] = [];
  if (params.companyCount < minimumCompanyCount) reasons.push('Not enough companies for anonymized benchmark.');
  if (params.projectCount < minimumProjectCount) reasons.push('Not enough projects for stable benchmark.');
  if (params.includesDirectCostAndSellingPrice) reasons.push('Direct cost and selling price cannot be pooled.');
  return {
    allowed: reasons.length === 0,
    reasons,
    minimumCompanyCount,
    minimumProjectCount,
  };
}

export function buildPricingCoverageMatrix(): PricingCoverageRow[] {
  const tier1 = [
    'demolition',
    'excavation',
    'grading',
    'utility_trenching',
    'concrete',
    'framing',
    'roofing',
    'insulation',
    'drywall',
    'painting',
    'flooring',
    'tile',
    'cabinets',
    'countertops',
    'plumbing',
    'electrical',
    'hvac',
    'landscaping',
    'cleanup',
  ];
  return tier1.map((trade) => {
    const supplierSupported = PRICING_SOURCE_REGISTRY.some((source) => source.sourceType === 'supplier' && source.supportedTrades?.includes(trade));
    const specHeavy = ['cabinets', 'countertops', 'hvac'].includes(trade);
    return {
      trade,
      tier: 1,
      scopeKeys: [trade],
      units: ['sqft', 'each', 'lf', 'cy'].filter((unit) => trade !== 'hvac' || unit === 'each'),
      sourceTypes: supplierSupported
        ? ['saved_rate', 'company_rate', 'supplier', 'localized_benchmark', 'national_average', 'manual']
        : ['saved_rate', 'company_rate', 'localized_benchmark', 'national_average', 'manual'],
      materialPricing: supplierSupported ? 'partial' : specHeavy ? 'manual_required' : 'covered_with_fallback',
      laborPricing: 'covered_with_fallback',
      installedPricing: 'covered_with_fallback',
      freshness: supplierSupported ? 'partial' : 'covered_with_fallback',
      confidence: supplierSupported ? 'medium' : 'low',
      fallbackAvailable: true,
      status: supplierSupported ? 'partial' : 'covered_with_fallback',
    } as PricingCoverageRow;
  });
}

export function sourceHealthFromError(sourceKey: string, error: unknown, checkedAt = new Date().toISOString()): PricingSourceHealth {
  const msg = String((error as { message?: string })?.message || error || '');
  if (/auth|unauthorized|forbidden/i.test(msg)) return { sourceKey, status: 'authentication_failed', checkedAt, message: 'Authentication failed.' };
  if (/rate.?limit|429/i.test(msg)) return { sourceKey, status: 'rate_limited', checkedAt, message: 'Source is rate limited.' };
  if (/timeout|abort/i.test(msg)) return { sourceKey, status: 'degraded', checkedAt, message: 'Source timed out.' };
  return { sourceKey, status: 'unavailable', checkedAt, message: 'Source unavailable.' };
}
