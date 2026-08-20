import {
  applyComplexityToSuggestedBlock,
  calculateProjectComplexityMultiplier,
  hasPlanProjectComplexityContext,
  hydrateProjectComplexityInputFields,
  hydrateProjectComplexityMeasurements,
  inferProjectComplexitySettings,
  isMepUserEnteredLivingArea,
  isProjectComplexityEligibleItem,
  resolveStoryCountFromProjectContext,
  seedMepProjectComplexityFromPlanImport,
  shouldApplySquareFootageComplexity,
} from '@/utils/projectComplexityAdjustments';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import { PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';

describe('projectComplexityAdjustments', () => {
  test('Plan 58 production single story uses 0.90 automatic multiplier', () => {
    expect(
      calculateProjectComplexityMultiplier({
        squareFootage: 1879,
        stories: 1,
        constructionType: 'production',
        accessibility: 'normal',
      }).totalMultiplier
    ).toBe(0.9);
  });

  test('large custom two-story stacks and caps automatic multiplier', () => {
    const breakdown = calculateProjectComplexityMultiplier({
      squareFootage: 3500,
      stories: 2,
      constructionType: 'custom',
      accessibility: 'normal',
    });
    expect(breakdown.squareFootMultiplier).toBe(1.15);
    expect(breakdown.storyMultiplier).toBe(1.1);
    expect(breakdown.constructionMultiplier).toBe(1.15);
    expect(breakdown.totalMultiplier).toBe(1.35);
    expect(breakdown.capped).toBe(true);
  });

  test('manual mode uses contractor multiplier within bounds', () => {
    expect(
      calculateProjectComplexityMultiplier({
        mode: 'manual',
        manualMultiplier: 1.25,
      }).totalMultiplier
    ).toBe(1.25);
  });

  test('infers two-story plumbing plan flags into complexity settings', () => {
    expect(
      inferProjectComplexitySettings({
        floorAreaSqft: 2450,
        storyCount: 2,
        plumbingComplexityFactors: [{ key: 'two_story_plumbing', label: 'Two story' }],
      })
    ).toMatchObject({
      squareFootage: 2450,
      stories: 2,
      constructionType: 'standard',
    });
  });

  test('prefers an edited story QM value over stale persisted complexity', () => {
    expect(
      inferProjectComplexitySettings({
        storyCount: '2',
        projectComplexity: {
          mode: 'automatic',
          stories: 1,
        },
        quickMeasurementSources: { storyCount: 'user_entered' },
        quickMeasurementUserOverrides: { storyCount: true },
      })
    ).toMatchObject({ stories: 2 });
  });

  test('infers Plan 58 two-story complexity from planFacts without top-level storyCount', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const planContext = {
      planImportMode: 'selected_trade' as const,
      planImportTradeKey: 'plumbing' as const,
      planImportFingerprint: 'plan-58',
    };
    expect(
      resolveStoryCountFromProjectContext({
        floorAreaSqft: plan58.measurements.floorAreaSqft,
        planFacts: plan58.facts,
        ...planContext,
      })
    ).toBe(2);
    expect(
      inferProjectComplexitySettings({
        floorAreaSqft: plan58.measurements.floorAreaSqft,
        planFacts: plan58.facts,
        ...planContext,
        allowPlanFactsFallback: true,
      })
    ).toMatchObject({
      squareFootage: null,
      stories: 2,
    });
    expect(
      calculateProjectComplexityMultiplier(
        inferProjectComplexitySettings({
          floorAreaSqft: plan58.measurements.floorAreaSqft,
          planFacts: plan58.facts,
          ...planContext,
          allowPlanFactsFallback: true,
        })
      ).totalMultiplier
    ).toBe(1.1);
  });

  test('plan-import MEP applies full SF stack when contractor opts into living area', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const planContext = {
      planImportMode: 'selected_trade' as const,
      planImportTradeKey: 'plumbing' as const,
      planImportFingerprint: 'plan-58',
      quickMeasurementUserOverrides: { floorAreaSqft: true },
      quickMeasurementSources: { floorAreaSqft: 'user_entered' as const },
    };
    expect(
      inferProjectComplexitySettings({
        floorAreaSqft: plan58.measurements.floorAreaSqft,
        planFacts: plan58.facts,
        ...planContext,
        allowPlanFactsFallback: true,
      })
    ).toMatchObject({
      squareFootage: 3660,
      stories: 2,
    });
    expect(
      calculateProjectComplexityMultiplier(
        inferProjectComplexitySettings({
          floorAreaSqft: plan58.measurements.floorAreaSqft,
          planFacts: plan58.facts,
          ...planContext,
          allowPlanFactsFallback: true,
        })
      ).totalMultiplier
    ).toBe(1.26);
  });

  test('shouldApplySquareFootageComplexity gates plan-import MEP living area', () => {
    expect(
      shouldApplySquareFootageComplexity({
        planImportMode: 'selected_trade',
        planImportTradeKey: 'plumbing',
        floorAreaSqft: '3660',
      })
    ).toBe(false);
    expect(
      shouldApplySquareFootageComplexity({
        planImportMode: 'selected_trade',
        planImportTradeKey: 'electrical',
        quickMeasurementUserOverrides: { floorAreaSqft: true },
      })
    ).toBe(true);
    expect(isMepUserEnteredLivingArea({ quickMeasurementSources: { floorAreaSqft: 'user_entered' } })).toBe(true);
  });

  test('hydrates persisted measurements and confirm-scope input from planFacts', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const planContext = {
      planImportMode: 'selected_trade' as const,
      planImportTradeKey: 'plumbing' as const,
      planImportFingerprint: 'plan-58',
      quickMeasurementSources: { plumbingRoughPointCount: 'plan_detected' },
    };
    const hydrated = hydrateProjectComplexityMeasurements({
      floorAreaSqft: 3660,
      planFacts: plan58.facts,
      ...planContext,
    });
    expect(hydrated.storyCount).toBe(2);

    const inputPatches = hydrateProjectComplexityInputFields({
      floorAreaSqft: '',
      planFacts: plan58.facts,
      ...planContext,
    });
    expect(inputPatches.storyCount).toBe('2');
    expect(inputPatches.floorAreaSqft).toBeUndefined();
  });

  test('notes-only jobs do not hydrate living area from orphaned planFacts', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    expect(
      hydrateProjectComplexityInputFields({
        floorAreaSqft: '',
        storyCount: '',
        planFacts: plan58.facts,
      })
    ).toEqual({});
    expect(
      hasPlanProjectComplexityContext({
        planFacts: plan58.facts,
      })
    ).toBe(false);
    expect(
      hydrateProjectComplexityInputFields({
        floorAreaSqft: '2200',
      }).floorAreaSqft
    ).toBeUndefined();
    expect(
      hydrateProjectComplexityInputFields({
        storyCount: '',
        planFacts: plan58.facts,
      }).storyCount
    ).toBeUndefined();
  });

  test('seedMepProjectComplexityFromPlanImport fills living SF and stories for selected-trade imports', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const scopeMeasurements: Record<string, unknown> = {
      planImportMode: 'selected_trade',
      planImportTradeKey: 'electrical',
      planImportFingerprint: 'plan-58',
    };
    seedMepProjectComplexityFromPlanImport(scopeMeasurements, {
      buildingAreas: plan58.facts.buildingAreas,
      planFacts: plan58.facts,
    });
    expect(scopeMeasurements.floorAreaSqft).toBeUndefined();
    expect(scopeMeasurements.storyCount).toBe('2');
    expect(scopeMeasurements.projectComplexity).toMatchObject({
      stories: 2,
    });
    expect(
      (scopeMeasurements.quickMeasurementSources as Record<string, string>)
        ?.floorAreaSqft
    ).toBeUndefined();
  });

  test('notes can supply story count without plan import context', () => {
    expect(
      resolveStoryCountFromProjectContext({
        storyCount: '2',
        allowPlanFactsFallback: false,
      })
    ).toBe(2);
    expect(
      resolveStoryCountFromProjectContext({
        allowPlanFactsFallback: false,
      })
    ).toBe(1);
  });

  test('Plan 58 plumbing rough suggested pricing includes labor complexity uplift', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const priced = resolveScopeItemSuggestedPricing(
      'plumbing_rough',
      {
        plumbingRoughPointCount: '10',
        floorAreaSqft: plan58.measurements.floorAreaSqft,
        planFacts: plan58.facts,
        planImportMode: 'selected_trade',
        planImportTradeKey: 'plumbing',
        planImportFingerprint: 'plan-58',
        quickMeasurementSources: { plumbingRoughPointCount: 'plan_detected' },
      },
      'plumbing_service',
      {
        quantity: 10,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
      { state: 'UT' }
    );
    expect(priced.fill?.complexityAdjustment?.baseTotal).toBe(5000);
    expect(priced.fill?.material).toBe(1500);
    expect(priced.fill?.labor).toBe(3850);
    expect(priced.fill?.total).toBe(5350);
    expect(priced.fill?.rateSourceLabel).toContain('complexity adjusted');
  });

  test('Plan 58 electrical main panel suggested pricing includes labor complexity uplift', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const priced = resolveScopeItemSuggestedPricing(
      'electrical_main_panel',
      {
        mainPanelCount: '1',
        serviceAmperage: '200',
        floorAreaSqft: plan58.measurements.floorAreaSqft,
        planFacts: plan58.facts,
        planImportMode: 'selected_trade',
        planImportTradeKey: 'electrical',
        planImportFingerprint: 'plan-58',
        storyCount: '2',
        projectComplexity: {
          mode: 'automatic',
          squareFootage: 3660,
          stories: 2,
        },
        quickMeasurementSources: { mainPanelCount: 'plan_detected' },
      },
      'electrical',
      {
        quantity: 1,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
      { state: 'UT' }
    );
    expect(priced.fill?.complexityAdjustment?.baseTotal).toBeGreaterThan(0);
    expect(priced.fill?.labor).toBeGreaterThan(
      priced.fill?.complexityAdjustment?.baseLabor ?? 0
    );
    expect(priced.fill?.material).toBe(
      priced.fill?.complexityAdjustment?.baseMaterial
    );
    expect(priced.fill?.rateSourceLabel).toContain('complexity adjusted');
  });

  test('applies labor-only complexity through resolveScopeItemSuggestedPricing', () => {
    const withoutComplexity = resolveScopeItemSuggestedPricing(
      'plumbing_rough',
      {
        plumbingRoughPointCount: '10',
        floorAreaSqft: '1879',
        storyCount: '1',
      },
      'plumbing_service',
      {
        quantity: 10,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
      { state: 'UT' }
    );
    expect(withoutComplexity.fill?.total).toBe(5000);

    const withProductionComplexity = resolveScopeItemSuggestedPricing(
      'plumbing_rough',
      {
        plumbingRoughPointCount: '10',
        floorAreaSqft: '1879',
        storyCount: '1',
        projectComplexity: {
          mode: 'automatic',
          squareFootage: 1879,
          stories: 1,
          constructionType: 'production',
          accessibility: 'normal',
        },
      },
      'plumbing_service',
      {
        quantity: 10,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
      { state: 'UT' }
    );
    expect(withProductionComplexity.fill?.complexityAdjustment?.baseTotal).toBe(5000);
    expect(withProductionComplexity.fill?.material).toBe(1500);
    expect(withProductionComplexity.fill?.labor).toBe(3150);
    expect(withProductionComplexity.fill?.total).toBe(4650);
  });

  test('complexity applies after regional pricing without double-counting regional', () => {
    const block = applyComplexityToSuggestedBlock(
      {
        material: 165,
        labor: 385,
        total: 550,
        helper: 'Base',
        rateSourceLabel: 'Suggested · CA regional (1.10×)',
      },
      calculateProjectComplexityMultiplier({
        squareFootage: 2500,
        stories: 2,
        constructionType: 'custom',
        accessibility: 'normal',
      }),
      { laborOnly: true }
    );
    expect(block.complexityAdjustment?.baseTotal).toBe(550);
    expect(block.material).toBe(165);
    expect(block.labor).toBeGreaterThan(385);
    expect(block.total).toBeGreaterThan(550);
  });

  test('eligible plumbing and electrical scope items', () => {
    expect(isProjectComplexityEligibleItem('plumbing_rough', 'plumbing_service')).toBe(true);
    expect(isProjectComplexityEligibleItem('electrical_rough', 'electrical')).toBe(true);
    expect(isProjectComplexityEligibleItem('permits', 'plumbing_service')).toBe(false);
  });
});
