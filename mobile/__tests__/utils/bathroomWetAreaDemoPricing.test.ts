import {
  resolveBathroomWetAreaDemoSuggestedPricing,
  BATHROOM_WET_AREA_DEMO_HELPER,
} from '@/utils/bathroomWetAreaDemoPricing';

describe('bathroom wet-area demo pricing', () => {
  test('helper text mentions tub and prefab pan', () => {
    expect(BATHROOM_WET_AREA_DEMO_HELPER).toMatch(/tub when present/i);
    expect(BATHROOM_WET_AREA_DEMO_HELPER).toMatch(/prefab/i);
  });

  test('tile-only demo prices shower wall + floor sqft', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1 },
      tileSqft: 95,
      sourceLabel: 'Shower walls + shower floor',
    });
    expect(fill?.total).toBe(522.5);
    expect(fill?.basis).toMatchObject({ quantity: 95, unit: 'sqft' });
  });

  test('includes tub removal allowance when tub demo stepper is set', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1, demoTubCount: 1 },
      tileSqft: 95,
      sourceLabel: 'Shower walls + shower floor',
    });
    expect(fill?.total).toBe(872.5);
    expect(String(fill?.helper || '')).toMatch(/tub removal/i);
    const tubAssumption = fill?.benchmarkScopeProfile?.scopeAssumptions.find((row) => row.scopeKey === 'tub');
    expect(tubAssumption?.status).toBe('included');
  });

  test('includes prefab pan removal when prefab pan demo stepper is set', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1, demoPrefabPanCount: 1 },
      tileSqft: 95,
    });
    expect(fill?.total).toBe(872.5);
    expect(String(fill?.helper || '')).toMatch(/prefab pan/i);
    const panAssumption = fill?.benchmarkScopeProfile?.scopeAssumptions.find(
      (row) => row.scopeKey === 'prefab_pan'
    );
    expect(panAssumption?.status).toBe('included');
  });

  test('tub-only demo prices without shower tile sqft', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTubCount: 1 },
      tileSqft: 0,
    });
    expect(fill?.total).toBe(350);
    expect(fill?.basis).toBeNull();
  });
});
