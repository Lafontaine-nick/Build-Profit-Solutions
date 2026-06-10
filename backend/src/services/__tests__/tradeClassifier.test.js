const {
  classifyTradeForPricing,
  isShowerWaterproofingScope,
  isShowerTileInstallScope,
} = require('../pricingEngine/tradeClassifier');
const { lookupNationalTradeAverage } = require('../pricingEngine/sources/nationalTradeAverage');

describe('tradeClassifier shower scopes', () => {
  test('waterproofing & backer board is shower_waterproofing not bathroom', () => {
    expect(
      classifyTradeForPricing(
        'Shower Waterproofing & Backer Board',
        'Shower waterproofing membrane and backer board before tile'
      )
    ).toBe('shower_waterproofing');
    expect(isShowerWaterproofingScope('Shower Waterproofing & Backer Board', '')).toBe(true);
    expect(isShowerTileInstallScope('Shower Waterproofing & Backer Board', '')).toBe(false);
  });

  test('shower wall tile install is shower_tile not bathroom', () => {
    expect(classifyTradeForPricing('Shower wall tile installation', 'Tile labor and materials')).toBe(
      'shower_tile'
    );
    expect(isShowerTileInstallScope('Shower Wall Tile Installation', '')).toBe(true);
  });

  test('national average for waterproofing uses low backer-board rates', () => {
    const scopeItem = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: 'Membrane, backer, and prep before tile',
      quantity: 90,
      unit: 'sqft',
      trade: 'shower_waterproofing',
    };
    const result = lookupNationalTradeAverage(scopeItem, { draft: {} });
    expect(result.available).toBe(true);
    const mat = result.rates.find((r) => r.pricingType === 'material');
    const lab = result.rates.find((r) => r.pricingType === 'labor');
    expect(mat.rate).toBe(5);
    expect(lab.rate).toBe(7);
    expect(mat.rate * 90 + lab.rate * 90).toBe(1080);
  });
});
