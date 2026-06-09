jest.mock('../sku/skuSearchService', () => ({
  searchSkuLive: jest.fn().mockResolvedValue({
    results: [],
    metadata: { dataSource: 'mock', isMockData: true },
  }),
}));

const { getPricingProposal } = require('../pricingEngine');
const { scopeItemsFromDraft } = require('../pricingEngine/scopeFromDraft');
const { resolveSupplierZipContext } = require('../pricingEngine/getPricingProposal');

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

  it('returns scope items with comparison and proposed rates in suggest mode', async () => {
    const result = await getPricingProposal({ draft, userId: 'dev-user-1', mode: 'suggest' });
    expect(result.scopeItems.length).toBe(3);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.totalSuggested).toBeGreaterThan(0);
    const tile = result.scopeItems.find((s) => s.scopeName === 'Tile Demo');
    expect(tile.comparison).toBeDefined();
    expect(tile.recommended).toBeDefined();
    expect(tile.proposedRates.length).toBeGreaterThan(0);
    expect(tile.proposedRates[0].requiresApproval).toBe(true);
  });

  it('saved_only mode may be empty without library entries', async () => {
    const result = await getPricingProposal({ draft, userId: 'dev-user-1', mode: 'saved_only' });
    expect(result.scopeItems.length).toBe(3);
  });

  it('baseboard rough pricing uses national $/LF midpoints not wage÷productivity', async () => {
    const result = await getPricingProposal({ draft, userId: 'test-pricing-isolated', mode: 'suggest' });
    const bb = result.scopeItems.find((s) => /baseboard/i.test(s.scopeName));
    expect(bb).toBeDefined();
    expect(bb.recommended.source).toBe('national_trade_average');
    const lab = bb.proposedRates.find((p) => p.pricingType === 'labor');
    const mat = bb.proposedRates.find((p) => p.pricingType === 'material');
    expect(lab?.rate).toBe(5);
    expect(mat?.rate).toBe(2);
    expect(lab?.total).toBe(2500);
    expect(mat?.total).toBe(1000);
    expect(bb.proposedRates.find((p) => p.formula?.includes('$1.91'))).toBeUndefined();
  });

  it('kitchen scope uses national trade average material and labor per sqft', async () => {
    const kitchenDraft = {
      originalNotes: 'Kitchen remodel 200 sqft floor tile and cabinets',
      projectType: 'kitchen',
      rooms: [
        {
          name: 'Kitchen',
          scope: 'Remodel kitchen flooring and cabinets',
          scopeQuantities: [{ quantity: 200, unit: 'sqft', label: 'area' }],
          status: 'missing_price',
        },
      ],
    };
    const result = await getPricingProposal({ draft: kitchenDraft, userId: 'dev-user-1', mode: 'suggest' });
    const kitchen = result.scopeItems.find((s) => s.scopeName === 'Kitchen');
    expect(kitchen?.recommended?.source).toBe('national_trade_average');
    const mat = kitchen.proposedRates.find((p) => p.pricingType === 'material');
    const lab = kitchen.proposedRates.find((p) => p.pricingType === 'labor');
    expect(mat?.rate).toBe(55);
    expect(lab?.rate).toBe(95);
  });

  it('baseboard scope ignores sqft quantities and uses lf from notes', () => {
    const items = scopeItemsFromDraft({
      originalNotes: '500 linear feet baseboard installation',
      projectType: 'flooring',
      rooms: [
        {
          name: 'Baseboard',
          scope: '1200 sqft baseboard install',
          scopeQuantities: [{ quantity: 1200, unit: 'sqft', label: 'area' }],
        },
      ],
    });
    const bb = items.find((s) => /baseboard/i.test(s.scopeName));
    expect(bb?.quantity).toBe(500);
    expect(bb?.unit).toBe('lf');
  });

  it('uses default supplier ZIP when notes have no ZIP', async () => {
    const result = await getPricingProposal({ draft, userId: 'dev-user-1', mode: 'suggest' });
    expect(result.supplierZip).toMatch(/^\d{5}$/);
    expect(result.supplierZipIsFallback).toBe(true);
    expect(resolveSupplierZipContext(draft, '').supplierZipSource).toBe('default');
  });

  it('bathroom remodel scopes get planning quantities and national rough pricing', async () => {
    const bathDraft = {
      originalNotes:
        'Full bathroom remodel. New shower tile, floor tile, relocate toilet, new vanity and countertops, lighting, paint, shower door.',
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      rooms: [
        { name: 'Shower Tile Installation', scope: 'Install new shower wall tile', status: 'missing_price' },
        { name: 'Vanity Installation', scope: 'New vanity and countertop', status: 'missing_price' },
        { name: 'Toilet Installation', scope: 'Relocate and install toilet', status: 'missing_price' },
        { name: 'Interior Painting', scope: 'Paint walls and ceiling', status: 'missing_price' },
      ],
    };
    const result = await getPricingProposal({ draft: bathDraft, userId: 'test-bath-pricing', mode: 'suggest' });
    expect(result.scopeItems.length).toBe(4);

    const shower = result.scopeItems.find((s) => /shower tile/i.test(s.scopeName));
    expect(shower?.quantity).toBe(90);
    expect(shower?.unit).toBe('sqft');
    expect(shower?.proposedRates.length).toBeGreaterThan(0);

    const vanity = result.scopeItems.find((s) => /vanity/i.test(s.scopeName));
    expect(vanity?.quantity).toBe(1);
    expect(vanity?.unit).toBe('each');
    expect(vanity?.proposedRates.length).toBeGreaterThan(0);
    expect(vanity?.proposedRates.find((p) => p.pricingType === 'labor')?.rate).toBe(650);

    const toilet = result.scopeItems.find((s) => /toilet/i.test(s.scopeName));
    expect(toilet?.proposedRates.find((p) => p.pricingType === 'labor')?.unit).toBe('each');
    expect(toilet?.proposedRates.find((p) => p.pricingType === 'labor')?.rate).toBe(475);

    const paint = result.scopeItems.find((s) => /paint/i.test(s.scopeName));
    expect(paint?.quantity).toBe(175);
    expect(paint?.proposedRates.length).toBeGreaterThan(0);

    expect(result.totalSuggested).toBeGreaterThan(1600);
  });

  it('applies saved tile template to shower tile when quantities are inferred', async () => {
    const bathDraft = {
      originalNotes: 'Bathroom remodel with new shower tile',
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      rooms: [{ name: 'Shower Tile Installation', scope: 'New shower tile', status: 'missing_price' }],
    };
    const savedTemplates = [
      {
        name: 'My tile bid',
        payload: {
          materialLineItems: [
            { name: 'Tile material', unit: 'sqft', unitPrice: 3.5, quantity: 1200, mode: 'sqft' },
          ],
          laborLineItems: [
            { name: 'Tile install labor', unit: 'sqft', unitPrice: 8, quantity: 1200, mode: 'sqft' },
          ],
        },
      },
    ];
    const result = await getPricingProposal({
      draft: bathDraft,
      userId: 'test-tile-template',
      mode: 'suggest',
      savedTemplates,
    });
    const shower = result.scopeItems[0];
    expect(shower.quantity).toBe(90);
    const savedRates = shower.proposedRates.filter((p) => p.source === 'saved_template');
    expect(savedRates.length).toBeGreaterThan(0);
    expect(savedRates.find((p) => p.pricingType === 'labor')?.rate).toBe(8);
  });

  it('saved_only merges template material with pricing library labor', async () => {
    const bathDraft = {
      originalNotes: 'Bathroom remodel with new shower tile',
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      rooms: [{ name: 'Shower Tile Installation', scope: 'New shower tile', status: 'missing_price' }],
    };
    const savedTemplates = [
      {
        name: 'My tile bid',
        payload: {
          materialLineItems: [
            { name: 'Tile material', unit: 'sqft', unitPrice: 3.5, quantity: 1200, mode: 'sqft' },
          ],
          laborLineItems: [
            { name: 'Tile install labor', unit: 'sqft', unitPrice: 8, quantity: 1200, mode: 'sqft' },
          ],
        },
      },
    ];
    const result = await getPricingProposal({
      draft: bathDraft,
      userId: 'dev-user-1',
      mode: 'saved_only',
      savedTemplates,
    });
    const shower = result.scopeItems[0];
    const mat = shower.proposedRates.find((p) => p.pricingType === 'material');
    const lab = shower.proposedRates.find((p) => p.pricingType === 'labor');
    expect(mat?.source).toBe('saved_template');
    expect(mat?.rate).toBe(3.5);
    expect(lab?.source).toBe('saved_pricing');
    expect(lab?.rate).toBe(5);
    expect(shower.proposedRates.length).toBe(2);
  });
});
