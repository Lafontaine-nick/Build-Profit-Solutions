jest.mock('@/utils/resolveAiBackendUrl', () => ({
  postAiAssistantJson: jest.fn(),
  resolveAiBackendUrl: jest.fn(() => 'http://localhost'),
}));

import { PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';
import {
  applyPlanImportToDraft,
  planMeasurementsToScopeMeasurements,
} from '@/utils/estimateAiDraft';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import { planAreaReconciliationWarnings } from '@/utils/planMeasurementFacts';
import {
  initialScopeMeasurementInputExtended,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';

describe('plan facts persistence', () => {
  test('plan import retains facts and field confidence without overwriting measurements', () => {
    const lot = PLAN_MEASUREMENT_LOTS['58'];
    const draft = applyPlanImportToDraft(
      {
        scopeChecklist: {
          estimateTier: 'complex',
          templateKey: 'ground_up',
          title: 'Confirm scope',
          intro: '',
          items: [],
        },
      } as any,
      {
        measurements: lot.measurements,
        planFacts: lot.facts,
        fieldConfidence: { floorAreaSqft: 0.99 },
      }
    );
    expect(draft.scopeMeasurements?.floorAreaSqft).toBe(3660);
    expect(draft.scopeMeasurements?.planFacts?.buildingAreas?.mainFloorLivingSqft).toBe(2047);
    expect(draft.scopeMeasurements?.quickMeasurementFieldConfidence?.floorAreaSqft).toBe(0.99);
  });

  test('scope measurement payload round-trips structured facts and suggestion metadata', () => {
    const input = {
      ...initialScopeMeasurementInputExtended(null),
      floorAreaSqft: '1879',
      planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
      quickMeasurementSuggestionMetadata: {
        roofSquares: {
          key: 'roofSquares',
          value: 37.2,
          unit: 'sq',
          sourceType: 'calculated_from_components' as const,
          confidence: 'medium' as const,
          confidenceReason: 'component facts',
          formulaId: 'roof_squares_from_footprint_pitch',
          formulaVersion: '2.0.0',
          inputsUsed: { roofPitch: '5:12' },
          assumptions: [],
          includedComponents: ['Main-floor living roof'],
          excludedComponents: ['Detached structures'],
          requiresConfirmation: true,
          planEvidence: [],
          calculationBreakdown: [{ label: 'Roof', value: 3720, unit: 'sqft' }],
        },
      },
    };
    const payload = scopeMeasurementsPayloadForPersist(input);
    const restored = scopeMeasurementsInputFromPayload(payload);
    expect(restored.planFacts?.roofPitch).toBe('5:12');
    expect(restored.quickMeasurementSuggestionMetadata?.roofSquares?.formulaVersion).toBe('2.0.0');
  });

  test('roofing plan pitch and stories stay on the draft without a roof area', () => {
    const draft = applyPlanImportToDraft(
      {
        projectType: 'roofing',
        scopeChecklist: {
          estimateTier: 'complex',
          templateKey: 'roofing',
          title: 'Confirm scope',
          intro: '',
          items: [],
        },
      } as any,
      {
        estimatingMode: 'selected_trade',
        selectedTrade: 'roofing',
        planImportFingerprint: 'shv-lot-49',
        measurements: { roofPitch: '2:12', storyCount: 2 },
      }
    );
    expect(draft.scopeMeasurements?.roofPitch).toBe('2:12');
    expect(Number(draft.scopeMeasurements?.storyCount)).toBe(2);
    expect(Number(draft.scopeMeasurements?.roofSquares || 0)).toBe(0);
    expect(draft.scopeMeasurements?.floorAreaSqft).toBeUndefined();
    expect(planMeasurementsToScopeMeasurements({ roofPitch: '2:12', storyCount: 2 }).roofPitch).toBe(
      '2:12'
    );
    expect(getInitialRevealChecklistScopePreview(draft)).toEqual([
      { name: 'Roof pitch', amount: 0, quantity: '2:12' },
      { name: 'Stories', amount: 0, quantity: '2 stories' },
      {
        name: 'Roof surface area / squares',
        amount: 0,
        quantity: 'Needs measurement',
      },
    ]);
    expect(getInitialRevealUnderstoodBullets(draft, 3)).toEqual([
      'Roof pitch · 2:12',
      'Stories · 2 stories',
      'Roof surface area / squares · Needs measurement',
    ]);
  });

  test('cover and floor totals reconcile without overwriting either fact', () => {
    const lot39 = PLAN_MEASUREMENT_LOTS['39'].facts;
    const warnings = planAreaReconciliationWarnings(lot39);
    expect(lot39.buildingAreas?.totalLivingSqft).toBe(3098);
    expect(lot39.buildingAreas?.mainFloorLivingSqft).toBe(1892);
    expect(lot39.buildingAreas?.upstairsLivingSqft).toBe(1209);
    expect(warnings.join(' ')).toMatch(/3,098.*3,101/);
  });
});

