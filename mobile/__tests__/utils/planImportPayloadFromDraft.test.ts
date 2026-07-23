import {
  applyPlanImportToDraft,
  planImportPayloadFromDraft,
  type EstimateAiDraft,
  type PlanImportPayload,
} from '@/utils/estimateAiDraft';

function baseDraft(): EstimateAiDraft {
  return {
    customerName: null,
    projectTitle: 'Ground-up',
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
      items: [
        { id: 'framing', label: 'Framing', state: 'unsure' },
        { id: 'appliances', label: 'Appliance install', state: 'unsure' },
      ],
    },
  } as EstimateAiDraft;
}

describe('planImportPayloadFromDraft', () => {
  it('returns null when draft has no plan measurements', () => {
    expect(planImportPayloadFromDraft(baseDraft())).toBeNull();
    expect(planImportPayloadFromDraft(null)).toBeNull();
  });

  it('rebuilds plan import after applyPlanImportToDraft so regenerate can re-seed', () => {
    const payload: PlanImportPayload = {
      measurements: {
        floorAreaSqft: 3098,
        garageSqft: 972,
        deckSqft: 1281,
      },
      rooms: [{ name: 'Kitchen', areaSqft: 220, sourceType: 'plan_explicit' }],
      planFacts: {
        buildingAreas: {
          totalLivingSqft: 3098,
          mainFloorLivingSqft: 1892,
          garageSqft: 972,
          coveredPatioSqft: 1281,
        },
        storyCount: 2,
        roofPitch: 'low-slope',
        coveredPatioRoofed: true,
      },
      buildingAreas: {
        totalLivingSqft: 3098,
        mainFloorLivingSqft: 1892,
        garageSqft: 972,
      },
      scopeDetections: [{ itemId: 'framing', label: 'Framing', state: 'included' }],
    };

    const drafted = applyPlanImportToDraft(baseDraft(), payload);
    const rebuilt = planImportPayloadFromDraft(drafted);
    expect(rebuilt).not.toBeNull();
    expect(Number(rebuilt!.measurements?.floorAreaSqft)).toBe(3098);
    expect(Number(rebuilt!.measurements?.garageSqft)).toBe(972);
    expect(rebuilt!.planFacts?.buildingAreas?.mainFloorLivingSqft).toBe(1892);
    expect(rebuilt!.rooms?.some((r) => r.name === 'Kitchen')).toBe(true);

    const regenerated = applyPlanImportToDraft(baseDraft(), rebuilt);
    expect(Number(regenerated.scopeMeasurements?.floorAreaSqft)).toBe(3098);
    expect(Number(regenerated.scopeMeasurements?.garageSqft)).toBe(972);
  });
});
