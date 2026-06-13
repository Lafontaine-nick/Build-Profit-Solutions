const { parseScopeMeasurementsFromNotes } = require('../scopeMeasurementParser');
const {
  checklistTemplateKey,
  CHECKLIST_TEMPLATES,
  inferItemStateFromNotes,
} = require('../scopeChecklistLibrary');
const { buildScopeChecklist } = require('../estimateDraftComplexity');
const { resolveQuantityForChecklistItem, normalizeScopeMeasurements } = require('../scopeItemQuantityCatalog');

describe('scopeMeasurementParser', () => {
  test('parses kitchen floor and backsplash from notes', () => {
    const notes = 'Kitchen remodel, 220 sqft kitchen floor, 45 sqft backsplash tile';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.kitchenFloorSqft).toBe(220);
    expect(parsed.backsplashSqft).toBe(45);
  });

  test('Martinez kitchen one line: paint sqft not stolen from backsplash', () => {
    const notes =
      'Kitchen remodel Martinez, Backsplash tile 45 sqft - material $8/sqft, labor $12/sqft, Paint walls/ceiling 320 sqft - $1.50/sqft labor, Demo $850';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.backsplashSqft).toBe(45);
    expect(parsed.wallPaintSqft).toBe(320);
    const norm = normalizeScopeMeasurements(parsed);
    const paint = resolveQuantityForChecklistItem('paint', {
      measurements: norm,
      notes,
      templateKey: 'kitchen',
    });
    expect(paint.quantity).toBe(320);
  });

  test('Martinez kitchen single-line notes: appliances get $1,200 not cabinet $28,629', () => {
    const notes =
      'Kitchen remodel Martinez Cabinets and counters $28,629 includes labor and materials Appliance install allowance $1,200 Demo $850 lump sum';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.itemQuantities?.appliances?.quantity).toBe(1200);
    expect(parsed.itemQuantities?.cabinets?.quantity).toBe(28629);
    expect(parsed.itemQuantities?.demo?.quantity).toBe(850);
  });

  test('Martinez kitchen: prefills lump-sum and allowance pricing from notes', () => {
    const notes = `Kitchen remodel for Martinez - 30339
Cabinets and counters $28,629 includes labor and materials
Appliance install allowance $1,200
Backsplash tile 45 sqft - material $8/sqft, labor $12/sqft
Paint walls/ceiling 320 sqft - $1.50/sqft labor
Demo old cabinets and haul off $850 lump sum`;
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.itemQuantities?.demo).toEqual({
      quantity: 850,
      unit: 'lump_sum',
      quantitySource: 'notes',
    });
    expect(parsed.itemQuantities?.cabinets).toEqual({
      quantity: 28629,
      unit: 'allowance',
      quantitySource: 'notes',
      includesCountertops: true,
    });
    expect(parsed.itemQuantities?.appliances).toEqual({
      quantity: 1200,
      unit: 'allowance',
      quantitySource: 'notes',
    });
    const norm = normalizeScopeMeasurements(parsed);
    expect(
      resolveQuantityForChecklistItem('countertops', { measurements: norm, notes, templateKey: 'kitchen' })
        .quantity
    ).toBe(28629);
    expect(
      resolveQuantityForChecklistItem('countertops', { measurements: norm, notes, templateKey: 'kitchen' })
        .sourceLabel
    ).toBe('Combined cabinets & counters');
    expect(resolveQuantityForChecklistItem('demo', { measurements: norm, notes, templateKey: 'kitchen' }).quantity).toBe(
      850
    );
    expect(
      resolveQuantityForChecklistItem('cabinets', { measurements: norm, notes, templateKey: 'kitchen' }).quantity
    ).toBe(28629);
    expect(
      resolveQuantityForChecklistItem('appliances', { measurements: norm, notes, templateKey: 'kitchen' }).quantity
    ).toBe(1200);
    expect(parsed.itemQuantities?.backsplash__allowance?.quantity).toBe(900);
    expect(parsed.itemQuantities?.backsplash__material?.quantity).toBe(360);
    expect(parsed.itemQuantities?.backsplash__labor?.quantity).toBe(540);
    expect(parsed.itemQuantities?.paint__allowance?.quantity).toBe(480);
    expect(parsed.itemQuantities?.paint__labor?.quantity).toBe(480);
    const backsplash = resolveQuantityForChecklistItem('backsplash', {
      measurements: norm,
      notes,
      templateKey: 'kitchen',
    });
    expect(backsplash.pricingReady).toBe(true);
    expect(backsplash.dualCount?.quantity).toBe(45);
    expect(backsplash.dualAllowance?.quantity).toBe(900);
    expect(backsplash.dualMaterial?.quantity).toBe(360);
    expect(backsplash.dualLabor?.quantity).toBe(540);
    const paint = resolveQuantityForChecklistItem('paint', {
      measurements: norm,
      notes,
      templateKey: 'kitchen',
    });
    expect(paint.dualCount?.quantity).toBe(320);
    expect(paint.dualAllowance?.quantity).toBe(480);
    expect(paint.dualLabor?.quantity).toBe(480);
    expect(paint.dualMaterial).toBeFalsy();
  });

  test('backsplash material/labor a square foot phrasing: labor is $12 not $8', () => {
    const { extractSqftUnitRates } = require('../scopeRatePricingParser');
    const clause = 'backsplash tile 45 sqft material $8 a square foot Labor $12 a square foot';
    const rates = extractSqftUnitRates(clause);
    expect(rates.materialRate).toBe(8);
    expect(rates.laborRate).toBe(12);

    const notes =
      'Kitchen remodel for Martinez 30339 Cabinets encounters $28,629 includes labor materials appliance install allowance $1200 backsplash tile 45 sqft material $8 a square foot Labor $12 a square foot. paint walls and the ceiling 320 sqft $1.50 square feet Labor. demo old Cabinets and haul off $850';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.itemQuantities?.backsplash__material?.quantity).toBe(360);
    expect(parsed.itemQuantities?.backsplash__labor?.quantity).toBe(540);
    expect(parsed.itemQuantities?.backsplash__allowance?.quantity).toBe(900);
  });

  test('voice-style Martinez notes: a square foot phrasing computes backsplash and paint totals', () => {
    const notes =
      'Kitchen remodel for Martinez 30339 Cabinets encounters $28,629 includes labor materials appliance install allowance $1200 backsplash tile 45 sqft material $8 a square foot Labor $12 a square foot. paint walls and the ceiling 320 sqft $1.50 square feet Labor. demo old Cabinets and haul off $850';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.backsplashSqft).toBe(45);
    expect(parsed.wallPaintSqft).toBe(320);
    expect(parsed.itemQuantities?.backsplash__allowance?.quantity).toBe(900);
    expect(parsed.itemQuantities?.backsplash__material?.quantity).toBe(360);
    expect(parsed.itemQuantities?.backsplash__labor?.quantity).toBe(540);
    expect(parsed.itemQuantities?.paint__allowance?.quantity).toBe(480);
    expect(parsed.itemQuantities?.paint__labor?.quantity).toBe(480);
    expect(parsed.itemQuantities?.paint?.quantity).toBeUndefined();
    expect(parsed.itemQuantities?.demo?.quantity).toBe(850);
    expect(parsed.itemQuantities?.demo?.unit).toBe('lump_sum');

    const norm = normalizeScopeMeasurements(parsed);
    const backsplash = resolveQuantityForChecklistItem('backsplash', {
      templateKey: 'kitchen',
      notes,
      measurements: norm,
    });
    expect(backsplash.dualAllowance?.quantity).toBe(900);
    const paint = resolveQuantityForChecklistItem('paint', {
      templateKey: 'kitchen',
      notes,
      measurements: norm,
    });
    expect(paint.dualAllowance?.quantity).toBe(480);
    const demo = resolveQuantityForChecklistItem('demo', {
      templateKey: 'kitchen',
      notes,
      measurements: norm,
    });
    expect(demo.quantity).toBe(850);
  });

  test('voice-style appliance allowance does not become appliance removal pricing', () => {
    const notes =
      'Kitchen remodel for Martinez 30339 Cabinets encounters $28,629 includes labor materials appliance install allowance $1200 backsplash tile 45 sqft material $8 a square foot Labor $12 a square foot. paint walls and the ceiling 320 sqft $1.50 square feet Labor. demo old Cabinets and haul off $850';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.itemQuantities?.appliances?.quantity).toBe(1200);
    expect(parsed.itemQuantities?.appliance_removal).toBeUndefined();
  });

  test('voice-style bathroom notes compute shower tile rates and floor tile total', () => {
    const notes =
      'OK bathroom remodel we are going to demo the shower and haul off all the trash for $950. The shower wall tile is 120 ft² and the material cost is six dollars a square foot and the labor cost is $14 a square foot. And then the floor tile total will be $810';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'bathroom', projectType: 'bathroom' });
    expect(parsed.bathroomFloorSqft).toBeUndefined();
    expect(parsed.floorAreaSqft).toBeUndefined();
    expect(parsed.showerWallTileSqft).toBe(120);
    expect(parsed.itemQuantities?.demo).toMatchObject({ quantity: 950, unit: 'lump_sum' });
    expect(parsed.itemQuantities?.shower_tile__material).toMatchObject({ quantity: 720, unit: 'allowance' });
    expect(parsed.itemQuantities?.shower_tile__labor).toMatchObject({ quantity: 1680, unit: 'allowance' });
    expect(parsed.itemQuantities?.shower_tile__allowance).toMatchObject({ quantity: 2400, unit: 'allowance' });
    expect(parsed.itemQuantities?.floor_tile).toMatchObject({ quantity: 810, unit: 'allowance' });
    expect(inferItemStateFromNotes('shower_tile', notes)).toBe('included');

    const norm = normalizeScopeMeasurements(parsed);
    const showerTile = resolveQuantityForChecklistItem('shower_tile', {
      templateKey: 'bathroom',
      notes,
      measurements: norm,
    });
    expect(showerTile.dualCount?.quantity).toBe(120);
    expect(showerTile.dualMaterial?.quantity).toBe(720);
    expect(showerTile.dualLabor?.quantity).toBe(1680);
    expect(showerTile.dualAllowance?.quantity).toBe(2400);
    expect(resolveQuantityForChecklistItem('floor_tile', { templateKey: 'bathroom', notes, measurements: norm }).quantity).toBe(810);
  });

  test('rate parser computes directly from item quantity and rates in the same clause', () => {
    const { parseScopeItemRatePricingFromNotes } = require('../scopeRatePricingParser');
    const notes =
      'Custom shower tile 120 sqft material $6/sqft labor $14/sqft; railing 48 linear feet $85 per linear foot; rock 12 tons $95 per ton';
    const parsed = parseScopeItemRatePricingFromNotes(notes, {}, {});

    expect(parsed.shower_tile__material).toMatchObject({ quantity: 720, unit: 'allowance' });
    expect(parsed.shower_tile__labor).toMatchObject({ quantity: 1680, unit: 'allowance' });
    expect(parsed.shower_tile__allowance).toMatchObject({ quantity: 2400, unit: 'allowance' });
    expect(parsed.railing).toMatchObject({ quantity: 4080, unit: 'allowance' });
    expect(parsed.rock_mulch).toMatchObject({ quantity: 1140, unit: 'allowance' });
  });

  test('flooring scope preserves material and labor splits for final estimate apply', () => {
    const notes =
      'Flooring job. Demo existing tile 850 sqft at $3 per sqft. Install LVP 850 sqft material $4.50 per sqft labor $3.25 per sqft. Baseboard 220 linear feet $7 per linear foot.';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'flooring', projectType: 'flooring' });

    expect(parsed.floorAreaSqft).toBe(850);
    expect(parsed.baseboardLf).toBe(220);
    expect(parsed.itemQuantities?.floor_demo).toMatchObject({ quantity: 2550, unit: 'allowance' });
    expect(parsed.itemQuantities?.flooring__material).toMatchObject({ quantity: 3825, unit: 'allowance' });
    expect(parsed.itemQuantities?.flooring__labor).toMatchObject({ quantity: 2762.5, unit: 'allowance' });
    expect(parsed.itemQuantities?.flooring).toMatchObject({ quantity: 6587.5, unit: 'allowance' });
    expect(parsed.itemQuantities?.trim).toMatchObject({ quantity: 1540, unit: 'allowance' });
  });

  test('mixed custom scope keeps shower sqft and does not leak railing LF into baseboard', () => {
    const notes =
      'Custom shower tile 120 ft.² material 6 a square foot Labor is $14 a square foot. Metal railing 48 linear feet $85 per linear foot. 12 tons of rock $95 per ton.';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'room_remodel', projectType: 'room_remodel' });

    expect(parsed.showerWallTileSqft).toBe(120);
    expect(parsed.railingLf).toBe(48);
    expect(parsed.baseboardLf).toBeUndefined();
    expect(parsed.landscapeTons).toBe(12);
    expect(parsed.itemQuantities?.shower_tile__allowance).toMatchObject({ quantity: 2400, unit: 'allowance' });
    expect(parsed.itemQuantities?.railing).toMatchObject({ quantity: 4080, unit: 'allowance' });
    expect(parsed.itemQuantities?.rock_mulch).toMatchObject({ quantity: 1140, unit: 'allowance' });
  });

  test('mixed custom scope accepts ft question-mark sqft shorthand from mobile notes', () => {
    const notes =
      'Custom shower tile 120 ft? material 6 dollars a square foot Labor is $14 a square foot. Metal railing 48 linear feet $85 per linear foot. 12 tons of rock $95 per ton.';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'room_remodel', projectType: 'room_remodel' });

    expect(parsed.showerWallTileSqft).toBe(120);
    expect(parsed.railingLf).toBe(48);
    expect(parsed.baseboardLf).toBeUndefined();
    expect(parsed.landscapeTons).toBe(12);
    expect(parsed.itemQuantities?.shower_tile__material).toMatchObject({ quantity: 720, unit: 'allowance' });
    expect(parsed.itemQuantities?.shower_tile__labor).toMatchObject({ quantity: 1680, unit: 'allowance' });
    expect(parsed.itemQuantities?.shower_tile__allowance).toMatchObject({ quantity: 2400, unit: 'allowance' });
    expect(parsed.itemQuantities?.railing).toMatchObject({ quantity: 4080, unit: 'allowance' });
    expect(parsed.itemQuantities?.rock_mulch).toMatchObject({ quantity: 1140, unit: 'allowance' });
  });

  test('flooring demo install and baseboard voice notes calculate each scope card', () => {
    const notes =
      'Flooring job demo existing tile which is 850 ft.² labor is $3 dollars a square foot for demo next install LVP flooring which is 850 ft.² material is $4.50 a square foot and $3.25 a square foot for Labor. Also we have baseboard installation 220 linear feet with lump sum of $7 dollars per linear foot.';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'flooring', projectType: 'flooring' });

    expect(parsed.floorAreaSqft).toBe(850);
    expect(parsed.baseboardLf).toBe(220);
    expect(parsed.itemQuantities?.floor_demo).toMatchObject({ quantity: 2550, unit: 'allowance' });
    expect(parsed.itemQuantities?.flooring).toMatchObject({ quantity: 6587.5, unit: 'allowance' });
    expect(parsed.itemQuantities?.trim).toMatchObject({ quantity: 1540, unit: 'allowance' });
    expect(parsed.itemQuantities?.demo).toBeUndefined();

    const norm = normalizeScopeMeasurements(parsed);
    expect(
      resolveQuantityForChecklistItem('floor_demo', { templateKey: 'flooring', notes, measurements: norm }).quantity
    ).toBe(2550);
    expect(
      resolveQuantityForChecklistItem('flooring', { templateKey: 'flooring', notes, measurements: norm }).quantity
    ).toBe(6587.5);
    expect(
      resolveQuantityForChecklistItem('trim', { templateKey: 'flooring', notes, measurements: norm }).pricingReady
    ).toBe(true);
  });

  test('rate parser does not treat a dollar rate as the item quantity', () => {
    const { parseScopeItemRatePricingFromNotes } = require('../scopeRatePricingParser');
    const parsed = parseScopeItemRatePricingFromNotes('Paint walls and ceiling $1.50 square feet labor', {}, {});

    expect(parsed.paint).toBeUndefined();
    expect(parsed.paint__allowance).toBeUndefined();
  });

  test('golden roofing scenario calculates squares rates', () => {
    const notes =
      'Roof replacement, tear off 28 squares $80 per square. New shingles install 28 squares $350 per square. Cleanup $600';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'roofing', projectType: 'roofing' });
    expect(parsed.roofSquares).toBe(28);
    expect(parsed.itemQuantities?.tear_off).toMatchObject({ quantity: 2240, unit: 'allowance' });
    expect(parsed.itemQuantities?.shingles_roofing).toMatchObject({ quantity: 9800, unit: 'allowance' });
    expect(parsed.itemQuantities?.cleanup).toMatchObject({ quantity: 600, unit: 'lump_sum' });
  });

  test('golden concrete scenario calculates sqft and CY rates', () => {
    const notes =
      'Concrete patio 400 sqft $12 per sqft. Foundation concrete 18 cy $165 per cy. Demo removal $900';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'concrete', projectType: 'concrete' });
    expect(parsed.concreteSqft).toBe(400);
    expect(parsed.concreteCy).toBe(18);
    expect(parsed.itemQuantities?.concrete).toMatchObject({ quantity: 4800, unit: 'allowance' });
    expect(parsed.itemQuantities?.pour_flatwork).toMatchObject({ quantity: 4800, unit: 'allowance' });
  });

  test('golden deck scenario calculates deck sqft and railing LF rates', () => {
    const notes =
      'Deck build, composite decking 320 sqft $28/sqft, railing 48 linear feet $85 per linear foot, stairs $1200';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'deck_patio', projectType: 'deck_patio' });
    expect(parsed.deckSqft).toBe(320);
    expect(parsed.railingLf).toBe(48);
    expect(parsed.itemQuantities?.decking).toMatchObject({ quantity: 8960, unit: 'allowance' });
    expect(parsed.itemQuantities?.railing).toMatchObject({ quantity: 4080, unit: 'allowance' });
  });

  test('golden landscaping scenario calculates sod, paver, and rock rates', () => {
    const notes =
      'Backyard landscaping: sod 900 sqft $2.25/sqft, pavers 180 sqft $18/sqft, rock 12 tons $95 per ton';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'landscaping', projectType: 'landscaping' });
    expect(parsed.sodSqft).toBe(900);
    expect(parsed.paverSqft).toBe(180);
    expect(parsed.landscapeTons).toBe(12);
    expect(parsed.itemQuantities?.sod_turf).toMatchObject({ quantity: 2025, unit: 'allowance' });
    expect(parsed.itemQuantities?.pavers).toMatchObject({ quantity: 3240, unit: 'allowance' });
    expect(parsed.itemQuantities?.rock_mulch).toMatchObject({ quantity: 1140, unit: 'allowance' });
  });

  test('golden excavation and drywall/painting scenarios calculate trade rates', () => {
    const excavation =
      'Excavation and grading, excavation 45 cy $38 per cy, trenching allowance $1400, haul off $900';
    const excavated = parseScopeMeasurementsFromNotes(excavation, {
      templateKey: 'excavation',
      projectType: 'excavation',
    });
    expect(excavated.excavationCy).toBe(45);
    expect(excavated.itemQuantities?.excavation).toMatchObject({ quantity: 1710, unit: 'allowance' });

    const drywallPaint =
      'Drywall job hang drywall 800 sqft $1.75/sqft, finish drywall 800 sqft $2.25/sqft. Interior paint 1500 sqft labor $1.50/sqft material $0.75/sqft';
    const parsed = parseScopeMeasurementsFromNotes(drywallPaint, { templateKey: 'drywall', projectType: 'drywall' });
    expect(parsed.drywallSqft).toBe(800);
    expect(parsed.wallPaintSqft).toBe(1500);
    expect(parsed.itemQuantities?.hang).toMatchObject({ quantity: 1400, unit: 'allowance' });
    expect(parsed.itemQuantities?.finish_tape).toMatchObject({ quantity: 1800, unit: 'allowance' });
    expect(parsed.itemQuantities?.interior_paint).toMatchObject({ quantity: 3375, unit: 'allowance' });
  });

  test('demo haul-off does not auto-include cleanup scope item', () => {
    const notes = 'Demo old cabinets and haul off $850 lump sum';
    expect(inferItemStateFromNotes('cleanup', notes)).toBe('unsure');
    expect(inferItemStateFromNotes('demo', notes)).toBe('included');
  });

  test('Martinez kitchen: backsplash and paint only — no false kitchen floor', () => {
    const notes = `Kitchen remodel for Martinez - 30339
Cabinets and counters $28,629 includes labor and materials
Appliance install allowance $1,200
Backsplash tile 45 sqft - material $8/sqft, labor $12/sqft
Paint walls/ceiling 320 sqft - $1.50/sqft labor
Demo old cabinets and haul off $850 lump sum`;
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.kitchenFloorSqft).toBeUndefined();
    expect(parsed.backsplashSqft).toBe(45);
    expect(parsed.wallPaintSqft).toBe(320);
  });

  test('parses baseboard LF from notes', () => {
    const notes = 'Floor job Atlanta. Baseboard 500 LF - labor $2.50/lf';
    const parsed = parseScopeMeasurementsFromNotes(notes, { projectType: 'flooring' });
    expect(parsed.baseboardLf).toBe(500);
  });

  test('parses landscaping coverage from notes', () => {
    const notes = 'Backyard landscaping, 1500 sqft sod and 800 sqft pavers';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'landscaping' });
    expect(parsed.landscapeSqft).toBe(1500);
  });

  test('parses roof squares from notes', () => {
    const notes = 'Roof replacement, tear off and install 28 squares shingles';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'roofing' });
    expect(parsed.roofSquares).toBe(28);
  });

  test('converts roof sqft to squares', () => {
    const notes = 'Roofing job 2800 sqft roof area';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'roofing' });
    expect(parsed.roofSquares).toBe(28);
  });
});

describe('trade-specific scope checklists', () => {
  test('routes roofing project to roofing template', () => {
    const draft = { projectType: 'roofing', rooms: [] };
    expect(checklistTemplateKey(draft, 'room_remodel')).toBe('roofing');
    const checklist = buildScopeChecklist(draft, 'room_remodel', '28 square roof replacement');
    expect(checklist.templateKey).toBe('roofing');
    expect(checklist.items.some((i) => i.id === 'shingles_roofing')).toBe(true);
    expect(checklist.suggestedMeasurements?.roofSquares).toBe(28);
  });

  test('routes painting project to painting template', () => {
    const draft = { projectType: 'painting', rooms: [] };
    expect(checklistTemplateKey(draft, 'room_remodel')).toBe('painting');
    expect(CHECKLIST_TEMPLATES.painting.items.some((i) => i.id === 'interior_paint')).toBe(true);
  });

  test('kitchen flooring uses parsed kitchen sqft', () => {
    const measurements = normalizeScopeMeasurements({ kitchenFloorSqft: 220 });
    const q = resolveQuantityForChecklistItem('flooring', { measurements });
    expect(q.quantity).toBe(220);
    expect(q.pricingReady).toBe(true);
  });

  test('adds note-backed custom rows when priced work is outside the active template', () => {
    const draft = { projectType: 'kitchen', rooms: [], originalNotes: '' };
    const notes = 'Kitchen remodel with drywall hang 200 sqft $2/sqft after wall demo';
    const checklist = buildScopeChecklist(draft, 'room_remodel', notes);
    const hang = checklist.items.find((i) => i.id === 'hang');
    expect(hang).toMatchObject({
      label: 'Hang drywall',
      state: 'included',
      noteBacked: true,
    });
    expect(checklist.suggestedMeasurements.itemQuantities.hang).toMatchObject({
      quantity: 400,
      unit: 'allowance',
    });
  });

  test('does not add duplicate interior paint row when kitchen template has paint', () => {
    const draft = { projectType: 'kitchen', rooms: [], originalNotes: '' };
    const notes =
      'Kitchen remodel backsplash tile 45 sqft material $8 a square foot Labor $12 a square foot. paint walls and the ceiling 320 sqft $1.50 square feet Labor.';
    const checklist = buildScopeChecklist(draft, 'room_remodel', notes);
    expect(checklist.items.some((i) => i.id === 'paint')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'interior_paint')).toBe(false);
    expect(checklist.suggestedMeasurements.itemQuantities.backsplash__labor.quantity).toBe(540);
    expect(checklist.suggestedMeasurements.itemQuantities.paint__allowance.quantity).toBe(480);
  });
});
