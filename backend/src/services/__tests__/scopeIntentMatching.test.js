const { scoreScopeToLine, getScopeWorkIntent } = require('../pricingEngine/scopeIntentMatching');
const { lookupSavedTemplate } = require('../pricingEngine/sources/savedTemplate');

describe('scopeIntentMatching', () => {
  const draft = { originalNotes: '1200 sqft tile demo, laminate install, baseboard' };

  it('Tile Demo scope rejects install-only Tile labor line', () => {
    const scope = { scopeName: 'Tile Demo', scope: '', quantity: 1200, unit: 'sqft' };
    const line = { name: 'Tile', description: '', section: 'Labor' };
    expect(getScopeWorkIntent(scope, draft).workType).toBe('demo');
    expect(scoreScopeToLine(scope, line, 'labor', draft)).toBe(0);
  });

  it('Laminate scope rejects Tile-only template lines (tile ≠ laminate)', () => {
    const scope = { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' };
    const line = { name: 'Tile', description: 'install labor', section: 'Labor' };
    expect(scoreScopeToLine(scope, line, 'labor', draft)).toBe(0);
  });

  it('Laminate scope accepts laminate-named template lines', () => {
    const scope = { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' };
    const line = { name: 'Laminate install labor', description: '', section: 'Labor' };
    expect(scoreScopeToLine(scope, line, 'labor', draft)).toBeGreaterThan(0);
  });

  it('job notes mentioning demo do not classify laminate install as demo', () => {
    const scope = { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' };
    expect(getScopeWorkIntent(scope, draft).workType).toBe('install');
  });

  it('Waterproofing scope rejects bare Tile install template lines', () => {
    const scope = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: 'Membrane, backer, and prep before tile',
      quantity: 90,
      unit: 'sqft',
    };
    const tileLine = { name: 'Tile', description: 'install labor', section: 'Labor' };
    expect(scoreScopeToLine(scope, tileLine, 'labor', {})).toBe(0);
  });

  it('Waterproofing scope accepts waterproofing-named template lines', () => {
    const scope = {
      scopeName: 'Shower Waterproofing & Backer Board',
      scope: 'Membrane, backer, and prep before tile',
      quantity: 90,
      unit: 'sqft',
    };
    const line = { name: 'RedGard waterproofing labor', description: '', section: 'Labor' };
    expect(scoreScopeToLine(scope, line, 'labor', {})).toBeGreaterThan(0);
  });

  it('template lookup: tile demo matches demo line; laminate does not use tile install lines', () => {
    const templates = [{
      name: 'Nick',
      payload: {
        materialLineItems: [{ name: 'Tile', quantity: 2000, unit: 'sq ft', mode: 'sqft', unitPrice: 2, total: 4000 }],
        laborLineItems: [
          { name: 'Tile', quantity: 2000, unit: 'sq ft', mode: 'sqft', unitPrice: 5, total: 10000 },
          { name: 'Tile demo', quantity: 2000, unit: 'sq ft', mode: 'sqft', unitPrice: 2, total: 4000 },
        ],
      },
    }];
    const demo = lookupSavedTemplate(
      { scopeName: 'Tile Demo', scope: '', quantity: 1200, unit: 'sqft' },
      templates,
      { draft }
    );
    expect(demo.available).toBe(true);
    expect(demo.rates[0].rate).toBe(2);
    expect(demo.rates[0].label).toMatch(/demo/i);

    const laminate = lookupSavedTemplate(
      { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' },
      templates,
      { draft }
    );
    expect(laminate.available).toBe(false);
  });

  it('Cleanup scope rejects demo template lines (haul-off is not demolition pricing)', () => {
    const scope = {
      scopeName: 'Cleanup, Haul-off & Disposal',
      scope: 'Final clean, debris haul-off, dump fees',
      quantity: 1,
      unit: 'lump_sum',
    };
    const demoLine = { name: 'Tile demo', description: '', section: 'Labor', mode: 'sqft', unitPrice: 2 };
    expect(getScopeWorkIntent(scope, {}).workType).toBe('other');
    expect(scoreScopeToLine(scope, demoLine, 'labor', {})).toBe(0);
  });

  it('template lookup: tile install matches bare Tile labor on run-on flooring notes', () => {
    const notes =
      'Create me a flooring bid, 1200 sqft tile demo and 1200 sqft tile installation, and 1000 linear ft of baseboard install';
    const templates = [
      {
        name: 'Nick',
        payload: {
          laborLineItems: [
            { name: 'Tile', quantity: 2000, unit: 'sq ft', mode: 'sqft', unitPrice: 5, total: 10000 },
            { name: 'Tile demo', quantity: 2000, unit: 'sq ft', mode: 'sqft', unitPrice: 2, total: 4000 },
          ],
        },
      },
    ];
    const install = lookupSavedTemplate(
      { scopeName: 'Tile Installation', scope: 'tile installation', quantity: 1200, unit: 'sqft' },
      templates,
      { draft: { originalNotes: notes } }
    );
    expect(install.available).toBe(true);
    expect(install.rates.some((r) => r.rate === 5)).toBe(true);
  });
});
