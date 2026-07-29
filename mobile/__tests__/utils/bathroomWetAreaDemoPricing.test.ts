import {
  resolveBathroomWetAreaDemoSuggestedPricing,
  BATHROOM_WET_AREA_DEMO_HELPER,
  SHOWER_DOOR_DEMO_EACH,
  PREFAB_PAN_DEMO_EACH,
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
    expect(String(fill?.helper || '')).toMatch(/95 sqft × \$5\.50\/SF \(\$522\.50\)/i);
  });

  test('scales tile demo with job-specific sqft', () => {
    const small = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1 },
      tileSqft: 40,
    });
    const large = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1 },
      tileSqft: 120,
    });
    expect(small.fill?.total).toBe(220);
    expect(large.fill?.total).toBe(660);
  });

  test('includes tub removal allowance when tub demo stepper is set', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1, demoTubCount: 1 },
      tileSqft: 95,
      sourceLabel: 'Shower walls + shower floor',
    });
    expect(fill?.total).toBe(872.5);
    expect(String(fill?.helper || '')).toMatch(/tub removal \$350/i);
    const tubAssumption = fill?.benchmarkScopeProfile?.scopeAssumptions.find((row) => row.scopeKey === 'tub');
    expect(tubAssumption?.status).toBe('included');
  });

  test('includes prefab pan removal when prefab pan demo stepper is set', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1, demoPrefabPanCount: 1 },
      tileSqft: 95,
    });
    expect(fill?.total).toBe(872.5);
    expect(String(fill?.helper || '')).toMatch(/prefab pan \$350/i);
    const panAssumption = fill?.benchmarkScopeProfile?.scopeAssumptions.find(
      (row) => row.scopeKey === 'prefab_pan'
    );
    expect(panAssumption?.status).toBe('included');
  });

  test('includes shower door removal allowance', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTileWallCount: 1, demoShowerDoorCount: 1 },
      tileSqft: 80,
    });
    expect(fill?.total).toBe(round2(80 * 5.5 + SHOWER_DOOR_DEMO_EACH.total));
    expect(String(fill?.helper || '')).toMatch(/shower door \$125/i);
    const doorAssumption = fill?.benchmarkScopeProfile?.scopeAssumptions.find(
      (row) => row.scopeKey === 'shower_door'
    );
    expect(doorAssumption?.status).toBe('included');
  });

  test('prefab pan + wall SF + door shows hybrid breakdown total', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: {
        demoTileWallCount: 1,
        demoPrefabPanCount: 1,
        demoShowerDoorCount: 1,
      },
      tileSqft: 80,
    });
    expect(fill?.total).toBe(80 * 5.5 + PREFAB_PAN_DEMO_EACH.total + SHOWER_DOOR_DEMO_EACH.total);
    expect(String(fill?.helper || '')).toMatch(/80 sqft × \$5\.50\/SF \(\$440\)/i);
    expect(String(fill?.helper || '')).toMatch(/prefab pan \$350/i);
    expect(String(fill?.helper || '')).toMatch(/shower door \$125/i);
  });

  test('tub-only demo prices without shower tile sqft', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoTubCount: 1 },
      tileSqft: 0,
    });
    expect(fill?.total).toBe(350);
    expect(fill?.basis).toBeNull();
  });

  test('door-only demo prices without shower tile sqft', () => {
    const { fill } = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput: { demoShowerDoorCount: 1 },
      tileSqft: 0,
    });
    expect(fill?.total).toBe(SHOWER_DOOR_DEMO_EACH.total);
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
