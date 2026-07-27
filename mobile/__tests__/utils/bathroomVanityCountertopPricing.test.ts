import {
  bathroomVanityCountertopPricingConfidence,
  bathroomVanityCountertopScopeLabel,
  inferBathroomVanityCountertopMaterialFromNotes,
  minimumProjectAppliedForCustomVanityCountertop,
  resolveBathroomVanityCountertopMaterialType,
  resolveBathroomVanityCountertopSuggestedPricing,
} from '@/utils/bathroomVanityCountertopPricing';

describe('bathroom vanity countertop pricing', () => {
  it('Test 1: custom quartz 10 sqft prices at national custom vanity profile', () => {
    const { fill } = resolveBathroomVanityCountertopSuggestedPricing({
      materialType: 'custom_quartz_granite',
      quantitySqft: 10,
      notes: 'Install 10 sqft custom quartz bathroom vanity countertop.',
    });
    expect(fill).toMatchObject({
      material: 670,
      labor: 480,
      total: 1150,
    });
    expect(fill?.basis).toMatchObject({ quantity: 10, unit: 'sqft' });
    expect(fill?.costBuckets?.[0]?.label).toBe('Material & fabrication');
    expect(fill?.costBuckets?.[1]?.label).toBe('Labor & installation');
    expect(['high', 'medium']).toContain(fill?.splitConfidence);
    expect(bathroomVanityCountertopScopeLabel('custom_quartz_granite').label).toBe(
      'Custom vanity countertop'
    );
  });

  it('Test 2: cultured marble vanity top uses each pricing, not sqft custom rate', () => {
    const notes = 'Install a 36-inch cultured marble vanity top with integrated sink.';
    expect(inferBathroomVanityCountertopMaterialFromNotes(notes)).toBe('cultured_marble_prefab');
    const pricing = resolveBathroomVanityCountertopSuggestedPricing({
      materialType: 'cultured_marble_prefab',
      quantityEach: 1,
      notes,
    });
    expect(pricing.fill?.basis).toMatchObject({ quantity: 1, unit: 'each' });
    expect(pricing.fill?.total).toBeGreaterThanOrEqual(350);
    expect(pricing.fill?.total).toBeLessThanOrEqual(700);
    expect(pricing.fill?.total).not.toBe(1150);
  });

  it('Test 3: replace bathroom countertop without material type does not auto-price custom quartz', () => {
    const pricing = resolveBathroomVanityCountertopSuggestedPricing({
      materialType: 'unknown',
      quantitySqft: 10,
    });
    expect(pricing.fill).toBeNull();
    expect(bathroomVanityCountertopScopeLabel('unknown').statusLabel).toBe('Material type needed');
    expect(
      bathroomVanityCountertopPricingConfidence({
        materialType: 'unknown',
        quantitySqft: null,
      })
    ).toBe('low');
    expect(inferBathroomVanityCountertopMaterialFromNotes('Replace bathroom countertop.')).toBeNull();
  });

  it('Test 4: 6 sqft custom granite applies $1,050 minimum project price', () => {
    expect(minimumProjectAppliedForCustomVanityCountertop(6)).toBe(true);
    const pricing = resolveBathroomVanityCountertopSuggestedPricing({
      materialType: 'custom_quartz_granite',
      quantitySqft: 6,
      notes: 'Install 6 sqft custom granite vanity countertop.',
    });
    expect(pricing.fill?.total).toBe(1050);
    expect(String(pricing.fill?.helper || '')).toMatch(/minimum applied/i);
  });

  it('Test 5: 20 sqft custom quartz does not apply minimum', () => {
    expect(minimumProjectAppliedForCustomVanityCountertop(20)).toBe(false);
    const pricing = resolveBathroomVanityCountertopSuggestedPricing({
      materialType: 'custom_quartz_granite',
      quantitySqft: 20,
      notes: 'Install 20 sqft custom quartz vanity countertop.',
    });
    expect(pricing.fill?.total).toBe(2300);
  });

  it('resolves material type from stored value before notes', () => {
    expect(
      resolveBathroomVanityCountertopMaterialType({
        storedType: 'prefab_quartz_stone',
        notes: 'Install custom granite vanity countertop 10 sqft',
      })
    ).toBe('prefab_quartz_stone');
  });

  it('includes standard sink cutout labor in fabrication assumptions, not fixture install', () => {
    const { fill } = resolveBathroomVanityCountertopSuggestedPricing({
      materialType: 'custom_quartz_granite',
      quantitySqft: 10,
    });
    const sinkCutout = fill?.benchmarkScopeProfile?.scopeAssumptions.find(
      (row) => row.scopeKey === 'sink_cutout'
    );
    expect(sinkCutout?.status).toBe('included');
    expect(String(sinkCutout?.notes || '')).toMatch(/built into fabrication/i);
    const sinkFixture = fill?.benchmarkScopeProfile?.scopeAssumptions.find(
      (row) => row.scopeKey === 'sink_fixture'
    );
    expect(sinkFixture?.status).toBe('excluded');
  });
});
