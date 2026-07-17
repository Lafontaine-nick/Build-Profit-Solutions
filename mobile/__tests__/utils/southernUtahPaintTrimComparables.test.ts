import {
  FINISH_CARPENTRY_BY_PROJECT,
  INTERIOR_PAINT_INSTALLED_BY_PROJECT,
  exteriorPaintLocalCalibrationMessage,
  exteriorPaintLocalSampleCount,
  matchSouthernUtahProjectByLivingSf,
  resolveFinishCarpentryComparable,
  resolveInteriorPaintComparable,
} from '@/utils/southernUtahPaintTrimComparables';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { applyBuilderBudgetBarometer } from '@/utils/southernUtahCalibratedRates';
import { normalizeScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import { buildSuggestedPricingCardDisplay } from '@/utils/suggestedPricingCardUi';
import * as benchmarkEngine from '@/utils/benchmarkEngine';
import type { BenchmarkSuggestion } from '@/utils/benchmarkEngine';

describe('southernUtahPaintTrimComparables', () => {
  it('keeps Silver Leaf paint and trim costs per-home (already ÷2)', () => {
    expect(INTERIOR_PAINT_INSTALLED_BY_PROJECT.silverLeaf).toBe(7675);
    expect(FINISH_CARPENTRY_BY_PROJECT.silverLeaf).toMatchObject({
      material: 5871.23,
      labor: 4250,
      total: 10121.23,
    });
    // Must not double-divide the twin-home building total.
    expect(INTERIOR_PAINT_INSTALLED_BY_PROJECT.silverLeaf).toBeLessThan(15000);
  });

  it('matches Plan 41 living SF exactly', () => {
    expect(matchSouthernUtahProjectByLivingSf(1879)?.id).toBe('lot41');
    expect(matchSouthernUtahProjectByLivingSf(1879)?.label).toBe('Plan 41');
  });

  it('returns Plan 41 interior paint $7,400 as exact comparable', () => {
    const comparable = resolveInteriorPaintComparable({
      livingSf: 1879,
      paintableSf: 5469,
    });
    expect(comparable).toMatchObject({
      total: 7400,
      matchKind: 'exact_project',
      projectId: 'lot41',
      sourceSplitTreatment: 'installed_lump_sum',
    });
    expect(comparable.impliedPerPaintableSf).toBeCloseTo(1.35, 2);
    expect(comparable.livingSfBenchmark).toBe(1879);
    expect(comparable.paintableSf).toBe(5469);
    expect(comparable.rateSourceLabel).toMatch(/Plan 41/);
  });

  it('returns Plan 41 finish carpentry $4,000 + $3,250 (incl. door hardware)', () => {
    const comparable = resolveFinishCarpentryComparable({ livingSf: 1879 });
    expect(comparable).toMatchObject({
      material: 4000,
      labor: 3250,
      total: 7250,
      matchKind: 'exact_project',
      splitSource: 'source',
      sourceScope: 'Finish trim, interior doors, door hardware & shelving',
    });
  });

  it('does not invent a real material/labor split for installed paint lumps', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      wallPaintSqft: '5469',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('interior_paint', input, {
      templateKey: 'ground_up',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'interior_paint',
      input,
      'ground_up',
      resolved
    );
    expect(pricing.fill).toMatchObject({
      total: 7400,
      lumpSumOnly: true,
      installedBudgetBenchmark: true,
      splitSource: 'none',
      material: 0,
      labor: 7400,
    });
    expect(pricing.fill?.total).toBe(7400);
    // Must not use national ~$10,300 surface-SF path.
    expect(pricing.fill?.total).not.toBeGreaterThan(8000);
  });

  it('keeps paintable SF separate from living-SF benchmark denominator', () => {
    const comparable = resolveInteriorPaintComparable({
      livingSf: 1879,
      paintableSf: 5469,
    });
    expect(comparable.paintableSf).toBe(5469);
    expect(comparable.livingSfBenchmark).toBe(1879);
    expect(comparable.paintableSf).not.toBe(comparable.livingSfBenchmark);
  });

  it('does not claim exterior paint is Southern Utah calibrated', () => {
    expect(exteriorPaintLocalSampleCount()).toBe(0);
    expect(exteriorPaintLocalCalibrationMessage()).toMatch(/not separately identified/i);

    const national = {
      unit: 'sqft',
      material: 1.0,
      labor: 2.75,
      sourceLabel: 'Suggested · National Average · exterior/stucco paint (mid-market)',
    } as any;
    expect(applyBuilderBudgetBarometer('exterior_paint', 'sqft', national)).toBeNull();
    expect(applyBuilderBudgetBarometer('interior_paint', 'sqft', national)).toBeNull();
    expect(applyBuilderBudgetBarometer('paint_trim', 'sqft', national)).toBeNull();

    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      exteriorPaintSqft: '1859',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('exterior_paint', input, {
      templateKey: 'ground_up',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      input,
      'ground_up',
      resolved
    );
    expect(pricing.fill?.rateSourceLabel).toMatch(/National/i);
    expect(pricing.fill?.rateSourceLabel).not.toMatch(/builder-budget calibrated/i);
    expect(pricing.fill?.helper).toMatch(/not separately identified/i);
    // Mid-market stucco paint with tape/masking: $1.00 + $2.75 = $3.75/SF.
    expect(pricing.fill).toMatchObject({
      material: 1859,
      labor: 5112.25,
      total: 6971.25,
    });
  });

  it('does not show Exterior Envelope stage lump (~$52k) under exterior paint Compare benchmarks', () => {
    const prev = process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1;
    const prevSem = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;
    process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = 'true';
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';

    const stageSuggestion = (scopeId: string, stageId: string, total: number): BenchmarkSuggestion =>
      ({
        scopeId,
        stageId,
        label: stageId,
        datasetId: 'southern_utah_residential_benchmark_v1',
        datasetVersion: '1',
        sourceKind: 'local_preliminary_budget',
        geography: 'Southern Utah',
        dataStatus: 'preliminary',
        selectedReason: 'blended_local_national',
        selectedSuggestion: { total, rate: total / 1879, unit: 'living_sqft', source: 'stage' },
        blendedBenchmark: {
          total,
          rate: total / 1879,
          unit: 'living_sqft',
          appliedQuantity: 1879,
          localWeight: 0.7,
          nationalWeight: 0.3,
        },
        sampleCount: 5,
        confidence: 'medium',
        warnings: [],
        benchmarkLevel: 'stage',
        benchmarkStageKey: stageId,
        coversScopeKeys: ['roofing', 'exterior', 'windows_doors', 'stucco'],
        benchmarkIsComparisonOnly: false,
      }) as BenchmarkSuggestion;

    jest
      .spyOn(benchmarkEngine, 'getCachedBenchmarkSuggestion')
      .mockImplementation((id: string) => stageSuggestion(id, 'exterior-finishes', 52850));

    try {
      const input = {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '1879',
        exteriorPaintSqft: '1859',
        itemQuantities: {},
      } as any;
      const resolved = resolveChecklistItemQuantity('exterior_paint', input, {
        templateKey: 'ground_up',
      });
      const pricing = resolveScopeItemSuggestedPricing(
        'exterior_paint',
        input,
        'ground_up',
        resolved
      );
      expect(pricing.fill?.total).toBeCloseTo(6971.25, 2);
      // Must not offer the Exterior Envelope package as a paint "allowance".
      expect(pricing.comparison).toBeNull();
    } finally {
      jest.restoreAllMocks();
      if (prev == null) delete process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1;
      else process.env.EXPO_PUBLIC_BUILD_AI_BENCHMARK_ENGINE_V1 = prev;
      if (prevSem == null) delete process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;
      else process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = prevSem;
    }
  });

  it('does not let national surface rates override Plan 41 paint without user action', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      wallPaintSqft: '5469',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('interior_paint', input, {
      templateKey: 'ground_up',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'interior_paint',
      input,
      'ground_up',
      resolved
    );
    expect(pricing.fill?.total).toBe(7400);
    expect(pricing.fill?.materialSource).toBe('local_benchmark');
  });

  it('splits legacy paint_trim into interior paint, exterior paint, and interior trim', () => {
    const items = normalizeScopeChecklistItems(
      [
        {
          id: 'paint_trim',
          label: 'Paint & trim',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      'ground_up'
    );
    const ids = items.map((i) => i.id);
    expect(ids).toContain('interior_paint');
    expect(ids).toContain('exterior_paint');
    expect(ids).toContain('interior_trim');
    expect(ids).not.toContain('paint_trim');
    expect(items.find((i) => i.id === 'interior_paint')?.state).toBe('included');
  });

  it('shows Plan 41 finish carpentry package with source mat/labor', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('interior_trim', input, {
      templateKey: 'ground_up',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'interior_trim',
      input,
      'ground_up',
      resolved
    );
    expect(pricing.fill).toMatchObject({
      material: 4000,
      labor: 3250,
      total: 7250,
      splitSource: 'source',
      rateSourceLabel: expect.stringMatching(/Plan 41/),
    });
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'interior_trim',
      block: pricing.fill!,
    });
    expect(display.displayTotal).toMatch(/7,250/);
    expect(display.splitLine).toMatch(/Material/);
    expect(display.splitLine).toMatch(/Labor/);
  });

  it('reconciles displayed paint total with selected source total', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      wallPaintSqft: '5469',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('interior_paint', input, {
      templateKey: 'ground_up',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'interior_paint',
      input,
      'ground_up',
      resolved
    );
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'interior_paint',
      block: pricing.fill!,
      quantitySource: 'calculated',
      hasPrimaryTakeoff: true,
    });
    expect(pricing.fill?.total).toBe(7400);
    expect(display.displayTotal).toBe('$7,400');
    expect(display.pricingSource).toMatch(/Plan 41|Southern Utah comparable/i);
    expect(display.splitLine).toMatch(/not separated/i);
    // Price basis is living-SF house match — not paintable SF × rate.
    expect(display.quantityLine).toMatch(/1,879 living SF/);
    expect(display.unitRateLine).toMatch(/Reference only/i);
    expect(display.unitRateLine).toMatch(/1\.35/);
  });

  it('keeps Plan 41 paint at $7,400 when paintable SF changes to calculated 6,013', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      wallPaintSqft: '6013',
      itemQuantities: {
        interior_paint: {
          quantity: '6013',
          unit: 'sqft',
          quantitySource: 'calculated_confirmed',
        },
      },
    } as any;
    const resolved = resolveChecklistItemQuantity('interior_paint', input, {
      templateKey: 'ground_up',
    });
    expect(Number(resolved.quantity)).toBe(6013);
    expect(resolved.quantitySource).toBe('calculated_confirmed');
    const pricing = resolveScopeItemSuggestedPricing(
      'interior_paint',
      input,
      'ground_up',
      resolved
    );
    expect(pricing.fill?.total).toBe(7400);
    expect(pricing.fill?.helper).toMatch(/does not change this price/i);
  });
});
