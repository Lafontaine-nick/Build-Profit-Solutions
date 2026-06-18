const { parseScopeMeasurementsFromNotes } = require('../scopeMeasurementParser');
const { evaluateScopeExtractionConfidence } = require('../scopeExtractionConfidence');

function evaluate(notes, ctx = {}) {
  const parsed = parseScopeMeasurementsFromNotes(notes, ctx);
  return evaluateScopeExtractionConfidence(notes, parsed, ctx);
}

describe('scopeExtractionConfidence', () => {
  test('marks clear deterministic extraction high confidence without fallback', () => {
    const result = evaluate(
      'Install LVP flooring 850 sqft material $4.50 per sqft and labor $3.25 per sqft. Baseboard 220 LF at $7 per LF.',
      { templateKey: 'flooring', projectType: 'flooring' }
    );

    expect(result).toMatchObject({
      overallConfidence: 'high',
      scopeConfidence: 'high',
      measurementConfidence: 'high',
      pricingConfidence: 'high',
      requiresAiFallback: false,
      requiresClarification: false,
    });
    expect(result.clarificationQuestions).toHaveLength(0);
  });

  test('triggers fallback on contradictory quantities', () => {
    const result = evaluate('Install LVP 850 sqft, actually maybe 950 sqft total, baseboards 220 LF.', {
      templateKey: 'flooring',
      projectType: 'flooring',
    });

    expect(result.overallConfidence).toBe('low');
    expect(result.requiresAiFallback).toBe(true);
    expect(result.ambiguityFlags).toEqual(expect.arrayContaining(['competing_sqft_values']));
    expect(result.conflictingValues[0]).toMatchObject({ field: 'sqft', values: [850, 950] });
  });

  test('asks a targeted question for ambiguous paint sqft', () => {
    const result = evaluate('Paint the room, about 250 sqft.', {
      templateKey: 'painting',
      projectType: 'painting',
    });

    expect(result.requiresClarification).toBe(true);
    expect(result.ambiguityFlags).toEqual(expect.arrayContaining(['ambiguous_sqft']));
    expect(result.clarificationQuestions.map((q) => q.question)).toContain(
      'Does the sqft refer to floor area or paintable wall and ceiling area?'
    );
  });

  test('does not ask unnecessary clarification questions for explicit paintable area', () => {
    const result = evaluate('Paint walls and ceiling 800 sqft lump sum $2,400.', {
      templateKey: 'painting',
      projectType: 'painting',
    });

    expect(result.requiresClarification).toBe(false);
    expect(result.clarificationQuestions).toHaveLength(0);
  });

  test('flags material-only and labor-only pricing as partial but not inherently unclear', () => {
    const materialOnly = evaluate('Install LVP flooring 500 sqft. Material is $4.25 per sqft, labor not priced yet.', {
      templateKey: 'flooring',
      projectType: 'flooring',
    });
    const laborOnly = evaluate('Install laminate flooring 500 sqft labor $3.50 per sqft. Customer has not picked material yet.', {
      templateKey: 'flooring',
      projectType: 'flooring',
    });

    expect(materialOnly).toMatchObject({ overallConfidence: 'medium', requiresClarification: false });
    expect(materialOnly.ambiguityFlags).toEqual(expect.arrayContaining(['partial_material_labor_pricing']));
    expect(laborOnly).toMatchObject({ overallConfidence: 'medium', requiresClarification: false });
    expect(laborOnly.ambiguityFlags).toEqual(expect.arrayContaining(['partial_material_labor_pricing']));
  });

  test('asks plumbing replacement responsibility questions', () => {
    const result = evaluate('Replace the toilet. Customer supplied toilet.', {
      templateKey: 'bathroom',
      projectType: 'bathroom',
    });

    expect(result.overallConfidence).toBe('low');
    expect(result.requiresAiFallback).toBe(true);
    expect(result.requiresClarification).toBe(true);
    expect(result.ambiguityFlags).toEqual(
      expect.arrayContaining(['customer_supplied_material', 'plumbing_replacement_responsibility_unknown'])
    );
    expect(result.clarificationQuestions.map((q) => q.question)).toContain(
      'Is the toilet staying in the same location, and is the fixture contractor-supplied or customer-supplied?'
    );
  });

  test('flags baseboard LF versus sqft conflict', () => {
    const result = evaluate('Baseboards 200 sqft maybe 200 LF, price $7.', {
      templateKey: 'flooring',
      projectType: 'flooring',
    });

    expect(result.requiresClarification).toBe(true);
    expect(result.ambiguityFlags).toEqual(expect.arrayContaining(['baseboard_unit_conflict']));
  });

  test('routes shorthand mixed-trade dictation to fallback', () => {
    const result = evaluate(
      'kitch reno cabs 20 lf tops 48 sf splash 35 sf lvp 300 sf elec 4 cans plumb sink hook no prices yet',
      { templateKey: 'kitchen', projectType: 'kitchen' }
    );

    expect(result.overallConfidence).toBe('low');
    expect(result.requiresAiFallback).toBe(true);
    expect(result.ambiguityFlags).toEqual(expect.arrayContaining(['shorthand_multi_trade_note']));
  });
});
