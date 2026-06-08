jest.mock('../sku/skuSearchService', () => ({
  searchSkuLive: jest.fn(),
}));

const { searchSkuLive } = require('../sku/skuSearchService');
const { getPricingProposal } = require('../pricingEngine');
const { lookupSupplierPricing } = require('../pricingEngine/sources/supplierPricing');
const { scopeToSkuQuery, packPriceToUnitRate } = require('../pricingEngine/sources/skuQueryFromScope');

describe('supplierPricing', () => {
  beforeEach(() => {
    searchSkuLive.mockReset();
  });

  const baseboardScope = {
    scopeItemId: 'baseboard',
    scopeName: 'Baseboard',
    scope: '500 lf baseboard install',
    trade: 'baseboard',
    quantity: 500,
    unit: 'lf',
  };

  it('scopeToSkuQuery maps baseboard to LF search', () => {
    const spec = scopeToSkuQuery(baseboardScope);
    expect(spec?.query).toMatch(/baseboard/i);
    expect(spec?.pricingUnit).toBe('lf');
  });

  it('packPriceToUnitRate converts 16ft baseboard pack to $/LF', () => {
    const rate = packPriceToUnitRate(18.95, 'Baseboard Trim 3-1/4" (16ft)', 'length', 'lf');
    expect(rate).toBeCloseTo(18.95 / 16, 2);
  });

  it('returns available supplier material when live SKU data exists', async () => {
    searchSkuLive.mockResolvedValue({
      results: [
        {
          sku: '100839',
          title: 'Baseboard Trim 3-1/4" (16ft)',
          price: 18.95,
          unit: 'length',
        },
      ],
      metadata: { dataSource: 'serpapi', isMockData: false },
    });

    const result = await lookupSupplierPricing(baseboardScope, { zipCode: '89109' });
    expect(result.available).toBe(true);
    expect(result.rates).toHaveLength(1);
    expect(result.rates[0].pricingType).toBe('material');
    expect(result.rates[0].rate).toBeCloseTo(1.18, 1);
  });

  it('returns unavailable when dataSource is mock', async () => {
    searchSkuLive.mockResolvedValue({
      results: [{ sku: 'x', title: 'Baseboard', price: 2, unit: 'each' }],
      metadata: { dataSource: 'mock', isMockData: true },
    });

    const result = await lookupSupplierPricing(baseboardScope, { zipCode: '89109' });
    expect(result.available).toBe(false);
  });

  it('uses default ZIP fallback when none provided so HD + national both resolve', async () => {
    searchSkuLive.mockResolvedValue({
      results: [
        {
          sku: '100839',
          title: 'Baseboard Trim 3-1/4" (16ft)',
          price: 18.95,
          unit: 'length',
        },
      ],
      metadata: { dataSource: 'serpapi', isMockData: false },
    });

    const result = await lookupSupplierPricing(baseboardScope, {
      zipCode: '30339',
      supplierZipIsFallback: true,
    });
    expect(result.available).toBe(true);
    expect(searchSkuLive).toHaveBeenCalled();
  });

  it('pricing proposal uses supplier material + national labor when live data available', async () => {
    searchSkuLive.mockResolvedValue({
      results: [
        {
          sku: '100839',
          title: 'Baseboard Trim 3-1/4" (16ft)',
          price: 18.95,
          unit: 'length',
        },
      ],
      metadata: { dataSource: 'serpapi', isMockData: false },
    });

    const draft = {
      originalNotes: 'Customer Nick, zip code 89141. 500 lf baseboard install',
      projectType: 'flooring',
      rooms: [
        {
          name: 'Baseboard',
          scope: '500 lf baseboard install',
          scopeQuantities: [{ quantity: 500, unit: 'lf', label: 'length' }],
          status: 'missing_price',
        },
      ],
    };

    const result = await getPricingProposal({ draft, userId: 'dev-user-1', mode: 'suggest' });
    const bb = result.scopeItems.find((s) => /baseboard/i.test(s.scopeName));
    expect(bb?.recommended?.source).toBe('supplier_pricing');
    expect(bb?.comparison?.supplier_pricing?.available).toBe(true);
    const mat = bb.proposedRates.find((p) => p.pricingType === 'material');
    const lab = bb.proposedRates.find((p) => p.pricingType === 'labor');
    expect(mat?.source).toBe('supplier_pricing');
    expect(lab?.source).toBe('national_trade_average');
    expect(lab?.rate).toBe(5);
  });

  it('falls through to national_trade_average when supplier mock/empty', async () => {
    searchSkuLive.mockResolvedValue({
      results: [],
      metadata: { dataSource: 'mock', isMockData: true },
    });

    const draft = {
      originalNotes: '500 lf baseboard',
      projectType: 'flooring',
      zipCode: '89109',
      rooms: [
        {
          name: 'Baseboard',
          scope: '500 lf baseboard install',
          scopeQuantities: [{ quantity: 500, unit: 'lf', label: 'length' }],
          status: 'missing_price',
        },
      ],
    };

    const result = await getPricingProposal({ draft, userId: 'dev-user-1', zipCode: '89109', mode: 'suggest' });
    const bb = result.scopeItems.find((s) => /baseboard/i.test(s.scopeName));
    expect(bb?.recommended?.source).toBe('national_trade_average');
    expect(bb?.comparison?.supplier_pricing?.available).toBe(false);
  });

  it('high-variance tile uses national material but keeps live HD in comparison', async () => {
    searchSkuLive.mockResolvedValue({
      results: [
        {
          sku: '103001',
          title: 'Porcelain Floor Tile 12x24',
          price: 3.95,
          unit: 'sqft',
        },
      ],
      metadata: { dataSource: 'serpapi', isMockData: false },
    });

    const draft = {
      originalNotes: 'zip 89141. 500 sqft tile install',
      projectType: 'flooring',
      rooms: [
        {
          name: 'Tile Install',
          scope: '500 sqft porcelain tile install',
          scopeQuantities: [{ quantity: 500, unit: 'sqft', label: 'area' }],
          status: 'missing_price',
        },
      ],
    };

    const result = await getPricingProposal({ draft, userId: 'dev-user-1', mode: 'suggest' });
    const tile = result.scopeItems.find((s) => /tile/i.test(s.scopeName));
    expect(tile?.comparison?.supplier_pricing?.available).toBe(true);
    expect(tile?.recommended?.source).toBe('national_trade_average');
    const mat = tile.proposedRates.find((p) => p.pricingType === 'material');
    const lab = tile.proposedRates.find((p) => p.pricingType === 'labor');
    expect(mat?.source).toBe('national_trade_average');
    expect(mat?.rate).toBe(4);
    expect(lab?.source).toBe('national_trade_average');
    expect(tile?.recommended?.reason).toMatch(/HD reference/i);
  });
});
