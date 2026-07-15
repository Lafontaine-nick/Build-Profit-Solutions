import { seedPlanFloorAreaItemQuantities, type EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  NO_LIVING_SF_PRIMARY_SEED_KEYS,
  assertBenchmarkDoesNotOverwritePrimary,
  buildAreaReconciliation,
  buildSemanticsStateForScope,
  buildUnifiedConfidence,
  getTradeMeasurementProfile,
  measurementSemanticsV1Enabled,
  validatePricingBasis,
} from '@/utils/measurementSemantics';
import {
  getChecklistItemQuantityRule,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { clearBenchmarkCache, fetchBenchmarkSuggestions } from '@/utils/benchmarkEngine';

jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

function draftWithIncluded(ids: string[]): EstimateAiDraft {
  return {
    customerName: null,
    projectTitle: null,
    projectType: 'ground_up',
    projectDescription: null,
    rooms: [],
    allowances: [],
    inclusions: [],
    exclusions: [],
    statedTotal: null,
    calculatedLineItemTotal: null,
    calculatedLaborTotal: null,
    calculatedMaterialTotal: null,
    pricingWarnings: [],
    missingInfo: [],
    contractScope: null,
    suggestedPaymentSchedule: null,
    scopeChecklist: {
      templateKey: 'ground_up',
      title: 'Ground up',
      intro: '',
      items: ids.map((id) => ({
        id,
        label: id,
        state: 'included' as const,
        inScope: true,
      })),
    },
  } as EstimateAiDraft;
}

describe('measurement semantics foundation', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;
  const originalBenchmark = process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1;

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = originalBenchmark;
    clearBenchmarkCache();
    jest.restoreAllMocks();
  });

  it('keeps measurement semantics disabled by default', () => {
    delete process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;
    expect(measurementSemanticsV1Enabled()).toBe(false);
  });

  it('preserves legacy living-SF seeding for framing when measurement semantics is off', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'false';
    const next = seedPlanFloorAreaItemQuantities(draftWithIncluded(['framing', 'foundation']), {
      floorAreaSqft: 1879,
      itemQuantities: {},
    });
    expect(next.itemQuantities?.framing).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
    });
    // Foundation never seeds living SF as quantity (needs CY takeoff).
    expect(next.itemQuantities?.foundation?.quantity).toBeUndefined();
  });

  it('does not seed living SF as primary takeoff when measurement semantics is on', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const next = seedPlanFloorAreaItemQuantities(
      draftWithIncluded(['framing', 'foundation', 'insulation', 'drywall', 'roofing']),
      {
        floorAreaSqft: 1879,
        garageSqft: 994,
        deckSqft: 247,
        drywallSqft: 6577,
        roofSquares: 24,
        planRooms: [
          { name: 'Great Room', areaSqft: 400 },
          { name: 'Garage', areaSqft: 500 },
        ],
        itemQuantities: {},
      }
    );

    expect(NO_LIVING_SF_PRIMARY_SEED_KEYS.has('framing')).toBe(true);
    expect(next.itemQuantities?.framing?.quantity).toBeNull();
    expect(next.itemQuantities?.framing?.measurementState?.status).toBe('needs_takeoff');
    expect(next.itemQuantities?.framing?.measurementState?.benchmark).toMatchObject({
      quantity: 1879,
      unit: 'living_sqft',
    });
    expect(next.itemQuantities?.framing?.measurementState?.primaryTakeoff).toBeNull();

    expect(next.itemQuantities?.foundation?.measurementState?.status).toBe(
      'needs_structural_takeoff'
    );
    expect(next.itemQuantities?.insulation?.quantity).toBeNull();
    expect(next.itemQuantities?.drywall?.quantity).toBe(6577);
    expect(next.itemQuantities?.drywall?.measurementState?.primaryTakeoff?.unit).toBe(
      'surface_sqft'
    );
    expect(next.itemQuantities?.roofing?.quantity).toBe(24);
    expect(next.areaReconciliation?.declaredLivingSf).toBe(1879);
  });

  it('stores Lot 41 style area reconciliation with unassigned living/garage', () => {
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
    expect(recon.declaredLivingSf).toBe(1879);
    expect(recon.detectedLivingRoomSf).toBeCloseTo(1282.2, 1);
    expect(recon.unassignedLivingSf).toBeCloseTo(596.8, 1);
    expect(recon.declaredGarageSf).toBe(994);
    expect(recon.detectedGarageRoomSf).toBeCloseTo(956.2, 1);
    expect(recon.unassignedGarageSf).toBeCloseTo(37.8, 1);
    expect(recon.status).toBe('material_variance');
    expect(recon.notes?.join(' ')).toMatch(/does not mean areas are fully reconciled/i);
  });

  it('registry prefers correct physical units and blocks living SF as primary', () => {
    expect(getTradeMeasurementProfile('excavation')?.preferredPrimaryUnits[0]).toBe('cy');
    expect(getTradeMeasurementProfile('foundation')?.canUseLivingSfAsPrimary).toBe(false);
    expect(getTradeMeasurementProfile('insulation')?.preferredPrimaryUnits).toContain('surface_sqft');
    expect(getTradeMeasurementProfile('appliances')?.preferredPrimaryUnits[0]).toBe('ea');
    expect(getTradeMeasurementProfile('hvac')?.preferredPrimaryUnits).toContain('ton');
    expect(getTradeMeasurementProfile('framing')?.missingQuantityBehavior).toBe('needs_takeoff');
  });

  it('ground-up quantity rules stop using living SF as measurement key when semantics on', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const framing = getChecklistItemQuantityRule('framing', 'ground_up');
    expect(framing?.measurementKeys || []).not.toContain('floorAreaSqft');
    expect(framing?.missingMessage).toMatch(/Needs detailed framing takeoff/i);
    const foundation = getChecklistItemQuantityRule('foundation', 'ground_up');
    expect(foundation?.missingMessage).toMatch(/structural takeoff/i);
  });

  it('validates pricing unit/rate and blocks silent mismatch when both flags enabled', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    const blocked = validatePricingBasis({
      itemId: 'framing',
      pricingQuantity: 1879,
      pricingUnit: 'living_sqft',
      rate: 24.42,
      rateUnit: 'surface_sqft',
      calculatedTotal: 45885.18,
      measurementStatus: 'needs_takeoff',
      selectedSource: 'local_benchmark',
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.requiresExplicitOverride).toBe(true);

    const ok = validatePricingBasis({
      itemId: 'framing',
      pricingQuantity: 1879,
      pricingUnit: 'living_sqft',
      rate: 24.419229,
      rateUnit: 'living_sqft',
      calculatedTotal: 45883.73,
      measurementStatus: 'needs_takeoff',
      selectedSource: 'local_benchmark',
    });
    expect(ok.totalMismatch).toBe(false);
    expect(ok.unitMismatch).toBe(false);
  });

  it('prevents benchmark living SF from overwriting primary takeoff', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const guard = assertBenchmarkDoesNotOverwritePrimary({
      previousPrimaryQuantity: null,
      previousPrimaryUnit: 'package',
      nextPrimaryQuantity: 1879,
      nextPrimaryUnit: 'living_sqft',
      appliedPricingUnit: 'living_sqft',
    });
    expect(guard.ok).toBe(false);
  });

  it('unifies confidence so living-SF-only plan extract is not High price confidence', () => {
    const conf = buildUnifiedConfidence({
      hasPrimaryTakeoff: false,
      measurementStatus: 'needs_takeoff',
      selectedSource: 'local_benchmark',
      localSampleCount: 4,
      livingSfOnlyFromPlan: true,
    });
    expect(conf.quantityConfidence).toBe('low');
    expect(conf.priceConfidence).toBe('medium');
    expect(conf.priceConfidence).not.toBe('high');
  });

  it('keeps benchmark fill off when benchmark flag is disabled even if semantics is on', async () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'false';
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      itemQuantities: {},
    } as ScopeMeasurementsInputExtended;
    const result = resolveScopeItemSuggestedPricing('framing', input, 'ground_up', {
      quantity: 1879,
      unit: 'sqft',
      quantitySource: 'plan_vision',
    });
    expect(result.fill?.laborSource).not.toBe('local_benchmark');
  });

  it('persists separate primary/pricing/benchmark roles for framing acceptance state', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const state = buildSemanticsStateForScope({
      scopeKey: 'framing',
      livingSf: 1879,
      primaryQuantity: null,
    });
    expect(state.primaryTakeoff).toBeNull();
    expect(state.benchmark).toMatchObject({ quantity: 1879, unit: 'living_sqft' });
    expect(state.status).toBe('needs_takeoff');
  });

  it('can fetch benchmark suggestions while preserving role separation metadata', async () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        suggestions: [
          {
            scopeId: 'framing',
            stageId: 'framing',
            label: 'Framing',
            datasetId: 'southern-utah-residential-benchmark-v1',
            datasetVersion: '1.0.0',
            sourceKind: 'local_preliminary_budget',
            geography: 'Southern Utah',
            dataStatus: 'planning_benchmark',
            selectedReason: 'blended_local_national',
            selectedSuggestion: {
              total: 45883.73,
              rate: 24.419229,
              unit: 'living_sqft',
              source: 'Southern Utah',
            },
            benchmarkIsComparisonOnly: false,
            localMedian: {
              rate: 22.82,
              unit: 'living_sqft',
              total: 42873,
              sampleCount: 4,
              buildingType: 'detached',
              sourceStatus: 'planning_benchmark',
            },
            nationalBenchmark: {
              rate: 26.82,
              adjustedRate: 26.82,
              unit: 'living_sqft',
              total: 50392,
              sourceName: 'NAHB',
              sourceUrl: 'https://example.com',
              sourceYear: 2024,
              sampleCount: 1,
              limitations: [],
            },
            blendedBenchmark: {
              rate: 24.419229,
              unit: 'living_sqft',
              total: 45883.73,
              appliedQuantity: 1879,
              localWeight: 0.6,
              nationalWeight: 0.4,
            },
            primaryTakeoff: null,
            benchmarkBasis: { quantity: 1879, unit: 'living_sqft', costPerUnit: 24.419229 },
            localSampleCount: 4,
            sourceConfidence: 'medium',
            quantityConfidence: 'low',
            priceConfidence: 'medium',
            measurementStatus: 'needs_takeoff',
            quantityRoles: {
              primaryTakeoff: null,
              pricing: { quantity: 1879, unit: 'living_sqft', rate: 24.419229 },
              benchmark: { quantity: 1879, unit: 'living_sqft' },
            },
            warnings: ['Benchmark pricing only — detailed takeoff still required.'],
            comparables: [],
            twinHomeReferences: [],
            detachedComparables: [],
          },
        ],
        reasonableness: null,
      }),
    } as Response);

    const payload = await fetchBenchmarkSuggestions({ itemIds: ['framing'], livingSf: 1879 });
    expect(payload?.suggestions[0].measurementStatus).toBe('needs_takeoff');
    expect(payload?.suggestions[0].quantityRoles?.benchmark?.quantity).toBe(1879);
    expect(payload?.suggestions[0].quantityConfidence).toBe('low');
    expect(payload?.suggestions[0].priceConfidence).toBe('medium');
  });
});
