const {
  resolveScopePricingRule,
  isManualPricingFallback,
  isNeedsApprovalScope,
  isAutoSelectAllowed,
} = require('../pricingEngine/scopePricingMatrix');
const { validateScopeItemSuggestion } = require('../pricingEngine/sourceValidation');
const { REVIEW_STATUS } = require('../pricingEngine/globalPricingValidation');
const { getPricingProposal } = require('../pricingEngine/getPricingProposal');

describe('scopePricingMatrix — global validation', () => {
  test('baseboard resolves LF rule with auto-select allowed', () => {
    const item = { scopeName: 'Baseboard Installation', scope: 'Install new baseboard', unit: 'lf', quantity: 60 };
    const rule = resolveScopePricingRule(item);
    expect(rule.allowedUnits).toContain('lf');
    expect(rule.autoSelectAllowed).toBe(true);
    expect(rule.manualPricingFallback).toBe(false);
  });

  test('plumbing trim is manual pricing fallback', () => {
    const item = { scopeName: 'Plumbing Trim', scope: 'Final trim', unit: 'lump_sum' };
    expect(isManualPricingFallback(item)).toBe(true);
    expect(isAutoSelectAllowed(item)).toBe(false);
  });

  test('kitchen cabinet install needs approval', () => {
    const item = { scopeName: 'Cabinet Installation', scope: 'Install kitchen cabinets', unit: 'lf', quantity: 24 };
    expect(isNeedsApprovalScope(item)).toBe(true);
    expect(isAutoSelectAllowed(item)).toBe(false);
  });

  test('flooring install sqft is auto-select candidate', () => {
    const item = { scopeName: 'LVP Flooring Installation', scope: 'Install LVP flooring', unit: 'sqft', quantity: 400 };
    expect(isAutoSelectAllowed(item)).toBe(true);
  });

  test('each light fixture cannot receive sqft pricing', () => {
    const item = { scopeName: 'Lighting Fixtures & Install', scope: 'Install 3 light fixtures', unit: 'each', quantity: 3 };
    const rates = [
      { pricingType: 'material', rate: 8, unit: 'sqft', total: 24, source: 'national_trade_average' },
      { pricingType: 'labor', rate: 14, unit: 'sqft', total: 42, source: 'national_trade_average' },
    ];
    const result = validateScopeItemSuggestion(item, rates, { source: 'national_trade_average' });
    expect(result.proposedRates).toHaveLength(0);
    expect(result.pricingBlocked || result.reviewStatus === REVIEW_STATUS.UNIT_MISMATCH).toBeTruthy();
  });

  test('LF baseboard cannot receive sqft labor', () => {
    const item = { scopeName: 'Baseboard Installation', scope: 'Paint-grade MDF baseboard', unit: 'lf', quantity: 80 };
    const rates = [
      { pricingType: 'material', rate: 3, unit: 'sqft', total: 240, source: 'national_trade_average' },
      { pricingType: 'labor', rate: 5, unit: 'sqft', total: 400, source: 'national_trade_average' },
    ];
    const result = validateScopeItemSuggestion(item, rates, { source: 'national_trade_average' });
    expect(result.proposedRates).toHaveLength(0);
    expect(result.pricingBlocked).toBe(true);
  });

  test('kitchen remodel does not apply sqft rates to LF baseboard', async () => {
    const draft = {
      originalNotes: 'Kitchen remodel. New LVP flooring 350 sqft, baseboard 40 LF.',
      projectType: 'kitchen',
      estimateTier: 'room_remodel',
      rooms: [{ name: 'Baseboard Installation', scope: 'Install baseboard trim', status: 'missing_price' }],
    };
    const result = await getPricingProposal({ draft, userId: 'test-global-kitchen', mode: 'suggest' });
    const baseboard = result.scopeItems.find((s) => /baseboard/i.test(s.scopeName));
    expect(baseboard?.unit).toBe('lf');
    if (baseboard?.proposedRates?.length) {
      expect(baseboard.proposedRates.every((r) => r.unit === 'lf')).toBe(true);
      const total = baseboard.proposedRates.reduce((s, r) => s + (r.total || 0), 0);
      expect(total).toBeGreaterThan(50);
      expect(total).toBeLessThan(5000);
    }
  });
});
