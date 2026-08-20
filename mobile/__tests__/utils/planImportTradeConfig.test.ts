import { stripScopeInputForSingleTrade } from '@/utils/planImportTradeConfig';
import { PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';

describe('stripScopeInputForSingleTrade', () => {
  it('preserves MEP complexity fields for electrical selected-trade imports', () => {
    const plan58 = PLAN_MEASUREMENT_LOTS['58'];
    const input = {
      mainPanelCount: '1',
      floorAreaSqft: '3660',
      storyCount: '2',
      planFacts: plan58.facts,
      projectComplexity: {
        mode: 'automatic' as const,
        stories: 2 as const,
      },
      quickMeasurementSources: {
        mainPanelCount: 'plan_detected',
        storyCount: 'plan_detected',
      },
      planImportMode: 'selected_trade',
      planImportTradeKey: 'electrical',
    };

    const stripped = stripScopeInputForSingleTrade(input, 'electrical');

    expect(stripped.planFacts?.storyCount).toBe(2);
    expect(stripped.storyCount).toBe('2');
    expect(stripped.floorAreaSqft).toBe('3660');
    expect(stripped.projectComplexity).toMatchObject({ stories: 2 });
    expect(
      (stripped.quickMeasurementSources as Record<string, string>).storyCount
    ).toBe('plan_detected');
    expect(stripped.mainPanelCount).toBe('1');
  });
});
