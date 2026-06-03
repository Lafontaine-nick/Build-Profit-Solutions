const { isUnitBasedLineItem, isUnitBasedMemoryEntry } = require('../pricingEngine/unitBased');
const { lookupSavedTemplate } = require('../pricingEngine/sources/savedTemplate');

describe('pricingEngine unitBased', () => {
  it('rejects flat template line (lot, $10k)', () => {
    const line = {
      name: 'Tile',
      quantity: 1,
      qty: 1,
      unit: 'lot',
      mode: 'flat',
      unitPrice: 10000,
      total: 10000,
    };
    expect(isUnitBasedLineItem(line, 'sqft')).toBe(false);
  });

  it('accepts per sqft template line', () => {
    const line = {
      name: 'Tile demo',
      quantity: 1,
      unit: 'sq ft',
      mode: 'sqft',
      unitPrice: 5,
      total: 5,
    };
    expect(isUnitBasedLineItem(line, 'sqft')).toBe(true);
  });

  it('rejects flat Nick template for tile demo scope', () => {
    const templates = [
      {
        name: 'Nick',
        payload: {
          materialLineItems: [
            { name: 'Tile', quantity: 1, unit: 'lot', mode: 'flat', unitPrice: 10000, total: 10000 },
          ],
          laborLineItems: [
            { name: 'Tile labor', quantity: 1, unit: 'lot', mode: 'flat', unitPrice: 10000, total: 10000 },
          ],
        },
      },
    ];
    const scopeItem = {
      scopeName: 'Tile Demo',
      quantity: 1200,
      unit: 'sqft',
      trade: 'demo',
    };
    const result = lookupSavedTemplate(scopeItem, templates);
    expect(result.available).toBe(false);
  });

  it('rejects lump_sum memory entry', () => {
    expect(isUnitBasedMemoryEntry({ unitType: 'lump_sum', unitRate: 10000 })).toBe(false);
    expect(isUnitBasedMemoryEntry({ unitType: 'sqft', unitRate: 5 })).toBe(true);
  });
});
