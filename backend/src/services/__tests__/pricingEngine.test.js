const { getPricingProposal } = require('../pricingEngine');

describe('pricingEngine', () => {
  const draft = {
    originalNotes:
      '1200 sqft tile demo 1200 sqft laminate flooring 500 lf baseboard',
    projectType: 'flooring',
    customerState: 'NV',
    rooms: [
      {
        name: 'Tile Demo',
        scope: 'demo',
        scopeQuantities: [{ quantity: 1200, unit: 'sqft', label: 'area' }],
        status: 'missing_price',
      },
      {
        name: 'Laminate Flooring Installation',
        scope: 'install',
        scopeQuantities: [{ quantity: 1200, unit: 'sqft', label: 'area' }],
        status: 'missing_price',
      },
      {
        name: 'Baseboard',
        scope: 'trim',
        scopeQuantities: [{ quantity: 500, unit: 'lf', label: 'length' }],
        status: 'missing_price',
      },
    ],
  };

  it('returns scope items with comparison and proposed rates in suggest mode', () => {
    const result = getPricingProposal({ draft, userId: 'dev-user-1', mode: 'suggest' });
    expect(result.scopeItems.length).toBe(3);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.totalSuggested).toBeGreaterThan(0);
    const tile = result.scopeItems.find((s) => s.scopeName === 'Tile Demo');
    expect(tile.comparison).toBeDefined();
    expect(tile.recommended).toBeDefined();
    expect(tile.proposedRates.length).toBeGreaterThan(0);
    expect(tile.proposedRates[0].requiresApproval).toBe(true);
  });

  it('saved_only mode may be empty without library entries', () => {
    const result = getPricingProposal({ draft, userId: 'dev-user-1', mode: 'saved_only' });
    expect(result.scopeItems.length).toBe(3);
  });
});
