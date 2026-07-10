const {
  NATIONAL_TRADE_AVERAGES,
  BENCHMARK_PRICING_META,
} = require('../pricingEngine/constants');
const { PRICING_RANGE_CATALOG } = require('../pricingEngine/pricingRangeCatalog');

/**
 * Every trade key classifyTradeForPricing can emit. Guards against a classifier
 * output silently falling through to the generic `other` national average.
 * bathroom_fixture is priced via planningQuantities, not a flat trade band.
 */
const CLASSIFIER_TRADES = [
  'shower_full_package',
  'shower_waterproofing',
  'shower_tile',
  'baseboard',
  'flooring',
  'demo',
  'kitchen',
  'plumbing',
  'plumbing_service',
  'electrical',
  'roofing',
  'painting',
  'concrete',
  'bathroom',
  'other',
];
const SPECIALLY_PRICED_TRADES = new Set(['bathroom_fixture']);

describe('benchmark pricing data consistency (Phase 1 guard)', () => {
  test('benchmark tables carry provenance metadata', () => {
    expect(BENCHMARK_PRICING_META).toMatchObject({
      region: 'national',
      currency: 'USD',
      basis: expect.any(String),
      lastReviewed: expect.stringMatching(/^\d{4}-\d{2}$/),
    });
  });

  test('every classifier trade has a national average (no silent fallback to other)', () => {
    for (const trade of CLASSIFIER_TRADES) {
      if (SPECIALLY_PRICED_TRADES.has(trade)) continue;
      expect(NATIONAL_TRADE_AVERAGES[trade]).toBeDefined();
    }
  });

  test('range catalog bands are internally ordered (low <= typical <= high <= extremeWarning)', () => {
    for (const [category, range] of Object.entries(PRICING_RANGE_CATALOG)) {
      for (const role of ['material', 'labor']) {
        const band = range[role];
        if (!band) continue;
        expect(band.low).toBeLessThanOrEqual(band.typical);
        expect(band.typical).toBeLessThanOrEqual(band.high);
        expect(band.high).toBeLessThanOrEqual(band.extremeWarning);
      }
    }
  });

  test('national average material/labor stays within the range band for shared trades', () => {
    for (const [trade, band] of Object.entries(NATIONAL_TRADE_AVERAGES)) {
      const range = PRICING_RANGE_CATALOG[trade];
      if (!range) continue;
      for (const role of ['material', 'labor']) {
        const national = band[role];
        const rangeBand = range[role];
        if (national == null || national <= 0 || !rangeBand) continue;
        expect(national).toBeGreaterThanOrEqual(rangeBand.low);
        expect(national).toBeLessThanOrEqual(rangeBand.high);
      }
    }
  });

  test('national average unit matches or is allowed by the range catalog for shared trades', () => {
    for (const [trade, band] of Object.entries(NATIONAL_TRADE_AVERAGES)) {
      const range = PRICING_RANGE_CATALOG[trade];
      if (!range) continue;
      const allowed = new Set([range.unit, ...(range.allowedUnits || [])]);
      expect(allowed.has(band.unit)).toBe(true);
    }
  });
});
