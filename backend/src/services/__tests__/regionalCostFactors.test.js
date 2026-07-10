const {
  resolveRegionalCostFactor,
  resolveCountyCostFactor,
  factorsFromIndex,
  zip3ToState,
  stateFromText,
  factorToPercentLabel,
} = require('../pricingEngine/regionalCostFactors');
const { lookupNationalTradeAverage } = require('../pricingEngine/sources/nationalTradeAverage');
const { lookupCostDatabase } = require('../pricingEngine/sources/costDatabase');

describe('regionalCostFactors (Phase 2)', () => {
  test('no location resolves to the national default (factors = 1.0)', () => {
    const f = resolveRegionalCostFactor('', '');
    expect(f.isDefault).toBe(true);
    expect(f.laborFactor).toBe(1.0);
    expect(f.materialFactor).toBe(1.0);
  });

  test('metro text resolves to a metro override', () => {
    const f = resolveRegionalCostFactor('Las Vegas, NV', '');
    expect(f.region).toBe('las_vegas');
    expect(f.source).toBe('metro_override');
    expect(f.laborFactor).toBeGreaterThan(1);
  });

  test('metro ZIP resolves to a metro override', () => {
    const f = resolveRegionalCostFactor('', '89141');
    expect(f.region).toBe('las_vegas');
    expect(f.source).toBe('metro_override');
  });

  test('state text resolves to a state index (below national for UT)', () => {
    const f = resolveRegionalCostFactor('Provo, Utah', '');
    expect(f.region).toBe('UT');
    expect(f.source).toBe('state_index');
    expect(f.laborFactor).toBeLessThan(1);
  });

  test('ZIP resolves to state when no metro/county match', () => {
    expect(zip3ToState('30339')).toBe('GA');
    expect(zip3ToState('75001')).toBe('TX');
    const f = resolveRegionalCostFactor('', '30339');
    expect(f.region).toBe('GA');
    expect(f.laborFactor).toBeLessThan(1);
  });

  test('two-letter state abbreviations are detected in text', () => {
    expect(stateFromText('Reno, NV')).toBe('NV');
    expect(stateFromText('Austin, TX 78701')).toBe('TX');
  });

  test('unknown location falls back to national default', () => {
    const f = resolveRegionalCostFactor('Somewhere', '');
    expect(f.isDefault).toBe(true);
  });

  test('labor swings more than material; factors are clamped', () => {
    const high = factorsFromIndex(1.35);
    expect(high.laborFactor).toBeGreaterThan(high.materialFactor);
    expect(high.laborFactor).toBeLessThanOrEqual(1.5);
    expect(high.materialFactor).toBeLessThanOrEqual(1.25);
    const low = factorsFromIndex(0.5);
    expect(low.laborFactor).toBeGreaterThanOrEqual(0.75);
    expect(low.materialFactor).toBeGreaterThanOrEqual(0.85);
  });

  test('factorToPercentLabel formats signed percentages', () => {
    expect(factorToPercentLabel(1.05)).toBe('+5%');
    expect(factorToPercentLabel(0.86)).toBe('-14%');
  });
});

describe('county cost factors (medium-term)', () => {
  test('ZIP 89141 resolves to Clark County / Las Vegas metro precision', () => {
    const f = resolveCountyCostFactor('', '89141');
    expect(f.geographicPrecision).toMatch(/metro|county/);
    expect(f.laborFactor).toBeGreaterThan(1);
  });

  test('ZIP 84101 resolves to Salt Lake County', () => {
    const f = resolveCountyCostFactor('', '84101');
    expect(f.region).toBe('salt_lake_ut');
    expect(f.geographicPrecision).toBe('county');
  });

  test('county name in address resolves', () => {
    const f = resolveCountyCostFactor('123 Main St, Clark County, NV', '');
    expect(f.region).toBe('clark_nv');
    expect(f.geographicPrecision).toBe('county');
  });
});

describe('national trade average is unadjusted', () => {
  const scopeItem = {
    scopeName: 'LVP flooring',
    scope: 'install lvp',
    trade: 'flooring',
    unit: 'sqft',
    quantity: 100,
  };

  test('returns raw national band regardless of location', () => {
    const res = lookupNationalTradeAverage(scopeItem, {
      projectLocation: 'Las Vegas, NV',
      draft: {},
    });
    const labor = res.rates.find((r) => r.pricingType === 'labor');
    const material = res.rates.find((r) => r.pricingType === 'material');
    expect(labor.rate).toBe(5);
    expect(material.rate).toBe(4);
  });
});

describe('construction cost database applies location factors', () => {
  const scopeItem = {
    scopeName: 'LVP flooring',
    scope: 'install lvp',
    trade: 'flooring',
    unit: 'sqft',
    quantity: 100,
  };

  test('no location → unavailable (falls through to national)', () => {
    const res = lookupCostDatabase(scopeItem, { draft: {} });
    expect(res.available).toBe(false);
  });

  test('high-cost metro raises labor vs national', () => {
    const res = lookupCostDatabase(scopeItem, {
      projectLocation: 'Las Vegas, NV',
      draft: {},
    });
    expect(res.available).toBe(true);
    expect(res.dataSource).toBe('static_index');
    const labor = res.rates.find((r) => r.pricingType === 'labor');
    expect(labor.rate).toBeGreaterThan(5);
    expect(labor.assumptions.some((a) => /Las Vegas|Clark/i.test(a))).toBe(true);
  });

  test('low-cost state lowers labor vs national', () => {
    const res = lookupCostDatabase(scopeItem, {
      projectLocation: 'Jackson, MS',
      draft: {},
    });
    expect(res.available).toBe(true);
    const labor = res.rates.find((r) => r.pricingType === 'labor');
    expect(labor.rate).toBeLessThan(5);
  });

  test('ignores fallback supplier ZIP', () => {
    const res = lookupCostDatabase(scopeItem, {
      zipCode: '30339',
      supplierZipIsFallback: true,
      draft: {},
    });
    expect(res.available).toBe(false);
  });
});
