const {
  resolveFixtureKind,
  lookupFixturePlanningRates,
} = require('../pricingEngine/planningQuantities');

describe('planningQuantities fixtures', () => {
  test('resolveFixtureKind recognizes wet area install packages', () => {
    expect(resolveFixtureKind('Tub Installation')).toBe('tub');
    expect(resolveFixtureKind('Prefab Shower Pan Install')).toBe('prefab_shower_pan');
    expect(resolveFixtureKind('Tile Shower Pan (Mud Pan)')).toBe('tile_shower_pan');
  });

  test('lookupFixturePlanningRates returns labor and material for each install type', () => {
    for (const name of [
      'Tub Installation',
      'Prefab Shower Pan Install',
      'Tile Shower Pan (Mud Pan)',
    ]) {
      const result = lookupFixturePlanningRates({
        scopeName: name,
        quantity: 1,
        unit: 'each',
      });
      expect(result.available).toBe(true);
      expect(result.rates.some((r) => r.pricingType === 'material')).toBe(true);
      expect(result.rates.some((r) => r.pricingType === 'labor')).toBe(true);
    }
  });
});
