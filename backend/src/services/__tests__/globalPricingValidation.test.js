const { classifyScopeItem } = require('../pricingEngine/scopeClassification');
const {
  validateScopeItemPricing,
  validatePricingProposal,
  REVIEW_STATUS,
} = require('../pricingEngine/globalPricingValidation');
const { getPricingRange } = require('../pricingEngine/pricingRangeCatalog');
const { validateScopeItemSuggestion } = require('../pricingEngine/sourceValidation');

describe('globalPricingValidation', () => {
  test('classifies waterproofing as subScope with correct category', () => {
    const item = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: 'Membrane, backer, and prep before tile',
      quantity: 90,
      unit: 'sqft',
    };
    const c = classifyScopeItem(item, {});
    expect(c.pricingCategory).toBe('shower_waterproofing');
    expect(c.scopeType).toBe('subScope');
    expect(c.pricingUnit).toBe('sqft');
  });

  test('validates reasonable waterproofing rates without blocking', () => {
    const item = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: '',
      quantity: 90,
      unit: 'sqft',
    };
    const rates = [
      {
        pricingType: 'material',
        rate: 5,
        unit: 'sqft',
        quantity: 90,
        total: 450,
        source: 'national_trade_average',
      },
      {
        pricingType: 'labor',
        rate: 7,
        unit: 'sqft',
        quantity: 90,
        total: 630,
        source: 'national_trade_average',
      },
    ];
    const result = validateScopeItemPricing(item, rates, {});
    expect(result.requiresConfirmBeforeApply).toBe(false);
    expect(result.reviewStatus).toBe(REVIEW_STATUS.SUGGESTED_ROUGH);
    expect(result.warnings.some((w) => /scope mismatch/i.test(w))).toBe(false);
  });

  test('flags bathroom-level rates on waterproofing subScope', () => {
    const item = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: '',
      quantity: 90,
      unit: 'sqft',
    };
    const rates = [
      {
        pricingType: 'material',
        rate: 45,
        unit: 'sqft',
        quantity: 90,
        total: 4050,
        source: 'national_trade_average',
      },
      {
        pricingType: 'labor',
        rate: 85,
        unit: 'sqft',
        quantity: 90,
        total: 7650,
        source: 'national_trade_average',
      },
    ];
    const result = validateScopeItemPricing(item, rates, {});
    expect(result.requiresConfirmBeforeApply).toBe(true);
    expect(result.reviewStatuses).toContain(REVIEW_STATUS.SCOPE_MISMATCH);
    expect(result.warnings.some((w) => /mismatch|high|assembly/i.test(w))).toBe(true);
  });

  test('validateScopeItemSuggestion strips invalid full-package rates', () => {
    const item = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: '',
      quantity: 90,
      unit: 'sqft',
    };
    const rates = [
      {
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
    const result = validateScopeItemSuggestion(item, rates, { source: 'national_trade_average' });
    expect(result.proposedRates).toHaveLength(0);
    expect(result.reviewStatus).toBe(REVIEW_STATUS.NEEDS_PRICE);
  });

  test('pricing range catalog covers major trades', () => {
    expect(getPricingRange('kitchen').material.typical).toBeGreaterThan(0);
    expect(getPricingRange('plumbing').allowedUnits).toContain('hour');
    expect(getPricingRange('cleanup').defaultScopeType).toBe('allowance');
  });

  test('proposal validation aggregates confirm flags', () => {
    const items = [
      {
        scopeName: 'Shower Waterproofing & Backer Board',
        scope: '',
        quantity: 90,
        unit: 'sqft',
        proposedRates: [
          { pricingType: 'material', rate: 45, total: 4050, source: 'national_trade_average' },
          { pricingType: 'labor', rate: 85, total: 7650, source: 'national_trade_average' },
        ],
      },
    ];
    const result = validatePricingProposal(items, {});
    expect(result.requiresConfirmBeforeApply).toBe(true);
  });
});
