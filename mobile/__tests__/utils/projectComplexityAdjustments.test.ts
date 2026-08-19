import {
  applyComplexityToSuggestedBlock,
  calculateProjectComplexityMultiplier,
  inferProjectComplexitySettings,
  isProjectComplexityEligibleItem,
} from '@/utils/projectComplexityAdjustments';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

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
