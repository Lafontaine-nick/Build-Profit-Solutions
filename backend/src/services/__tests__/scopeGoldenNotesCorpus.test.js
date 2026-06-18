const { parseScopeMeasurementsFromNotes } = require('../scopeMeasurementParser');
const { evaluateScopeExtractionConfidence } = require('../scopeExtractionConfidence');

function scopeItem(overrides) {
  return {
    itemType: overrides.itemType,
    tradeCategory: overrides.tradeCategory,
    scopeCategory: overrides.scopeCategory || overrides.itemType,
    location: overrides.location || null,
    includedStatus: overrides.includedStatus || 'included',
    scopeQuantity: overrides.scopeQuantity ?? null,
    scopeUnit: overrides.scopeUnit || null,
    pricingQuantity: overrides.pricingQuantity ?? overrides.scopeQuantity ?? null,
    pricingUnit: overrides.pricingUnit || overrides.scopeUnit || null,
    quantitySource: overrides.quantitySource || 'notes',
    materialState: overrides.materialState || 'missing',
    laborState: overrides.laborState || 'missing',
    equipmentState: overrides.equipmentState || 'missing',
    subcontractorState: overrides.subcontractorState || 'missing',
    expectedStatus: overrides.expectedStatus || 'needs_pricing',
  };
}

function fixture(input) {
  return {
    expectedClarificationQuestions: [],
    expectedAssumptions: [],
    expectedWarnings: [],
    expectedManualPricingItems: [],
    expectedBlockedItems: [],
    expectedTotals: {},
    expectedMeasurements: {},
    expectedPricingComponents: {},
    expectedPricingSources: {},
    absentExpectedPricingComponents: [],
    ...input,
  };
}

const goldenNotes = [
  fixture({
    id: 'flooring_voice_rates_and_lf',
    description: 'Flooring voice notes separate sqft, LF, demo labor rate, install material/labor rates, and baseboard LF pricing.',
    notes:
      'Flooring job demo existing tile which is 850 ft.2 labor is $3 dollars a square foot for tile demo next install LVP flooring which is 850 ft.? material is $4.50 a square foot and $3.25 a square foot for Labor. Also we have baseboard installation 220 linear feet with lump sum of $7 dollars per linear foot.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring', 'trim'],
    expectedScopeItems: [
      scopeItem({ itemType: 'floor_demo', tradeCategory: 'flooring', scopeQuantity: 850, scopeUnit: 'sqft', materialState: 'missing', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 850, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'trim', tradeCategory: 'trim', scopeQuantity: 220, scopeUnit: 'lf', materialState: 'suggested', laborState: 'suggested', expectedStatus: 'priced' }),
    ],
    expectedMeasurements: { floorAreaSqft: 850, baseboardLf: 220 },
    expectedPricingComponents: {
      floor_demo: { quantity: 2550, unit: 'allowance' },
      flooring__material: { quantity: 3825, unit: 'allowance' },
      flooring__labor: { quantity: 2762.5, unit: 'allowance' },
      flooring: { quantity: 6587.5, unit: 'allowance' },
      trim: { quantity: 1540, unit: 'allowance' },
    },
    expectedPricingSources: { floor_demo: 'notes', flooring: 'notes', trim: 'notes' },
    expectedConfidence: { overallConfidence: 'high', requiresAiFallback: false, requiresClarification: false },
  }),
  fixture({
    id: 'smith_flooring_multiple_demo_unpriced_install',
    description: 'Smith flooring notes accumulate multiple demo clauses and keep LVP install unpriced.',
    notes:
      'Floor job at Smith residence. Demo existing tile in main bath 850 sqft lump sum $2,550. Demo kitchen vinyl 180 sqft allowance $900. Install LVP in both areas 1030 total sqft not priced yet. Baseboards throughout 220 LF lump sum $1,540. Final clean and haul off $650 lump sum.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring', 'trim', 'cleanup'],
    expectedScopeItems: [
      scopeItem({ itemType: 'floor_demo', tradeCategory: 'flooring', location: 'main bath and kitchen', scopeQuantity: 1030, scopeUnit: 'sqft', materialState: 'included_elsewhere', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 1030, scopeUnit: 'sqft', materialState: 'missing', laborState: 'missing', expectedStatus: 'needs_pricing' }),
      scopeItem({ itemType: 'trim', tradeCategory: 'trim', scopeQuantity: 220, scopeUnit: 'lf', materialState: 'included_elsewhere', laborState: 'included_elsewhere', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'cleanup', tradeCategory: 'cleanup', materialState: 'included_elsewhere', laborState: 'provided', expectedStatus: 'priced' }),
    ],
    expectedMeasurements: { bathroomFloorSqft: 850, kitchenFloorSqft: 180, floorAreaSqft: 1030, baseboardLf: 220 },
    expectedPricingComponents: {
      floor_demo: { quantity: 3450, unit: 'allowance' },
      trim: { quantity: 1540, unit: 'allowance' },
      cleanup: { quantity: 650, unit: 'lump_sum' },
    },
    absentExpectedPricingComponents: ['flooring', 'flooring__material', 'flooring__labor', 'flooring__allowance', 'demo'],
    expectedConfidence: { overallConfidence: 'high', requiresAiFallback: false, requiresClarification: false },
  }),
  fixture({
    id: 'kitchen_mixed_units_and_rates',
    description: 'Kitchen remodel separates cabinet LF, counter sqft, backsplash sqft, floor sqft, and baseboard LF.',
    notes:
      'Kitchen remodel: install 24 LF cabinets lump sum $12,000, quartz counters 55 sqft allowance $4,400, backsplash 42 sqft material $8 per sqft and labor $14 per sqft. New LVP flooring 350 sqft material $4.25 per sqft and labor $3.75 per sqft. Baseboard 48 LF at $7 per LF.',
    ctx: { templateKey: 'kitchen', projectType: 'kitchen' },
    expectedProjectType: 'kitchen',
    expectedTrades: ['cabinetry', 'countertops', 'tile', 'flooring', 'trim'],
    expectedScopeItems: [
      scopeItem({ itemType: 'cabinets', tradeCategory: 'cabinetry', scopeQuantity: 24, scopeUnit: 'lf', materialState: 'included_elsewhere', laborState: 'included_elsewhere', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'countertops', tradeCategory: 'countertops', scopeQuantity: 55, scopeUnit: 'sqft', materialState: 'included_elsewhere', laborState: 'included_elsewhere', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'backsplash', tradeCategory: 'tile', scopeQuantity: 42, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 350, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'trim', tradeCategory: 'trim', scopeQuantity: 48, scopeUnit: 'lf', materialState: 'suggested', laborState: 'suggested', expectedStatus: 'priced' }),
    ],
    expectedMeasurements: { cabinetLf: 24, countertopSqft: 55, backsplashSqft: 42, kitchenFloorSqft: 350, floorAreaSqft: 350, baseboardLf: 48 },
    expectedPricingComponents: {
      cabinets: { quantity: 12000, unit: 'allowance' },
      countertops: { quantity: 4400, unit: 'allowance' },
      backsplash__material: { quantity: 336, unit: 'allowance' },
      backsplash__labor: { quantity: 588, unit: 'allowance' },
      backsplash__allowance: { quantity: 924, unit: 'allowance' },
      flooring__material: { quantity: 1487.5, unit: 'allowance' },
      flooring__labor: { quantity: 1312.5, unit: 'allowance' },
      flooring: { quantity: 2800, unit: 'allowance' },
      trim: { quantity: 336, unit: 'allowance' },
    },
    expectedConfidence: { overallConfidence: 'high', requiresAiFallback: false, requiresClarification: false },
  }),
  fixture({
    id: 'sitework_mixed_units',
    description: 'Sitework notes keep sqft, CY, tons, and roofing squares in their own fields.',
    notes:
      'Exterior scope: sod 900 sqft material $1.20 per sqft and labor $0.85 per sqft, paver patio 180 sqft material $6 per sqft and labor $8 per sqft, decorative rock 12 tons lump sum $1,800, concrete patio 400 sqft and 12 CY concrete, roof tear off 28 squares lump sum $5,600.',
    ctx: { templateKey: 'landscaping', projectType: 'landscaping' },
    expectedProjectType: 'landscaping',
    expectedTrades: ['landscaping', 'concrete', 'roofing'],
    expectedScopeItems: [
      scopeItem({ itemType: 'sod_turf', tradeCategory: 'landscaping', scopeQuantity: 900, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'pavers', tradeCategory: 'hardscape', scopeQuantity: 180, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'rock_mulch', tradeCategory: 'landscaping', scopeQuantity: 12, scopeUnit: 'ton', materialState: 'included_elsewhere', laborState: 'included_elsewhere', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'concrete', tradeCategory: 'concrete', scopeQuantity: 400, scopeUnit: 'sqft', materialState: 'missing', laborState: 'missing', expectedStatus: 'needs_pricing' }),
      scopeItem({ itemType: 'tear_off', tradeCategory: 'roofing', scopeQuantity: 28, scopeUnit: 'squares', materialState: 'included_elsewhere', laborState: 'provided', expectedStatus: 'priced' }),
    ],
    expectedMeasurements: { sodSqft: 900, paverSqft: 180, landscapeTons: 12, concreteSqft: 400, concreteCy: 12, roofSquares: 28 },
    expectedPricingComponents: {
      sod_turf__material: { quantity: 1080, unit: 'allowance' },
      sod_turf__labor: { quantity: 765, unit: 'allowance' },
      sod_turf: { quantity: 1845, unit: 'allowance' },
      pavers__material: { quantity: 1080, unit: 'allowance' },
      pavers__labor: { quantity: 1440, unit: 'allowance' },
      pavers: { quantity: 2520, unit: 'allowance' },
      rock_mulch: { quantity: 1800, unit: 'allowance' },
      tear_off: { quantity: 5600, unit: 'allowance' },
    },
    expectedConfidence: { overallConfidence: 'high', requiresAiFallback: false, requiresClarification: false },
  }),
  fixture({
    id: 'flooring_material_only',
    description: 'Material provided, labor missing should be a medium-confidence partial-pricing fixture.',
    notes: 'Install LVP flooring 500 sqft. Material is $4.25 per sqft, labor not priced yet.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring'],
    expectedScopeItems: [scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 500, scopeUnit: 'sqft', materialState: 'provided', laborState: 'missing', expectedStatus: 'partial_pricing' })],
    expectedMeasurements: { floorAreaSqft: 500 },
    expectedPricingComponents: { flooring__material: { quantity: 2125, unit: 'allowance' }, flooring: { quantity: 2125, unit: 'allowance' } },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['partial_material_labor_pricing'], requiresClarification: false },
  }),
  fixture({
    id: 'flooring_labor_only',
    description: 'Labor provided, material missing should be a medium-confidence partial-pricing fixture.',
    notes: 'Install laminate flooring 500 sqft labor $3.50 per sqft. Customer has not picked material yet.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring'],
    expectedScopeItems: [scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 500, scopeUnit: 'sqft', materialState: 'missing', laborState: 'provided', expectedStatus: 'partial_pricing' })],
    expectedMeasurements: { floorAreaSqft: 500 },
    expectedPricingComponents: { flooring__labor: { quantity: 1750, unit: 'allowance' }, flooring: { quantity: 1750, unit: 'allowance' } },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['partial_material_labor_pricing'], requiresClarification: false },
  }),
  fixture({
    id: 'flooring_quantity_no_pricing',
    description: 'Clear quantity with no pricing should not require AI fallback; resolver can suggest later.',
    notes: 'Install 600 sqft laminate flooring and 120 LF baseboards. No pricing yet.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring', 'trim'],
    expectedScopeItems: [
      scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 600, scopeUnit: 'sqft', expectedStatus: 'needs_pricing' }),
      scopeItem({ itemType: 'trim', tradeCategory: 'trim', scopeQuantity: 120, scopeUnit: 'lf', expectedStatus: 'needs_pricing' }),
    ],
    expectedMeasurements: { floorAreaSqft: 600, baseboardLf: 120 },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['no_pricing_provided'], requiresAiFallback: false },
  }),
  fixture({
    id: 'single_scope_lump_sum_paint',
    description: 'A full lump sum for one scope item should preserve the total.',
    notes: 'Paint walls and ceiling 800 sqft lump sum $2,400.',
    ctx: { templateKey: 'painting', projectType: 'painting' },
    expectedProjectType: 'painting',
    expectedTrades: ['painting'],
    expectedScopeItems: [scopeItem({ itemType: 'paint', tradeCategory: 'painting', scopeQuantity: 800, scopeUnit: 'sqft', materialState: 'included_elsewhere', laborState: 'included_elsewhere', expectedStatus: 'priced' })],
    expectedMeasurements: { wallPaintSqft: 800 },
    expectedPricingComponents: { paint: { quantity: 2400, unit: 'allowance' } },
    expectedConfidence: { overallConfidence: 'high', requiresAiFallback: false, requiresClarification: false },
  }),
  fixture({
    id: 'bathroom_lump_sum_ambiguous',
    description: 'One lump sum covering multiple scope items needs clarification about the meaning of the total.',
    notes: 'Bathroom remodel for $18,000.',
    ctx: { templateKey: 'bathroom', projectType: 'bathroom' },
    expectedProjectType: 'bathroom',
    expectedTrades: ['bathroom'],
    expectedScopeItems: [scopeItem({ itemType: 'bathroom_remodel', tradeCategory: 'bathroom', materialState: 'manual_required', laborState: 'manual_required', expectedStatus: 'needs_clarification' })],
    expectedConfidence: { overallConfidence: 'low', ambiguityFlags: ['lump_sum_meaning_unknown'], requiresAiFallback: true, requiresClarification: true },
    expectedClarificationQuestions: ['Does the lump sum represent the total selling price, direct project cost, labor only, material only, or a subcontractor quote?'],
  }),
  fixture({
    id: 'material_only_lump_sum',
    description: 'Material-only lump sum should preserve material responsibility and leave labor missing.',
    notes: 'Customer wants tile shower. Material only allowance $1,800, labor TBD.',
    ctx: { templateKey: 'bathroom', projectType: 'bathroom' },
    expectedProjectType: 'bathroom',
    expectedTrades: ['tile'],
    expectedScopeItems: [scopeItem({ itemType: 'shower_tile', tradeCategory: 'tile', materialState: 'provided', laborState: 'missing', expectedStatus: 'partial_pricing' })],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['material_only'], requiresClarification: false },
  }),
  fixture({
    id: 'labor_only_lump_sum',
    description: 'Labor-only lump sum should preserve labor responsibility and leave material missing.',
    notes: 'Labor only to hang and finish drywall patches, $950, material by owner.',
    ctx: { templateKey: 'drywall', projectType: 'drywall' },
    expectedProjectType: 'drywall',
    expectedTrades: ['drywall'],
    expectedScopeItems: [scopeItem({ itemType: 'patch_repair', tradeCategory: 'drywall', materialState: 'customer_supplied', laborState: 'provided', expectedStatus: 'partial_pricing' })],
    expectedConfidence: { overallConfidence: 'low', ambiguityFlags: ['missing_quantity', 'customer_supplied_material', 'labor_only'], requiresAiFallback: true, requiresClarification: false },
  }),
  fixture({
    id: 'subcontractor_quote',
    description: 'Subcontractor quote should be identified without bypassing the later pricing/approval pipeline.',
    notes: 'HVAC sub quote is $9,800 for 3 ton condenser, coil, furnace swap, and reconnect existing ductwork.',
    ctx: { templateKey: 'room_remodel', projectType: 'hvac' },
    expectedProjectType: 'hvac',
    expectedTrades: ['hvac'],
    expectedScopeItems: [scopeItem({ itemType: 'hvac_equipment', tradeCategory: 'hvac', scopeQuantity: 3, scopeUnit: 'ton', materialState: 'included_elsewhere', laborState: 'included_elsewhere', subcontractorState: 'provided', expectedStatus: 'subcontractor_quote' })],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['measurements_not_mapped', 'subcontractor_quote'], requiresAiFallback: true, requiresClarification: true },
    expectedClarificationQuestions: ['Does the subcontractor quote include material, labor, equipment, cleanup, and disposal?'],
  }),
  fixture({
    id: 'customer_supplied_toilet',
    description: 'Customer-supplied material on a plumbing fixture replacement needs location/supply clarification.',
    notes: 'Replace the toilet. Customer supplied toilet.',
    ctx: { templateKey: 'bathroom', projectType: 'bathroom' },
    expectedProjectType: 'bathroom',
    expectedTrades: ['plumbing'],
    expectedScopeItems: [scopeItem({ itemType: 'toilet', tradeCategory: 'plumbing', scopeQuantity: 1, scopeUnit: 'each', materialState: 'customer_supplied', laborState: 'missing', expectedStatus: 'needs_clarification' })],
    expectedConfidence: { overallConfidence: 'low', ambiguityFlags: ['missing_quantity', 'customer_supplied_material', 'plumbing_replacement_responsibility_unknown', 'no_pricing_provided'], requiresAiFallback: true, requiresClarification: true },
    expectedClarificationQuestions: ['Is the toilet staying in the same location, and is the fixture contractor-supplied or customer-supplied?'],
  }),
  fixture({
    id: 'contractor_supplied_vanity',
    description: 'Contractor-supplied fixture language should not ask customer-supplied responsibility questions.',
    notes: 'Replace vanity in hall bath. Contractor supplied 36 inch vanity and faucet, labor $650.',
    ctx: { templateKey: 'bathroom', projectType: 'bathroom' },
    expectedProjectType: 'bathroom',
    expectedTrades: ['plumbing', 'finish_carpentry'],
    expectedScopeItems: [scopeItem({ itemType: 'vanity', tradeCategory: 'bathroom', scopeQuantity: 1, scopeUnit: 'each', materialState: 'contractor_supplied', laborState: 'provided', expectedStatus: 'partial_pricing' })],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['contractor_supplied_material'], requiresClarification: false },
  }),
  fixture({
    id: 'ambiguous_paint_sqft',
    description: 'Painting sqft versus floor sqft must trigger clarification instead of reusing floor area blindly.',
    notes: 'Paint the room, about 250 sqft.',
    ctx: { templateKey: 'painting', projectType: 'painting' },
    expectedProjectType: 'painting',
    expectedTrades: ['painting'],
    expectedScopeItems: [scopeItem({ itemType: 'paint', tradeCategory: 'painting', scopeQuantity: 250, scopeUnit: 'sqft', expectedStatus: 'needs_clarification' })],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['ambiguous_sqft', 'approximate_or_uncertain_language'], requiresClarification: true },
    expectedClarificationQuestions: ['Does the sqft refer to floor area or paintable wall and ceiling area?'],
  }),
  fixture({
    id: 'lf_vs_sqft_conflict',
    description: 'LF versus sqft conflict on baseboards should flag unit ambiguity.',
    notes: 'Baseboards 200 sqft maybe 200 LF, price $7.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['trim'],
    expectedScopeItems: [scopeItem({ itemType: 'trim', tradeCategory: 'trim', scopeQuantity: 200, scopeUnit: 'lf', materialState: 'manual_required', laborState: 'manual_required', expectedStatus: 'needs_clarification' })],
    expectedMeasurements: { baseboardLf: 200 },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['baseboard_unit_conflict', 'approximate_or_uncertain_language'], requiresClarification: true },
    expectedClarificationQuestions: ['Is the baseboard price per linear foot, and does it include both material and labor?'],
  }),
  fixture({
    id: 'multiple_rooms_same_unit',
    description: 'Several room locations with the same unit should preserve separate quantities when deterministic enough.',
    notes: 'Install LVP in kitchen 180 sqft, hall 90 sqft, laundry 70 sqft. Baseboard 120 LF. No pricing yet.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring', 'trim'],
    expectedScopeItems: [scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', location: 'kitchen, hall, laundry', scopeUnit: 'sqft', expectedStatus: 'needs_pricing' })],
    expectedMeasurements: { kitchenFloorSqft: 180, baseboardLf: 120 },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['no_pricing_provided'], requiresAiFallback: false },
  }),
  fixture({
    id: 'plumbing_rough_in',
    description: 'Plumbing relocation/rough-in should be captured as complexity requiring future scope confirmation.',
    notes: 'Move toilet 3 feet and rough in double vanity plumbing, two sinks, labor $1,200.',
    ctx: { templateKey: 'bathroom', projectType: 'bathroom' },
    expectedProjectType: 'bathroom',
    expectedTrades: ['plumbing'],
    expectedScopeItems: [scopeItem({ itemType: 'plumbing_rough', tradeCategory: 'plumbing', scopeQuantity: 2, scopeUnit: 'each', materialState: 'missing', laborState: 'provided', expectedStatus: 'partial_pricing' })],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['replacement_vs_relocation_complexity'], requiresAiFallback: false },
  }),
  fixture({
    id: 'electrical_fixture_replacement',
    description: 'Electrical fixture replacement with counts is clearer than new wiring or circuits.',
    notes: 'Replace 6 can lights and 2 vanity lights, fixtures customer supplied, labor $900.',
    ctx: { templateKey: 'bathroom', projectType: 'bathroom' },
    expectedProjectType: 'bathroom',
    expectedTrades: ['electrical'],
    expectedScopeItems: [scopeItem({ itemType: 'electrical_finish', tradeCategory: 'electrical', scopeQuantity: 8, scopeUnit: 'each', materialState: 'customer_supplied', laborState: 'provided', expectedStatus: 'partial_pricing' })],
    expectedConfidence: { overallConfidence: 'high', ambiguityFlags: ['customer_supplied_material'], requiresClarification: false },
  }),
  fixture({
    id: 'electrical_new_circuit',
    description: 'New electrical wiring or circuits should flag complexity.',
    notes: 'Add 3 new outlets and run one new 20 amp circuit from panel to kitchen island.',
    ctx: { templateKey: 'kitchen', projectType: 'kitchen' },
    expectedProjectType: 'kitchen',
    expectedTrades: ['electrical'],
    expectedScopeItems: [scopeItem({ itemType: 'electrical_rough', tradeCategory: 'electrical', scopeQuantity: 4, scopeUnit: 'each', materialState: 'missing', laborState: 'missing', expectedStatus: 'needs_pricing' })],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['electrical_new_wiring_or_circuits', 'no_pricing_provided'], requiresAiFallback: false },
  }),
  fixture({
    id: 'concrete_slab_sqft_cy',
    description: 'Concrete slab with sqft and CY should keep both units.',
    notes: 'Pour 600 sqft concrete slab, 18 CY concrete, finish and saw cut. Labor $6 per sqft material $145 per CY.',
    ctx: { templateKey: 'concrete', projectType: 'concrete' },
    expectedProjectType: 'concrete',
    expectedTrades: ['concrete'],
    expectedScopeItems: [scopeItem({ itemType: 'concrete', tradeCategory: 'concrete', scopeQuantity: 600, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' })],
    expectedMeasurements: { concreteSqft: 600, concreteCy: 18 },
    expectedConfidence: { overallConfidence: 'medium', requiresAiFallback: false },
  }),
  fixture({
    id: 'excavation_lf_cy_equipment_haul',
    description: 'Excavation using LF, CY, equipment, and haul-off is medium confidence until equipment/haul are separately priced.',
    notes: 'Excavate trench 80 LF, about 20 CY spoils, mini ex and haul off included, no price yet.',
    ctx: { templateKey: 'excavation', projectType: 'excavation' },
    expectedProjectType: 'excavation',
    expectedTrades: ['excavation'],
    expectedScopeItems: [scopeItem({ itemType: 'excavation', tradeCategory: 'excavation', scopeQuantity: 20, scopeUnit: 'cy', equipmentState: 'included_elsewhere', laborState: 'missing', expectedStatus: 'needs_pricing' })],
    expectedMeasurements: { excavationCy: 20 },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['cleanup_disposal_unclear', 'approximate_or_uncertain_language'], requiresAiFallback: false, requiresClarification: true },
    expectedClarificationQuestions: ['Is cleanup, haul-off, and disposal included, and is it priced separately?'],
  }),
  fixture({
    id: 'roofing_tearoff_decking',
    description: 'Roofing squares with tear-off and decking repair should preserve squares and flag unpriced decking repair.',
    notes: 'Roof tear off 28 squares $5,600. Replace bad decking as needed, not priced.',
    ctx: { templateKey: 'roofing', projectType: 'roofing' },
    expectedProjectType: 'roofing',
    expectedTrades: ['roofing'],
    expectedScopeItems: [
      scopeItem({ itemType: 'tear_off', tradeCategory: 'roofing', scopeQuantity: 28, scopeUnit: 'squares', laborState: 'provided', expectedStatus: 'priced' }),
      scopeItem({ itemType: 'decking_repair', tradeCategory: 'roofing', materialState: 'missing', laborState: 'missing', expectedStatus: 'needs_pricing' }),
    ],
    expectedMeasurements: { roofSquares: 28 },
    expectedPricingComponents: { tear_off: { quantity: 5600, unit: 'allowance' } },
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['missing_quantity'], requiresAiFallback: false },
  }),
  fixture({
    id: 'drywall_patch_vs_full_room',
    description: 'Drywall patch versus full-room drywall should keep repair sqft distinct.',
    notes: 'Patch drywall in living room, 80 sqft repair, texture match and paint by others. Labor $600.',
    ctx: { templateKey: 'drywall', projectType: 'drywall' },
    expectedProjectType: 'drywall',
    expectedTrades: ['drywall'],
    expectedScopeItems: [scopeItem({ itemType: 'patch_repair', tradeCategory: 'drywall', scopeQuantity: 80, scopeUnit: 'sqft', materialState: 'missing', laborState: 'provided', expectedStatus: 'partial_pricing' })],
    expectedMeasurements: { drywallSqft: 80 },
    expectedConfidence: { overallConfidence: 'medium', requiresClarification: false },
  }),
  fixture({
    id: 'hourly_service_call',
    description: 'Service-call or hourly work should remain manual-friendly but high confidence when hours and rate are explicit.',
    notes: 'Service call: handyman punch list, 2 hours at $95 per hour, materials excluded.',
    ctx: { templateKey: 'room_remodel', projectType: 'service' },
    expectedProjectType: 'service',
    expectedTrades: ['service'],
    expectedScopeItems: [scopeItem({ itemType: 'service_call', tradeCategory: 'service', scopeQuantity: 2, scopeUnit: 'hr', materialState: 'blocked', laborState: 'provided', expectedStatus: 'manual_pricing' })],
    expectedManualPricingItems: ['service_call'],
    expectedConfidence: { overallConfidence: 'medium', requiresAiFallback: false },
  }),
  fixture({
    id: 'conflicting_quantities',
    description: 'Conflicting quantities in the same note should trigger AI fallback or clarification.',
    notes: 'Install LVP 850 sqft, actually maybe 950 sqft total, use same for baseboards 220 LF.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring', 'trim'],
    expectedScopeItems: [scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeUnit: 'sqft', expectedStatus: 'needs_clarification' })],
    expectedMeasurements: { baseboardLf: 220 },
    expectedConfidence: { overallConfidence: 'low', ambiguityFlags: ['competing_sqft_values', 'approximate_or_uncertain_language'], requiresAiFallback: true },
  }),
  fixture({
    id: 'mixed_trade_slang_dictation',
    description: 'Mixed-trade shorthand and missing punctuation should be accepted cautiously and routed to later AI fallback if needed.',
    notes: 'kitch reno cabs 20 lf tops 48 sf splash 35 sf lvp 300 sf elec 4 cans plumb sink hook no prices yet',
    ctx: { templateKey: 'kitchen', projectType: 'kitchen' },
    expectedProjectType: 'kitchen',
    expectedTrades: ['cabinetry', 'countertops', 'tile', 'flooring', 'electrical', 'plumbing'],
    expectedScopeItems: [
      scopeItem({ itemType: 'cabinets', tradeCategory: 'cabinetry', scopeQuantity: 20, scopeUnit: 'lf', expectedStatus: 'needs_pricing' }),
      scopeItem({ itemType: 'countertops', tradeCategory: 'countertops', scopeQuantity: 48, scopeUnit: 'sqft', expectedStatus: 'needs_pricing' }),
      scopeItem({ itemType: 'backsplash', tradeCategory: 'tile', scopeQuantity: 35, scopeUnit: 'sqft', expectedStatus: 'needs_pricing' }),
      scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 300, scopeUnit: 'sqft', expectedStatus: 'needs_pricing' }),
    ],
    expectedConfidence: { overallConfidence: 'low', ambiguityFlags: ['shorthand_multi_trade_note', 'measurements_not_mapped'], requiresAiFallback: true },
  }),
  fixture({
    id: 'prices_written_as_words',
    description: 'Prices written as words should preserve explicit user values when possible.',
    notes: 'Install backsplash 40 sqft material eight dollars per sqft labor fourteen dollars per sqft.',
    ctx: { templateKey: 'kitchen', projectType: 'kitchen' },
    expectedProjectType: 'kitchen',
    expectedTrades: ['tile'],
    expectedScopeItems: [scopeItem({ itemType: 'backsplash', tradeCategory: 'tile', scopeQuantity: 40, scopeUnit: 'sqft', materialState: 'provided', laborState: 'provided', expectedStatus: 'priced' })],
    expectedMeasurements: { backsplashSqft: 40 },
    expectedPricingComponents: { backsplash__material: { quantity: 320, unit: 'allowance' }, backsplash__labor: { quantity: 560, unit: 'allowance' }, backsplash__allowance: { quantity: 880, unit: 'allowance' } },
    expectedConfidence: { overallConfidence: 'high', requiresAiFallback: false },
  }),
  fixture({
    id: 'explicit_exclusions_cleanup_unclear',
    description: 'Explicit exclusions and unclear cleanup should not be silently priced.',
    notes: 'Install carpet 700 sqft, exclude furniture moving. Cleanup and disposal by owner.',
    ctx: { templateKey: 'flooring', projectType: 'flooring' },
    expectedProjectType: 'flooring',
    expectedTrades: ['flooring'],
    expectedScopeItems: [scopeItem({ itemType: 'flooring', tradeCategory: 'flooring', scopeQuantity: 700, scopeUnit: 'sqft', expectedStatus: 'needs_pricing' })],
    expectedMeasurements: { floorAreaSqft: 700 },
    expectedWarnings: ['explicit_exclusion'],
    expectedConfidence: { overallConfidence: 'medium', ambiguityFlags: ['no_pricing_provided', 'cleanup_disposal_unclear'], requiresClarification: true },
    expectedClarificationQuestions: ['Is cleanup, haul-off, and disposal included, and is it priced separately?'],
  }),
];

describe('golden walkthrough notes corpus', () => {
  test.each(goldenNotes)('$id — $description', (golden) => {
    const parsed = parseScopeMeasurementsFromNotes(golden.notes, golden.ctx);
    const confidence = evaluateScopeExtractionConfidence(golden.notes, parsed, golden.ctx);

    expect(golden).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        description: expect.any(String),
        notes: expect.any(String),
        expectedProjectType: expect.any(String),
        expectedTrades: expect.any(Array),
        expectedScopeItems: expect.any(Array),
        expectedMeasurements: expect.any(Object),
        expectedPricingComponents: expect.any(Object),
        expectedPricingSources: expect.any(Object),
        expectedClarificationQuestions: expect.any(Array),
        expectedAssumptions: expect.any(Array),
        expectedWarnings: expect.any(Array),
        expectedManualPricingItems: expect.any(Array),
        expectedBlockedItems: expect.any(Array),
        expectedConfidence: expect.any(Object),
        expectedTotals: expect.any(Object),
      })
    );

    for (const item of golden.expectedScopeItems) {
      expect(item).toEqual(
        expect.objectContaining({
          itemType: expect.any(String),
          tradeCategory: expect.any(String),
          scopeCategory: expect.any(String),
          includedStatus: expect.any(String),
          materialState: expect.any(String),
          laborState: expect.any(String),
          equipmentState: expect.any(String),
          subcontractorState: expect.any(String),
          expectedStatus: expect.any(String),
        })
      );
    }

    for (const [key, value] of Object.entries(golden.expectedMeasurements)) {
      expect(parsed[key]).toBe(value);
    }

    for (const [key, expected] of Object.entries(golden.expectedPricingComponents)) {
      expect(parsed.itemQuantities?.[key]).toMatchObject(expected);
    }

    for (const key of golden.absentExpectedPricingComponents) {
      expect(parsed.itemQuantities?.[key]).toBeUndefined();
    }

    const { ambiguityFlags: _expectedFlags, ...expectedConfidenceShape } = golden.expectedConfidence;
    expect(confidence).toMatchObject(expectedConfidenceShape);

    if (golden.expectedConfidence.ambiguityFlags) {
      expect(confidence.ambiguityFlags).toEqual(expect.arrayContaining(golden.expectedConfidence.ambiguityFlags));
    }

    const questions = confidence.clarificationQuestions.map((q) => q.question);
    expect(questions).toEqual(expect.arrayContaining(golden.expectedClarificationQuestions));
    if (golden.expectedConfidence.requiresClarification === false) {
      expect(questions).toHaveLength(0);
    }
  });
});
