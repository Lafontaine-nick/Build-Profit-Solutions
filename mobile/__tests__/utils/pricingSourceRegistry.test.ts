import {
  LAUNCH_MARKETS,
  PRICING_COVERAGE_MATRIX_VERSION,
  PRICING_NORMALIZATION_VERSION,
  PRICING_SELECTION_VERSION,
  PRICING_SOURCE_REGISTRY,
  PRICING_SOURCE_REGISTRY_VERSION,
  buildPricingCoverageMatrix,
  calculateBurdenedLaborCost,
  createPricingCacheKey,
  detectPricingAnomalies,
  evaluateBenchmarkPrivacy,
  evaluateFreshness,
  getEnabledPricingSources,
  getPricingSourceDefinition,
  matchProduct,
  normalizeExternalPricingRecord,
  normalizePackagePrice,
  regionalMatchLevel,
  selectPricingSource,
  sourceHealthFromError,
  sourceSupportsRequest,
  type NormalizedPricingRecord,
} from '@/utils/pricingSourceRegistry';

function record(overrides: Partial<NormalizedPricingRecord> = {}): NormalizedPricingRecord {
  return {
    id: overrides.id || 'saved-flooring',
    sourceKey: overrides.sourceKey || 'saved_rate',
    trade: overrides.trade || 'flooring',
    scopeKey: overrides.scopeKey || 'flooring',
    description: overrides.description || 'Flooring installed rate',
    rateType: overrides.rateType || 'installed_unit_rate',
    value: overrides.value ?? 7,
    currency: overrides.currency || 'USD',
    unit: overrides.unit || 'sqft',
    region: overrides.region || { country: 'US', state: 'UT', metro: 'St. George', zipCode: '84770' },
    effectiveDate: overrides.effectiveDate || '2026-06-01',
    confidence: overrides.confidence || 'high',
    metadataCompleteness: overrides.metadataCompleteness || 'complete',
    ...overrides,
  };
}

describe('pricingSourceRegistry', () => {
  it('versions pricing data logic and defines launch markets', () => {
    expect(PRICING_SOURCE_REGISTRY_VERSION).toBe('1.0.0');
    expect(PRICING_NORMALIZATION_VERSION).toBe('1.0.0');
    expect(PRICING_SELECTION_VERSION).toBe('1.0.0');
    expect(PRICING_COVERAGE_MATRIX_VERSION).toBe('1.0.0');
    expect(LAUNCH_MARKETS.map((market) => market.key)).toEqual(
      expect.arrayContaining(['utah_st_george', 'utah_salt_lake', 'nevada_las_vegas', 'arizona_phoenix', 'national'])
    );
  });

  it('keeps declarative source priority and feature-flag disable support', () => {
    expect(getPricingSourceDefinition('project_quote')?.priority).toBeGreaterThan(getPricingSourceDefinition('saved_rate')!.priority);
    expect(getPricingSourceDefinition('saved_rate')?.priority).toBeGreaterThan(getPricingSourceDefinition('supplier_retail')!.priority);
    expect(getPricingSourceDefinition('supplier_retail')?.priority).toBeGreaterThan(getPricingSourceDefinition('national_average')!.priority);

    const enabled = getEnabledPricingSources({ supplierPricing: false });
    expect(enabled.some((source) => source.key === 'supplier_retail')).toBe(false);
    expect(enabled[0].key).toBe('project_quote');
  });

  it('filters unsupported scope, unit, trade, and region', () => {
    const supplier = getPricingSourceDefinition('supplier_retail')!;
    expect(
      sourceSupportsRequest(supplier, {
        scopeKey: 'flooring',
        trade: 'flooring',
        unit: 'sqft',
        region: { country: 'US', state: 'UT', metro: 'St. George', zipCode: '84770' },
      })
    ).toBe(true);
    expect(sourceSupportsRequest(supplier, { scopeKey: 'flooring', trade: 'flooring', unit: 'hour' })).toBe(false);
    expect(sourceSupportsRequest(supplier, { scopeKey: 'specialty', trade: 'elevator', unit: 'each' })).toBe(false);
  });

  it('normalizes external records and rejects malformed raw responses', () => {
    expect(normalizeExternalPricingRecord({ sourceKey: 'supplier_retail', trade: 'flooring', scopeKey: 'flooring', unitPrice: 3.25, unit: 'sqft' })).toMatchObject({
      sourceKey: 'supplier_retail',
      value: 3.25,
      currency: 'USD',
      registryVersion: PRICING_SOURCE_REGISTRY_VERSION,
      normalizationVersion: PRICING_NORMALIZATION_VERSION,
    });
    expect(normalizeExternalPricingRecord({ sourceKey: 'supplier_retail', trade: 'flooring', scopeKey: 'flooring', unit: 'sqft', price: 0 })).toBeNull();
  });

  it('matches products without overstating approximate matches', () => {
    expect(matchProduct({ sku: 'ABC123' }, { sku: 'ABC123' }).status).toBe('exact');
    expect(
      matchProduct(
        { manufacturer: 'Schluter', productCategory: 'waterproofing membrane', thickness: '1/8' },
        { manufacturer: 'Schluter', productCategory: 'waterproofing membrane', thickness: '1/8' }
      ).status
    ).toBe('strong');
    expect(matchProduct({ productCategory: 'lvp flooring' }, { productCategory: 'lvp flooring' }).status).toBe('approximate');
    expect(matchProduct({ upc: '123' }, { upc: '999' }).status).toBe('unmatched');
  });

  it('normalizes package pricing only when conversion data is sufficient', () => {
    expect(
      normalizePackagePrice({
        sourcePrice: 72,
        sourceUnit: 'box',
        packageUnit: 'box',
        coverageQuantity: 24,
        coverageUnit: 'sqft',
        desiredUnit: 'sqft',
        coverageSource: 'manufacturer coverage',
      })
    ).toMatchObject({ normalizedPrice: 3, normalizedUnit: 'sqft', confidence: 'high' });

    expect(
      normalizePackagePrice({
        sourcePrice: 45,
        sourceUnit: 'sheet',
        packageUnit: 'sheet',
        coverageQuantity: 32,
        coverageUnit: 'sqft',
        desiredUnit: 'sqft',
      }).normalizedPrice
    ).toBe(1.4063);

    expect(
      normalizePackagePrice({
        sourcePrice: 120,
        sourceUnit: 'bundle',
        packageUnit: 'bundle',
        coverageQuantity: 0.33,
        coverageUnit: 'square',
        desiredUnit: 'square',
      }).normalizedPrice
    ).toBeCloseTo(363.6364);

    expect(
      normalizePackagePrice({
        sourcePrice: 18,
        sourceUnit: 'piece',
        packageUnit: 'piece',
        packageQuantity: 12,
        desiredUnit: 'lf',
      }).normalizedPrice
    ).toBe(1.5);

    expect(
      normalizePackagePrice({
        sourcePrice: 25,
        sourceUnit: 'gallon',
        packageUnit: 'gallon',
        coverageQuantity: 350,
        coverageUnit: 'sqft',
        desiredUnit: 'sqft',
      }).normalizedPrice
    ).toBe(0.0714);

    const tonWithoutDensity = normalizePackagePrice({
      sourcePrice: 42,
      sourceUnit: 'ton',
      desiredUnit: 'cy',
    });
    expect(tonWithoutDensity.normalizedPrice).toBeUndefined();
    expect(tonWithoutDensity.notices.some((notice) => notice.code === 'missing_density')).toBe(true);

    const tonWithDensity = normalizePackagePrice({
      sourcePrice: 42,
      sourceUnit: 'ton',
      desiredUnit: 'cy',
      densityTonPerCy: 1.35,
    });
    expect(tonWithDensity.normalizedPrice).toBe(56.7);
  });

  it('labels retail pricing and keeps confidence lower than contractor pricing', () => {
    const result = normalizePackagePrice({
      sourcePrice: 72,
      sourceUnit: 'box',
      packageUnit: 'box',
      coverageQuantity: 24,
      coverageUnit: 'sqft',
      desiredUnit: 'sqft',
      retailBasis: 'consumer_retail',
    });
    expect(result.confidence).toBe('low');
    expect(result.notices.some((notice) => notice.code === 'retail_price_label')).toBe(true);
  });

  it('evaluates regional fallback levels', () => {
    expect(regionalMatchLevel({ zipCode: '84770', state: 'UT' }, { zipCode: '84770', state: 'UT' })).toBe('same_zip');
    expect(regionalMatchLevel({ city: 'St. George', state: 'UT' }, { city: 'St. George', state: 'UT' })).toBe('same_city');
    expect(regionalMatchLevel({ metro: 'Salt Lake City', state: 'UT' }, { metro: 'Salt Lake City', state: 'UT' })).toBe('same_metro');
    expect(regionalMatchLevel({ county: 'Washington', state: 'UT' }, { county: 'Washington', state: 'UT' })).toBe('same_county');
    expect(regionalMatchLevel({ state: 'UT' }, { state: 'UT' })).toBe('same_state');
    expect(regionalMatchLevel({ country: 'US' }, { state: 'CA', country: 'US' })).toBe('national');
  });

  it('applies source-specific freshness policies and expiration', () => {
    expect(
      evaluateFreshness({
        sourceKey: 'supplier_retail',
        trade: 'concrete',
        effectiveDate: '2026-06-20',
        now: '2026-06-22',
      }).status
    ).toBe('current');
    expect(
      evaluateFreshness({
        sourceKey: 'supplier_retail',
        trade: 'concrete',
        effectiveDate: '2026-06-01',
        now: '2026-06-22',
      }).status
    ).toBe('expired');
    expect(
      evaluateFreshness({
        sourceKey: 'project_quote',
        effectiveDate: '2026-06-01',
        expirationDate: '2026-06-10',
        now: '2026-06-22',
      }).status
    ).toBe('expired');
  });

  it('preserves selected saved/company/project/user pricing over external alternatives', () => {
    const current = record({ sourceKey: 'saved_rate', value: 7 });
    const supplier = record({ id: 'supplier-flooring', sourceKey: 'supplier_retail', value: 7.65, rateType: 'material_only', confidence: 'medium' });
    const selected = selectPricingSource({
      request: { scopeKey: 'flooring', trade: 'flooring', unit: 'sqft' },
      currentRecord: current,
      records: [supplier],
    });
    expect(selected.selected).toBe(current);
    expect(selected.alternatives[0]).toBe(supplier);
    expect(selected.comparisonMetadata.currentSourcePreserved).toBe(true);
  });

  it('selects local source above national only when hierarchy allows', () => {
    const local = record({ id: 'local-flooring', sourceKey: 'localized_benchmark', value: 7.5, confidence: 'medium' });
    const national = record({ id: 'national-flooring', sourceKey: 'national_average', value: 6.5, confidence: 'low' });
    const selected = selectPricingSource({
      request: { scopeKey: 'flooring', trade: 'flooring', unit: 'sqft' },
      records: [national, local],
    });
    expect(selected.selected?.id).toBe('local-flooring');
    expect(selected.alternatives[0].id).toBe('national-flooring');
  });

  it('retains manual pricing availability when no compatible source exists', () => {
    const selected = selectPricingSource({
      request: { scopeKey: 'elevator', trade: 'elevator', unit: 'each' },
      records: [record({ scopeKey: 'flooring', trade: 'flooring' })],
      unavailableSourceKeys: ['supplier_retail'],
    });
    expect(selected.selected).toBeNull();
    expect(selected.reason).toMatch(/No compatible/);
  });

  it('keeps labor classifications distinct and supports company burden configuration', () => {
    expect(calculateBurdenedLaborCost(40, {
      payrollBurdenPercent: 8,
      insuranceBurdenPercent: 12,
      benefitsPercent: 5,
      smallToolsPercent: 3,
      vehicleAllowancePerHour: 4,
    })).toBe(55.2);
  });

  it('detects anomalies and quarantines invalid pricing records', () => {
    expect(detectPricingAnomalies(record({ id: 'zero', value: 0 })).some((a) => a.code === 'zero_price' && a.severity === 'quarantine')).toBe(true);
    expect(detectPricingAnomalies(record({ id: 'negative', value: -1 })).some((a) => a.code === 'negative_price')).toBe(true);
    expect(detectPricingAnomalies(record({ id: 'labor-low', rateType: 'labor_only', unit: 'hour', value: 8 })).some((a) => a.code === 'suspicious_labor_rate')).toBe(true);
    expect(detectPricingAnomalies(record({ id: 'jump', value: 20 }), record({ id: 'old', value: 10 })).some((a) => a.code === 'extreme_price_change')).toBe(true);
  });

  it('creates region-isolated cache keys and maps source health failures', () => {
    const key = createPricingCacheKey({
      scopeKey: 'flooring',
      trade: 'flooring',
      unit: 'sqft',
      quantity: 1200,
      region: { zipCode: '84770' },
      sku: 'ABC123',
    }, 'supplier_retail');
    expect(key).toContain('supplier_retail:flooring:flooring:sqft:1200:84770:abc123');
    expect(sourceHealthFromError('supplier_retail', new Error('429 rate limit')).status).toBe('rate_limited');
    expect(sourceHealthFromError('supplier_retail', new Error('unauthorized')).status).toBe('authentication_failed');
    expect(sourceHealthFromError('supplier_retail', new Error('timeout')).status).toBe('degraded');
  });

  it('enforces privacy thresholds for shared benchmarks', () => {
    expect(evaluateBenchmarkPrivacy({ companyCount: 1, projectCount: 50 }).allowed).toBe(false);
    expect(evaluateBenchmarkPrivacy({ companyCount: 6, projectCount: 25, includesDirectCostAndSellingPrice: true }).allowed).toBe(false);
    expect(evaluateBenchmarkPrivacy({ companyCount: 6, projectCount: 25 }).allowed).toBe(true);
  });

  it('builds structured launch coverage rows for internal dashboards', () => {
    const matrix = buildPricingCoverageMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(19);
    expect(matrix.find((row) => row.trade === 'flooring')).toMatchObject({
      tier: 1,
      materialPricing: 'partial',
      fallbackAvailable: true,
    });
    expect(matrix.every((row) => row.status !== 'unsupported')).toBe(true);
  });
});
