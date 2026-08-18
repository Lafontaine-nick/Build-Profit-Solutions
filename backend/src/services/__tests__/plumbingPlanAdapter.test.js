const {
  PLUMBING_MEASUREMENT_KEYS,
  applyPlumbingVisionTakeoff,
  normalizePlumbingFieldEvidence,
  normalizePlumbingPlanMeasurements,
  normalizePlumbingUtilityConnections,
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
    expect(Object.keys(payload.fieldConfidence)).toEqual(['fixtureReplacementCount']);
    expect(PLUMBING_MEASUREMENT_KEYS).toContain('sewerLineLf');
  });

  test('normalizes gas piping and preserves sheet evidence for derived counts', () => {
    const payload = applyPlumbingVisionTakeoff({
      measurements: {
        gasLineFeet: 42,
        roughInPoints: 8,
      },
      explicitlyLabeled: ['gasLineFeet'],
      geometryDerived: ['roughInPoints'],
      fieldEvidence: {
        gasLineFeet: [
          {
            page: 7,
            sheet: 'P2.1',
            label: 'Gas piping',
            sourceText: '42 LF gas service',
            sourceType: 'plan_vision',
            confidence: 0.94,
          },
        ],
        roughInPoints: [
          {
            page: 6,
            sheet: 'P1.1',
            label: 'Fixture schedule',
            evidenceKind: 'fixture_inventory_derived',
            derivedFrom: ['toilets', 'lavatories'],
            confidence: 0.82,
          },
        ],
      },
    });

    expect(payload.measurements).toEqual({
      gasLineLf: 42,
      plumbingRoughPointCount: 8,
    });
    expect(payload.fieldEvidence.gasLineLf[0]).toMatchObject({
      page: 7,
      sheet: 'P2.1',
      sourceText: '42 LF gas service',
    });
    expect(payload.fieldEvidence.plumbingRoughPointCount[0]).toMatchObject({
      evidenceKind: 'fixture_inventory_derived',
      derivedFrom: ['toilets', 'lavatories'],
    });
    expect(
      normalizePlumbingFieldEvidence({
        gasLineFeet: payload.fieldEvidence.gasLineLf,
      })
    ).toHaveProperty('gasLineLf');
  });

  test('keeps utility tie-ins as scope-only confirmations', () => {
    expect(
      normalizePlumbingUtilityConnections([
        {
          label: 'Municipal sewer tap',
          status: 'confirmed',
          evidence: [{ page: 3, sheet: 'P0.1', label: 'UTILITY NOTE' }],
        },
      ])
    ).toEqual([
      {
        label: 'Municipal sewer tap',
        status: 'confirmed',
        evidence: [{ page: 3, sheet: 'P0.1', label: 'UTILITY NOTE' }],
      },
    ]);
  });
});
