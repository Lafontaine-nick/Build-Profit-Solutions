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
      planImportFingerprint: 'same-plan',
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
      electricalValidation: {
        priceableFields: ['standardReceptacleCount'],
        blockedFields: ['threeWaySwitchCount'],
        fields: {
          standardReceptacleCount: {
            status: 'ai_verified',
            pricingEligible: true,
          },
          threeWaySwitchCount: {
            status: 'conflict',
            pricingEligible: false,
          },
        },
      },
      scopeDetections: [
        { itemId: 'framing', label: 'Framing', state: 'included' },
      ],
    };

    const drafted = applyPlanImportToDraft(baseDraft(), payload);
    const rebuilt = planImportPayloadFromDraft(drafted);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.planImportFingerprint).toBe('same-plan');
    expect(Number(rebuilt!.measurements?.floorAreaSqft)).toBe(3098);
    expect(Number(rebuilt!.measurements?.garageSqft)).toBe(972);
    expect(rebuilt!.planFacts?.buildingAreas?.mainFloorLivingSqft).toBe(1892);
    expect(rebuilt!.rooms?.some(r => r.name === 'Kitchen')).toBe(true);
    expect(rebuilt!.electricalValidation).toMatchObject({
      priceableFields: ['standardReceptacleCount'],
      blockedFields: ['threeWaySwitchCount'],
    });

    const regenerated = applyPlanImportToDraft(baseDraft(), rebuilt);
    expect(Number(regenerated.scopeMeasurements?.floorAreaSqft)).toBe(3098);
    expect(Number(regenerated.scopeMeasurements?.garageSqft)).toBe(972);
    expect(regenerated.scopeMeasurements?.electricalValidation).toMatchObject({
      blockedFields: ['threeWaySwitchCount'],
    });
  });

  it('routes selected Drywall imports to the standalone drywall checklist', () => {
    const next = applyPlanImportToDraft(baseDraft(), {
      estimatingMode: 'selected_trade',
      selectedTrade: 'drywall',
      planImportFingerprint: 'drywall-plan',
      measurements: {
        floorAreaSqft: 3098,
        drywallWallSqft: 8200,
        drywallCeilingSqft: 3660,
        drywallOpeningDeductionSqft: 1017,
      },
      scopeDetections: [
        { itemId: 'drywall', label: 'Drywall', state: 'included' },
      ],
    } as PlanImportPayload);

    expect(next.scopeChecklist?.templateKey).toBe('drywall');
    expect(next.scopeChecklist?.items.map(item => item.id)).toEqual([
      'drywall',
      'texture',
      'patch_repair',
      'cleanup',
    ]);
    expect(next.scopeMeasurements?.drywallSqft).toBe(11860);
  });

  it('routes selected Insulation imports to the standalone insulation checklist with cleanup', () => {
    const next = applyPlanImportToDraft(baseDraft(), {
      estimatingMode: 'selected_trade',
      selectedTrade: 'insulation',
      planImportFingerprint: 'insulation-plan',
      measurements: {
        floorAreaSqft: 3660,
        exteriorWallInsulationSqft: 1950.4,
        openingDeductionSqft: 289.6,
      },
      scopeDetections: [
        { itemId: 'insulation', label: 'Insulation', state: 'included' },
      ],
    } as PlanImportPayload);

    expect(next.scopeChecklist?.templateKey).toBe('insulation');
    expect(next.scopeChecklist?.items.map(item => item.id)).toEqual([
      'insulation',
      'cleanup',
    ]);
    expect(
      Number(next.scopeMeasurements?.exteriorWallInsulationSqft)
    ).toBeGreaterThan(0);
  });

  it('routes selected Windows & doors imports without activating framing', () => {
    const next = applyPlanImportToDraft(baseDraft(), {
      estimatingMode: 'selected_trade',
      selectedTrade: 'windows_doors',
      planImportFingerprint: 'windows-plan',
      measurements: {
        floorAreaSqft: 3098,
        windowCount: 14,
        exteriorDoorCount: 3,
        slidingDoorCount: 2,
        interiorDoorCount: 10,
        garageDoorSingleCount: 1,
        garageDoorDoubleCount: 1,
        garageDoorRvCount: 1,
        framingOpeningCount: 18,
      },
      scopeDetections: [
        { itemId: 'windows', label: 'Windows', state: 'included' },
      ],
    } as PlanImportPayload);

    expect(next.scopeChecklist?.templateKey).toBe('windows_doors');
    expect(next.scopeChecklist?.items.map(item => item.id)).toEqual([
      'windows',
      'exterior_doors',
      'sliding_doors',
      'interior_doors',
    ]);
    expect(
      next.scopeChecklist?.items.find(item => item.id === 'windows')?.state
    ).toBe('included');
    expect(
      next.scopeChecklist?.items.find(item => item.id === 'sliding_doors')
        ?.state
    ).toBe('included');
    expect(
      next.scopeChecklist?.items.find(item => item.id === 'interior_doors')
        ?.state
    ).toBe('included');
    expect(next.scopeMeasurements).toMatchObject({
      windowCount: 14,
      exteriorDoorCount: 3,
      slidingDoorCount: 2,
    });
    expect(next.scopeMeasurements?.garageDoorSingleCount).toBeUndefined();
    expect(next.scopeMeasurements?.framingOpeningCount).toBeUndefined();
    expect(next.scopeMeasurements?.itemQuantities).not.toHaveProperty('framing');
  });

  it('copies HVAC plan measurements into scopeMeasurements for Quick Measurements step 2', () => {
    const payload: PlanImportPayload = {
      estimatingMode: 'selected_trade',
      selectedTrade: 'hvac',
      planImportFingerprint: 'hvac-plan-1',
      measurements: {
        hvacSystemCount: 1,
        hvacSystemTons: 4,
        hvacSupplyRegisterCount: 12,
        hvacReturnGrilleCount: 4,
        hvacThermostatCount: 1,
      },
    };
    const next = applyPlanImportToDraft(baseDraft(), payload);
    expect(next.scopeMeasurements).toMatchObject({
      hvacSystemCount: 1,
      hvacSystemTons: 4,
      hvacSupplyRegisterCount: 12,
      hvacReturnGrilleCount: 4,
      hvacThermostatCount: 1,
      planImportTradeKey: 'hvac',
    });
    expect(next.scopeMeasurements?.itemQuantities).toMatchObject({
      hvac: { quantity: 1, unit: 'each' },
      supply_registers: { quantity: 12, unit: 'each' },
      return_grilles: { quantity: 4, unit: 'each' },
      thermostat: { quantity: 1, unit: 'each' },
    });
    expect(next.scopeMeasurements?.quickMeasurementSources?.hvacSupplyRegisterCount).toBe(
      'needs_confirmation'
    );
  });
});
