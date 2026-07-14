const {
  sanitizeRooms,
  sanitizeMeasurements,
  sanitizeBuildingAreas,
  sanitizeFieldConfidence,
  sanitizeUnreadableFields,
  applyConfidenceFloor,
  mergePlanMeasurementsIntoExisting,
  buildItemQuantities,
  formatNotesBlock,
  mergeRoomsPreferPdf,
  pruneEnvelopeGarageRooms,
  reconcileBathroomMeasurement,
  MIN_FIELD_CONFIDENCE,
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

  test('sanitizeRooms keeps a full labeled-room inventory including baths and closets', () => {
    const rooms = sanitizeRooms([
      { name: 'Dining', lengthFt: 12.083, widthFt: 8.083, confidence: 0.9 },
      { name: 'Kitchen', lengthFt: 12.083, widthFt: 14.167, confidence: 0.9 },
      { name: 'Pantry', lengthFt: 9.167, widthFt: 4.25, confidence: 0.85 },
      { name: 'Bed 3', lengthFt: 13.167, widthFt: 10.5, confidence: 0.9 },
      { name: 'Bed 2/Office', lengthFt: 10.333, widthFt: 10.25, confidence: 0.9 },
      { name: 'Great Room', lengthFt: 14.833, widthFt: 17.5, confidence: 0.9 },
      { name: 'Primary Suite', lengthFt: 15.333, widthFt: 16.083, confidence: 0.9 },
      { name: 'Primary Closet', lengthFt: 11.833, widthFt: 5.25, confidence: 0.85 },
      { name: 'Laundry', lengthFt: 8, widthFt: 5.25, confidence: 0.85 },
      { name: 'Den/Bed 4', lengthFt: 10.333, widthFt: 10.25, confidence: 0.9 },
      { name: 'Primary Bath', lengthFt: 9, widthFt: 8, confidence: 0.8 },
      { name: 'Guest Bath', lengthFt: 7, widthFt: 5, confidence: 0.8 },
      { name: 'Garage', lengthFt: 19.083, widthFt: 23.25, confidence: 0.9 },
      { name: 'RV Garage', lengthFt: 12.083, widthFt: 42.417, confidence: 0.9 },
    ]);
    expect(rooms).toHaveLength(14);
    expect(rooms.filter((r) => r.measurementKey === 'bathroomFloorSqft').map((r) => r.name)).toEqual([
      'Primary Bath',
      'Guest Bath',
    ]);
    expect(rooms.find((r) => r.name === 'Kitchen')?.measurementKey).toBe('kitchenFloorSqft');
    expect(rooms.find((r) => r.name === 'Great Room')?.areaSqft).toBe(259.6);
    expect(rooms.find((r) => r.name === 'Garage')?.measurementKey).toBeNull();

    const measurements = sanitizeMeasurements({}, rooms, { totalLivingSqft: 1879, garageSqft: 994 }, []);
    expect(measurements.bathroomFloorSqft).toBe(107);
    expect(measurements.kitchenFloorSqft).toBe(171.2);
    expect(measurements.floorAreaSqft).toBe(1879);
  });

  test('formatNotesBlock appends full room inventory under summary notes', () => {
    const notes = formatNotesBlock({
      notesBlock: 'Main living area is 1879 SqFt.',
      rooms: [
        { name: 'Kitchen', areaSqft: 171.2 },
        { name: 'Primary Bath', areaSqft: 72 },
        { name: 'Bed 2', areaSqft: 105.9 },
      ],
      measurements: { floorAreaSqft: 1879 },
      buildingAreas: { totalLivingSqft: 1879 },
    });
    expect(notes).toContain('Main living area is 1879 SqFt.');
    expect(notes).toContain('Room measurements:');
    expect(notes).toContain('- Kitchen: 171.2 sqft');
    expect(notes).toContain('- Primary Bath: 72 sqft');
    expect(notes).toContain('- Bed 2: 105.9 sqft');
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

  test('sanitizeMeasurements drops concrete when it duplicates deck / patio SF', () => {
    const measurements = sanitizeMeasurements(
      { concreteSqft: 247, deckSqft: 247, floorAreaSqft: 1879 },
      [],
      { coveredPatioSqft: 247, totalLivingSqft: 1879 },
      ['concreteSqft']
    );
    expect(measurements.deckSqft).toBe(247);
    expect(measurements.concreteSqft).toBeUndefined();
    expect(measurements.floorAreaSqft).toBe(1879);
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

  test('sanitizeFieldConfidence keeps only known keys and clamps to [0,1]', () => {
    const conf = sanitizeFieldConfidence({
      floorAreaSqft: 0.95,
      kitchenFloorSqft: 1.7,
      bogusKey: 0.9,
      deckSqft: -0.2,
      garageSqft: 'not a number',
    });
    expect(conf.floorAreaSqft).toBe(0.95);
    expect(conf.kitchenFloorSqft).toBe(1);
    expect(conf.deckSqft).toBe(0);
    expect(conf.bogusKey).toBeUndefined();
    expect(conf.garageSqft).toBeUndefined();
  });

  test('applyConfidenceFloor withholds low-confidence fields instead of auto-filling', () => {
    const { measurements, lowConfidence } = applyConfidenceFloor(
      { floorAreaSqft: 2418, kitchenFloorSqft: 120, garageSqft: 483 },
      { floorAreaSqft: 0.95, kitchenFloorSqft: MIN_FIELD_CONFIDENCE - 0.1 }
    );
    expect(measurements.floorAreaSqft).toBe(2418);
    // No confidence reported (e.g. schedule-derived) → kept; other gating already applied
    expect(measurements.garageSqft).toBe(483);
    expect(measurements.kitchenFloorSqft).toBeUndefined();
    expect(lowConfidence).toEqual([
      { field: 'kitchenFloorSqft', value: 120, confidence: 0.5 },
    ]);
  });

  test('mergeRoomsPreferPdf keeps PDF rooms and adds missing vision rooms', () => {
    const merged = mergeRoomsPreferPdf(
      [{ name: 'Kitchen', areaSqft: 194.1, confidence: 0.98 }],
      [
        { name: 'Kitchen', areaSqft: 171.2, confidence: 0.7 },
        { name: 'Primary Bath', areaSqft: 40, measurementKey: 'bathroomFloorSqft', confidence: 0.8 },
      ]
    );
    expect(merged.find((r) => r.name === 'Kitchen')?.areaSqft).toBe(194.1);
    expect(merged.map((r) => r.name)).toEqual(['Kitchen', 'Primary Bath']);
  });

  test('pruneEnvelopeGarageRooms drops foundation combined garage envelopes', () => {
    const rooms = pruneEnvelopeGarageRooms([
      { name: 'Garage', lengthFt: 31.083, widthFt: 23.333, areaSqft: 725.8, confidence: 0.7 },
      { name: 'RV Garage', lengthFt: 12.083, widthFt: 42.417, areaSqft: 512.5, confidence: 0.9 },
      { name: 'Garage', lengthFt: 19.083, widthFt: 23.25, areaSqft: 443.7, confidence: 0.9 },
    ]);
    expect(rooms.map((r) => r.areaSqft).sort()).toEqual([443.7, 512.5]);
  });

  test('reconcileBathroomMeasurement drops invented bath SF without bath rooms', () => {
    const unreadable = [];
    const measurements = reconcileBathroomMeasurement(
      { bathroomFloorSqft: 90, kitchenFloorSqft: 194.1 },
      [{ name: 'Kitchen', areaSqft: 194.1, measurementKey: 'kitchenFloorSqft' }],
      unreadable
    );
    expect(measurements.bathroomFloorSqft).toBeUndefined();
    expect(measurements.kitchenFloorSqft).toBe(194.1);
    expect(unreadable[0].field).toBe('bathroomFloorSqft');
  });

  test('reconcileBathroomMeasurement sums labeled bath rooms', () => {
    const measurements = reconcileBathroomMeasurement(
      { bathroomFloorSqft: 90 },
      [
        { name: 'Primary Bath', areaSqft: 72, measurementKey: 'bathroomFloorSqft' },
        { name: 'Guest Bath', areaSqft: 35, measurementKey: 'bathroomFloorSqft' },
      ],
      []
    );
    expect(measurements.bathroomFloorSqft).toBe(107);
  });

  test('sanitizeUnreadableFields normalizes entries and caps reasons', () => {
    const out = sanitizeUnreadableFields([
      { field: 'garageSqft', reason: 'Dimension string blurry' },
      { key: 'deckSqft' },
      { reason: 'no field name' },
      'garbage',
    ]);
    expect(out).toEqual([
      { field: 'garageSqft', reason: 'Dimension string blurry' },
      { field: 'deckSqft', reason: 'Not legible on the plan' },
    ]);
  });
});
