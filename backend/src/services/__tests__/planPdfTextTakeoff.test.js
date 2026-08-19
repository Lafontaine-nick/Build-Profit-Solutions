const {
  collapseDoubledGlyphs,
  parseDimensionString,
  normalizeRoomLabel,
  parseScheduleFromText,
  parsePageFactsFromText,
  extractRoomsFromPhrases,
  dedupeRoomsByName,
  formatPdfEvidenceForVision,
  scorePaintingRelevantPage,
  scoreElectricalRelevantPage,
  scorePlumbingRelevantPage,
  expandElectricalRelevantPages,
  expandPlumbingRelevantPages,
  countElectricalInstanceTagsOnPage,
  aggregateElectricalInstanceTagCounts,
  detectElectricalSheetKind,
  detectElectricalPlanLevel,
  extractSheet,
  shouldCollapseDuplicateFixtureViews,
  toUint8Array,
  fillElectricalSheetBackground,
} = require('../planPdfTextTakeoff');
const shvPlanFacts = require('../testFixtures/shvPlanFacts');

describe('planPdfTextTakeoff', () => {
  test('collapseDoubledGlyphs undoes CAD double-draw text', () => {
    expect(collapseDoubledGlyphs('DDIINNIINNGG')).toBe('DINING');
    expect(collapseDoubledGlyphs('KK')).toBe('K');
    expect(collapseDoubledGlyphs('1133')).toBe('13');
    expect(collapseDoubledGlyphs('MAIN FLOOR')).toBe('MAIN FLOOR');
  });

  test('parseDimensionString reads feet-inch L×W', () => {
    expect(parseDimensionString('13\'-1"X14\'-10"')).toEqual({
      lengthFt: 13.083,
      widthFt: 14.833,
      areaSqft: 194.1,
      raw: '13\'-1" x 14\'-10"',
    });
    expect(parseDimensionString('12\'-1" x 42\'-5"')).toMatchObject({
      lengthFt: 12.083,
      widthFt: 42.417,
      areaSqft: 512.5,
    });
  });

  test('normalizeRoomLabel handles concatenated CAD names', () => {
    expect(normalizeRoomLabel('PRIMARYSUITE')).toBe('Primary Suite');
    expect(normalizeRoomLabel('RVGARAGE')).toBe('RV Garage');
    expect(normalizeRoomLabel('DEN/BED4')).toBe('Den/Bed 4');
    expect(normalizeRoomLabel('BED2/OFFICE')).toBe('Bed 2/Office');
    expect(normalizeRoomLabel('GREATROOM')).toBe('Great Room');
  });

  test('parseScheduleFromText reads cover-sheet square footage', () => {
    const text =
      'Sand Hollow Village Lot 41 Square Footage: Main Living Area: 1,879 SqFt Garages: 994 SqFt Covered Patio: 247 SqFt';
    // Cover "Main Living Area" is the total — not promoted to mainFloor (avoids
    // 2-story plans treating cover total as the roof footprint).
    expect(parseScheduleFromText(text)).toEqual({
      totalLivingSqft: 1879,
      garageSqft: 994,
      coveredPatioSqft: 247,
    });
  });

  test('Lot 58 floor Living Area callouts survive CAD junk between label and SF', () => {
    const main = parsePageFactsFromText('PRIMARYSUITE LIVINGAREA N 2047SQFT PANTRY MAIN LEVEL LAYOUT BEDROOM2', {
      page: 3,
    });
    expect(main.buildingAreas.mainFloorLivingSqft).toBe(2047);
    expect(main.buildingAreas.totalLivingSqft).toBeUndefined();
    expect(main.planFacts.storyCount).toBe(1);

    const upper = parsePageFactsFromText('BEDROOM3 LIVINGAREA 6\'-1"X3\'-10" 1613SQFT 2ND LEVEL LAYOUT BEDROOM6', {
      page: 4,
    });
    expect(upper.buildingAreas.upstairsLivingSqft).toBe(1613);
    expect(upper.buildingAreas.mainFloorLivingSqft).toBeUndefined();
  });

  test.each(shvPlanFacts)('extracts labeled facts and evidence for SHV Lot $lot', ({ text, expected }) => {
    const { buildingAreas, planFacts, sourceSheet } = parsePageFactsFromText(text, { page: 2 });
    for (const key of [
      'totalLivingSqft',
      'mainFloorLivingSqft',
      'upstairsLivingSqft',
      'garageSqft',
      'coveredPatioSqft',
    ]) {
      if (expected[key] != null) expect(buildingAreas[key]).toBe(expected[key]);
    }
    expect(planFacts.storyCount).toBe(expected.storyCount);
    expect(planFacts.roofPitch).toBe(expected.roofPitch);
    expect(planFacts.coveredPatioRoofed).toBe(true);
    if (expected.wallHeightFt != null) expect(planFacts.wallHeightFt).toBe(expected.wallHeightFt);
    if (expected.plateHeightFt != null) expect(planFacts.plateHeightFt).toBe(expected.plateHeightFt);
    if (expected.exteriorPerimeterLf != null) {
      expect(planFacts.exteriorPerimeterLf).toBe(expected.exteriorPerimeterLf);
    }
    if (expected.foundationPerimeterLf != null) {
      expect(planFacts.foundationPerimeterLf).toBe(expected.foundationPerimeterLf);
    }
    if (expected.nonPaintedExteriorPercent != null) {
      expect(planFacts.nonPaintedExteriorPercent).toBe(expected.nonPaintedExteriorPercent);
    }
    expect(sourceSheet).toMatch(/^A/);
    expect(planFacts.fieldEvidence.roofPitch.evidence[0]).toMatchObject({
      page: 2,
      sheet: sourceSheet,
      sourceType: 'pdf_text',
    });
  });

  test('parseLabeledHeight and perimeter/finish helpers read elevation notes', () => {
    const {
      parseLabeledHeight,
      parseLabeledPerimeter,
      parseNonPaintedExteriorPercent,
      parsePitch,
      parseOverallEnvelopePerimeter,
      normalizeCadCallouts,
    } = require('../planPdfTextTakeoff');
    expect(parseLabeledHeight('PLATE HEIGHT 10\'-0"', 'plate')?.value).toBe(10);
    expect(parseLabeledHeight('CEILING HEIGHT 9\'-1"', 'wall')?.value).toBeCloseTo(9.083, 3);
    expect(parseLabeledHeight("TOPOFPLATE 10.2'", 'plate')?.value).toBe(10.2);
    expect(parseLabeledHeight("TOP OF PLATE 10.2'", 'plate')?.value).toBe(10.2);
    // Lot 58 elevations label cumulative 20.5' and per-story 10.2' with CAD junk after.
    expect(
      parseLabeledHeight(
        "TOP OF PLATE 20.5' \" 8 1 3 -' 9 TOP OF SUBFLOOR-2NDFLOOR 11.2' TOP OF PLATE \" 10.2' 8 5 0 -' 1",
        'plate'
      )?.value
    ).toBe(10.2);
    expect(parseOverallEnvelopePerimeter("FOUNDATION PLAN 55' 31' 55' 22' 18'")?.value).toBe(172);
    expect(parseLabeledPerimeter('EXTERIOR PERIMETER 214 LF', 'exterior')?.value).toBe(214);
    expect(parseLabeledPerimeter('FOUNDATION PERIMETER 198\'-6"', 'foundation')?.value).toBeCloseTo(198.5, 1);
    expect(parseNonPaintedExteriorPercent('STONE 20% BRICK 10%')?.value).toBe(30);
    expect(parsePitch('ROOF PLAN 5:12 5:12 5:12')?.value).toBe('5:12');
    expect(normalizeCadCallouts("TOPOFPLATE 10.2'")).toContain('TOP OF PLATE');
    expect(
      parseOverallEnvelopePerimeter('FOUNDATION PLAN 70\'-6" 45\'-8" 26\'-8" 13\'-6" 70\'-6" 45\'-8"')?.value
    ).toBe(232.4);
    expect(parseOverallEnvelopePerimeter('FOUNDATION PLAN 70\'-6" 45\'-8" 26\'-8" 13\'-6"')).toBeNull();
    expect(parseOverallEnvelopePerimeter('FOUNDATION PLAN GARAGE 31\'-1"X23\'-4" 70\'-6" 70\'-6"')).toBeNull();
  });

  test('extractRoomsFromPhrases pairs each label with nearest L×W (SHV-like)', () => {
    const phrases = [
      { str: 'DINING', x: 642, y: 1199 },
      { str: '13\'-1"X8\'-7"', x: 634, y: 1188 },
      { str: 'PRIMARYSUITE', x: 1184, y: 1140 },
      { str: '15\'-4"X16\'-7"', x: 1200, y: 1128 },
      { str: 'GREATROOM', x: 876, y: 1087 },
      { str: '14\'-10"X17\'-6"', x: 884, y: 1075 },
      { str: 'CLOSET', x: 1454, y: 1057 },
      { str: '11\'-6"X4\'-9"', x: 1451, y: 1050 },
      { str: 'KITCHEN', x: 594, y: 1044 },
      { str: '13\'-1"X14\'-10"', x: 586, y: 1033 },
      { str: 'LAUNDRY', x: 1426, y: 922 },
      { str: '8\'-0"X5\'-3"', x: 1430, y: 910 },
      { str: 'RVGARAGE', x: 1669, y: 893 },
      { str: '12\'-1"X42\'-5"', x: 1674, y: 881 },
      { str: 'PANTRY', x: 652, y: 822 },
      { str: '9\'-2"X4\'-3"', x: 652, y: 810 },
      { str: 'DEN/BED4', x: 1109, y: 712 },
      { str: '10\'-4"X10\'-8"', x: 1110, y: 700 },
      { str: 'GARAGE', x: 1378, y: 695 },
      { str: '19\'-1"X23\'-3"', x: 1372, y: 684 },
      { str: 'BED3', x: 602, y: 684 },
      { str: '10\'-2"X10\'-6"', x: 588, y: 671 },
      { str: 'BED2/OFFICE', x: 788, y: 546 },
      { str: '10\'-9"X10\'-2"', x: 799, y: 534 },
    ];
    const rooms = extractRoomsFromPhrases(phrases, { sourcePage: 3, sourceSheet: 'A1.1' });
    const byName = Object.fromEntries(rooms.map(r => [r.name, r]));
    expect(byName.Kitchen.areaSqft).toBe(194.1);
    expect(byName.Dining.areaSqft).toBe(112.3);
    expect(byName['Den/Bed 4'].areaSqft).toBe(110.2);
    expect(byName.Garage.areaSqft).toBe(443.7);
    expect(byName['RV Garage'].areaSqft).toBe(512.5);
    expect(byName.Closet.areaSqft).toBe(54.6);
    expect(byName['Great Room'].areaSqft).toBe(259.6);
    expect(byName['Primary Suite'].areaSqft).toBe(254.3);
    expect(byName['Bed 3'].areaSqft).toBe(106.8);
    expect(byName['Bed 2/Office'].areaSqft).toBe(109.3);
    expect(rooms).toHaveLength(12);
    expect(rooms[0]).toMatchObject({ sourcePage: 3, sourceSheet: 'A1.1' });
  });

  test('dedupeRoomsByName keeps higher confidence', () => {
    const rooms = dedupeRoomsByName([
      { name: 'Kitchen', areaSqft: 100, confidence: 0.5 },
      { name: 'Kitchen', areaSqft: 194.1, confidence: 0.98 },
    ]);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].areaSqft).toBe(194.1);
  });

  test('formatPdfEvidenceForVision lists schedule and rooms', () => {
    const text = formatPdfEvidenceForVision({
      buildingAreas: { totalLivingSqft: 1879, garageSqft: 994 },
      rooms: [{ name: 'Kitchen', lengthFt: 13.083, widthFt: 14.833, areaSqft: 194.1 }],
    });
    expect(text).toContain('totalLivingSqft: 1879');
    expect(text).toContain('Kitchen: 13.083');
    expect(text).toContain('do not swap labels');
  });

  test('scorePaintingRelevantPage ranks floor plans and schedules above electrical sheets', () => {
    expect(scorePaintingRelevantPage('A1.1 FLOOR PLAN MAIN LEVEL')).toMatchObject({
      score: expect.any(Number),
      reasons: expect.arrayContaining(['floor plan']),
    });
    expect(scorePaintingRelevantPage('A1.1 FLOOR PLAN MAIN LEVEL').score).toBeGreaterThan(
      scorePaintingRelevantPage('E1.0 ELECTRICAL PLAN').score
    );
    expect(scorePaintingRelevantPage('DOOR SCHEDULE').reasons).toContain('door schedule');
    expect(scorePaintingRelevantPage('REFLECTED CEILING PLAN / RCP').reasons).toEqual(expect.arrayContaining(['RCP']));
    expect(scorePaintingRelevantPage('FRONT ELEVATION').reasons).toContain('exterior elevation');
    expect(scorePaintingRelevantPage('E1.0 ELECTRICAL PLAN').score).toBe(0);
  });

  test('scoreElectricalRelevantPage ranks electrical sheets and panel schedules', () => {
    expect(scoreElectricalRelevantPage('E1.0 ELECTRICAL PLAN MAIN LEVEL')).toMatchObject({
      score: expect.any(Number),
      reasons: expect.arrayContaining(['electrical plan']),
    });
    expect(scoreElectricalRelevantPage('PANEL SCHEDULE 200A')).toMatchObject({
      reasons: expect.arrayContaining(['panel schedule']),
    });
    expect(scoreElectricalRelevantPage('MAIN LEVEL ELECTRICAL PLAN').score).toBeGreaterThan(
      scoreElectricalRelevantPage('A1.1 FLOOR PLAN MAIN LEVEL').score
    );
    expect(scoreElectricalRelevantPage('A1.1 FLOOR PLAN MAIN LEVEL').score).toBe(0);
    expect(scoreElectricalRelevantPage('UPPER FLOOR LIGHTING PLAN').reasons).toContain('lighting / power plan');
  });

  test('toUint8Array copies bytes so pdf.js cannot detach the original buffer', () => {
    const buf = Buffer.from('electrical-plan');
    const copy = toUint8Array(buf);
    expect(copy).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(copy).toString()).toBe('electrical-plan');
    expect(copy.buffer).not.toBe(buf.buffer);
  });

  test('fillElectricalSheetBackground paints white before JPEG encode', () => {
    const fillRect = jest.fn();
    const context = { save: jest.fn(), restore: jest.fn(), fillRect };
    fillElectricalSheetBackground(context, 1200, 800);
    expect(context.save).toHaveBeenCalled();
    expect(context.fillStyle).toBe('#ffffff');
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1200, 800);
    expect(context.restore).toHaveBeenCalled();
  });

  test('expandElectricalRelevantPages includes the following sheet after a strong E-page hit', () => {
    const expanded = expandElectricalRelevantPages([{ page: 12, score: 12, reasons: ['electrical plan'] }], 15);
    expect(expanded.map(page => page.page)).toEqual([12, 13]);
    expect(expanded.find(page => page.page === 13).reasons).toContain('following electrical sheet');
  });

  test('scorePlumbingRelevantPage prioritizes P sheets and fixture schedules', () => {
    expect(scorePlumbingRelevantPage('PLUMBING PLAN P1.1 FIXTURE SCHEDULE MAIN FLOOR')).toMatchObject({
      score: expect.any(Number),
      reasons: expect.arrayContaining(['plumbing plan', 'P sheet', 'fixture schedule']),
    });
    expect(scorePlumbingRelevantPage('MAIN FLOOR PLAN A-3 TOILET LAVATORY')).toMatchObject({
      reasons: expect.arrayContaining(['floor plan (fixture symbols)']),
    });
  });

  test('expandPlumbingRelevantPages includes the following sheet after a strong plumbing hit', () => {
    const expanded = expandPlumbingRelevantPages([{ page: 5, score: 12, reasons: ['plumbing plan'] }], 8);
    expect(expanded.map(page => page.page)).toEqual([5, 6]);
  });

  test('formatPdfEvidenceForVision lists plumbing-relevant pages for Plumbing trade', () => {
    const text = formatPdfEvidenceForVision(
      {
        plumbingRelevantPages: [
          { page: 5, reasons: ['floor plan (fixture symbols)'] },
          { page: 7, reasons: ['P sheet', 'fixture schedule'] },
        ],
      },
      { tradeKey: 'plumbing' }
    );
    expect(text).toMatch(/Plumbing-relevant sheets/i);
    expect(text).toContain('page 5');
    expect(text).toContain('page 7');
    expect(text).toMatch(/P sheets > fixture schedules/i);
  });

  test('formatPdfEvidenceForVision lists electrical-relevant pages for Electrical trade', () => {
    const text = formatPdfEvidenceForVision(
      {
        electricalRelevantPages: [
          { page: 12, reasons: ['electrical plan', 'level electrical'] },
          { page: 13, reasons: ['electrical plan'] },
        ],
        electricalInstanceTags: {
          byKey: {
            recessedLightCount: {
              value: 48,
              tag: 'R4',
              sheets: [
                { sheet: 'A-10', page: 10, count: 33 },
                { sheet: 'A-11', page: 11, count: 15 },
              ],
            },
          },
        },
      },
      { tradeKey: 'electrical' }
    );
    expect(text).toMatch(/Electrical-relevant sheets/i);
    expect(text).toContain('page 12');
    expect(text).toContain('page 13');
    expect(text).toMatch(/Do not invent homeruns/i);
    expect(text).toMatch(/fixture instance tags/i);
    expect(text).toContain('recessedLightCount: 48 from R4 instance tags');
    expect(text).toMatch(/Prefer these instance-tag counts/i);
  });

  test('formatPdfEvidenceForVision lists painting-relevant pages for Painting trade', () => {
    const text = formatPdfEvidenceForVision(
      {
        rooms: [{ name: 'Kitchen', lengthFt: 12, widthFt: 12, areaSqft: 144 }],
        paintingRelevantPages: [
          { page: 3, score: 8, reasons: ['floor plan'] },
          { page: 8, score: 8, reasons: ['exterior elevation'] },
        ],
      },
      { tradeKey: 'painting' }
    );
    expect(text).toContain('not only sheets titled Paint');
    expect(text).toContain('page 3: floor plan');
    expect(text).toContain('page 8: exterior elevation');
  });

  function scatterTags(tag, count, { x0 = 180, y0 = 900, dx = 24, dy = 20 } = {}) {
    return Array.from({ length: count }, (_, i) => ({
      str: tag,
      x: x0 + (i % 11) * dx,
      y: y0 - Math.floor(i / 11) * dy,
    }));
  }

  test('repeated R4 instance tags become the recessedLightCount candidate', () => {
    const main = countElectricalInstanceTagsOnPage(
      [
        { str: 'LIGHTING PLAN MAIN LEVEL A-10', x: 400, y: 1200 },
        { str: 'LIGHTING LEGEND', x: 40, y: 180 },
        { str: 'R4', x: 48, y: 140 },
        { str: '4" LED RECESSED DOWNLIGHT', x: 110, y: 140 },
        ...scatterTags('R4', 33),
      ],
      { page: 10, sheet: 'A-10' }
    );
    const upper = countElectricalInstanceTagsOnPage(
      [{ str: 'LIGHTING PLAN 2ND LEVEL A-11', x: 400, y: 1200 }, ...scatterTags('R4', 15, { x0: 200, y0: 700 })],
      { page: 11, sheet: 'A-11' }
    );
    expect(main.measurements.recessedLightCount).toBe(33);
    expect(upper.measurements.recessedLightCount).toBe(15);
    expect(detectElectricalPlanLevel('LIGHTING PLAN MAIN LEVEL A-10')).toBe('main');
    expect(detectElectricalPlanLevel('LIGHTING PLAN 2ND LEVEL A-11')).toBe('upper');
    expect(detectElectricalSheetKind('LIGHTING PLAN MAIN LEVEL')).toBe('lighting');
    const aggregated = aggregateElectricalInstanceTagCounts([main, upper]);
    expect(aggregated.measurements.recessedLightCount).toBe(48);
    expect(aggregated.byKey.recessedLightCount.tag).toBe('R4');
  });

  test('legend-only R4 text does not inflate recessedLightCount', () => {
    const legendOnly = countElectricalInstanceTagsOnPage([
      { str: 'LIGHTING PLAN MAIN LEVEL', x: 400, y: 1200 },
      { str: 'LIGHTING LEGEND', x: 40, y: 200 },
      { str: 'R4', x: 50, y: 160 },
      { str: '4" LED RECESSED DOWNLIGHT', x: 90, y: 160 },
      { str: 'CF', x: 50, y: 120 },
      { str: 'CEILING FAN', x: 90, y: 120 },
      { str: 'R4 6 INCH WAFER', x: 220, y: 500 },
    ]);
    expect(legendOnly.measurements.recessedLightCount).toBeUndefined();
    expect(legendOnly.measurements.ceilingFanCount).toBeUndefined();
  });

  test('same-level RCP and lighting plan do not double-count R4 tags', () => {
    const lighting = countElectricalInstanceTagsOnPage(
      [{ str: 'LIGHTING PLAN MAIN LEVEL A-10', x: 400, y: 1200 }, ...scatterTags('R4', 20)],
      { page: 10, sheet: 'A-10' }
    );
    const rcp = countElectricalInstanceTagsOnPage(
      [
        { str: 'REFLECTED CEILING PLAN MAIN LEVEL A-10A', x: 400, y: 1200 },
        ...scatterTags('R4', 20, { x0: 160, y0: 820 }),
      ],
      { page: 12, sheet: 'A-10A' }
    );
    expect(lighting.level).toBe('main');
    expect(rcp.kind).toBe('rcp');
    const aggregated = aggregateElectricalInstanceTagCounts([lighting, rcp]);
    expect(aggregated.measurements.recessedLightCount).toBe(20);
  });

  test('repeated CF instance tags become ceilingFanCount when present', () => {
    const page = countElectricalInstanceTagsOnPage(
      [{ str: 'LIGHTING PLAN MAIN LEVEL', x: 400, y: 1200 }, ...scatterTags('CF', 9)],
      { page: 10 }
    );
    expect(page.measurements.ceilingFanCount).toBe(9);
    expect(page.measurements.recessedLightCount).toBeUndefined();
  });

  test('extractSheet prefers the lighting-plan title over an earlier sheet reference', () => {
    expect(extractSheet('SEE A-10 LIGHTING PLAN 2ND LEVEL A-11')).toBe('A-11');
    expect(extractSheet('LIGHTING PLAN MAIN LEVEL A-10')).toBe('A-10');
    expect(extractSheet('R4 R4 MAIN LEVEL ELECTRICAL DRAWINGS A-10')).toBe('A-10');
  });

  test('an R4 glued into a room label counts; door/floor numbers do not', () => {
    const phrases = [
      { str: 'MAIN LEVEL ELECTRICAL DRAWINGS A-10', x: 400, y: 1200 },
      { str: 'LIGHTING LEGEND', x: 40, y: 180 },
      { str: 'R4', x: 48, y: 140 },
      { str: 'LAUNR4DRY', x: 900, y: 1017, xEnd: 954 },
      { str: 'DOOR4', x: 500, y: 400 },
      { str: 'FLOOR4', x: 520, y: 380 },
      ...scatterTags('R4', 32),
    ];
    const page = countElectricalInstanceTagsOnPage(phrases, {
      items: [
        { str: 'R', x: 927, y: 1014 },
        { str: '4', x: 930, y: 1014 },
      ],
    });
    expect(page.measurements.recessedLightCount).toBe(33);
    expect(page.level).toBe('main');
  });

  test('main and upper instance totals are counted separately before they sum', () => {
    const main = countElectricalInstanceTagsOnPage(
      [
        { str: 'MAIN LEVEL ELECTRICAL DRAWINGS A-10', x: 400, y: 1200 },
        { str: 'LIGHTING LEGEND', x: 40, y: 180 },
        { str: 'R4', x: 48, y: 140 },
        { str: 'LAUNR4DRY', x: 900, y: 1017 },
        ...scatterTags('R4', 32),
      ],
      { page: 10, sheet: 'A-10' }
    );
    const upperItems = [
      { str: '2ND LEVEL ELECTRICAL DRAWINGS A-11', x: 400, y: 1200 },
      { str: 'W.I.S.', x: 1460, y: 1002 },
      { str: 'R', x: 1466, y: 1002 },
      { str: '4', x: 1469, y: 1002 },
    ];
    const upperPhrases = [
      { str: '2ND LEVEL ELECTRICAL DRAWINGS A-11', x: 400, y: 1200 },
      ...scatterTags('R4', 14, { x0: 200, y0: 700 }),
      { str: 'W.RI4.S.', x: 1460, y: 1002 },
    ];
    const upper = countElectricalInstanceTagsOnPage(upperPhrases, {
      page: 11,
      sheet: 'A-11',
      items: upperItems,
    });
    expect(main.measurements.recessedLightCount).toBe(33);
    expect(upper.measurements.recessedLightCount).toBe(15);
    expect(main.level).toBe('main');
    expect(upper.level).toBe('upper');
    const aggregated = aggregateElectricalInstanceTagCounts([main, upper]);
    expect(aggregated.measurements.recessedLightCount).toBe(
      main.measurements.recessedLightCount + upper.measurements.recessedLightCount
    );
    expect(aggregated.byKey.recessedLightCount.sheets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheet: 'A-10', count: 33, level: 'main' }),
        expect.objectContaining({ sheet: 'A-11', count: 15, level: 'upper' }),
      ])
    );
  });

  test('lighting plan pages are not skipped because notes mention section', () => {
    const page = countElectricalInstanceTagsOnPage(
      [{ str: 'LIGHTING PLAN 2ND LEVEL A-11 SEE SECTION', x: 400, y: 1200 }, ...scatterTags('R4', 15)],
      { page: 11 }
    );
    expect(page.measurements.recessedLightCount).toBe(15);
  });

  test('stacked R4 text without coordinate spread still counts instances', () => {
    const upper = countElectricalInstanceTagsOnPage(
      [
        { str: 'LIGHTING PLAN 2ND LEVEL A-11', x: 400, y: 1200 },
        ...Array.from({ length: 15 }, () => ({ str: 'R4', x: 10, y: 10 })),
      ],
      { page: 11 }
    );
    expect(upper.measurements.recessedLightCount).toBe(15);
  });

  test('main and upper lighting plans sum even if both extract as the same sheet id', () => {
    const main = countElectricalInstanceTagsOnPage(
      [{ str: 'LIGHTING PLAN MAIN LEVEL A-10', x: 400, y: 1200 }, ...scatterTags('R4', 33)],
      { page: 10, sheet: 'A-10' }
    );
    const upper = countElectricalInstanceTagsOnPage(
      [{ str: 'LIGHTING PLAN 2ND LEVEL A-11', x: 400, y: 1200 }, ...scatterTags('R4', 15, { x0: 200, y0: 700 })],
      { page: 11, sheet: 'A-10' }
    );
    expect(main.level).toBe('main');
    expect(upper.level).toBe('upper');
    expect(shouldCollapseDuplicateFixtureViews(main, upper)).toBe(false);
    const aggregated = aggregateElectricalInstanceTagCounts([main, upper]);
    expect(aggregated.measurements.recessedLightCount).toBe(48);
  });

  test('other lighting tags surface as unclassified fixtures', () => {
    const page = countElectricalInstanceTagsOnPage(
      [
        { str: 'LIGHTING PLAN MAIN LEVEL A-10', x: 400, y: 1200 },
        ...scatterTags('L1', 4, { x0: 80, y0: 400 }),
        ...scatterTags('R4', 8, { x0: 200, y0: 800 }),
      ],
      { page: 10 }
    );
    expect(page.measurements.recessedLightCount).toBe(8);
    expect(page.unclassifiedFixtureCount).toBe(4);
    const aggregated = aggregateElectricalInstanceTagCounts([page]);
    expect(aggregated.unclassifiedFixtureCount).toBe(4);
  });
});
