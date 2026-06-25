import {
  buildBenchmarkPricingCoverageReport,
  benchmarkRecordCoverageStatus,
} from '@/utils/benchmarkPricingCoverage';
import {
  listNationalAverageBenchmarkRecords,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

describe('benchmarkPricingCoverage', () => {
  it('inventories current national-average records with separated rate and scope-profile sources', () => {
    const records = listNationalAverageBenchmarkRecords();
    expect(records.length).toBeGreaterThan(20);

    const excavation = records.find((record) => record.itemKey === 'excavation' && record.unit === 'cy');
    expect(excavation).toMatchObject({
      rateSource: 'bps_national_benchmark',
      scopeProfileSource: 'bps_standard_assumption',
      scopeProfileCoverage: 'complete',
      productionStatus: 'review_required',
      productionReady: false,
    });
    expect(excavation?.costBucketLabels).toEqual(['Equipment', 'Labor']);

    const permits = records.find((record) => record.itemKey === 'permits');
    expect(permits).toMatchObject({
      pricingMethod: 'allowance',
      costBucketLabels: ['Allowance'],
    });
  });

  it('reports launch readiness without claiming all records are production-ready', () => {
    const report = buildBenchmarkPricingCoverageReport(listNationalAverageBenchmarkRecords(), new Date('2026-06-24T00:00:00Z'));
    expect(report.overall.total).toBeGreaterThan(20);
    expect(report.overall.reviewRequired + report.overall.fallbackOnly + report.overall.disabled).toBeGreaterThan(0);
    expect(report.partialOrUnsafeRecords.length).toBeGreaterThan(0);
    expect(report.byTrade.flooring.total).toBeGreaterThan(0);
  });

  it('explains record gating reasons', () => {
    const record = listNationalAverageBenchmarkRecords().find((item) => item.itemKey === 'flooring');
    expect(record).toBeTruthy();
    const status = benchmarkRecordCoverageStatus(record!);
    expect(status.productionReady).toBe(false);
    expect(status.reasons).toContain('freshness_missing');
  });

  it('attaches equipment and labor buckets to excavation suggested pricing', () => {
    const { fill } = resolveScopeItemSuggestedPricing(
      'excavation',
      { ...emptyQuickMeasurementInput(), excavationCy: '50', itemQuantities: {} },
      'addition',
      { quantity: 50, unit: 'cy', quantitySource: 'inferred' }
    );
    expect(fill?.costBuckets?.map((bucket) => bucket.label)).toEqual(['Equipment', 'Labor']);
    expect(fill?.benchmarkScopeProfile?.scopeProfileSource).toBe('bps_standard_assumption');
  });
});
