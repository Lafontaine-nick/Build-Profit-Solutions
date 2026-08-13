import {
  hydratePaintingPlanMeasurements,
  resolvePaintingPlanTakeoffApiSelection,
} from '@/utils/hydratePaintingPlanMeasurements';

describe('hydratePaintingPlanMeasurements', () => {
  it('fills Lot 58 ceilings from labeled living area when the backend returns 0 painting keys', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      rooms: [],
      buildingAreas: {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
        garageSqft: 781,
        coveredPatioSqft: 297,
      },
    });
    expect(hydrated.measurements.ceilingPaintSqft).toBe(3660);
    expect(hydrated.measurements.wallPaintSqft).toBeUndefined();
    expect(hydrated.measurements.cabinetRunLf).toBeUndefined();
    expect(hydrated.measurements.garageSqft).toBeUndefined();
    expect(hydrated.measurementProvenance?.ceilingPaintSqft).toMatchObject({
      source: 'measured_from_geometry',
    });
  });

  it('uses schedule living SF from measurements when buildingAreas were stripped', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: { floorAreaSqft: 3660, garageSqft: 781 },
    });
    expect(hydrated.measurements.ceilingPaintSqft).toBe(3660);
    expect(hydrated.measurements.floorAreaSqft).toBeUndefined();
    expect(hydrated.measurements.garageSqft).toBeUndefined();
  });

  it('does not invent walls from living SF', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: { floorAreaSqft: 3660 },
      buildingAreas: { totalLivingSqft: 3660 },
      planFacts: { wallHeightFt: 10.2 },
    });
    expect(hydrated.measurements.ceilingPaintSqft).toBe(3660);
    expect(hydrated.measurements.wallPaintSqft).toBeUndefined();
  });

  it('uses labeled living SF when detected rooms do not cover the house', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      buildingAreas: { totalLivingSqft: 3660 },
      rooms: [
        {
          name: 'Great Room',
          lengthFt: 16,
          widthFt: 14,
          areaSqft: 224,
          confidence: 0.9,
        },
        {
          name: 'Kitchen',
          lengthFt: 12,
          widthFt: 12,
          areaSqft: 144,
          confidence: 0.9,
        },
      ],
    });
    expect(hydrated.measurements.ceilingPaintSqft).toBe(3660);
  });

  it('replaces an incomplete room-sum ceiling and flags partial walls/trim', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: { ceilingPaintSqft: 1345.2, wallPaintSqft: 4918.2, baseboardLf: 482.2 },
      buildingAreas: {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
      },
      planFacts: { wallHeightFt: 10.2 },
      rooms: [
        { name: 'Great Room', lengthFt: 16, widthFt: 14, confidence: 0.9 },
        { name: 'Kitchen', lengthFt: 12, widthFt: 12, confidence: 0.9 },
      ],
    });
    expect(hydrated.measurements.ceilingPaintSqft).toBe(3660);
    expect(hydrated.measurements.wallPaintSqft).toBe(4918.2);
    expect(hydrated.measurements.baseboardLf).toBe(482.2);
    expect(hydrated.measurementProvenance?.wallPaintSqft).toMatchObject({
      coverage: 'incomplete',
    });
    expect(hydrated.measurementProvenance?.baseboardLf).toMatchObject({
      coverage: 'incomplete',
    });
  });

  it('keeps room ceilings when they cover living area', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      buildingAreas: { totalLivingSqft: 400 },
      rooms: [
        { name: 'Great Room', lengthFt: 16, widthFt: 14, areaSqft: 224, confidence: 0.9 },
        { name: 'Kitchen', lengthFt: 12, widthFt: 12, areaSqft: 144, confidence: 0.9 },
      ],
    });
    expect(hydrated.measurements.ceilingPaintSqft).toBe(368);
  });

  it('fills walls and baseboard from dimensioned rooms × explicit height', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      planFacts: { wallHeightFt: 9 },
      rooms: [
        { name: 'Great Room', lengthFt: 16, widthFt: 14, confidence: 0.9 },
        { name: 'Kitchen', lengthFt: 12, widthFt: 12, confidence: 0.9 },
      ],
    });
    expect(hydrated.measurements.wallPaintSqft).toBe(972);
    expect(hydrated.measurements.baseboardLf).toBe(108);
    expect(hydrated.measurements.ceilingPaintSqft).toBe(368);
  });

  it('recovers rooms from notes and interiorRooms when the payload stripped them', () => {
    const fromNotes = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      rooms: [],
      notesBlock: [
        "CEILING HEIGHT 9'-0\"",
        'Room measurements:',
        '- Great Room: 16×14 ft (224 sqft)',
        '- Kitchen: 12×12 ft',
        'Interior door count 11 EA from identifiable interior door symbols.',
      ].join('\n'),
    });
    expect(fromNotes.measurements.wallPaintSqft).toBe(972);
    expect(fromNotes.measurements.baseboardLf).toBe(108);
    expect(fromNotes.measurements.interiorDoorCount).toBe(11);

    const fromFacts = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      rooms: [],
      planFacts: {
        wallHeightFt: 9,
        interiorRooms: [
          { name: 'Great Room', lengthFt: 16, widthFt: 14, confidence: 0.9 },
          { name: 'Kitchen', lengthFt: 12, widthFt: 12, confidence: 0.9 },
        ],
      },
    });
    expect(fromFacts.measurements.wallPaintSqft).toBe(972);
    expect(fromFacts.measurements.baseboardLf).toBe(108);
  });

  it('merges area-only rooms with note L×W so walls can calculate', () => {
    const hydrated = hydratePaintingPlanMeasurements({
      estimatingMode: 'selected_trade',
      selectedTrade: 'painting',
      measurements: {},
      planFacts: { wallHeightFt: 9 },
      rooms: [
        { name: 'Great Room', areaSqft: 224, confidence: 0.9 },
        { name: 'Kitchen', areaSqft: 144, confidence: 0.9 },
      ],
      notesBlock: [
        'Room measurements:',
        "- Great Room: 16'-0\" x 14'-0\"",
        '- Kitchen: 12×12 ft',
      ].join('\n'),
    });
    expect(hydrated.measurements.wallPaintSqft).toBe(972);
    expect(hydrated.measurements.baseboardLf).toBe(108);
  });
});

describe('resolvePaintingPlanTakeoffApiSelection', () => {
  it('asks the hosted API for whole-project rooms when Painting is selected', () => {
    expect(
      resolvePaintingPlanTakeoffApiSelection({
        estimatingMode: 'selected_trade',
        selectedTradeKey: 'painting',
      })
    ).toEqual({
      estimatingMode: 'whole_project',
      selectedTradeKey: null,
    });
  });

  it('leaves other trades on selected-trade', () => {
    expect(
      resolvePaintingPlanTakeoffApiSelection({
        estimatingMode: 'selected_trade',
        selectedTradeKey: 'flooring',
      })
    ).toEqual({
      estimatingMode: 'selected_trade',
      selectedTradeKey: 'flooring',
    });
  });
});
