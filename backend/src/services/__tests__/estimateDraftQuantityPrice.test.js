const { normalizeDraft } = require('../estimateDraftFromNotes');
const {
  extractPricingItemsFromText,
  buildScopePackage,
} = require('../estimateDraftPartialPricing');
const { amountAppearsAsQuantityInText, labeledPriceMatchIsValid } = require('../estimateDraftQuantityPrice');

const FLOOR_NOTES =
  "OK, let's create a bid. I have a floor job. I have 1200 ft.² of tile demo. I have 1200 ft.² of laminate flooring installation and 500 linear feet of baseboard installation, caulk and paint";

describe('quantity vs price parsing', () => {
  test('extractPricingItemsFromText does not treat 1200 sqft as dollars', () => {
    const items = extractPricingItemsFromText(FLOOR_NOTES);
    const amounts = items.map((i) => i.amount).filter(Boolean);
    expect(amounts).not.toContain(1200);
    expect(amounts).not.toContain(500);
    expect(items.length).toBe(0);
  });

  test('still extracts explicit dollar amounts', () => {
    const items = extractPricingItemsFromText('Countertops $5,000 and cabinets $8,000');
    const total = items.reduce((s, i) => s + (i.amount || 0), 0);
    expect(total).toBe(13000);
  });

  test('normalizeDraft: scope-only floor job has no known subtotal', () => {
    const draft = normalizeDraft(
      {
        projectType: 'bathroom',
        projectTitle: 'Floor job',
        rooms: [
          {
            name: 'Flooring',
            scope: '1200 sqft tile demo and 1200 sqft laminate install',
            price: 4100,
            priceProvidedByUser: true,
            pricingItems: [
              { name: 'I have', amount: 1200, status: 'confirmed' },
              { name: 'caulk and paint Demo', amount: 1200, status: 'confirmed' },
            ],
            missingPriceItems: ['Tile demo', 'Laminate flooring installation'],
          },
          {
            name: 'Baseboard',
            scope: '500 linear feet baseboard installation',
            price: 2200,
            pricingItems: [{ name: 'Install', amount: 500, status: 'confirmed' }],
          },
        ],
        allowances: [],
      },
      { originalNotes: FLOOR_NOTES }
    );

    expect(draft.projectType).toBe('flooring');
    expect(draft.knownSubtotal || 0).toBe(0);
    expect(draft.calculatedLineItemTotal || 0).toBe(0);
    expect(draft.scopePackages.every((p) => p.status === 'missing_price' || (p.knownSubtotal || 0) === 0)).toBe(
      true
    );
    expect(draft.whatAiDid.some((l) => /no material or labor rates/i.test(l))).toBe(true);
    expect(draft.estimateConfidence.level).toMatch(/low|medium/);
  });

  test('buildScopePackage assigns quantities per package not global blob', () => {
    const notes =
      'Floor remodel. 1200 sqft tile demo. 1200 sqft laminate flooring installation. 500 linear feet baseboard installation, prep and paint.';
    const tile = buildScopePackage(
      { name: 'Tile Demo', scope: 'Demolition of 1200 square feet of existing tile.', price: null, pricingItems: [] },
      { projectType: 'flooring' },
      notes
    );
    const laminate = buildScopePackage(
      {
        name: 'Laminate Flooring Installation',
        scope: 'Installation of 1200 square feet of laminate flooring.',
        price: null,
        pricingItems: [],
      },
      { projectType: 'flooring' },
      notes
    );
    const baseboard = buildScopePackage(
      {
        name: 'Baseboard Installation',
        scope: 'Install 500 linear feet of baseboard, prep and paint.',
        price: null,
        pricingItems: [],
      },
      { projectType: 'flooring' },
      notes
    );
    expect(tile.scopeQuantities).toEqual([{ label: 'Tile Demo', quantity: 1200, unit: 'sqft' }]);
    expect(laminate.scopeQuantities).toEqual([
      { label: 'Laminate Flooring Installation', quantity: 1200, unit: 'sqft' },
    ]);
    expect(baseboard.scopeQuantities).toEqual([{ label: 'Baseboard Installation', quantity: 500, unit: 'lf' }]);
    expect(tile.knownSubtotal).toBeNull();
    expect(tile.status).toBe('missing_price');
  });
});
