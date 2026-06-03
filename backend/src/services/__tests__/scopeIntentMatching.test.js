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

  it('Laminate scope accepts Tile install labor line', () => {
    const scope = { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' };
    const line = { name: 'Tile', description: 'install labor', section: 'Labor' };
    expect(scoreScopeToLine(scope, line, 'labor', draft)).toBeGreaterThan(0);
  });

  it('job notes mentioning demo do not classify laminate install as demo', () => {
    const scope = { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' };
    expect(getScopeWorkIntent(scope, draft).workType).toBe('install');
  });

  it('template lookup uses install tile for laminate not demo', () => {
    const templates = [{
      name: 'Nick',
      payload: {
        materialLineItems: [],
        laborLineItems: [
          { name: 'Tile', quantity: 2000, unit: 'sq ft', mode: 'sqft', unitPrice: 5, total: 10000 },
        ],
      },
    }];
    const demo = lookupSavedTemplate(
      { scopeName: 'Tile Demo', scope: '', quantity: 1200, unit: 'sqft' },
      templates,
      { draft }
    );
    expect(demo.available).toBe(false);

    const laminate = lookupSavedTemplate(
      { scopeName: 'Laminate Flooring Installation', scope: '', quantity: 1200, unit: 'sqft' },
      templates,
      { draft }
    );
    expect(laminate.available).toBe(true);
    expect(laminate.rates[0].rate).toBe(5);
  });
});
