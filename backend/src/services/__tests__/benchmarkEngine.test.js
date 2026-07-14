const {
  loadSeedDataset,
  importDataset,
  getDetachedProjects,
  getTwinHomeProjects,
  getLocalNationalWeights,
  median,
  mean,
  blendRates,
  calculatePlanningBaseline,
  scoreProjectSimilarity,
  buildStageSuggestion,
  buildReasonablenessCheck,
  buildBenchmarkProvenance,
} = require('../benchmarkEngine');

describe('benchmarkEngine', () => {
  const dataset = loadSeedDataset();

  test('loads immutable versioned seed idempotently', () => {
    const again = loadSeedDataset();
    expect(again).toBe(dataset);
    expect(dataset.datasetId).toBe('southern-utah-residential-benchmark-v1');
    expect(dataset.schemaVersion).toBe('1.0.0');
    expect(Object.isFrozen(dataset)).toBe(true);
    expect(importDataset(dataset)).toEqual({ dataset, inserted: false });
  });

  test('retains Silver Leaf full building and per-home values outside detached median', () => {
    const silverLeaf = getTwinHomeProjects(dataset).find((p) => p.projectId === 'silver-leaf');
    expect(silverLeaf).toMatchObject({
      livingSfFullBuilding: 4343,
      livingSfPerHome: 2171.5,
      homesInSource: 2,
      includeInDetachedMedian: false,
    });
    expect(getDetachedProjects(dataset).map((p) => p.projectId)).toEqual([
      'lot-39',
      'lot-41',
      'lot-49',
      'lot-58',
    ]);
  });

  test('uses versioned local/national weights', () => {
    expect(getLocalNationalWeights(4, dataset)).toEqual({
      localWeight: 0.6,
      nationalWeight: 0.4,
    });
    expect(getLocalNationalWeights(3, dataset)).toEqual({
      localWeight: 0.55,
      nationalWeight: 0.45,
    });
    expect(getLocalNationalWeights(0, dataset)).toEqual({
      localWeight: 0,
      nationalWeight: 1,
    });
  });

  test('uses median rather than mean for local center', () => {
    expect(median([10, 20, 30, 100])).toBe(25);
    expect(mean([10, 20, 30, 100])).toBe(40);
    const blend = blendRates({
      localRates: [10, 20, 30, 100],
      nationalRate: 50,
      sampleCount: 4,
      dataset,
    });
    expect(blend.localMedianRate).toBe(25);
    expect(blend.blendedRate).toBe(35);
  });

  test('does not apply national escalation or BLS factor by default', () => {
    const blend = blendRates({
      localMedian: 20,
      nationalRate: 30,
      sampleCount: 4,
      dataset,
    });
    expect(blend.adjustedNationalRate).toBe(30);
    expect(blend.nationalEscalation).toBeNull();
    expect(dataset.laborContext.applyToInstalledTotalsByDefault).toBe(false);
  });

  test('planning baseline keeps builder fee separate', () => {
    const baseline = calculatePlanningBaseline(dataset);
    expect(baseline.planningBuildBaselinePerLivingSf).toBeCloseTo(172.65, 1);
    expect(baseline.builderFeeAndOverheadPerLivingSf).toBe(0);
    expect(baseline.generalConditionsPerLivingSf).toBeGreaterThan(0);
    expect(baseline.contingencyPerLivingSf).toBeGreaterThan(0);
  });

  test('builds framing acceptance suggestion for Lot 41', () => {
    const suggestion = buildStageSuggestion({
      itemId: 'framing',
      livingSf: 1879,
      buildingType: 'detached',
      currentProject: { stories: 1, garageSf: 994, patioPorchSf: 247 },
      dataset,
    });
    expect(suggestion.localMedian.rate).toBeCloseTo(22.82, 1);
    expect(suggestion.nationalBenchmark.rate).toBeCloseTo(26.82, 1);
    expect(suggestion.blendedBenchmark.rate).toBeCloseTo(24.42, 1);
    expect(suggestion.selectedSuggestion.total).toBeGreaterThanOrEqual(45875);
    expect(suggestion.selectedSuggestion.total).toBeLessThanOrEqual(45900);
    expect(suggestion.quantityConfidence).toBe('medium');
    expect(suggestion.warnings.join(' ')).toMatch(/detailed takeoff still required/i);
    expect(suggestion.exactSourceMatch).toBe(true);
    expect(suggestion.leaveOneOut?.available).toBe(true);
    expect(suggestion.leaveOneOut?.excludedProjectName).toBe('Lot 41');
    // Primary rates stay published; leave-one-out is validation-only.
    expect(suggestion.leaveOneOut.localMedianRate).not.toBeCloseTo(suggestion.localMedian.rate, 2);
    expect(suggestion.detachedComparables[0].stories).toBe(1);
    expect(suggestion.detachedComparables[0].garageSf).toBe(994);
    expect(suggestion.detachedComparables[0].similarityReasons.join(' ')).not.toMatch(/unknown/i);
  });

  test('saved contractor price beats benchmark', () => {
    const suggestion = buildStageSuggestion({
      itemId: 'framing',
      livingSf: 1879,
      existingSource: {
        total: 47500,
        source: 'Saved framing price',
        reason: 'saved_contractor_price',
        unit: 'ls',
      },
      dataset,
    });
    expect(suggestion.selectedSuggestion.total).toBe(47500);
    expect(suggestion.selectedReason).toBe('saved_contractor_price');
    expect(suggestion.benchmarkIsComparisonOnly).toBe(true);
    expect(buildBenchmarkProvenance(suggestion)).toBeNull();
  });

  test('surface takeoff remains distinct from living-SF benchmark', () => {
    const suggestion = buildStageSuggestion({
      itemId: 'insulation',
      livingSf: 1879,
      primaryTakeoff: { quantity: 6577, unit: 'surface_sqft', source: 'plan_takeoff' },
      dataset,
    });
    expect(suggestion.primaryTakeoff).toEqual({
      quantity: 6577,
      unit: 'surface_sqft',
      source: 'plan_takeoff',
    });
    expect(suggestion.benchmarkBasis).toMatchObject({
      quantity: 1879,
      unit: 'living_sqft',
    });
    expect(suggestion.quantityConfidence).toBe('low');
    expect(suggestion.warnings.join(' ')).toMatch(/6577 surface_sqft/i);
  });

  test('building type mismatch cannot score perfectly', () => {
    const score = scoreProjectSimilarity(
      { buildingType: 'detached', livingSf: 2171.5, stories: 2 },
      getTwinHomeProjects(dataset)[0],
      { market: dataset.geography.market, sourceYear: 2024 }
    );
    expect(score.similarityScore).toBeLessThan(80);
  });

  test('reasonableness check never revises the estimate', () => {
    const check = buildReasonablenessCheck({
      estimateTotal: 367700,
      livingSf: 1879,
      dataset,
    });
    expect(check.currentEstimate).toBe(367700);
    expect(check.currentPerLivingSf).toBeCloseTo(195.69, 1);
    expect(check.disclaimer).toMatch(/no estimate values were changed/i);
  });

  test('benchmark provenance reconciles quantity times rate within one cent', () => {
    const suggestion = buildStageSuggestion({
      itemId: 'framing',
      livingSf: 1879,
      dataset,
    });
    const provenance = buildBenchmarkProvenance(suggestion);
    expect(provenance.calculatedTotal).toBe(
      Math.round(provenance.appliedQuantity * provenance.blendedRate * 100) / 100
    );
    expect(provenance.overriddenByUser).toBe(false);
  });
});
