const {
  validatePricingUnits,
  isRateUnitCompatibleWithQuantity,
  isAutoSelectEligibleScope,
  isNeverAutoSelectScope,
  MANUAL_PRICING_MESSAGE,
} = require('../pricingEngine/pricingUnitValidation');

describe('pricingUnitValidation', () => {
  test('blocks sqft rates on each-based vanity install', () => {
    const scopeItem = { scopeName: 'Vanity Installation', unit: 'each', quantity: 1 };
    const rates = [
      { pricingType: 'material', rate: 8, unit: 'sqft', total: 8 },
      { pricingType: 'labor', rate: 14, unit: 'sqft', total: 14 },
    ];
    const result = validatePricingUnits(scopeItem, rates);
    expect(result.blocked).toBe(true);
    expect(result.rates).toHaveLength(0);
    expect(result.warnings[0]).toBe(MANUAL_PRICING_MESSAGE);
    expect(result.unitMismatchSubtext).toMatch(/sqft.*each/i);
  });

  test('allows sqft rates on sqft shower tile', () => {
    const scopeItem = { scopeName: 'Shower Tile Installation', unit: 'sqft', quantity: 90 };
    const rates = [
      { pricingType: 'material', rate: 8, unit: 'sqft', total: 720 },
      { pricingType: 'labor', rate: 14, unit: 'sqft', total: 1260 },
    ];
    const result = validatePricingUnits(scopeItem, rates);
    expect(result.blocked).toBe(false);
    expect(result.rates).toHaveLength(2);
  });

  test('allows each fixture rates on each niche', () => {
    const scopeItem = { scopeName: 'Shower Niche', unit: 'each', quantity: 1 };
    const rates = [{ pricingType: 'labor', rate: 600, unit: 'each', total: 600 }];
    const result = validatePricingUnits(scopeItem, rates);
    expect(result.blocked).toBe(false);
    expect(result.rates).toHaveLength(1);
  });

  test('isRateUnitCompatibleWithQuantity rejects LF on sqft', () => {
    expect(isRateUnitCompatibleWithQuantity('sqft', { unit: 'lf', rate: 5 })).toBe(false);
  });

  test('isNeverAutoSelectScope for vanity and toilet', () => {
    expect(isNeverAutoSelectScope({ scopeName: 'Vanity Installation' })).toBe(true);
    expect(isNeverAutoSelectScope({ scopeName: 'Toilet Installation' })).toBe(true);
  });

  test('isAutoSelectEligibleScope for waterproofing and demo', () => {
    expect(
      isAutoSelectEligibleScope({ scopeName: 'Shower Waterproofing & Backer Board', trade: 'shower_waterproofing' })
    ).toBe(true);
    expect(isAutoSelectEligibleScope({ scopeName: 'Bathroom Demo', trade: 'demo' })).toBe(true);
    expect(isAutoSelectEligibleScope({ scopeName: 'Vanity Installation' })).toBe(false);
  });

  test('manual-only plumbing trim without saved source', () => {
    const scopeItem = { scopeName: 'Plumbing (Bathroom)', unit: 'lump_sum', quantity: 1 };
    const rates = [
      { pricingType: 'labor', rate: 42, unit: 'sqft', total: 42, source: 'national_trade_average' },
    ];
    const result = validatePricingUnits(scopeItem, rates);
    expect(result.blocked).toBe(false);
    expect(result.rates).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/no reliable source/i);
  });
});
