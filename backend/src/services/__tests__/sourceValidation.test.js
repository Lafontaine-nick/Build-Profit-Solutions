const { scopeToSkuQuery } = require('../pricingEngine/sources/skuQueryFromScope');
const {
  validateScopeItemSuggestion,
  isPlumbingTrimScope,
  vendorLiveAllowedForScope,
} = require('../pricingEngine/sourceValidation');

describe('sourceValidation', () => {
  test('plumbing trim is not vendor-live eligible', () => {
    const item = { scopeName: 'Plumbing Trim (Bathroom)', scope: '', unit: 'lump_sum' };
    expect(isPlumbingTrimScope(item)).toBe(true);
    expect(vendorLiveAllowedForScope(item)).toBe(false);
    expect(scopeToSkuQuery(item)).toBeNull();
  });

  test('electrical trim is not vendor-live eligible', () => {
    const item = { scopeName: 'Electrical Trim (Bathroom)', scope: '', unit: 'lump_sum' };
    expect(scopeToSkuQuery(item)).toBeNull();
  });

  test('baseboard trim may use vendor live', () => {
    const item = { scopeName: 'Baseboard Installation', scope: '', unit: 'lf', trade: 'baseboard' };
    expect(vendorLiveAllowedForScope(item)).toBe(true);
    expect(scopeToSkuQuery(item)).not.toBeNull();
  });

  test('cleanup rejects demo template rate mislabeled as saved template', () => {
    const scopeItem = {
      scopeName: 'Cleanup, Haul-off & Disposal',
      scope: 'Final clean, debris haul-off, dump fees',
      unit: 'lump_sum',
    };
    const proposedRates = [
      {
        label: 'Tile demo (labor)',
        pricingType: 'labor',
        rate: 2,
        unit: 'lump_sum',
        total: 2,
        source: 'saved_template',
        confidence: 'medium',
        assumptions: [],
      },
    ];
    const result = validateScopeItemSuggestion(scopeItem, proposedRates, {
      source: 'saved_template',
      confidence: 'medium',
    });
    expect(result.proposedRates).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/Needs manual pricing/i);
  });

  test('waterproofing rejects full-bathroom rates and flags high totals', () => {
    const scopeItem = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: 'Membrane, backer, and prep before tile',
      quantity: 90,
      unit: 'sqft',
    };
    const proposedRates = [
      {
        label: 'Bathroom materials',
        pricingType: 'material',
        rate: 45,
        unit: 'sqft',
        quantity: 90,
        total: 4050,
        source: 'national_trade_average',
        confidence: 'low',
        assumptions: [],
      },
      {
        label: 'Bathroom labor',
        pricingType: 'labor',
        rate: 85,
        unit: 'sqft',
        quantity: 90,
        total: 7650,
        source: 'national_trade_average',
        confidence: 'medium',
        assumptions: [],
      },
    ];
    const result = validateScopeItemSuggestion(scopeItem, proposedRates, {
      source: 'national_trade_average',
      confidence: 'low',
    });
    expect(result.proposedRates).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/Needs manual pricing/i);
  });

  test('waterproofing warns when saved rate is high but still valid', () => {
    const scopeItem = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: 'Membrane, backer, and prep before tile',
      quantity: 90,
      unit: 'sqft',
    };
    const proposedRates = [
      {
        label: 'Waterproofing material',
        pricingType: 'material',
        rate: 12,
        unit: 'sqft',
        quantity: 90,
        total: 1080,
        source: 'saved_template',
        confidence: 'medium',
        assumptions: [],
      },
      {
        label: 'Waterproofing labor',
        pricingType: 'labor',
        rate: 10,
        unit: 'sqft',
        quantity: 90,
        total: 900,
        source: 'saved_template',
        confidence: 'medium',
        assumptions: [],
      },
    ];
    const result = validateScopeItemSuggestion(scopeItem, proposedRates, {
      source: 'saved_template',
      confidence: 'medium',
    });
    expect(result.proposedRates).toHaveLength(2);
    expect(result.warnings.some((w) => /saved rate looks high/i.test(w))).toBe(true);
  });

  test('invalid supplier rate is stripped from plumbing trim suggestion', () => {
    const scopeItem = { scopeName: 'Plumbing Trim (Bathroom)', scope: '', unit: 'lump_sum' };
    const proposedRates = [
      {
        label: 'Material',
        pricingType: 'material',
        rate: 1.87,
        unit: 'lf',
        total: 2,
        source: 'supplier_pricing',
        confidence: 'medium',
        assumptions: [],
      },
      {
        label: 'Labor',
        pricingType: 'labor',
        rate: 5,
        unit: 'lf',
        total: 5,
        source: 'national_trade_average',
        confidence: 'medium',
        assumptions: [],
      },
    ];
    const result = validateScopeItemSuggestion(scopeItem, proposedRates, {
      source: 'supplier_pricing',
      confidence: 'medium',
    });
    expect(result.proposedRates).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/Needs manual pricing/i);
  });
});
