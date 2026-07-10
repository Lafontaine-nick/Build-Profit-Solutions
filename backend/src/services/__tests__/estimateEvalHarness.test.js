/**
 * Scoped estimate eval harness — scores the golden notes corpus.
 *
 * Metrics (0–100):
 *   measurementRecall  — share of expected measurement keys that match
 *   pricingRecall      — share of expected pricing components that match
 *   confidenceMatch    — share of fixtures whose confidence band matches
 *   overall            — average of the three
 *
 * Fail the suite if overall drops below EVAL_MIN_OVERALL (default 70).
 * Run: npm run test:eval
 */

const { parseScopeMeasurementsFromNotes } = require('../scopeMeasurementParser');
const { evaluateScopeExtractionConfidence } = require('../scopeExtractionConfidence');

/** Keep in sync with scopeGoldenNotesCorpus.test.js fixture set (subset scored here). */
const EVAL_FIXTURES = [
  {
    id: 'flooring_voice_rates_and_lf',
    notes:
      'Flooring job demo existing tile which is 850 ft.2 labor is $3 dollars a square foot for tile demo next install LVP flooring which is 850 ft.? material is $4.50 a square foot and $3.25 a square foot for Labor. Also we have baseboard installation 220 linear feet with lump sum of $7 dollars per linear foot.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedMeasurements: { floorAreaSqft: 850, baseboardLf: 220 },
    expectedPricingComponents: {
      floor_demo: { quantity: 2550, unit: 'allowance' },
      flooring__material: { quantity: 3825, unit: 'allowance' },
      flooring__labor: { quantity: 2762.5, unit: 'allowance' },
      trim: { quantity: 1540, unit: 'allowance' },
    },
    expectedConfidence: 'high',
  },
  {
    id: 'kitchen_mixed_units_and_rates',
    notes:
      'Kitchen remodel: install 24 LF cabinets lump sum $12,000, quartz counters 55 sqft allowance $4,400, backsplash 42 sqft material $8 per sqft and labor $14 per sqft. New LVP flooring 350 sqft material $4.25 per sqft and labor $3.75 per sqft. Baseboard 48 LF at $7 per LF.',
    ctx: { templateKey: 'kitchen', projectType: 'kitchen' },
    expectedMeasurements: {
      cabinetLf: 24,
      countertopSqft: 55,
      backsplashSqft: 42,
      kitchenFloorSqft: 350,
      baseboardLf: 48,
    },
    expectedPricingComponents: {
      cabinets: { quantity: 12000, unit: 'allowance' },
      countertops: { quantity: 4400, unit: 'allowance' },
      backsplash__material: { quantity: 336, unit: 'allowance' },
      flooring: { quantity: 2800, unit: 'allowance' },
      trim: { quantity: 336, unit: 'allowance' },
    },
    expectedConfidence: 'high',
  },
  {
    id: 'flooring_material_only',
    notes: 'Install LVP flooring 500 sqft. Material is $4.25 per sqft, labor not priced yet.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedMeasurements: { floorAreaSqft: 500 },
    expectedPricingComponents: {
      flooring__material: { quantity: 2125, unit: 'allowance' },
    },
    expectedConfidence: 'medium',
  },
  {
    id: 'single_scope_lump_sum_paint',
    notes: 'Paint walls and ceiling 800 sqft lump sum $2,400.',
    ctx: { templateKey: 'painting', projectType: 'painting' },
    expectedMeasurements: { wallPaintSqft: 800 },
    expectedPricingComponents: { paint: { quantity: 2400, unit: 'allowance' } },
    expectedConfidence: 'high',
  },
  {
    id: 'roofing_tearoff_decking',
    notes: 'Roof tear off 28 squares $5,600. Replace bad decking as needed, not priced.',
    ctx: { templateKey: 'roofing', projectType: 'roofing' },
    expectedMeasurements: { roofSquares: 28 },
    expectedPricingComponents: { tear_off: { quantity: 5600, unit: 'allowance' } },
    expectedConfidence: 'medium',
  },
  {
    id: 'prices_written_as_words',
    notes: 'Install backsplash 40 sqft material eight dollars per sqft labor fourteen dollars per sqft.',
    ctx: { templateKey: 'kitchen', projectType: 'kitchen' },
    expectedMeasurements: { backsplashSqft: 40 },
    expectedPricingComponents: {
      backsplash__material: { quantity: 320, unit: 'allowance' },
      backsplash__labor: { quantity: 560, unit: 'allowance' },
    },
    expectedConfidence: 'high',
  },
  {
    id: 'ambiguous_paint_sqft',
    notes: 'Paint the room, about 250 sqft.',
    ctx: { templateKey: 'painting', projectType: 'painting' },
    expectedMeasurements: {},
    expectedPricingComponents: {},
    expectedConfidence: 'medium',
    expectClarification: true,
  },
  {
    id: 'conflicting_quantities',
    notes: 'Install LVP 850 sqft, actually maybe 950 sqft total, use same for baseboards 220 LF.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedMeasurements: { baseboardLf: 220 },
    expectedPricingComponents: {},
    expectedConfidence: 'low',
  },
];

const EVAL_MIN_OVERALL = Number(process.env.EVAL_MIN_OVERALL || 70);

function scoreFixture(fixture) {
  const parsed = parseScopeMeasurementsFromNotes(fixture.notes, fixture.ctx);
  const confidence = evaluateScopeExtractionConfidence(fixture.notes, parsed, fixture.ctx);

  const measKeys = Object.keys(fixture.expectedMeasurements || {});
  let measHits = 0;
  for (const key of measKeys) {
    if (parsed[key] === fixture.expectedMeasurements[key]) measHits += 1;
  }
  const measurementRecall = measKeys.length ? (measHits / measKeys.length) * 100 : 100;

  const priceKeys = Object.keys(fixture.expectedPricingComponents || {});
  let priceHits = 0;
  for (const key of priceKeys) {
    const expected = fixture.expectedPricingComponents[key];
    const actual = parsed.itemQuantities?.[key];
    if (
      actual &&
      Number(actual.quantity) === Number(expected.quantity) &&
      String(actual.unit) === String(expected.unit)
    ) {
      priceHits += 1;
    }
  }
  const pricingRecall = priceKeys.length ? (priceHits / priceKeys.length) * 100 : 100;

  const confidenceMatch =
    confidence.overallConfidence === fixture.expectedConfidence
      ? 100
      : fixture.expectClarification && confidence.requiresClarification
        ? 80
        : 0;

  const overall = (measurementRecall + pricingRecall + confidenceMatch) / 3;

  return {
    id: fixture.id,
    measurementRecall: Math.round(measurementRecall * 10) / 10,
    pricingRecall: Math.round(pricingRecall * 10) / 10,
    confidenceMatch,
    overall: Math.round(overall * 10) / 10,
    clarificationAsked: Boolean(confidence.requiresClarification),
  };
}

function runEvalSuite(fixtures = EVAL_FIXTURES) {
  const results = fixtures.map(scoreFixture);
  const avg = (key) =>
    results.length === 0
      ? 0
      : Math.round((results.reduce((s, r) => s + r[key], 0) / results.length) * 10) / 10;

  return {
    version: '1.0.0',
    fixtureCount: results.length,
    measurementRecall: avg('measurementRecall'),
    pricingRecall: avg('pricingRecall'),
    confidenceMatch: avg('confidenceMatch'),
    overall: avg('overall'),
    minOverallGate: EVAL_MIN_OVERALL,
    results,
  };
}

describe('estimate eval harness', () => {
  test('scores golden fixtures and meets overall gate', () => {
    const report = runEvalSuite();

    // eslint-disable-next-line no-console
    console.log(
      `\n[eval] overall=${report.overall} measurement=${report.measurementRecall} pricing=${report.pricingRecall} confidence=${report.confidenceMatch} (gate≥${report.minOverallGate})\n`
    );
    for (const row of report.results) {
      // eslint-disable-next-line no-console
      console.log(
        `  ${row.id}: overall=${row.overall} meas=${row.measurementRecall} price=${row.pricingRecall} conf=${row.confidenceMatch}`
      );
    }

    expect(report.fixtureCount).toBeGreaterThanOrEqual(6);
    expect(report.measurementRecall).toBeGreaterThanOrEqual(60);
    expect(report.pricingRecall).toBeGreaterThanOrEqual(60);
    expect(report.overall).toBeGreaterThanOrEqual(report.minOverallGate);
  });

  test('exports runEvalSuite for scripts', () => {
    expect(typeof runEvalSuite).toBe('function');
    const report = runEvalSuite(EVAL_FIXTURES.slice(0, 2));
    expect(report.results).toHaveLength(2);
  });
});

module.exports = { runEvalSuite, scoreFixture, EVAL_FIXTURES, EVAL_MIN_OVERALL };
