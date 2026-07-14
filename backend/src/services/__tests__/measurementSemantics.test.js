const {
  measurementSemanticsV1Enabled,
  buildAreaReconciliation,
  getTradeMeasurementProfile,
  missingStatusForScope,
  validatePricingBasis,
  NO_LIVING_SF_PRIMARY_SEED_KEYS,
} = require('../measurementSemantics');
const { buildStageSuggestion, getDetachedProjects, loadSeedDataset } = require('../benchmarkEngine');

describe('measurementSemantics foundation', () => {
  const originalSemantics = process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1;
  const originalBenchmark = process.env.BUILD_AI_BENCHMARK_ENGINE_V1;

  afterEach(() => {
    process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
    process.env.BUILD_AI_BENCHMARK_ENGINE_V1 = originalBenchmark;
  });

  test('flag defaults off', () => {
    delete process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1;
    expect(measurementSemanticsV1Enabled()).toBe(false);
  });

  test('Lot 41 area reconciliation stores unassigned living and garage', () => {
    const recon = buildAreaReconciliation({
      declaredLivingSf: 1879,
      declaredGarageSf: 994,
      patioDeckSf: 247,
      rooms: [
        { name: 'Great Room', areaSqft: 420 },
        { name: 'Kitchen', areaSqft: 210 },
        { name: 'Master Bedroom', areaSqft: 220 },
        { name: 'Bedroom 2', areaSqft: 140 },
        { name: 'Bedroom 3', areaSqft: 132.2 },
        { name: 'Bath 1', areaSqft: 60 },
        { name: 'Bath 2', areaSqft: 50 },
        { name: 'Laundry', areaSqft: 50 },
        { name: 'Garage', areaSqft: 620 },
        { name: 'RV Garage', areaSqft: 336.2 },
      ],
    });
    expect(recon.detectedLivingRoomSf).toBeCloseTo(1282.2, 1);
    expect(recon.unassignedLivingSf).toBeCloseTo(596.8, 1);
    expect(recon.detectedGarageRoomSf).toBeCloseTo(956.2, 1);
    expect(recon.unassignedGarageSf).toBeCloseTo(37.8, 1);
    expect(recon.status).toBe('material_variance');
  });

  test('registry blocks living SF as primary for physical trades', () => {
    expect(NO_LIVING_SF_PRIMARY_SEED_KEYS.has('framing')).toBe(true);
    expect(getTradeMeasurementProfile('excavation').preferredPrimaryUnits[0]).toBe('cy');
    expect(getTradeMeasurementProfile('foundation').canUseLivingSfAsPrimary).toBe(false);
    expect(missingStatusForScope('framing')).toBe('needs_takeoff');
    expect(missingStatusForScope('foundation')).toBe('needs_structural_takeoff');
  });

  test('validator blocks unit mismatch when both flags enabled', () => {
    process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    const result = validatePricingBasis({
      itemId: 'framing',
      pricingQuantity: 1879,
      pricingUnit: 'living_sqft',
      rate: 24.42,
      rateUnit: 'surface_sqft',
      calculatedTotal: 45885,
      measurementStatus: 'needs_takeoff',
      selectedSource: 'local_benchmark',
    });
    expect(result.blocked).toBe(true);
    expect(result.requiresExplicitOverride).toBe(true);
  });

  test('Lot 41 framing suggestion keeps needs_takeoff and low quantity confidence when semantics on', () => {
    process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const suggestion = buildStageSuggestion({
      itemId: 'framing',
      livingSf: 1879,
      buildingType: 'detached',
      primaryTakeoff: null,
    });
    expect(suggestion.blendedBenchmark.rate).toBeCloseTo(24.42, 1);
    expect(suggestion.selectedSuggestion.total).toBeGreaterThanOrEqual(45875);
    expect(suggestion.selectedSuggestion.total).toBeLessThanOrEqual(45900);
    expect(suggestion.measurementStatus).toBe('needs_takeoff');
    expect(suggestion.quantityConfidence).toBe('low');
    expect(suggestion.priceConfidence).toBe('medium');
    expect(suggestion.quantityRoles.primaryTakeoff).toBeNull();
    expect(suggestion.quantityRoles.benchmark).toEqual({ quantity: 1879, unit: 'living_sqft' });
    expect(suggestion.warnings.join(' ')).toMatch(/detailed takeoff still required/i);
  });

  test('saved framing price still wins as comparison-only', () => {
    process.env.BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const suggestion = buildStageSuggestion({
      itemId: 'framing',
      livingSf: 1879,
      existingSource: {
        total: 47500,
        reason: 'saved_contractor_price',
        source: 'Saved framing',
      },
    });
    expect(suggestion.selectedSuggestion.total).toBe(47500);
    expect(suggestion.benchmarkIsComparisonOnly).toBe(true);
  });

  test('Silver Leaf remains excluded from detached median', () => {
    const detached = getDetachedProjects(loadSeedDataset());
    expect(detached.map((p) => p.projectId)).not.toContain('silver-leaf');
  });
});
