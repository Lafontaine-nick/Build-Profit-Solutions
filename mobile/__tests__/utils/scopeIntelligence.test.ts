import {
  buildCardIntelligenceDisplay,
  cardConfidenceForIntelligence,
  classifyMeasurementRelationship,
  detectActualDuplicatePricingConflicts,
  getScopeUnitDefinition,
  primaryIntelligenceNotice,
  pricingConfidenceForSuggestedBlock,
  resolveScopeItemIntelligence,
} from '@/utils/scopeIntelligence';
import {
  calculateFormulaForScope,
  executeFormula,
  getAssumptionsForScope,
  getFormulaDefinitionsForScope,
} from '@/utils/scopeFormulaRegistry';
import {
  evaluateAssemblyForScope,
  evaluateProjectScopeGaps,
  getAssemblyDefinitionsForScope,
  getOverlapDefinitions,
  getProjectScopeTemplates,
} from '@/utils/scopeAssemblyRegistry';
import {
  classifyRateType,
  evaluateMinimumCharge,
  evaluatePricingCompleteness,
  evaluateQuantityScale,
  evaluateRateAge,
  evaluateRegionalRelevance,
  evaluateMarkupRisk,
  summarizeEstimatePricingReview,
  type RateMetadata,
} from '@/utils/scopePricingIntelligence';
import type {
  NormalizedScopeMeasurements,
  ResolvedItemQuantity,
  SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';

function emptyMeasurements(overrides: Partial<NormalizedScopeMeasurements> = {}): NormalizedScopeMeasurements {
  return {
    bathroomFloorSqft: null,
    kitchenFloorSqft: null,
    floorAreaSqft: null,
    flooringSqft: null,
    backsplashSqft: null,
    countertopSqft: null,
    cabinetLf: null,
    landscapeSqft: null,
    sodSqft: null,
    paverSqft: null,
    rockMulchSqft: null,
    landscapeTons: null,
    roofSquares: null,
    drywallSqft: null,
    concreteSqft: null,
    concreteCy: null,
    excavationCy: null,
    deckSqft: null,
    exteriorPaintSqft: null,
    railingLf: null,
    baseboardLf: null,
    showerWallTileSqft: null,
    showerFloorTileSqft: null,
    wallPaintSqft: null,
    itemQuantities: {},
    ...overrides,
  };
}

function resolved(overrides: Partial<ResolvedItemQuantity>): ResolvedItemQuantity {
  return {
    quantity: 1,
    unit: 'each',
    quantitySource: 'missing',
    sourceLabel: '',
    pricingReady: true,
    showInput: true,
    ...overrides,
  };
}

function suggested(overrides: Partial<SuggestedPricingBlock> = {}): SuggestedPricingBlock {
  return {
    material: 100,
    labor: 200,
    total: 300,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: 'Suggested · National Average',
    helper: 'Based on quantity',
    mode: 'suggested_price',
    basis: { quantity: 10, unit: 'sqft' },
    ...overrides,
  };
}

describe('scopeIntelligence', () => {
  it('keeps explicit note quantities labeled as parsed from notes with high confidence', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'excavation',
      templateKey: 'addition',
      notes: 'Excavate 50 CY for footings.',
      measurements: emptyMeasurements({ excavationCy: 50 }),
      resolved: resolved({
        quantity: 50,
        unit: 'cy',
        quantitySource: 'notes',
        sourceLabel: 'Parsed from notes',
      }),
    });

    expect(intelligence.quantity).toMatchObject({
      source: 'from_notes',
      sourceLabel: 'Parsed from notes',
      confidence: 'high',
    });
  });

  it('does not call an inferred working quantity parsed from notes', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'excavation',
      templateKey: 'addition',
      notes: 'Excavation for a 600 sqft ADU.',
      measurements: emptyMeasurements({ floorAreaSqft: 600 }),
      resolved: resolved({
        quantity: 50,
        unit: 'cy',
        quantitySource: 'inferred',
        sourceLabel: 'Calculated',
      }),
    });

    expect(intelligence.quantity.source).toBe('calculated_assumption');
    expect(intelligence.quantity.sourceLabel).toBe('Calculated');
    expect(intelligence.quantity.confidence).toBe('medium');
  });

  it('flags incompatible units without blocking pricing flow', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'appliances',
      templateKey: 'addition',
      measurements: emptyMeasurements(),
      resolved: resolved({
        quantity: 600,
        unit: 'sqft',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
      }),
    });

    expect(intelligence.validation.status).toBe('review_required');
    expect(intelligence.validation.issues[0]).toMatchObject({
      ruleKey: 'unit_not_approved_for_scope',
      pricingMayContinue: true,
    });
  });

  it('uses the existing unit registry rules for trade-specific measurement bases', () => {
    expect(getScopeUnitDefinition('utility_trenching', 'addition')).toMatchObject({
      preferredUnits: ['lf'],
      alternateUnits: expect.arrayContaining(['cy', 'allowance', 'lump_sum']),
    });
    expect(getScopeUnitDefinition('cabinets')).toMatchObject({
      preferredUnits: ['lf'],
      alternateUnits: expect.arrayContaining(['each', 'allowance', 'lump_sum']),
    });
  });

  it('returns safe fallback behavior for unregistered scopes', () => {
    const definition = getScopeUnitDefinition('custom_specialty_scope');
    expect(definition).toMatchObject({
      trade: 'unknown',
      allowManualOverride: true,
      allowLumpSum: true,
      allowAllowance: true,
      incompatibleUnitSeverity: 'review',
    });
    expect(definition.preferredUnits).toContain('allowance');
  });

  it('classifies direct measurement relationships across trades', () => {
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'flooring',
        measurementType: 'flooring_area',
      })
    ).toBe('direct');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'utility_trenching',
        templateKey: 'addition',
        measurementType: 'trench_length',
      })
    ).toBe('direct');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'windows_doors',
        templateKey: 'addition',
        measurementType: 'fixture_count',
      })
    ).toBe('direct');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'shingles_roofing',
        measurementType: 'roof_area',
      })
    ).toBe('direct');
  });

  it('classifies derived measurement relationships without calculating formulas', () => {
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'drywall',
        templateKey: 'addition',
        measurementType: 'building_floor_area',
      })
    ).toBe('derived');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'shingles_roofing',
        measurementType: 'building_floor_area',
      })
    ).toBe('derived');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'concrete',
        templateKey: 'addition',
        measurementType: 'slab_area',
      })
    ).toBe('derived');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'utility_trenching',
        templateKey: 'addition',
        measurementType: 'trench_width',
      })
    ).toBe('derived');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'baseboard',
        measurementType: 'room_floor_area',
      })
    ).toBe('derived');
  });

  it('classifies incompatible measurement relationships across unit families', () => {
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'utility_trenching',
        templateKey: 'addition',
        measurementType: 'building_floor_area',
      })
    ).toBe('incompatible');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'toilet',
        measurementType: 'flooring_area',
      })
    ).toBe('incompatible');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'baseboard',
        measurementType: 'concrete_volume',
      })
    ).toBe('incompatible');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'drywall',
        measurementType: 'fixture_count',
      })
    ).toBe('incompatible');
    expect(
      classifyMeasurementRelationship({
        scopeKey: 'flooring',
        measurementType: 'roof_area',
      })
    ).toBe('unknown');
  });

  it('returns missing-measurement recommendations and keeps the user moving', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'cabinets',
      templateKey: 'kitchen',
      measurements: emptyMeasurements(),
      resolved: resolved({
        quantity: null,
        unit: 'lf',
        quantitySource: 'missing',
        sourceLabel: 'Measurement needed',
        pricingReady: false,
      }),
    });

    expect(intelligence.validation.status).toBe('measurement_needed');
    expect(intelligence.canContinue).toBe(true);
    expect(intelligence.missingMeasurements.map((m) => m.type)).toContain('cabinet_length');
    expect(primaryIntelligenceNotice(intelligence)).toContain('cabinet LF');
  });

  it('shows an approved formula comparison without changing an existing quantity', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'drywall',
      templateKey: 'addition',
      measurements: emptyMeasurements({ floorAreaSqft: 600 }),
      resolved: resolved({
        quantity: 600,
        unit: 'sqft',
        quantitySource: 'inferred',
        sourceLabel: 'Calculated',
      }),
    });

    expect(intelligence.measurementRelationship.type).toBe('derived');
    expect(intelligence.measurementRelationship.formulaKey).toBe('building_floor_area_to_wall_surface_area');
    expect(intelligence.validationNotices.some((n) => n.ruleKey === 'derived_measurement_requires_formula')).toBe(false);
    expect(intelligence.formula).toMatchObject({
      formulaKey: 'surface_area_from_floor_area_benchmark',
      roundedValue: 2100,
      unit: 'sqft',
      confidence: 'low',
    });
    expect(intelligence.formulaComparison).toMatchObject({
      currentValue: 600,
      calculatedValue: 2100,
    });
    expect(primaryIntelligenceNotice(intelligence)).toContain('Calculated comparison');
    expect(intelligence.quantity.value).toBe(600);
  });

  it('separates pricing confidence from quantity confidence', () => {
    expect(pricingConfidenceForSuggestedBlock(suggested()).confidence).toBe('low');
    expect(
      pricingConfidenceForSuggestedBlock(
        suggested({
          materialSource: 'template',
          laborSource: 'template',
          rateSourceLabel: 'Suggested · Saved rate',
        })
      ).confidence
    ).toBe('medium');
  });

  it('keeps confidence low when benchmark inclusion profile is undefined', () => {
    const confidence = pricingConfidenceForSuggestedBlock(
      suggested({
        benchmarkScopeProfile: {
          sourceRecordId: 'national_average:excavation:cy',
          pricingSource: 'national_average',
          scopeAssumptionsDefined: false,
          scopeAssumptions: [],
        },
      })
    );
    expect(confidence.confidence).toBe('low');
    expect(confidence.reason).toMatch(/does not fully define what is included/i);
  });

  it('looks up approved formulas and assumptions by scope', () => {
    expect(getFormulaDefinitionsForScope('flooring').map((formula) => formula.key)).toContain('flooring_purchase_with_waste');
    expect(getFormulaDefinitionsForScope('custom_specialty_scope')).toEqual([]);
    expect(getAssumptionsForScope('countertops').map((assumption) => assumption.key)).toContain('countertop_depth_ft');
  });

  it('runs basic flooring and waste formulas with reproducible ranges', () => {
    const result = calculateFormulaForScope({
      scopeKey: 'flooring',
      measurements: emptyMeasurements({ flooringSqft: 1000 }),
    });

    expect(result).toMatchObject({
      formulaKey: 'flooring_purchase_with_waste',
      roundedValue: 1080,
      unit: 'sqft',
      confidence: 'medium',
      expectedRange: { low: 1050, high: 1120 },
    });
  });

  it('calculates concrete slab CY from area and approved thickness assumption', () => {
    const result = calculateFormulaForScope({
      scopeKey: 'concrete',
      measurements: emptyMeasurements({ concreteSqft: 810 }),
    });

    expect(result).toMatchObject({
      formulaKey: 'flatwork_cy_from_area_thickness',
      roundedValue: 10,
      unit: 'cy',
      confidence: 'low',
      expectedRange: { low: 8.8, high: 15 },
    });
  });

  it('calculates paintable and drywall surfaces from approved scoped assumptions', () => {
    expect(
      calculateFormulaForScope({
        scopeKey: 'drywall',
        measurements: emptyMeasurements({ floorAreaSqft: 600 }),
      })
    ).toMatchObject({
      roundedValue: 2100,
      expectedRange: { low: 1800, high: 2520 },
      confidence: 'low',
    });

    expect(
      calculateFormulaForScope({
        scopeKey: 'paint',
        measurements: emptyMeasurements({ floorAreaSqft: 600 }),
      })
    ).toMatchObject({
      roundedValue: 1920,
      expectedRange: { low: 1560, high: 2280 },
      confidence: 'low',
    });
  });

  it('keeps utility trench LF primary while making CY unavailable without approved dimensions', () => {
    expect(
      calculateFormulaForScope({
        scopeKey: 'utility_trenching',
        measurements: emptyMeasurements({ railingLf: 120 }),
      })
    ).toBeNull();
  });

  it('calculates landscape material CY without inventing tonnage', () => {
    const result = calculateFormulaForScope({
      scopeKey: 'rock_mulch',
      measurements: emptyMeasurements({ rockMulchSqft: 810 }),
    });

    expect(result).toMatchObject({
      formulaKey: 'landscape_material_cy_from_area_depth',
      roundedValue: 5,
      unit: 'cy',
      expectedRange: { low: 3.8, high: 7.5 },
    });
  });

  it('calculates direct roofing squares, trim LF, countertops, and post counts', () => {
    expect(
      calculateFormulaForScope({
        scopeKey: 'shingles_roofing',
        measurements: emptyMeasurements({ roofSquares: 24.25 }),
      })
    ).toMatchObject({ roundedValue: 24.3, unit: 'squares', confidence: 'high' });

    expect(
      calculateFormulaForScope({
        scopeKey: 'baseboard',
        measurements: emptyMeasurements({ baseboardLf: 122.4 }),
      })
    ).toMatchObject({ roundedValue: 122, unit: 'lf', confidence: 'high' });

    expect(
      calculateFormulaForScope({
        scopeKey: 'countertops',
        measurements: emptyMeasurements({ cabinetLf: 24 }),
      })
    ).toMatchObject({ roundedValue: 50, unit: 'sqft', confidence: 'medium' });

    expect(
      calculateFormulaForScope({
        scopeKey: 'railing',
        measurements: emptyMeasurements({ railingLf: 65 }),
      })
    ).toMatchObject({ roundedValue: 10, unit: 'each', confidence: 'medium' });
  });

  it('executes approved formulas only and rejects unsupported keys', () => {
    expect(executeFormula('not_a_real_formula', { areaSqft: 100 })).toBeNull();
    expect(
      executeFormula('flatwork_cy_from_area_thickness', {
        areaSqft: 540,
        thicknessInches: 6,
      })
    ).toMatchObject({
      exactValue: 10,
      roundedValue: 10,
      unit: 'cy',
      confidence: 'high',
    });
  });

  it('preserves parsed note quantities and exposes formula comparison only', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'concrete',
      templateKey: 'addition',
      notes: 'Concrete is 25 CY from supplier.',
      measurements: emptyMeasurements({ concreteSqft: 400 }),
      resolved: resolved({
        quantity: 25,
        unit: 'cy',
        quantitySource: 'notes',
        sourceLabel: 'Parsed from notes',
      }),
    });

    expect(intelligence.quantity).toMatchObject({
      value: 25,
      source: 'from_notes',
      confidence: 'high',
    });
    expect(intelligence.formula).toMatchObject({
      formulaKey: 'flatwork_cy_from_area_thickness',
      roundedValue: 4.9,
    });
    expect(intelligence.formulaComparison).toMatchObject({
      currentValue: 25,
      calculatedValue: 4.9,
      variancePercent: 410,
    });
  });

  it('marks accepted calculated quantities as high-confidence calculated_confirmed', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'flooring',
      templateKey: 'kitchen',
      measurements: emptyMeasurements({ flooringSqft: 100 }),
      resolved: resolved({
        quantity: 108,
        unit: 'sqft',
        quantitySource: 'calculated_confirmed',
        sourceLabel: 'Calculated',
      }),
    });

    expect(intelligence.quantity).toMatchObject({
      source: 'calculated_confirmed',
      confidence: 'high',
      reason: expect.stringContaining('accepted'),
    });
  });

  it('looks up assembly definitions with required and optional components', () => {
    const foundation = getAssemblyDefinitionsForScope('foundation', 'addition')[0];
    expect(foundation).toMatchObject({
      key: 'foundation_assembly',
      trade: 'concrete',
    });
    expect(foundation.requiredComponents.map((component) => component.key)).toContain('reinforcement');
    expect(foundation.optionalComponents?.map((component) => component.key)).toContain('vapor_barrier');
    expect(getAssemblyDefinitionsForScope('custom_specialty_scope')).toEqual([]);
  });

  it('evaluates included, excluded, missing, unknown, and separately priced components', () => {
    const result = evaluateAssemblyForScope({
      scopeKey: 'foundation',
      projectContext: 'addition',
      activeScopeKeys: ['foundation', 'excavation'],
      inclusionMetadata: {
        source: 'project_quote',
        confirmedByUser: true,
        includedComponentKeys: ['layout', 'formwork', 'concrete', 'placement'],
        excludedComponentKeys: ['reinforcement'],
        unknownComponentKeys: ['base_preparation'],
      },
    });

    expect(result?.includedComponents.some((component) => component.key === 'excavation' && component.status === 'separately_priced')).toBe(true);
    expect(result?.excludedComponents.some((component) => component.key === 'reinforcement')).toBe(true);
    expect(result?.unknownComponents.some((component) => component.key === 'base_preparation')).toBe(true);
    expect(result?.missingComponents.some((component) => component.key === 'reinforcement')).toBe(false);
    expect(result?.confidence).toBe('medium');
  });

  it('flags missing required components when detailed metadata omits them', () => {
    const result = evaluateAssemblyForScope({
      scopeKey: 'concrete',
      projectContext: 'concrete_flatwork',
      activeScopeKeys: ['concrete'],
      inclusionMetadata: {
        source: 'saved_rate',
        includedComponentKeys: ['concrete', 'placement'],
      },
    });

    expect(result?.completeness).toBe('incomplete');
    expect(result?.confidence).toBe('low');
    expect(result?.missingComponents.map((component) => component.key)).toEqual(
      expect.arrayContaining(['subgrade_preparation', 'forms', 'finishing'])
    );
  });

  it('keeps missing metadata compatible but lowers inclusion confidence', () => {
    const result = evaluateAssemblyForScope({
      scopeKey: 'drywall',
      projectContext: 'addition',
      activeScopeKeys: ['drywall'],
      pricingSource: 'national_average',
    });

    expect(result?.completeness).toBe('mostly_complete');
    expect(result?.confidence).toBe('low');
    expect(result?.includedComponents.some((component) => component.status === 'included_assumed')).toBe(true);
  });

  it('detects project scope gaps for whole-project contexts and avoids trade-only noise', () => {
    expect(
      evaluateProjectScopeGaps({
        projectContext: 'kitchen',
        activeScopeKeys: ['cabinets', 'countertops', 'appliances'],
      }).map((gap) => gap.scopeGroupKey)
    ).toEqual(expect.arrayContaining(['demo', 'plumbing', 'electrical', 'backsplash', 'paint', 'cleanup']));

    expect(
      evaluateProjectScopeGaps({
        projectContext: 'plumbing_only',
        activeScopeKeys: ['plumbing_trim'],
      })
    ).toEqual([]);

    expect(
      evaluateProjectScopeGaps({
        projectContext: 'hvac_only',
        activeScopeKeys: ['hvac'],
      })
    ).toEqual([]);
  });

  it('detects overlap groups across major trades without changing quantities', () => {
    const excavation = evaluateAssemblyForScope({
      scopeKey: 'excavation',
      projectContext: 'sitework',
      activeScopeKeys: ['excavation', 'utility_trenching', 'backfill', 'haul_off'],
    });
    expect(excavation?.possibleOverlaps.map((overlap) => overlap.key)).toContain('excavation_trenching');

    const cabinets = evaluateAssemblyForScope({
      scopeKey: 'cabinets',
      projectContext: 'kitchen',
      activeScopeKeys: ['cabinets', 'countertops', 'trim'],
    });
    expect(cabinets?.possibleOverlaps.map((overlap) => overlap.key)).toEqual(
      expect.arrayContaining(['cabinets_countertops', 'cabinets_finish_carpentry'])
    );

    const hvac = evaluateAssemblyForScope({
      scopeKey: 'hvac',
      projectContext: 'hvac_only',
      activeScopeKeys: ['hvac', 'electrical_rough'],
    });
    expect(hvac?.possibleOverlaps.map((overlap) => overlap.key)).toContain('hvac_electrical');
  });

  it('returns dependency notices without automatically adding related scopes', () => {
    const tile = evaluateAssemblyForScope({
      scopeKey: 'shower_tile',
      projectContext: 'bathroom',
      activeScopeKeys: ['shower_tile'],
    });
    expect(tile?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'tile_shower_needs_waterproofing',
          suggestedScopeKeys: ['waterproofing'],
        }),
      ])
    );
  });

  it('extends scope intelligence with assembly, gap, overlap, and dependency metadata', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'cabinets',
      templateKey: 'kitchen',
      measurements: emptyMeasurements({ cabinetLf: 20 }),
      activeScopeKeys: ['cabinets', 'countertops', 'trim'],
      resolved: resolved({
        quantity: 20,
        unit: 'lf',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
      }),
      suggestedPricing: suggested({
        materialSource: 'template',
        laborSource: 'template',
      }),
    });

    expect(intelligence.quantity.value).toBe(20);
    expect(intelligence.assembly).toMatchObject({
      assemblyKey: 'cabinets_assembly',
    });
    expect(intelligence.assembly?.confidence).toBe('low');
    expect(intelligence.overlaps.map((overlap) => overlap.key)).toEqual(
      expect.arrayContaining(['cabinets_countertops', 'cabinets_finish_carpentry'])
    );
    expect(intelligence.scopeGaps.map((gap) => gap.scopeGroupKey)).toEqual(
      expect.arrayContaining(['demo', 'plumbing', 'electrical'])
    );
  });

  it('keeps registry coverage broad for templates and overlap definitions', () => {
    expect(getProjectScopeTemplates().map((template) => template.key)).toEqual(
      expect.arrayContaining([
        'new_adu',
        'kitchen_remodel',
        'bathroom_remodel',
        'roofing_replacement',
        'flooring_replacement',
        'sitework_package',
        'landscaping_package',
        'concrete_flatwork',
        'plumbing_only',
        'electrical_only',
        'hvac_only',
      ])
    );
    expect(getOverlapDefinitions().map((overlap) => overlap.key)).toEqual(
      expect.arrayContaining([
        'excavation_trenching',
        'demolition_cleanup',
        'foundation_concrete',
        'flooring_baseboard',
        'plumbing_rough_fixtures',
        'electrical_rough_fixtures',
        'hvac_electrical',
        'general_conditions_trade',
        'contingency_duplication',
      ])
    );
  });

  it('supports optional rate metadata while legacy rates still evaluate safely', () => {
    const result = evaluatePricingCompleteness({
      scopeKey: 'flooring',
      trade: 'flooring',
      pricingSource: 'saved_rate',
      suggestedPricing: suggested({
        materialSource: 'template',
        laborSource: 'template',
        basis: { quantity: 500, unit: 'sqft' },
      }),
      resolved: resolved({ quantity: 500, unit: 'sqft', quantitySource: 'user_entered' }),
    });

    expect(result.rateType).toBe('installed_unit_rate');
    expect(result.status).toBe('mostly_complete');
    expect(result.confidence).toBe('medium');
    expect(result.notices.some((notice) => notice.ruleKey === 'pricing_markup_unknown')).toBe(true);
  });

  it('classifies rate types without treating installed rates as selling prices', () => {
    expect(classifyRateType({ metadata: { rateType: 'project_quote' } })).toBe('project_quote');
    expect(classifyRateType({ metadata: { rateType: 'selling_price' } })).toBe('selling_price');
    expect(classifyRateType({ suggestedPricing: suggested({ material: 120, labor: 0 }) })).toBe('material_only');
    expect(classifyRateType({ suggestedPricing: suggested({ material: 0, labor: 120 }) })).toBe('labor_only');
    expect(classifyRateType({ suggestedPricing: suggested({ material: 120, labor: 240 }) })).toBe('installed_unit_rate');
    expect(classifyRateType({ resolved: resolved({ unit: 'allowance' }), pricingSource: 'allowance' })).toBe('allowance');
    expect(classifyRateType({ resolved: resolved({ unit: 'lump_sum' }) })).toBe('lump_sum');
    expect(classifyRateType({})).toBe('unknown');
  });

  it('evaluates regional relevance from zip, metro, state, national, and missing metadata', () => {
    const projectLocation = { state: 'UT', metro: 'Salt Lake City', zipCode: '84101' };
    expect(evaluateRegionalRelevance({ metadata: { region: { zipCode: '84101' } }, projectLocation })).toBe('high');
    expect(evaluateRegionalRelevance({ metadata: { region: { metro: 'Salt Lake City' } }, projectLocation })).toBe('high');
    expect(evaluateRegionalRelevance({ metadata: { region: { state: 'UT' } }, projectLocation })).toBe('medium');
    expect(evaluateRegionalRelevance({ metadata: { region: { state: 'CA' } }, projectLocation })).toBe('low');
    expect(evaluateRegionalRelevance({ pricingSource: 'national_average', projectLocation })).toBe('low');
    expect(evaluateRegionalRelevance({ metadata: {}, projectLocation })).toBe('unknown');
  });

  it('evaluates rate age with configurable source and trade thresholds', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(
      evaluateRateAge({
        scopeKey: 'concrete',
        trade: 'concrete',
        metadata: { lastConfirmedAt: '2026-03-01', source: 'saved_rate' },
        now,
      }).status
    ).toBe('current');
    expect(
      evaluateRateAge({
        scopeKey: 'concrete',
        trade: 'concrete',
        metadata: { lastConfirmedAt: '2025-08-01', source: 'saved_rate' },
        now,
      }).status
    ).toBe('aging');
    expect(
      evaluateRateAge({
        scopeKey: 'flooring',
        trade: 'flooring',
        metadata: { lastConfirmedAt: '2024-01-01', source: 'saved_rate' },
        now,
      }).status
    ).toBe('stale');
    expect(
      evaluateRateAge({
        scopeKey: 'hvac',
        metadata: { expirationDate: '2026-01-01', source: 'subcontractor' },
        now,
      }).status
    ).toBe('expired');
    expect(evaluateRateAge({ scopeKey: 'paint', metadata: {}, now }).status).toBe('unknown');
  });

  it('evaluates quantity scale and minimum-charge risk without changing totals', () => {
    expect(
      evaluateQuantityScale({
        currentQuantity: 40,
        metadata: { originalQuantity: 2500 },
      }).status
    ).toBe('small_job_review');
    expect(
      evaluateQuantityScale({
        currentQuantity: 12000,
        metadata: { originalQuantity: 2500 },
      }).status
    ).toBe('large_job_review');
    expect(
      evaluateQuantityScale({
        currentQuantity: 2,
        metadata: { minimumQuantity: 5, maximumQuantity: 100 },
      }).status
    ).toBe('outside_saved_range');

    const min = evaluateMinimumCharge({
      scopeKey: 'toilet',
      metadata: { minimumCharge: 750 },
      suggestedPricing: suggested({ total: 420 }),
    });
    expect(min).toMatchObject({
      applies: true,
      status: 'review',
      minimumCharge: 750,
      recommendedWorkingTotal: 750,
    });
    expect(suggested({ total: 420 }).total).toBe(420);
  });

  it('detects markup and margin risks without rewriting markup logic', () => {
    expect(
      evaluateMarkupRisk({
        rateType: 'direct_cost',
        metadata: { rateType: 'direct_cost' },
        projectMarkupPercent: 20,
      }).risk
    ).toBe('none');

    const selling = evaluateMarkupRisk({
      rateType: 'selling_price',
      metadata: { rateType: 'selling_price', overheadIncluded: true, profitIncluded: true },
      projectMarkupPercent: 20,
    });
    expect(selling.risk).toBe('review');
    expect(selling.notices.map((notice) => notice.ruleKey)).toContain('pricing_markup_possible_duplication');

    expect(
      evaluateMarkupRisk({
        rateType: 'direct_cost',
        metadata: { marginPercentIncluded: 25 },
        projectMarkupPercent: 25,
      }).notices.map((notice) => notice.ruleKey)
    ).toContain('pricing_markup_margin_review');
  });

  it('evaluates complete, incomplete, allowance, national-average, and project-quote pricing completeness', () => {
    const completeMetadata: RateMetadata = {
      rateType: 'installed_unit_rate',
      unit: 'sqft',
      scopeKey: 'flooring',
      source: 'saved_rate',
      region: { state: 'UT', metro: 'Salt Lake City' },
      lastConfirmedAt: '2026-03-01',
      originalQuantity: 500,
      materialIncluded: true,
      laborIncluded: true,
      deliveryIncluded: true,
      wasteIncluded: true,
    };
    expect(
      evaluatePricingCompleteness({
        scopeKey: 'flooring',
        trade: 'flooring',
        projectContext: 'flooring',
        pricingSource: 'saved_rate',
        suggestedPricing: suggested({ basis: { quantity: 500, unit: 'sqft' } }),
        metadata: completeMetadata,
        projectLocation: { state: 'UT', metro: 'Salt Lake City' },
        now: new Date('2026-06-01'),
      })
    ).toMatchObject({
      status: 'complete',
      confidence: 'high',
      rateType: 'installed_unit_rate',
    });

    expect(
      evaluatePricingCompleteness({
        scopeKey: 'concrete',
        trade: 'concrete',
        pricingSource: 'saved_rate',
        suggestedPricing: suggested({ material: 400, labor: 0, total: 400, basis: { quantity: 3, unit: 'cy' } }),
        metadata: { rateType: 'installed_unit_rate', unit: 'cy', materialIncluded: true, minimumCharge: 900 },
      })
    ).toMatchObject({
      status: 'incomplete',
      confidence: 'low',
      minimumCharge: expect.objectContaining({ status: 'review' }),
    });

    expect(
      evaluatePricingCompleteness({
        scopeKey: 'permits',
        pricingSource: 'allowance',
        resolved: resolved({ quantity: 2500, unit: 'allowance' }),
      }).notices.map((notice) => notice.ruleKey)
    ).toContain('pricing_allowance_placeholder');

    expect(
      evaluatePricingCompleteness({
        scopeKey: 'drywall',
        trade: 'drywall',
        pricingSource: 'national_average',
        suggestedPricing: suggested({ materialSource: 'national_average', laborSource: 'national_average' }),
      }).regionalRelevance?.overall
    ).toBe('low');

    expect(
      evaluatePricingCompleteness({
        scopeKey: 'hvac',
        pricingSource: 'project_quote',
        metadata: {
          rateType: 'project_quote',
          source: 'project_quote',
          expirationDate: '2026-12-01',
          materialIncluded: true,
          laborIncluded: true,
          overheadIncluded: true,
          profitIncluded: true,
        },
        now: new Date('2026-06-01'),
      }).rateType
    ).toBe('project_quote');
  });

  it('extends scope intelligence with pricing completeness without changing selected rate or quantity', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'flooring',
      templateKey: 'flooring',
      measurements: emptyMeasurements({ flooringSqft: 40 }),
      resolved: resolved({
        quantity: 40,
        unit: 'sqft',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
      }),
      suggestedPricing: suggested({
        material: 200,
        labor: 220,
        total: 420,
        materialSource: 'template',
        laborSource: 'template',
        basis: { quantity: 40, unit: 'sqft' },
      }),
      rateMetadata: {
        rateType: 'installed_unit_rate',
        unit: 'sqft',
        scopeKey: 'flooring',
        source: 'saved_rate',
        originalQuantity: 2500,
        minimumCharge: 750,
        materialIncluded: true,
        laborIncluded: true,
        lastConfirmedAt: '2024-01-01',
      },
    });

    expect(intelligence.quantity.value).toBe(40);
    expect(intelligence.pricingCompleteness).toMatchObject({
      rateType: 'installed_unit_rate',
      minimumCharge: expect.objectContaining({ status: 'review', recommendedWorkingTotal: 750 }),
      quantityScale: expect.objectContaining({ status: 'small_job_review' }),
    });
    expect(intelligence.pricingCompleteness?.notices.map((notice) => notice.ruleKey)).toEqual(
      expect.arrayContaining(['pricing_minimum_charge_review', 'pricing_quantity_scale_review'])
    );
  });

  it('summarizes estimate-level pricing review results for Phase 4 readiness', () => {
    const results = [
      evaluatePricingCompleteness({
        scopeKey: 'flooring',
        pricingSource: 'saved_rate',
        suggestedPricing: suggested(),
        metadata: { rateType: 'installed_unit_rate', materialIncluded: true, laborIncluded: true, lastConfirmedAt: '2026-01-01' },
        now: new Date('2026-06-01'),
      }),
      evaluatePricingCompleteness({
        scopeKey: 'drywall',
        pricingSource: 'national_average',
        suggestedPricing: suggested({ materialSource: 'national_average', laborSource: 'national_average' }),
      }),
    ];
    const summary = summarizeEstimatePricingReview(results);
    expect(summary.pricingReadiness).toBeGreaterThanOrEqual(0);
    expect(summary.nationalAverageCount).toBeGreaterThanOrEqual(1);
    expect(summary.incompletePriceDefinitionCount).toBeGreaterThanOrEqual(0);
  });

  it('uses duplicate-pricing language for overlap definitions instead of inclusion wording', () => {
    const excavationOverlap = getOverlapDefinitions().find((overlap) => overlap.key === 'excavation_trenching');
    expect(excavationOverlap?.message).toMatch(/may overlap/i);
    expect(excavationOverlap?.message).toMatch(/avoid duplicate pricing/i);
    expect(excavationOverlap?.message).not.toMatch(/may cover/i);

    for (const overlap of getOverlapDefinitions()) {
      expect(overlap.message).toMatch(/avoid duplicate pricing/i);
      expect(overlap.message).not.toMatch(/may cover/i);
    }
  });

  it('summarizes defined national-average scope profiles without generic overlap warnings', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'excavation',
      templateKey: 'sitework',
      notes: 'Excavate 50 CY for footings.',
      measurements: emptyMeasurements({ excavationCy: 50 }),
      activeScopeKeys: ['excavation', 'utility_trenching', 'backfill', 'haul_off'],
      resolved: resolved({
        quantity: 50,
        unit: 'cy',
        quantitySource: 'notes',
        sourceLabel: 'Parsed from notes',
        pricingReady: true,
        showInput: false,
      }),
      suggestedPricing: suggested({
        material: 250,
        labor: 2250,
        total: 2500,
        basis: { quantity: 50, unit: 'cy' },
        benchmarkScopeProfile: {
          sourceRecordId: 'national_average:excavation:cy',
          pricingSource: 'national_average',
          scopeAssumptionsDefined: true,
          scopeProfileSource: 'bps_standard_assumption',
          scopeAssumptions: [
            { scopeKey: 'excavation', status: 'included', displayLabel: 'Base excavation' },
            { scopeKey: 'equipment', status: 'included', displayLabel: 'Excavation equipment' },
            { scopeKey: 'operator', status: 'included', displayLabel: 'Operator labor' },
            { scopeKey: 'haul_off', status: 'excluded', displayLabel: 'Haul-off / export', riskLevel: 'high' },
            { scopeKey: 'dump_fees', status: 'excluded', displayLabel: 'Dump fees', riskLevel: 'high' },
            { scopeKey: 'backfill', status: 'excluded', displayLabel: 'Backfill', riskLevel: 'high' },
            { scopeKey: 'compaction', status: 'excluded', displayLabel: 'Compaction', riskLevel: 'high' },
            { scopeKey: 'shoring', status: 'excluded', displayLabel: 'Shoring', riskLevel: 'high' },
          ],
        },
      }),
    });

    expect(intelligence.quantity.confidence).toBe('high');
    expect(cardConfidenceForIntelligence(intelligence)).toBe('low');
    expect(intelligence.confidenceReasons).not.toContain('missing_scope_profile');
    expect(intelligence.overlapRisk.hasOverlapRisk).toBe(false);
    expect(primaryIntelligenceNotice(intelligence)).toBeNull();

    const card = buildCardIntelligenceDisplay(intelligence);
    expect(card.confidence).toBe('low');
    expect(card.confidenceLabel).toBe('Low confidence');
    expect(card.conciseBenchmarkWarning).toMatch(/Base national average only/i);
    expect(card.conciseBenchmarkWarning).toMatch(/haul-off \/ export, dump fees, backfill, and compaction/i);
    expect(card.conciseBenchmarkWarning).toMatch(/5 scope assumptions/i);
    expect(card.duplicatePricingMessage).toBeNull();
    expect(card.otherNotice).toBeNull();
    expect(card.showQuantityConfidenceLine).toBe(true);
  });

  it('shows duplicate-pricing warnings only when related scopes have accepted prices', () => {
    const conflict = detectActualDuplicatePricingConflicts({
      scopeKey: 'excavation',
      activeScopeKeys: ['excavation', 'backfill'],
      overlaps: [
        {
          key: 'excavation_trenching',
          componentKey: 'trench_excavation',
          componentLabel: 'Trench excavation/backfill',
          relatedScopeKeys: ['backfill'],
          severity: 'review',
          message: 'generic overlap',
          resolutionOptions: [],
        },
      ],
      pricingAcceptance: {
        excavation: { selectionStatus: 'accepted', totalAmount: 2500 },
        backfill: { selectionStatus: 'accepted', totalAmount: 1200 },
      },
    });
    expect(conflict.hasOverlapRisk).toBe(true);
    expect(conflict.title).toBe('Possible duplicate pricing');
    expect(conflict.reason).toMatch(/separate price/i);

    const noConflict = detectActualDuplicatePricingConflicts({
      scopeKey: 'excavation',
      activeScopeKeys: ['excavation', 'backfill'],
      overlaps: [
        {
          key: 'excavation_trenching',
          componentKey: 'trench_excavation',
          componentLabel: 'Trench excavation/backfill',
          relatedScopeKeys: ['backfill'],
          severity: 'review',
          message: 'generic overlap',
          resolutionOptions: [],
        },
      ],
    });
    expect(noConflict.hasOverlapRisk).toBe(false);
  });

  it('does not lower card confidence from overlap alone when benchmark scope is defined', () => {
    const intelligence = resolveScopeItemIntelligence({
      scopeKey: 'cabinets',
      templateKey: 'kitchen',
      measurements: emptyMeasurements({ cabinetLf: 20 }),
      activeScopeKeys: ['cabinets', 'countertops', 'trim'],
      resolved: resolved({
        quantity: 20,
        unit: 'lf',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
      }),
      suggestedPricing: suggested({
        materialSource: 'template',
        laborSource: 'template',
        rateSourceLabel: 'Suggested · Saved rate',
        benchmarkScopeProfile: {
          sourceRecordId: 'template:cabinets',
          pricingSource: 'saved_rate',
          scopeAssumptionsDefined: true,
          scopeAssumptions: [
            { scopeKey: 'countertops', status: 'excluded', displayLabel: 'Countertops' },
          ],
        },
      }),
    });

    expect(intelligence.overlapRisk.hasOverlapRisk).toBe(false);
    expect(cardConfidenceForIntelligence(intelligence)).not.toBe('low');
    expect(buildCardIntelligenceDisplay(intelligence).conciseBenchmarkWarning).toBeNull();
  });
});
