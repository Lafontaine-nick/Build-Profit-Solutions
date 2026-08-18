const {
  PLUMBING_MEASUREMENT_KEYS,
  applyPlumbingVisionTakeoff,
  normalizePlumbingPlanMeasurements,
} = require('../plumbingPlanAdapter');

describe('plumbingPlanAdapter', () => {
  test('folds aliases to canonical keys and excludes living area', () => {
    expect(
      normalizePlumbingPlanMeasurements({
        roughInPoints: 4,
        waterLineFeet: 36,
        floorAreaSqft: 2400,
      })
    ).toEqual({
      plumbingRoughPointCount: 4,
      waterLineLf: 36,
    });
  });

  test('normalizes focused vision output and drops unsupported aliases', () => {
    const payload = applyPlumbingVisionTakeoff({
      measurements: {
        fixtureReplacements: 3,
        waterLineFeet: 40,
        roomCount: 12,
      },
      explicitlyLabeled: ['fixtureReplacements', 'roomCount'],
      inferredKeys: ['waterLineFeet'],
      fieldConfidence: {
        fixtureReplacements: 0.9,
        roomCount: 0.8,
      },
    });
    expect(payload.measurements).toEqual({ fixtureReplacementCount: 3 });
    expect(payload.explicitlyLabeled).toEqual(['fixtureReplacementCount']);
    expect(payload.inferredKeys).toEqual(['waterLineLf']);
    expect(Object.keys(payload.fieldConfidence)).toEqual([
      'fixtureReplacementCount',
    ]);
    expect(PLUMBING_MEASUREMENT_KEYS).toContain('sewerLineLf');
  });
});
