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
});
