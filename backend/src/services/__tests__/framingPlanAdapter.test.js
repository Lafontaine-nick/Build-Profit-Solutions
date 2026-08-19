const {
  finalizeFramingTakeoff,
  resolveCoveredFramedAreaSqft,
  deriveFramingScope,
} = require('../framingPlanAdapter');

describe('framingPlanAdapter', () => {
  it('derives covered framed SF from living plus garage', () => {
    expect(
      resolveCoveredFramedAreaSqft({ floorAreaSqft: 2000, garageSqft: 400 })
    ).toBe(2400);
  });

  it('builds framing scope cards from normalized measurements', () => {
    expect(
      deriveFramingScope({
        framedAreaSqft: 2400,
        sheathingSqft: 3200,
      })
    ).toEqual(['framing', 'shear_sheathing']);
  });

  it('finalizes plan takeoff with derived framed area and scope', () => {
    const finalized = finalizeFramingTakeoff({
      measurements: {
        floorAreaSqft: 2000,
        garageSqft: 400,
        stuccoGrossWallSqft: 3100,
      },
      fieldEvidence: {},
      fieldConfidence: {},
      inferredKeys: [],
    });

    expect(finalized.measurements.framedAreaSqft).toBe(2400);
    expect(finalized.measurements.sheathingSqft).toBe(3100);
    expect(finalized.framingScope).toEqual(['framing', 'shear_sheathing']);
    expect(finalized.derivedKeys).toEqual(
      expect.arrayContaining(['framedAreaSqft', 'sheathingSqft'])
    );
  });

  it('does not add wall LF or openings to shell framing scope', () => {
    const finalized = finalizeFramingTakeoff({
      measurements: {
        floorAreaSqft: 3660,
        garageSqft: 781,
        sheathingSqft: 2530,
        wallFramingLf: 750,
        framingOpeningCount: 75,
      },
      fieldEvidence: {},
      fieldConfidence: {},
      inferredKeys: [],
    });

    expect(finalized.framingScope).toEqual(['framing', 'shear_sheathing']);
    expect(finalized.measurements.wallFramingLf).toBeUndefined();
    expect(finalized.measurements.framingOpeningCount).toBeUndefined();
  });
});
