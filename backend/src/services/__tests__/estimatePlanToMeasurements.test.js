const {
  sanitizeRooms,
  sanitizeMeasurements,
  sanitizeBuildingAreas,
  mergePlanMeasurementsIntoExisting,
  buildItemQuantities,
} = require('../estimatePlanToMeasurements');

describe('estimatePlanToMeasurements', () => {
  test('sanitizeRooms computes area and maps bathroom keys', () => {
    const rooms = sanitizeRooms([
      { name: 'Master Bath', lengthFt: 10, widthFt: 8, confidence: 0.9 },
      { name: 'Kitchen', areaSqft: 140, measurementKey: 'kitchenFloorSqft', confidence: 0.8 },
      { name: 'Living', areaSqft: 200, confidence: 0.9 },
    ]);
    expect(rooms[0].areaSqft).toBe(80);
    expect(rooms[0].measurementKey).toBe('bathroomFloorSqft');
    expect(rooms[1].measurementKey).toBe('kitchenFloorSqft');
    // Living rooms stay in notes — not mapped to whole-house floorAreaSqft
    expect(rooms[2].measurementKey).toBeNull();
  });

  test('sanitizeMeasurements prefers Building Areas schedule over a single room', () => {
    const rooms = sanitizeRooms([
      { name: 'Bath', areaSqft: 40, measurementKey: 'bathroomFloorSqft', confidence: 0.9 },
      { name: 'Living', areaSqft: 200, confidence: 0.9 },
    ]);
    const buildingAreas = sanitizeBuildingAreas({
      mainFloorLivingSqft: 1373,
      upstairsLivingSqft: 1045,
      garageSqft: 483,
      coveredPatioSqft: 375,
      roofDeckSqft: 331,
    });
    const measurements = sanitizeMeasurements(
      {
        floorAreaSqft: 40,
        wallPaintSqft: 320,
        drywallSqft: 200,
        baseboardLf: 48,
        bathroomFloorSqft: 40,
        concreteSqft: 375,
      },
      rooms,
      buildingAreas,
      []
    );
    expect(buildingAreas.totalLivingSqft).toBe(2418);
    expect(measurements.floorAreaSqft).toBe(2418);
    expect(measurements.flooringSqft).toBe(2418);
    expect(measurements.garageSqft).toBe(483);
    // Covered patio + roof deck → deck, not flatwork
    expect(measurements.deckSqft).toBe(706);
    expect(measurements.bathroomFloorSqft).toBe(40);
    expect(measurements.wallPaintSqft).toBeUndefined();
    expect(measurements.drywallSqft).toBeUndefined();
    expect(measurements.baseboardLf).toBeUndefined();
    expect(measurements.concreteSqft).toBeUndefined();
  });

  test('sanitizeMeasurements keeps labeled concrete flatwork when explicitlyLabeled', () => {
    const measurements = sanitizeMeasurements(
      { concreteSqft: 900, wallPaintSqft: 2400 },
      [],
      {},
      ['concreteSqft', 'wallPaintSqft']
    );
    expect(measurements.concreteSqft).toBe(900);
    expect(measurements.wallPaintSqft).toBe(2400);
  });

  test('mergePlanMeasurementsIntoExisting does not overwrite filled fields', () => {
    const { measurements, filled } = mergePlanMeasurementsIntoExisting(
      { floorAreaSqft: 1000, kitchenFloorSqft: null },
      { floorAreaSqft: 900, kitchenFloorSqft: 120, bathroomFloorSqft: 45 }
    );
    expect(measurements.floorAreaSqft).toBe(1000);
    expect(measurements.kitchenFloorSqft).toBe(120);
    expect(measurements.bathroomFloorSqft).toBe(45);
    expect(filled).toBe(2);
  });

  test('buildItemQuantities tags plan_vision source', () => {
    const iq = buildItemQuantities({ flooringSqft: 850, baseboardLf: 200 });
    expect(iq.flooring.quantitySource).toBe('plan_vision');
    expect(iq.trim.quantity).toBe(200);
  });
});
