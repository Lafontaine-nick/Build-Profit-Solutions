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
    expect(result.measurements.serviceAmperage).toBe(200);
    expect(result.measurements.threeWaySwitchCount).toBe(4);
    expect(result.measurements.rangeHookupCount).toBe(1);
    expect(result.measurements.standardCircuitCount).toBeUndefined();
    expect(result.measurements.circuit50aCount).toBeUndefined();
    expect(result.measurements.electricalIncludeRough).toBeUndefined();
    expect(result.measurements.floorAreaSqft).toBe(3660);
    expect(result.provenance.recessedLightCount).toMatchObject({
      confidenceTier: 1,
      note: 'Counted from electrical plan',
    });
    expect(result.provenance.gfciReceptacleCount.note).toBe('Counted from symbols');
    expect(result.provenance.mainPanelCount.note).toBe('From panel callout');
    expect(result.provenance.threeWaySwitchCount).toMatchObject({
      confidenceTier: 2,
      note: 'Calculated from symbols, confirm',
      normalizedSource: 'NEEDS_REVIEW',
    });
    expect(result.provenance.standardCircuitCount).toBeUndefined();
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
});
