import { applyPlanImportToDraft } from '@/utils/estimateAiDraft';
import {
  groupQuickMeasurementFields,
  resolveQuickMeasurementFields,
} from '@/utils/quickMeasurementProvenance';
import { initialScopeMeasurementInputExtended } from '@/utils/scopeItemQuantities';
import { quickMeasurementRowsForTemplate } from '@/utils/scopeQuickMeasurements';

describe('insulation confirm scope hydration', () => {
  it('loads applied insulation takeoff into Step 2 quick measurements', () => {
    const draft = applyPlanImportToDraft(
      {
        projectTitle: 'Lot 58 Insulation',
        scopeChecklist: {
          templateKey: 'insulation',
          title: 'Insulation — confirm project scope',
          intro: 'Confirm insulation scope before pricing.',
          items: [{ id: 'insulation', label: 'Insulation', state: 'yes' }],
        },
      } as any,
      {
        estimatingMode: 'selected_trade',
        selectedTrade: 'insulation',
        measurements: {
          floorAreaSqft: '3660',
          garageSqft: '781',
          openingDeductionSqft: '289.6',
          exteriorWallInsulationSqft: '1950.4',
        },
        planFacts: {
          buildingAreas: { totalLivingSqft: 3660, garageSqft: 781 },
          storyCount: 2,
        },
        quickMeasurementSources: {
          floorAreaSqft: 'detected_from_plan',
          garageSqft: 'detected_from_plan',
          openingDeductionSqft: 'detected_from_plan',
          exteriorWallInsulationSqft: 'detected_from_plan',
        },
      }
    );

    const input = initialScopeMeasurementInputExtended(draft);
    expect(input.openingDeductionSqft).toBe('289.6');
    expect(input.exteriorWallInsulationSqft).toBe('1950.4');
    expect(input.floorAreaSqft).toBe('3660');

    const rows = quickMeasurementRowsForTemplate('insulation');
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: input,
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: ['insulation'],
      templateKey: 'insulation',
    });
    const grouped = groupQuickMeasurementFields(results);
    expect(grouped.fromPlan.length).toBeGreaterThan(0);
    expect(
      results.find(row => row.key === 'openingDeductionSqft')?.filled
    ).toBe(true);
    expect(
      results.find(row => row.key === 'exteriorWallInsulationSqft')?.filled
    ).toBe(true);
  });
});
