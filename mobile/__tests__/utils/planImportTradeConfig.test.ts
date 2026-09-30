import {
  filterPlanScopesForTrade,
  stripScopeInputForSingleTrade,
} from '@/utils/planImportTradeConfig';
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

  it('keeps the plan living area on a flooring import', () => {
    const stripped = stripScopeInputForSingleTrade(
      {
        floorAreaSqft: '2571',
        flooringSqft: '2571',
        garageSqft: '1427',
        planImportMode: 'selected_trade',
        planImportTradeKey: 'flooring',
      },
      'flooring'
    );

    expect(stripped.floorAreaSqft).toBe('2571');
    expect(stripped.garageSqft).toBe('');
  });
});

describe('roofing plan scope filtering', () => {
  it('drops generic ground-up cleanup but keeps explicit roofing disposal', () => {
    const filtered = filterPlanScopesForTrade(
      [
        {
          itemId: 'cleanup',
          state: 'included',
          label: 'Cleanup & disposal',
          evidence:
            'Standard ground-up scope for a full residential plan set',
        },
        {
          itemId: 'cleanup',
          state: 'included',
          label: 'Roofing cleanup',
          evidence: 'Remove roofing debris and haul off shingles',
        },
      ],
      'selected_trade',
      'roofing'
    );

    expect(filtered.map(item => item.label)).toEqual(['Roofing cleanup']);
  });
});
