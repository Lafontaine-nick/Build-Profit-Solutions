import {
  listNationalAverageBenchmarkRecords,
  type BenchmarkPricingCatalogRecord,
  type BenchmarkPricingCoverageStatus,
  type BenchmarkPricingProductionStatus,
} from '@/utils/scopeItemQuantities';

export type BenchmarkCoverageBucket = {
  total: number;
  productionReady: number;
  reviewRequired: number;
  fallbackOnly: number;
  disabled: number;
  completeProfiles: number;
  partialProfiles: number;
  missingProfiles: number;
  invalidRates: number;
  staleOrUnknownFreshness: number;
};

export type BenchmarkPricingCoverageReport = {
  generatedAt: string;
  overall: BenchmarkCoverageBucket;
  byTrade: Record<string, BenchmarkCoverageBucket>;
  byPricingMethod: Record<string, BenchmarkCoverageBucket>;
  byGeographicBasis: Record<string, BenchmarkCoverageBucket>;
  records: BenchmarkPricingCatalogRecord[];
  productionReadyRecords: BenchmarkPricingCatalogRecord[];
  partialOrUnsafeRecords: BenchmarkPricingCatalogRecord[];
};

function emptyBucket(): BenchmarkCoverageBucket {
  return {
    total: 0,
    productionReady: 0,
    reviewRequired: 0,
    fallbackOnly: 0,
    disabled: 0,
    completeProfiles: 0,
    partialProfiles: 0,
    missingProfiles: 0,
    invalidRates: 0,
    staleOrUnknownFreshness: 0,
  };
}

function addToBucket(bucket: BenchmarkCoverageBucket, record: BenchmarkPricingCatalogRecord): void {
  bucket.total += 1;
  if (record.productionStatus === 'production_ready') bucket.productionReady += 1;
  if (record.productionStatus === 'review_required') bucket.reviewRequired += 1;
  if (record.productionStatus === 'fallback_only') bucket.fallbackOnly += 1;
  if (record.productionStatus === 'disabled') bucket.disabled += 1;
  if (record.scopeProfileCoverage === 'complete') bucket.completeProfiles += 1;
  if (record.scopeProfileCoverage === 'partial') bucket.partialProfiles += 1;
  if (record.scopeProfileCoverage === 'missing') bucket.missingProfiles += 1;
  if (record.pricingCoverage === 'invalid') bucket.invalidRates += 1;
  if (record.freshnessCoverage !== 'complete') bucket.staleOrUnknownFreshness += 1;
}

function addGrouped(
  groups: Record<string, BenchmarkCoverageBucket>,
  key: string,
  record: BenchmarkPricingCatalogRecord
): void {
  groups[key] ||= emptyBucket();
  addToBucket(groups[key], record);
}

export function benchmarkRecordCoverageStatus(record: BenchmarkPricingCatalogRecord): {
  pricingCoverage: BenchmarkPricingCoverageStatus;
  productionStatus: BenchmarkPricingProductionStatus;
  productionReady: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (record.pricingCoverage !== 'complete') reasons.push(`pricing_${record.pricingCoverage}`);
  if (record.scopeProfileCoverage !== 'complete') reasons.push(`scope_profile_${record.scopeProfileCoverage}`);
  if (record.freshnessCoverage !== 'complete') reasons.push('freshness_missing');
  if (record.sourceCoverage === 'missing') reasons.push('source_missing');
  if (record.costBucketLabels.length === 0) reasons.push('cost_buckets_missing');
  return {
    pricingCoverage: record.pricingCoverage,
    productionStatus: record.productionStatus,
    productionReady: record.productionReady,
    reasons,
  };
}

export function buildBenchmarkPricingCoverageReport(
  records: BenchmarkPricingCatalogRecord[] = listNationalAverageBenchmarkRecords(),
  now: Date = new Date()
): BenchmarkPricingCoverageReport {
  const overall = emptyBucket();
  const byTrade: Record<string, BenchmarkCoverageBucket> = {};
  const byPricingMethod: Record<string, BenchmarkCoverageBucket> = {};
  const byGeographicBasis: Record<string, BenchmarkCoverageBucket> = {};

  for (const record of records) {
    addToBucket(overall, record);
    addGrouped(byTrade, record.trade || 'unknown', record);
    addGrouped(byPricingMethod, record.pricingMethod || 'unknown', record);
    addGrouped(byGeographicBasis, record.geographicBasis || 'unknown', record);
  }

  return {
    generatedAt: now.toISOString(),
    overall,
    byTrade,
    byPricingMethod,
    byGeographicBasis,
    records,
    productionReadyRecords: records.filter((record) => record.productionReady),
    partialOrUnsafeRecords: records.filter((record) => !record.productionReady),
  };
}
