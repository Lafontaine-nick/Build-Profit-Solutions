const { getPricingProposal } = require('../pricingEngine/getPricingProposal');
const { validateScopeItemSuggestion } = require('../pricingEngine/sourceValidation');
const { REVIEW_STATUS } = require('../pricingEngine/globalPricingValidation');
const {
  isNeedsApprovalScope,
  getScopeApprovalHint,
  applyPricingApprovalStatus,
} = require('../pricingEngine/pricingApprovalStatus');

describe('pricingApprovalStatus', () => {
  test('vanity with fixture rates is needs_approval not scope_mismatch', () => {
    const item = {
      scopeName: 'Vanity Installation',
      scope: 'New vanity and countertop',
      quantity: 1,
      unit: 'each',
      trade: 'bathroom_fixture',
    };
    const rates = [
      {
        pricingType: 'material',
        rate: 950,
        unit: 'each',
        quantity: 1,
        total: 950,
        source: 'national_trade_average',
        confidence: 'low',
        assumptions: [],
      },
      {
        pricingType: 'labor',
        rate: 650,
        unit: 'each',
        quantity: 1,
        total: 650,
        source: 'national_trade_average',
        confidence: 'medium',
        assumptions: [],
      },
    ];
    const result = validateScopeItemSuggestion(item, rates, { source: 'national_trade_average' });
    expect(result.reviewStatus).toBe(REVIEW_STATUS.NEEDS_APPROVAL);
    expect(result.proposedRates).toHaveLength(2);
    expect(result.pricingBlocked).toBe(false);
    expect(result.autoSelectEligible).toBe(false);
    expect(result.warnings.some((w) => /vanity cabinet, countertop/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /scope mismatch|full assembly|framing only/i.test(w))).toBe(false);
    expect(result.approvalSubtext).toMatch(/Confirm what is included/i);
  });

  test('shower tile stays planning estimate and auto-select eligible', async () => {
    const draft = {
      originalNotes: 'Bathroom remodel with new shower tile',
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      rooms: [{ name: 'Shower Tile Installation', scope: 'Install new shower wall tile', status: 'missing_price' }],
    };
    const result = await getPricingProposal({ draft, userId: 'test-approval', mode: 'suggest' });
    const shower = result.scopeItems.find((s) => /shower tile/i.test(s.scopeName));
    expect(shower.reviewStatus).toBe(REVIEW_STATUS.SUGGESTED_ROUGH);
    expect(shower.autoSelectEligible).toBe(true);
    expect(shower.proposedRates.length).toBeGreaterThan(0);
  });

  test('plumbing trim without saved source is manual pricing', () => {
    const item = { scopeName: 'Plumbing Trim', scope: 'Final plumbing trim', quantity: 1, unit: 'lump_sum' };
    const result = validateScopeItemSuggestion(
      item,
      [{ pricingType: 'labor', rate: 42, unit: 'sqft', total: 42, source: 'national_trade_average' }],
      { source: 'national_trade_average' }
    );
    expect(result.proposedRates).toHaveLength(0);
    expect(result.reviewStatus).toBe(REVIEW_STATUS.NEEDS_PRICE);
  });

  test('getScopeApprovalHint returns trade-specific copy', () => {
    expect(isNeedsApprovalScope({ scopeName: 'Toilet Installation' })).toBe(true);
    expect(getScopeApprovalHint({ scopeName: 'Shower Niche' })).toMatch(/prefab niche/i);
  });

  test('blocked unit mismatch uses blocked label', () => {
    const item = { scopeName: 'Vanity Installation', unit: 'each', quantity: 1 };
    const applied = applyPricingApprovalStatus(
      item,
      { proposedRates: [], warnings: [], reviewStatuses: [] },
      { pricingBlocked: true, unitMismatchSubtext: 'Available rate is sqft, but this item is priced by each.' }
    );
    expect(applied.reviewStatus).toBe(REVIEW_STATUS.UNIT_MISMATCH);
    expect(applied.warnings[0]).toMatch(/Blocked — pricing unit does not match scope/i);
  });
});
