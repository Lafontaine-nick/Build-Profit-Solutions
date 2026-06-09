const { parseScopeMeasurementsFromNotes } = require('../scopeMeasurementParser');
const { checklistTemplateKey, CHECKLIST_TEMPLATES } = require('../scopeChecklistLibrary');
const { buildScopeChecklist } = require('../estimateDraftComplexity');
const { resolveQuantityForChecklistItem, normalizeScopeMeasurements } = require('../scopeItemQuantityCatalog');

describe('scopeMeasurementParser', () => {
  test('parses kitchen floor and backsplash from notes', () => {
    const notes = 'Kitchen remodel, 220 sqft kitchen floor, 45 sqft backsplash tile';
    const parsed = parseScopeMeasurementsFromNotes(notes, { templateKey: 'kitchen', projectType: 'kitchen' });
    expect(parsed.kitchenFloorSqft).toBe(220);
    expect(parsed.backsplashSqft).toBe(45);
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
