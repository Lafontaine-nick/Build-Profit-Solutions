const {
  applyElectricalVisionTakeoff,
  normalizeElectricalPlanMeasurements,
} = require('../electricalPlanAdapter');

describe('electricalPlanAdapter', () => {
  test('counts the semantic item and applies hookup ownership', () => {
    const normalized = normalizeElectricalPlanMeasurements({
      duplexReceptacleCount: 42,
      gfciCount: 6,
      rangeCircuitCount: 1,
      circuit50aCount: 1,
      threeWayCount: 4,
      dedicated20aCircuitCount: 1,
      dishwasherCircuitCount: 1,
    });
    expect(normalized.standardReceptacleCount).toBe(42);
    expect(normalized.gfciReceptacleCount).toBe(6);
    expect(normalized.rangeHookupCount).toBe(1);
    expect(normalized.threeWaySwitchCount).toBe(4);
    expect(normalized.dishwasherHookupCount).toBe(1);
    expect(normalized.circuit50aCount).toBeUndefined();
    expect(normalized.dedicated20aCircuitCount).toBeUndefined();
    expect(normalized.duplexReceptacleCount).toBeUndefined();
    expect(normalized.gfciCount).toBeUndefined();
    expect(normalized.standardReceptacleCount).not.toBe(42 + 6);
  });

  test('selected-trade vision keeps tier-1 symbols and drops unlabeled homeruns', () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      measurements: {
        recessedLightCount: 34,
        gfciReceptacleCount: 6,
        mainPanelCount: 1,
        serviceAmperage: 200,
        threeWaySwitchCount: 4,
        standardCircuitCount: 18,
        circuit50aCount: 1,
        rangeHookupCount: 1,
        electricalIncludeRough: true,
        floorAreaSqft: 3660,
      },
    });
    expect(result.measurements.recessedLightCount).toBe(34);
    expect(result.measurements.gfciReceptacleCount).toBe(6);
    expect(result.measurements.mainPanelCount).toBe(1);
    expect(result.measurements.serviceAmperage).toBeUndefined();
    expect(result.measurements.threeWaySwitchCount).toBe(4);
    expect(result.measurements.rangeHookupCount).toBe(1);
    expect(result.measurements.standardCircuitCount).toBeUndefined();
    expect(result.measurements.circuit50aCount).toBeUndefined();
    expect(result.measurements.electricalIncludeRough).toBeUndefined();
    expect(result.measurements.floorAreaSqft).toBe(3660);
    expect(result.provenance.recessedLightCount).toMatchObject({
      confidenceTier: 2,
      evidenceKind: 'symbols',
      note: 'From plan symbols',
      normalizedSource: 'NEEDS_REVIEW',
    });
    expect(result.provenance.gfciReceptacleCount).toMatchObject({
      note: 'From plan symbols',
      source: 'calculated_from_symbols',
      normalizedSource: 'NEEDS_REVIEW',
    });
    expect(result.provenance.mainPanelCount.note).toBe('From panel callout');
    expect(result.provenance.threeWaySwitchCount).toMatchObject({
      confidenceTier: 2,
      note: 'From plan symbols',
      normalizedSource: 'NEEDS_REVIEW',
    });
    expect(result.provenance.standardCircuitCount).toBeUndefined();
  });

  test('keeps labeled service amperage and drops unlabeled 200A inference', () => {
    const labeled = applyElectricalVisionTakeoff({
      electricalSelected: true,
      explicitlyLabeled: ['serviceAmperage'],
      measurements: { mainPanelCount: 1, serviceAmperage: 200 },
    });
    expect(labeled.measurements.serviceAmperage).toBe(200);
    const unlabeled = applyElectricalVisionTakeoff({
      electricalSelected: true,
      measurements: { mainPanelCount: 1, serviceAmperage: 200 },
    });
    expect(unlabeled.measurements.serviceAmperage).toBeUndefined();
    expect(unlabeled.measurements.mainPanelCount).toBe(1);
  });

  test('omits conflicted electrical counts so they are not auto-priced', () => {
    const { omitUnresolvedElectricalConflicts } = require('../electricalPlanAdapter');
    const result = omitUnresolvedElectricalConflicts(
      {
        standardReceptacleCount: 50,
        recessedLightCount: 40,
        singlePoleSwitchCount: 15,
        smokeDetectorCount: 6,
      },
      [
        {
          field: 'recessedLightCount',
          selectedValue: 40,
          requiresConfirmation: true,
          candidates: [{ value: 40 }, { value: 20 }],
        },
        {
          field: 'singlePoleSwitchCount',
          selectedValue: 15,
          requiresConfirmation: true,
          candidates: [{ value: 15 }, { value: 20 }],
        },
        {
          field: 'smokeDetectorCount',
          selectedValue: 6,
          requiresConfirmation: true,
          candidates: [{ value: 6 }, { value: 10 }],
        },
      ]
    );
    expect(result.measurements.standardReceptacleCount).toBe(50);
    expect(result.measurements.recessedLightCount).toBeUndefined();
    expect(result.measurements.singlePoleSwitchCount).toBeUndefined();
    expect(result.measurements.smokeDetectorCount).toBeUndefined();
  });

  test('does not keep unlabeled electrical counts on non-electrical takeoff', () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: false,
      measurements: {
        recessedLightCount: 34,
        floorAreaSqft: 3660,
        wallPaintSqft: 5000,
      },
    });
    expect(result.measurements.recessedLightCount).toBeUndefined();
    expect(result.measurements.floorAreaSqft).toBe(3660);
    expect(result.measurements.wallPaintSqft).toBe(5000);
  });

  test('instance-tag recessed lights are Plan verified, symbol GFCI is not', () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      instanceTagKeys: ['recessedLightCount'],
      inferredKeys: ['gfciReceptacleCount'],
      measurements: {
        recessedLightCount: 48,
        gfciReceptacleCount: 8,
        ceilingFanCount: 8,
        standardReceptacleCount: 50,
        mainPanelCount: 1,
      },
    });
    expect(result.provenance.recessedLightCount).toMatchObject({
      evidenceKind: 'instance_tags',
      source: 'pdf_text_instance_tags',
      normalizedSource: 'FROM_PLAN',
      note: 'Counted from instance tags',
      confidenceTier: 1,
    });
    expect(result.provenance.gfciReceptacleCount).toMatchObject({
      evidenceKind: 'inference',
      source: 'inferred_from_context',
      normalizedSource: 'NEEDS_REVIEW',
      note: 'AI inferred — confirm',
    });
    expect(result.provenance.ceilingFanCount).toMatchObject({
      evidenceKind: 'symbols',
      note: 'From plan symbols',
      normalizedSource: 'NEEDS_REVIEW',
    });
    expect(result.provenance.standardReceptacleCount).toMatchObject({
      evidenceKind: 'symbols',
      normalizedSource: 'NEEDS_REVIEW',
    });
    expect(result.provenance.mainPanelCount).toMatchObject({
      evidenceKind: 'explicit_label',
      normalizedSource: 'FROM_PLAN',
    });
  });

  test('two agreeing vision passes are Plan verified; inference is not', () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      methodsAgreeKeys: ['standardReceptacleCount', 'gfciReceptacleCount'],
      inferredKeys: ['gfciReceptacleCount'],
      measurements: {
        standardReceptacleCount: 50,
        gfciReceptacleCount: 8,
      },
    });
    expect(result.provenance.standardReceptacleCount).toMatchObject({
      methodsAgree: true,
      normalizedSource: 'FROM_PLAN',
      confidenceTier: 1,
    });
    expect(result.provenance.gfciReceptacleCount).toMatchObject({
      evidenceKind: 'inference',
      normalizedSource: 'NEEDS_REVIEW',
      note: 'AI inferred — confirm',
    });
  });
});
