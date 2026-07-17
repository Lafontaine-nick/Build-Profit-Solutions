import { blendBarometerLump } from '@/utils/builderBudgetLumpBlend';
import {
  FINISH_CARPENTRY_BY_PROJECT,
  FINISH_CARPENTRY_NATIONAL_AVERAGE_TOTAL,
  INTERIOR_PAINT_INSTALLED_BY_PROJECT,
  INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL,
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

  it('returns blended Plan 41 interior paint as exact comparable', () => {
    const expected = blendBarometerLump(7400, INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL);
    const comparable = resolveInteriorPaintComparable({
      livingSf: 1879,
      paintableSf: 5469,
    });
    expect(comparable).toMatchObject({
      total: expected,
      matchKind: 'exact_project',
      projectId: 'lot41',
      sourceSplitTreatment: 'installed_lump_sum',
    });
    expect(comparable.impliedPerPaintableSf).toBeCloseTo(expected / 5469, 2);
    expect(comparable.livingSfBenchmark).toBe(1879);
    expect(comparable.paintableSf).toBe(5469);
    expect(comparable.rateSourceLabel).toMatch(/Blended national \+ barometer · Plan 41/);

    const ca = resolveInteriorPaintComparable({ livingSf: 1879, state: 'CA' });
    expect(ca.total).toBeCloseTo(expected * 1.38, 1);
  });

  it('returns blended Plan 41 finish carpentry (incl. door hardware in local leg)', () => {
    const local = FINISH_CARPENTRY_BY_PROJECT.lot41;
    const blendedTotal = blendBarometerLump(local.total, FINISH_CARPENTRY_NATIONAL_AVERAGE_TOTAL);
    const comparable = resolveFinishCarpentryComparable({ livingSf: 1879 });
    expect(comparable.total).toBe(blendedTotal);
    expect(comparable.material + comparable.labor).toBeCloseTo(blendedTotal, 1);
    expect(comparable).toMatchObject({
      matchKind: 'exact_project',
      splitSource: 'source',
      sourceScope: 'Finish trim, interior doors, door hardware & shelving',
    });
    expect(comparable.rateSourceLabel).toMatch(/Blended national/);
  });

  it('does not invent a real material/labor split for installed paint lumps', () => {
    const expected = blendBarometerLump(7400, INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL);
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
      total: expected,
      lumpSumOnly: true,
      installedBudgetBenchmark: true,
      splitSource: 'none',
      material: 0,
      labor: expected,
    });
    // Blended package — not the bare national surface-SF path (~$10k+ from $/SF × paintable).
    expect(pricing.fill?.rateSourceLabel).toMatch(/Blended national/);
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
    const expected = blendBarometerLump(7400, INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL);
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
    expect(pricing.fill?.total).toBe(expected);
    expect(pricing.fill?.materialSource).toBe('local_benchmark');
    expect(pricing.fill?.rateSourceLabel).toMatch(/Blended national/);
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

  it('shows Plan 41 finish carpentry package with blended mat/labor', () => {
    const local = FINISH_CARPENTRY_BY_PROJECT.lot41;
    const blendedTotal = blendBarometerLump(local.total, FINISH_CARPENTRY_NATIONAL_AVERAGE_TOTAL);
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
      total: blendedTotal,
      splitSource: 'source',
      rateSourceLabel: expect.stringMatching(/Blended national.*Plan 41/),
    });
    expect((pricing.fill?.material || 0) + (pricing.fill?.labor || 0)).toBeCloseTo(blendedTotal, 1);
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'interior_trim',
      block: pricing.fill!,
    });
    expect(display.displayTotal).toMatch(/9,5\d{2}/);
    expect(display.splitLine).toMatch(/Material/);
    expect(display.splitLine).toMatch(/Labor/);
  });

  it('reconciles displayed paint total with selected source total', () => {
    const expected = blendBarometerLump(7400, INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL);
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
    expect(pricing.fill?.total).toBe(expected);
    expect(display.displayTotal).toBe(`$${expected.toLocaleString()}`);
    expect(display.pricingSource).toMatch(/Blended national|Plan 41/i);
    expect(display.splitLine).toMatch(/not separated/i);
    // Price basis is living-SF house match — not paintable SF × rate.
    expect(display.quantityLine).toMatch(/1,879 living SF/);
    expect(display.unitRateLine).toBeNull();
    expect(display.whyThisPriceLines.join(' ')).toMatch(/Reference only/i);
  });

  it('keeps blended Plan 41 paint fixed when paintable SF changes to calculated 6,013', () => {
    const expected = blendBarometerLump(7400, INTERIOR_PAINT_NATIONAL_AVERAGE_TOTAL);
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
    expect(pricing.fill?.total).toBe(expected);
    expect(pricing.fill?.helper).toMatch(/does not change this installed package/i);
  });
});
