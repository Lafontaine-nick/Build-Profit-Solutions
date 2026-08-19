const {
  PLUMBING_MEASUREMENT_KEYS,
  applyPlumbingVisionTakeoff,
  normalizePlumbingFieldEvidence,
  normalizePlumbingComplexityFactors,
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

  test('keeps complexity flags review-only and evidence-backed', () => {
    expect(
      normalizePlumbingComplexityFactors([
        {
          key: 'slab_foundation',
          label: 'Slab foundation',
          confidence: 0.9,
          evidence: [{ page: 2, sheet: 'S1.1', label: 'SLAB ON GRADE' }],
        },
        {
          key: 'invented_labor_multiplier',
          label: 'Invented labor multiplier',
        },
      ])
    ).toEqual([
      {
        key: 'slab_foundation',
        label: 'Slab foundation',
        status: 'review',
        confidence: 0.9,
        evidence: [{ page: 2, sheet: 'S1.1', label: 'SLAB ON GRADE' }],
      },
      {
        label: 'Invented labor multiplier',
        status: 'review',
      },
    ]);
  });

  test('derives rough-in and trim from fixture inventory when counts are missing', () => {
    const {
      derivePlumbingCountsFromFixtureInventory,
      normalizePlumbingFixtureInventory,
    } = require('../plumbingPlanAdapter');
    const derived = derivePlumbingCountsFromFixtureInventory({
      inventory: normalizePlumbingFixtureInventory({
        toilets: 3,
        lavatories: 3,
        showers: 2,
        kitchenSinks: 1,
        hoseBibs: 3,
      }),
      measurements: {},
      fieldEvidence: {},
      fieldConfidence: {},
      geometryDerived: [],
    });
    expect(derived.measurements).toEqual({
      plumbingRoughPointCount: 12,
      plumbingTrimHookupCount: 12,
    });
    expect(derived.fieldEvidence.plumbingRoughPointCount[0].derivedFrom).toEqual(
      expect.arrayContaining(['toilets', 'lavatories', 'showers'])
    );
  });

  test('marks architectural LF reads as contractor confirmation-only', () => {
    const { applyPlumbingLineScopeWarnings } = require('../plumbingPlanAdapter');
    const warned = applyPlumbingLineScopeWarnings({
      measurements: { waterLineLf: 50, sewerLineLf: 30 },
      fieldEvidence: {
        waterLineLf: [{ sheet: 'A-3', page: 5, label: 'Water Line' }],
        sewerLineLf: [{ sheet: 'A-3', page: 5, label: 'Sewer Line' }],
      },
      inferredKeys: [],
    });
    expect(warned.inferredKeys).toEqual(expect.arrayContaining(['waterLineLf', 'sewerLineLf']));
    expect(warned.fieldEvidence.waterLineLf[0]).toMatchObject({
      requiresContractorConfirmation: true,
      evidenceKind: 'architectural_line_segment',
    });
  });

  test('builds dynamic plumbing review status for Plan Export', () => {
    const { buildPlumbingReviewStatus } = require('../plumbingPlanAdapter');
    expect(
      buildPlumbingReviewStatus({
        fixtureInventory: { toilets: 3, lavatories: 3, showers: 2 },
        measurements: {
          plumbingRoughPointCount: 8,
          waterLineLf: 50,
        },
        fieldEvidence: {
          waterLineLf: [{ sheet: 'A-3', requiresContractorConfirmation: true }],
        },
        plumbingRelevantPages: [{ page: 3, reasons: ['floor plan (fixture symbols)'] }],
      })
    ).toMatchObject({
      detected: expect.arrayContaining(['8 rough-in points']),
      needsConfirmation: expect.arrayContaining([
        expect.stringMatching(/Water line: 50 LF detected/),
        'Underground sewer / DWV length',
      ]),
      notFound: expect.arrayContaining([
        'Plumbing riser diagram',
        'Dedicated plumbing sheets (P sheets)',
      ]),
    });
  });

  test('reconciles fixtureInventory from fieldEvidence fixtureCounts', () => {
    const { reconcilePlumbingFixtureInventory } = require('../plumbingPlanAdapter');
    expect(
      reconcilePlumbingFixtureInventory({
        inventory: {},
        fieldEvidence: {
          plumbingRoughPointCount: [
            {
              sheet: 'A-1',
              page: 3,
              label: 'Fixture schedule',
              fixtureCounts: {
                toilets: 3,
                lavatories: 3,
                showers: 2,
                tubs: 1,
                kitchenSinks: 1,
              },
            },
          ],
        },
      })
    ).toEqual({
      toilets: 3,
      lavatories: 3,
      showers: 2,
      tubs: 1,
      kitchenSinks: 1,
    });
  });

  test('normalizes water heater detail and gas appliance scope', () => {
    const {
      normalizePlumbingWaterHeaterDetail,
      normalizePlumbingGasApplianceScope,
      finalizePlumbingTakeoff,
    } = require('../plumbingPlanAdapter');
    expect(
      normalizePlumbingWaterHeaterDetail({
        count: 1,
        type: 'tankless',
        fuel: 'gas',
        location: 'Garage',
      })
    ).toMatchObject({
      count: 1,
      type: 'tankless',
      fuel: 'gas',
      location: 'Garage',
    });
    expect(
      normalizePlumbingGasApplianceScope({
        range: true,
        fireplace: true,
        gasPipingRequired: true,
      })
    ).toMatchObject({
      range: true,
      fireplace: true,
      gasPipingRequired: true,
    });
    const finalized = finalizePlumbingTakeoff({
      measurements: { plumbingRoughPointCount: 10, plumbingTrimHookupCount: 10 },
      fieldEvidence: {
        plumbingRoughPointCount: [
          {
            sheet: 'A-1',
            page: 3,
            label: 'Fixture schedule',
            fixtureCounts: { toilets: 3, lavatories: 3, showers: 2, tubs: 1, kitchenSinks: 1 },
          },
        ],
      },
      waterHeaterDetail: { type: 'tankless', fuel: 'gas', location: 'Garage' },
      gasApplianceScope: { range: true, waterHeater: true, gasPipingRequired: true },
      plumbingRelevantPages: [{ page: 3, reasons: ['fixture schedule'] }],
    });
    expect(finalized.fixtureInventory).toMatchObject({
      toilets: 3,
      lavatories: 3,
      showers: 2,
      tubs: 1,
      kitchenSinks: 1,
    });
    expect(finalized.waterHeaterDetail).toMatchObject({ type: 'tankless', fuel: 'gas' });
    expect(finalized.gasApplianceScope).toMatchObject({ range: true, gasPipingRequired: true });
    expect(finalized.plumbingReviewStatus.detected).toEqual(
      expect.arrayContaining([expect.stringMatching(/water heater/i), expect.stringMatching(/Gas appliances/i)])
    );
  });
});
