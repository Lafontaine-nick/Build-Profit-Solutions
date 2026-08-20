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
  sanitizePlanFacts,
  reconcileLabeledLivingAreas,
  derivePaintingGeometryMeasurements,
  MIN_FIELD_CONFIDENCE,
  MEASUREMENT_KEYS,
  buildElectricalSystemPrompt,
  mergeElectricalEvidenceSources,
  mergePlumbingFieldEvidence,
  collectUnclassifiedElectricalFixtures,
} = require('../estimatePlanToMeasurements');
const { filterPlanMeasurementsForTrade, filterPlanScopesForTrade, TRADE_CONFIGS } = require('../planImportTradeConfig');
const shvPlanFacts = require('../testFixtures/shvPlanFacts');

describe('estimatePlanToMeasurements', () => {
  test('merges Plumbing evidence by canonical field and retains derivation inputs', () => {
    expect(
      mergePlumbingFieldEvidence(
        {
          roughInPoints: {
            page: 3,
            sheet: 'P1.1',
            evidenceKind: 'fixture_inventory_derived',
            derivedFrom: ['toilets'],
          },
        },
        {
          gasLineFeet: [
            {
              page: 4,
              sheet: 'P2.1',
              sourceText: '42 LF',
              sourceType: 'pdf_text',
            },
          ],
        }
      )
    ).toEqual({
      plumbingRoughPointCount: [
        {
          page: 3,
          sheet: 'P1.1',
          evidenceKind: 'fixture_inventory_derived',
          derivedFrom: ['toilets'],
        },
      ],
      gasLineLf: [
        {
          page: 4,
          sheet: 'P2.1',
          sourceText: '42 LF',
          sourceType: 'pdf_text',
        },
      ],
    });
  });

  test('sanitizeRooms computes area and maps bathroom keys', () => {
    const rooms = sanitizeRooms([
      { name: 'Master Bath', lengthFt: 10, widthFt: 8, confidence: 0.9 },
      {
        name: 'Kitchen',
        areaSqft: 140,
        measurementKey: 'kitchenFloorSqft',
        confidence: 0.8,
      },
      { name: 'Living', areaSqft: 200, confidence: 0.9 },
    ]);
    expect(rooms[0].areaSqft).toBe(80);
    expect(rooms[0].measurementKey).toBe('bathroomFloorSqft');
    expect(rooms[1].measurementKey).toBe('kitchenFloorSqft');
    // Living rooms stay in notes — not mapped to whole-house floorAreaSqft
    expect(rooms[2].measurementKey).toBeNull();
  });

  test('sanitizeRooms preserves bounded PDF page and sheet evidence', () => {
    const [room] = sanitizeRooms([
      {
        name: 'Kitchen',
        areaSqft: 120,
        confidence: 1,
        sourcePage: 4,
        sourceSheet: 'A1.2',
      },
    ]);
    expect(room).toMatchObject({ sourcePage: 4, sourceSheet: 'A1.2' });
  });

  test('sanitizePlanFacts requires evidence and rejects fabricated geometry', () => {
    const facts = sanitizePlanFacts(
      {
        storyCount: 2,
        roofPitch: '5/12',
        wallHeightFt: 9,
        exteriorPerimeterLf: 214,
        nonPaintedExteriorPercent: 25,
        coveredPatioRoofed: true,
        fieldEvidence: {
          storyCount: {
            value: 2,
            sourceType: 'detected_from_plan',
            confidence: 'high',
            evidence: [{ page: 2, sheet: 'A1.1', sourceText: 'UPPER FLOOR' }],
          },
          roofPitch: {
            value: '5:12',
            sourceType: 'detected_from_plan',
            confidence: 'high',
            evidence: [{ page: 5, label: 'ROOF PITCH 5:12' }],
          },
          exteriorPerimeterLf: {
            value: 214,
            sourceType: 'detected_from_plan',
            confidence: 'high',
            evidence: [{ page: 5, sourceText: 'EXTERIOR PERIMETER 214 LF' }],
          },
          nonPaintedExteriorPercent: {
            value: 25,
            sourceType: 'detected_from_plan',
            confidence: 'medium',
            evidence: [{ page: 6, sourceText: 'STONE 25%' }],
          },
        },
        geometry: [
          { id: 'invented', kind: 'roof_plane' },
          {
            id: 'supplied-plane',
            kind: 'roof_plane',
            areaSqft: 500,
            pitch: '5/12',
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
            ],
          },
        ],
      },
      { totalLivingSqft: 1879 }
    );
    expect(facts.storyCount).toBe(2);
    expect(facts.roofPitch).toBe('5:12');
    expect(facts.wallHeightFt).toBeUndefined();
    expect(facts.exteriorPerimeterLf).toBe(214);
    expect(facts.nonPaintedExteriorPercent).toBe(25);
    expect(facts.coveredPatioRoofed).toBeUndefined();
    expect(facts.geometry).toHaveLength(1);
    expect(facts.geometry[0].id).toBe('supplied-plane');
  });

  test.each(shvPlanFacts.filter(fixture => fixture.expected.floorDeltaSqft != null))(
    'reconciles cover and floor labels for SHV Lot $lot',
    ({ expected }) => {
      const result = reconcileLabeledLivingAreas({
        totalLivingSqft: expected.totalLivingSqft,
        mainFloorLivingSqft: expected.mainFloorLivingSqft,
        upstairsLivingSqft: expected.upstairsLivingSqft,
      });
      expect(result.floorDeltaSqft).toBe(expected.floorDeltaSqft);
      expect(result.floorAreaStatus).toBe(expected.floorDeltaSqft === 0 ? 'reconciled' : 'review');
    }
  );

  test('sanitizeRooms keeps a full labeled-room inventory including baths and closets', () => {
    const rooms = sanitizeRooms([
      { name: 'Dining', lengthFt: 12.083, widthFt: 8.083, confidence: 0.9 },
      { name: 'Kitchen', lengthFt: 12.083, widthFt: 14.167, confidence: 0.9 },
      { name: 'Pantry', lengthFt: 9.167, widthFt: 4.25, confidence: 0.85 },
      { name: 'Bed 3', lengthFt: 13.167, widthFt: 10.5, confidence: 0.9 },
      {
        name: 'Bed 2/Office',
        lengthFt: 10.333,
        widthFt: 10.25,
        confidence: 0.9,
      },
      { name: 'Great Room', lengthFt: 14.833, widthFt: 17.5, confidence: 0.9 },
      {
        name: 'Primary Suite',
        lengthFt: 15.333,
        widthFt: 16.083,
        confidence: 0.9,
      },
      {
        name: 'Primary Closet',
        lengthFt: 11.833,
        widthFt: 5.25,
        confidence: 0.85,
      },
      { name: 'Laundry', lengthFt: 8, widthFt: 5.25, confidence: 0.85 },
      { name: 'Den/Bed 4', lengthFt: 10.333, widthFt: 10.25, confidence: 0.9 },
      { name: 'Primary Bath', lengthFt: 9, widthFt: 8, confidence: 0.8 },
      { name: 'Guest Bath', lengthFt: 7, widthFt: 5, confidence: 0.8 },
      { name: 'Garage', lengthFt: 19.083, widthFt: 23.25, confidence: 0.9 },
      { name: 'RV Garage', lengthFt: 12.083, widthFt: 42.417, confidence: 0.9 },
    ]);
    expect(rooms).toHaveLength(14);
    expect(rooms.filter(r => r.measurementKey === 'bathroomFloorSqft').map(r => r.name)).toEqual([
      'Primary Bath',
      'Guest Bath',
    ]);
    expect(rooms.find(r => r.name === 'Kitchen')?.measurementKey).toBe('kitchenFloorSqft');
    expect(rooms.find(r => r.name === 'Great Room')?.areaSqft).toBe(259.6);
    expect(rooms.find(r => r.name === 'Garage')?.measurementKey).toBeNull();

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
      {
        name: 'Bath',
        areaSqft: 40,
        measurementKey: 'bathroomFloorSqft',
        confidence: 0.9,
      },
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
    const measurements = sanitizeMeasurements({ concreteSqft: 900, wallPaintSqft: 2400 }, [], {}, [
      'concreteSqft',
      'wallPaintSqft',
    ]);
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

  test('roof squares seed only the base Roofing quantity, never tear-off', () => {
    const iq = buildItemQuantities({
      roofSquares: 30,
      roofDeckingReplacementSqft: 100,
      roofDripEdgeLf: 180,
      roofRepairAffectedSqft: 50,
    });

    expect(iq.shingles_roofing).toMatchObject({
      quantity: 30,
      unit: 'squares',
      quantitySource: 'plan_vision',
    });
    expect(iq.tear_off).toBeUndefined();
    expect(iq.decking_repair).toBeUndefined();
  });

  test('retains explicitly extracted Roofing accessory measurements', () => {
    const measurements = sanitizeMeasurements(
      {
        roofSquares: 30,
        roofDeckingReplacementSqft: 100,
        roofDripEdgeLf: 180,
        roofRidgeCapLf: 60,
        roofRidgeVentLf: 40,
        roofVentCount: 3,
        roofPipeBootCount: 4,
        roofRepairAffectedSqft: 50,
      },
      [],
      {}
    );

    expect(measurements).toMatchObject({
      roofSquares: 30,
      roofDeckingReplacementSqft: 100,
      roofDripEdgeLf: 180,
      roofRidgeCapLf: 60,
      roofRidgeVentLf: 40,
      roofVentCount: 3,
      roofPipeBootCount: 4,
      roofRepairAffectedSqft: 50,
    });
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
    expect(lowConfidence).toEqual([{ field: 'kitchenFloorSqft', value: 120, confidence: 0.5 }]);
  });

  test('mergeRoomsPreferPdf keeps PDF rooms and adds missing vision rooms', () => {
    const merged = mergeRoomsPreferPdf(
      [{ name: 'Kitchen', areaSqft: 194.1, confidence: 0.98 }],
      [
        { name: 'Kitchen', areaSqft: 171.2, confidence: 0.7 },
        {
          name: 'Primary Bath',
          areaSqft: 40,
          measurementKey: 'bathroomFloorSqft',
          confidence: 0.8,
        },
      ]
    );
    expect(merged.find(r => r.name === 'Kitchen')?.areaSqft).toBe(194.1);
    expect(merged.map(r => r.name)).toEqual(['Kitchen', 'Primary Bath']);
  });

  test('pruneEnvelopeGarageRooms drops foundation combined garage envelopes', () => {
    const rooms = pruneEnvelopeGarageRooms([
      {
        name: 'Garage',
        lengthFt: 31.083,
        widthFt: 23.333,
        areaSqft: 725.8,
        confidence: 0.7,
      },
      {
        name: 'RV Garage',
        lengthFt: 12.083,
        widthFt: 42.417,
        areaSqft: 512.5,
        confidence: 0.9,
      },
      {
        name: 'Garage',
        lengthFt: 19.083,
        widthFt: 23.25,
        areaSqft: 443.7,
        confidence: 0.9,
      },
    ]);
    expect(rooms.map(r => r.areaSqft).sort()).toEqual([443.7, 512.5]);
  });

  test('reconcileBathroomMeasurement drops invented bath SF without bath rooms', () => {
    const unreadable = [];
    const measurements = reconcileBathroomMeasurement(
      { bathroomFloorSqft: 90, kitchenFloorSqft: 194.1 },
      [
        {
          name: 'Kitchen',
          areaSqft: 194.1,
          measurementKey: 'kitchenFloorSqft',
        },
      ],
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
        {
          name: 'Primary Bath',
          areaSqft: 72,
          measurementKey: 'bathroomFloorSqft',
        },
        {
          name: 'Guest Bath',
          areaSqft: 35,
          measurementKey: 'bathroomFloorSqft',
        },
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
    expect(
      sanitizeUnreadableFields([
        { field: 'serviceAmperage', reason: 'No printed amperage callout' },
        { field: 'serviceAmperage', reason: 'No printed amperage callout' },
      ])
    ).toEqual([{ field: 'serviceAmperage', reason: 'No printed amperage callout' }]);
  });

  const residentialPaintRooms = () =>
    sanitizeRooms([
      { name: 'Great Room', lengthFt: 16, widthFt: 14, confidence: 0.9 },
      { name: 'Kitchen', lengthFt: 12, widthFt: 12, confidence: 0.9 },
      { name: 'Bed 1', lengthFt: 12, widthFt: 11, confidence: 0.9 },
      { name: 'Bed 2', lengthFt: 11, widthFt: 10, confidence: 0.9 },
      { name: 'Bath', lengthFt: 8, widthFt: 5, confidence: 0.9 },
      { name: 'Garage', lengthFt: 20, widthFt: 20, confidence: 0.9 },
    ]);

  test('labeled painting keys survive sanitize + selected-trade filter', () => {
    const measurements = sanitizeMeasurements(
      {
        wallPaintSqft: 5000,
        ceilingPaintSqft: 2000,
        interiorDoorCount: 12,
        baseboardLf: 800,
        floorAreaSqft: 2400,
        drywallSqft: 1800,
      },
      [],
      { totalLivingSqft: 2400 },
      ['wallPaintSqft', 'ceilingPaintSqft', 'interiorDoorCount', 'baseboardLf']
    );
    expect(measurements.wallPaintSqft).toBe(5000);
    expect(measurements.ceilingPaintSqft).toBe(2000);
    expect(measurements.interiorDoorCount).toBe(12);
    expect(measurements.baseboardLf).toBe(800);
    expect(measurements.drywallSqft).toBeUndefined();
    const filtered = filterPlanMeasurementsForTrade(measurements, 'selected_trade', TRADE_CONFIGS.painting);
    expect(filtered).toEqual({
      wallPaintSqft: 5000,
      ceilingPaintSqft: 2000,
      interiorDoorCount: 12,
      baseboardLf: 800,
    });
  });

  test('unlabeled interior door counts in 1-80 survive sanitize; unlabeled paint SF still drops', () => {
    const measurements = sanitizeMeasurements(
      {
        interiorDoorCount: 16,
        wallPaintSqft: 320,
        ceilingPaintSqft: 320,
      },
      [],
      { totalLivingSqft: 3660 },
      []
    );
    expect(measurements.interiorDoorCount).toBe(16);
    expect(measurements.wallPaintSqft).toBeUndefined();
    expect(measurements.ceilingPaintSqft).toBeUndefined();
  });

  test('derivePaintingGeometryMeasurements calculates walls/ceilings/trim from dimensioned rooms', () => {
    const rooms = residentialPaintRooms();
    const derived = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 2000 },
      rooms,
      { wallHeightFt: 9 },
      { buildingAreas: { totalLivingSqft: 2000 } }
    );
    expect(derived.measurements.wallPaintSqft).toBe(1998);
    expect(derived.measurements.ceilingPaintSqft).toBe(2000);
    expect(derived.measurements.baseboardLf).toBe(222);
    expect(derived.measurements.cabinetRunLf).toBeUndefined();
    expect(derived.measurements.cabinetPaintSqft).toBeUndefined();
    expect(derived.derivedKeys).toEqual(expect.arrayContaining(['wallPaintSqft', 'ceilingPaintSqft', 'baseboardLf']));
    expect(derived.measurements.wallPaintSqft).not.toBe(2000);
    expect(derived.measurements.wallPaintSqft).not.toBe(6000);
  });

  test('derivePaintingGeometryMeasurements does not invent walls from living SF or missing height', () => {
    const noRooms = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 2000 },
      [],
      { wallHeightFt: 9 },
      { buildingAreas: { totalLivingSqft: 2000 } }
    );
    expect(noRooms.measurements.wallPaintSqft).toBeUndefined();
    expect(noRooms.measurements.ceilingPaintSqft).toBe(2000);
    expect(noRooms.derivedKeys).toEqual(['ceilingPaintSqft']);

    const noHeight = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 2000 },
      residentialPaintRooms(),
      {},
      { buildingAreas: { totalLivingSqft: 2000 } }
    );
    expect(noHeight.measurements.wallPaintSqft).toBeUndefined();
    expect(noHeight.measurements.ceilingPaintSqft).toBe(2000);
    expect(noHeight.derivedKeys).toContain('ceilingPaintSqft');
    expect(noHeight.derivedKeys).not.toContain('wallPaintSqft');
  });

  test('Lot 58 living areas fall back to 3660 ceiling SF and exclude garage/patio', () => {
    const derived = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 3660, garageSqft: 781, deckSqft: 297 },
      [],
      { wallHeightFt: 10.2, plateHeightFt: 10.2 },
      {
        buildingAreas: {
          totalLivingSqft: 3660,
          mainFloorLivingSqft: 2047,
          upstairsLivingSqft: 1613,
          garageSqft: 781,
          coveredPatioSqft: 297,
        },
      }
    );
    expect(derived.measurements.ceilingPaintSqft).toBe(3660);
    expect(derived.measurements.wallPaintSqft).toBeUndefined();
    expect(derived.measurements.baseboardLf).toBeUndefined();
    expect(derived.measurements.cabinetRunLf).toBeUndefined();
    expect(derived.measurements.exteriorPaintSqft).toBeUndefined();
    expect(derived.measurements.ceilingPaintSqft).not.toBe(4441);
    expect(derived.measurements.ceilingPaintSqft).not.toBe(3957);
    const filtered = filterPlanMeasurementsForTrade(derived.measurements, 'selected_trade', TRADE_CONFIGS.painting);
    expect(filtered.ceilingPaintSqft).toBe(3660);
    expect(filtered.garageSqft).toBeUndefined();
    expect(filtered.floorAreaSqft).toBeUndefined();
  });

  test('Lot 58 incomplete rooms keep 3660 ceiling SF instead of the partial room sum', () => {
    const derived = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 3660 },
      sanitizeRooms([
        { name: 'Great Room', lengthFt: 16, widthFt: 14, confidence: 0.9 },
        { name: 'Kitchen', lengthFt: 12, widthFt: 12, confidence: 0.9 },
      ]),
      { wallHeightFt: 10.2 },
      {
        buildingAreas: {
          totalLivingSqft: 3660,
          mainFloorLivingSqft: 2047,
          upstairsLivingSqft: 1613,
        },
      }
    );
    expect(derived.measurements.ceilingPaintSqft).toBe(3660);
    expect(derived.measurements.ceilingPaintSqft).not.toBe(368);
    expect(derived.measurements.wallPaintSqft).toBe(1101.6);
    expect(derived.measurements.baseboardLf).toBe(108);
    expect(derived.incompleteKeys).toEqual(expect.arrayContaining(['wallPaintSqft', 'baseboardLf']));
  });

  test('derivePaintingGeometryMeasurements keeps labeled paint totals and skips unlabeled cabinets', () => {
    const derived = derivePaintingGeometryMeasurements(
      { wallPaintSqft: 5000, ceilingPaintSqft: 2000 },
      residentialPaintRooms(),
      { wallHeightFt: 9 },
      {
        rawVisionMeasurements: { cabinetRunLf: 42, interiorDoorCount: 12 },
        geometryDerived: ['interiorDoorCount'],
        buildingAreas: { totalLivingSqft: 2000 },
      }
    );
    expect(derived.measurements.wallPaintSqft).toBe(5000);
    expect(derived.measurements.ceilingPaintSqft).toBe(2000);
    expect(derived.measurements.interiorDoorCount).toBe(12);
    expect(derived.measurements.cabinetRunLf).toBeUndefined();
  });

  test('derivePaintingGeometryMeasurements accepts unlabeled interior door counts', () => {
    const derived = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 2000 },
      residentialPaintRooms(),
      { wallHeightFt: 9 },
      {
        rawVisionMeasurements: { interiorDoorCount: 14, wallPaintSqft: 320 },
        buildingAreas: { totalLivingSqft: 2000 },
      }
    );
    expect(derived.measurements.interiorDoorCount).toBe(14);
    expect(derived.measurements.wallPaintSqft).toBe(1998);
    expect(derived.derivedKeys).toContain('interiorDoorCount');
  });

  test('formatNotesBlock includes room L×W when dimensioned', () => {
    const notes = formatNotesBlock({
      notesBlock: 'Main living area is 650 SqFt.',
      rooms: [
        { name: 'Kitchen', lengthFt: 12, widthFt: 12, areaSqft: 144 },
        { name: 'Great Room', areaSqft: 224 },
      ],
      measurements: {},
      buildingAreas: { totalLivingSqft: 650 },
    });
    expect(notes).toContain('- Kitchen: 12×12 ft (144 sqft)');
    expect(notes).toContain('- Great Room: 224 sqft');
  });

  test('electrical symbol counts survive sanitize and selected-trade filter', () => {
    const measurements = sanitizeMeasurements(
      {
        recessedLightCount: 34,
        gfciReceptacleCount: 6,
        mainPanelCount: 1,
        serviceAmperage: 200,
        standardCircuitCount: 18,
        circuit50aCount: 1,
        floorAreaSqft: 3660,
        wallPaintSqft: 5000,
      },
      [],
      { totalLivingSqft: 3660 },
      ['mainPanelCount', 'serviceAmperage']
    );
    expect(measurements.recessedLightCount).toBe(34);
    expect(measurements.gfciReceptacleCount).toBe(6);
    expect(measurements.mainPanelCount).toBe(1);
    expect(measurements.serviceAmperage).toBe(200);
    expect(measurements.standardCircuitCount).toBeUndefined();
    expect(measurements.circuit50aCount).toBeUndefined();
    expect(measurements.wallPaintSqft).toBeUndefined();
    const filtered = filterPlanMeasurementsForTrade(measurements, 'selected_trade', TRADE_CONFIGS.electrical);
    expect(filtered.recessedLightCount).toBe(34);
    expect(filtered.gfciReceptacleCount).toBe(6);
    expect(filtered.mainPanelCount).toBe(1);
    expect(filtered.serviceAmperage).toBe(200);
    expect(filtered.floorAreaSqft).toBeUndefined();
  });

  test('electrical plan scope detections do not auto-include rough/trim or cleanup', () => {
    const filtered = filterPlanScopesForTrade(
      {
        detections: [
          {
            itemId: 'electrical_rough',
            state: 'included',
            label: 'Electrical rough-in',
          },
          {
            itemId: 'electrical_trim',
            state: 'included',
            label: 'Electrical fixtures',
          },
          { itemId: 'electrical', state: 'included', label: 'Electrical' },
          { itemId: 'cleanup', state: 'included', label: 'Cleanup & disposal' },
          {
            itemId: 'electrical_standard_receptacle',
            state: 'included',
            label: 'Standard receptacle',
          },
        ],
      },
      'selected_trade',
      TRADE_CONFIGS.electrical
    );
    expect(filtered.detections.map(row => row.itemId)).toEqual(['electrical_standard_receptacle']);
  });

  test('labeled homerun counts survive electrical explicit-only sanitize', () => {
    const measurements = sanitizeMeasurements(
      {
        standardCircuitCount: 12,
        conduitLf: 80,
        recessedLightCount: 24,
      },
      [],
      {},
      ['standardCircuitCount', 'conduitLf']
    );
    expect(measurements.standardCircuitCount).toBe(12);
    expect(measurements.conduitLf).toBe(80);
    expect(measurements.recessedLightCount).toBe(24);
  });

  test('electrical plan aliases survive sanitize and fold onto canonical keys', () => {
    expect(MEASUREMENT_KEYS.has('duplexReceptacleCount')).toBe(true);
    expect(MEASUREMENT_KEYS.has('gfciCount')).toBe(true);
    const aliased = sanitizeMeasurements(
      {
        duplexReceptacleCount: 42,
        gfciCount: 6,
        canLightCount: 34,
        serviceAmps: 200,
      },
      [],
      {},
      []
    );
    expect(aliased.duplexReceptacleCount).toBe(42);
    expect(aliased.gfciCount).toBe(6);
    expect(aliased.canLightCount).toBe(34);
    expect(aliased.serviceAmps).toBe(200);
    const { normalizeElectricalPlanMeasurements } = require('../electricalPlanAdapter');
    const folded = sanitizeMeasurements(
      normalizeElectricalPlanMeasurements({
        duplexReceptacleCount: 42,
        gfciCount: 6,
        canLightCount: 34,
        serviceAmps: 200,
      }),
      [],
      {},
      ['serviceAmperage']
    );
    expect(folded.standardReceptacleCount).toBe(42);
    expect(folded.gfciReceptacleCount).toBe(6);
    expect(folded.recessedLightCount).toBe(34);
    expect(folded.serviceAmperage).toBe(200);
    expect(folded.duplexReceptacleCount).toBeUndefined();
  });

  test('unlabeled service amperage does not survive electrical explicit-only sanitize', () => {
    const measurements = sanitizeMeasurements(
      {
        mainPanelCount: 1,
        serviceAmperage: 200,
        standardReceptacleCount: 50,
      },
      [],
      {},
      []
    );
    expect(measurements.mainPanelCount).toBe(1);
    expect(measurements.standardReceptacleCount).toBe(50);
    expect(measurements.serviceAmperage).toBeUndefined();
  });

  test('electrical system prompt requires symbol counting', () => {
    const prompt = buildElectricalSystemPrompt();
    expect(prompt).toMatch(/COUNT visible device/i);
    expect(prompt).toMatch(/standardReceptacleCount/);
    expect(prompt).toMatch(/unclassifiedFixtureCount/);
    expect(prompt).toMatch(/every ceiling-fan symbol/i);
    expect(prompt).toMatch(/electricalSheetEvidence\.sheetSubtotals/);
    expect(prompt).toMatch(/sum of sheet subtotals/i);
    expect(prompt).toMatch(/electricalFieldEvidence/);
    expect(prompt).toMatch(/traceable field evidence reference/i);
    expect(prompt).not.toMatch(/NEVER estimate, round from visual proportions/);
  });

  test('unclassified lighting fixtures become a review field, not a priced count', () => {
    const collected = collectUnclassifiedElectricalFixtures({
      measurements: {
        mainPanelCount: 1,
        unclassifiedFixtureCount: 4,
      },
      pdfTakeoff: { electricalInstanceTags: { unclassifiedFixtureCount: 4 } },
      unreadableFields: [{ field: 'serviceAmperage', reason: 'No printed amperage callout' }],
    });
    expect(collected.measurements.unclassifiedFixtureCount).toBeUndefined();
    expect(collected.measurements.mainPanelCount).toBe(1);
    expect(collected.unreadableFields).toEqual(
      expect.arrayContaining([
        {
          field: 'unclassifiedFixtureCount',
          reason: '4 lighting fixtures without a symbol legend',
        },
      ])
    );
  });

  test('derivePaintingGeometryMeasurements takes exterior paint from painted elevation faces only', () => {
    const derived = derivePaintingGeometryMeasurements(
      { floorAreaSqft: 2400 },
      [],
      {
        elevationFaces: [
          {
            id: 'front',
            widthFt: 40,
            heightFt: 10,
            paintAreaSqft: 320,
            finish: 'siding',
          },
          {
            id: 'rear',
            widthFt: 40,
            heightFt: 10,
            stuccoAreaSqft: 400,
            finish: 'stucco',
          },
        ],
      },
      { buildingAreas: { totalLivingSqft: 2400 } }
    );
    expect(derived.measurements.exteriorPaintSqft).toBe(320);
    expect(derived.measurements.exteriorPaintSqft).not.toBe(2400);
  });

  test('explicit R4 instance tags conflict with vision and stay out of priced measurements', () => {
    const { omitUnresolvedElectricalConflicts } = require('../electricalPlanAdapter');
    const merged = mergeElectricalEvidenceSources({
      generalMeasurements: {
        recessedLightCount: 20,
        ceilingFanCount: 8,
        mainPanelCount: 1,
      },
      generalConfidence: {
        recessedLightCount: 0.8,
        ceilingFanCount: 0.7,
        mainPanelCount: 0.95,
      },
      focusedMeasurements: {
        recessedLightCount: 40,
        ceilingFanCount: 8,
        mainPanelCount: 1,
      },
      focusedConfidence: {
        recessedLightCount: 0.85,
        ceilingFanCount: 0.8,
        mainPanelCount: 0.95,
      },
      instanceTagMeasurements: { recessedLightCount: 48 },
    });
    expect(merged.measurements.recessedLightCount).toBe(48);
    expect(merged.conflicts.some(row => row.field === 'recessedLightCount')).toBe(true);
    const omitted = omitUnresolvedElectricalConflicts(merged.measurements, merged.conflicts);
    expect(omitted.measurements.recessedLightCount).toBeUndefined();
    expect(omitted.measurements.mainPanelCount).toBe(1);
    expect(omitted.measurements.ceilingFanCount).toBe(8);
  });

  test('deriveInsulationMeasurementsFromPlanFacts maps stucco elevation openings', () => {
    const { deriveInsulationMeasurementsFromPlanFacts } = require('../estimatePlanToMeasurements');
    const result = deriveInsulationMeasurementsFromPlanFacts(
      { stuccoWindowDoorOpeningSqft: 289.6 },
      {},
    );
    expect(result.measurements.openingDeductionSqft).toBe(289.6);
    expect(result.derivedKeys).toContain('openingDeductionSqft');
  });

  test('deriveInsulationMeasurementsFromPlanFacts derives net exterior walls from perimeter', () => {
    const { deriveInsulationMeasurementsFromPlanFacts } = require('../estimatePlanToMeasurements');
    const result = deriveInsulationMeasurementsFromPlanFacts(
      { openingDeductionSqft: 289 },
      {
        foundationPerimeterLf: 214,
        wallHeightFt: 9,
        storyCount: 1,
        elevationFaces: [{ id: 'north', windowDoorOpeningsSqft: 289 }],
      },
    );
    expect(result.measurements.exteriorWallInsulationSqft).toBe(1637);
  });

  test('insulation selected-trade filter keeps canonical envelope keys', () => {
    const filtered = filterPlanMeasurementsForTrade(
      {
        openingDeductionSqft: 289.6,
        exteriorWallInsulationSqft: 1637,
        stuccoWindowDoorOpeningSqft: 289.6,
        drywallSqft: 12000,
      },
      'selected_trade',
      TRADE_CONFIGS.insulation,
    );
    expect(filtered.openingDeductionSqft).toBe(289.6);
    expect(filtered.exteriorWallInsulationSqft).toBe(1637);
    expect(filtered.stuccoWindowDoorOpeningSqft).toBeUndefined();
    expect(filtered.drywallSqft).toBeUndefined();
  });
});
