const {
  sanitizeRooms,
  sanitizeMeasurements,
  mergePlanMeasurementsIntoExisting,
  buildItemQuantities,
} = require('../estimatePlanToMeasurements');

describe('estimatePlanToMeasurements', () => {
  test('sanitizeRooms computes area and maps bathroom keys', () => {
    const rooms = sanitizeRooms([
      { name: 'Master Bath', lengthFt: 10, widthFt: 8, confidence: 0.9 },
      { name: 'Kitchen', areaSqft: 140, measurementKey: 'kitchenFloorSqft', confidence: 0.8 },
    ]);
    expect(rooms[0].areaSqft).toBe(80);
    expect(rooms[0].measurementKey).toBe('bathroomFloorSqft');
    expect(rooms[1].measurementKey).toBe('kitchenFloorSqft');
  });

  test('sanitizeMeasurements aggregates rooms and accepts explicit map', () => {
    const rooms = sanitizeRooms([
      { name: 'Bath', areaSqft: 40, measurementKey: 'bathroomFloorSqft', confidence: 0.9 },
      { name: 'Living', areaSqft: 200, measurementKey: 'floorAreaSqft', confidence: 0.9 },
    ]);
    const measurements = sanitizeMeasurements({ baseboardLf: 180 }, rooms);
    expect(measurements.bathroomFloorSqft).toBe(40);
    expect(measurements.floorAreaSqft).toBe(200);
    expect(measurements.baseboardLf).toBe(180);
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
