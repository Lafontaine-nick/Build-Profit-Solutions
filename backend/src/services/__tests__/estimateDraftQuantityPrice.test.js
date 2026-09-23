const { normalizeDraft } = require('../estimateDraftFromNotes');
const {
  extractPricingItemsFromText,
  buildScopePackage,
} = require('../estimateDraftPartialPricing');
const {
  amountAppearsAsQuantityInText,
  labeledPriceMatchIsValid,
  extractScopeQuantitiesForPackage,
  classifyScopeFromNotes,
  inferProjectTypeFromNotes,
} = require('../estimateDraftQuantityPrice');
const {
  expandJobScopeRooms,
  detectScopeTasksFromNotes,
} = require('../estimateDraftScopeSplit');
const { resolvePackageTrade } = require('../estimateDraftPartialPricing');
const classificationFixtures = require('../../../../test-fixtures/scopeClassificationFixtures.json');

const FLOOR_NOTES =
  "OK, let's create a bid. I have a floor job. I have 1200 ft.² of tile demo. I have 1200 ft.² of laminate flooring installation and 500 linear feet of baseboard installation, caulk and paint";

describe('quantity vs price parsing', () => {
  test.each(classificationFixtures)(
    'classifies shared fixture $id without conflating project type and trades',
    (fixture) => {
      const result = classifyScopeFromNotes(
        fixture.notes,
        fixture.hintProjectType
      );
      expect(result.scopeMode).toBe(fixture.expected.scopeMode);
      expect(result.projectType).toBe(fixture.expected.projectType);
      expect(result.detectedTrades).toEqual(fixture.expected.detectedTrades);
    }
  );

  test('resolves package trade from package text instead of project type', () => {
    expect(resolvePackageTrade('flooring', 'Framing and Exterior Enclosure')).toBe(
      'framing'
    );
    expect(resolvePackageTrade('flooring', 'Install 1200 sqft LVP flooring')).toBe(
      'flooring'
    );
    expect(resolvePackageTrade('flooring', 'Hang and finish drywall')).toBe(
      'drywall'
    );
  });

  test('classifies dedicated interior repaint notes as painting despite excluded kitchen cabinets', () => {
    const projectType = inferProjectTypeFromNotes(
      'Interior repaint throughout a 2-story home. Kitchen cabinets, closets, and exterior surfaces are excluded.'
    );

    expect(projectType).toBe('painting');
  });

  test('classifies stucco repair notes as dedicated stucco and ignores excluded structural and paint work', () => {
    const notes =
      'Repair and install stucco on designated exterior wall areas. Protect adjacent surfaces, remove loose or damaged stucco, prepare the substrate, repair minor cracks, apply scratch and brown coats, and install a matching finish texture and color. Seal applicable joints and penetrations, remove debris, and leave the work area clean. Assumes accessible, serviceable substrate; excludes structural framing, extensive sheathing or moisture damage, major waterproofing, painting beyond the stucco finish, and hazardous-material remediation.';
    const result = classifyScopeFromNotes(notes, 'other');

    expect(result.projectType).toBe('stucco');
    expect(result.scopeMode).toBe('dedicated');
    expect(result.detectedTrades).toEqual(['stucco']);
    expect(result.scopeTradeLabels).toEqual(['Stucco / exterior finish']);
    expect(result.exclusions).toEqual(
      expect.arrayContaining(['Framing', 'Painting'])
    );

    const draft = normalizeDraft(
      { projectType: 'other', rooms: [] },
      { originalNotes: notes }
    );
    expect(draft.projectType).toBe('stucco');
    expect(draft.detectedTrades).toEqual(['stucco']);
  });

  test('does not detect excluded electrical service upgrades as an active trade', () => {
    const result = classifyScopeFromNotes(
      'Replace the existing HVAC system and ductwork, then install a new HVAC system with thermostat, supply registers, return grilles, startup, and testing. System count, tonnage, and ductwork length must be confirmed. Excludes plumbing, electrical service upgrades, and building repairs.',
      'hvac'
    );

    expect(result.detectedTrades).toEqual(['hvac']);
    expect(result.projectType).toBe('hvac');
    expect(result.primaryTrade).toBe('hvac');
    expect(result.exclusions).toEqual(
      expect.arrayContaining(['Electrical'])
    );
  });

  test('extractPricingItemsFromText does not treat 1200 sqft as dollars', () => {
    const items = extractPricingItemsFromText(FLOOR_NOTES);
    const amounts = items.map((i) => i.amount).filter(Boolean);
    expect(amounts).not.toContain(1200);
    expect(amounts).not.toContain(500);
    expect(items.length).toBe(0);
  });

  test('still extracts explicit dollar amounts', () => {
    const items = extractPricingItemsFromText('Countertops $5,000 and cabinets $8,000');
    const total = items.reduce((s, i) => s + (i.amount || 0), 0);
    expect(total).toBe(13000);
  });

  test('normalizeDraft: scope-only floor job has no known subtotal', () => {
    const draft = normalizeDraft(
      {
        projectType: 'bathroom',
        projectTitle: 'Floor job',
        rooms: [
          {
            name: 'Flooring',
            scope: '1200 sqft tile demo and 1200 sqft laminate install',
            price: 4100,
            pricingItems: [
              { name: 'I have', amount: 1200, status: 'confirmed' },
              { name: 'caulk and paint Demo', amount: 1200, status: 'confirmed' },
            ],
            missingPriceItems: ['Tile demo', 'Laminate flooring installation'],
          },
          {
            name: 'Baseboard',
            scope: '500 linear feet baseboard installation',
            price: 2200,
            pricingItems: [{ name: 'Install', amount: 500, status: 'confirmed' }],
          },
        ],
        allowances: [],
      },
      { originalNotes: FLOOR_NOTES }
    );

    expect(draft.projectType).toBe('flooring');
    expect(draft.knownSubtotal || 0).toBe(0);
    expect(draft.calculatedLineItemTotal || 0).toBe(0);
    expect(draft.scopePackages.every((p) => p.status === 'missing_price' || (p.knownSubtotal || 0) === 0)).toBe(
      true
    );
    expect(draft.whatAiDid.some((l) => /no material or labor rates/i.test(l))).toBe(true);
    expect(draft.estimateConfidence.level).toMatch(/low|medium/);
  });

  test('buildScopePackage assigns quantities per package not global blob', () => {
    const notes =
      'Floor remodel. 1200 sqft tile demo. 1200 sqft laminate flooring installation. 500 linear feet baseboard installation, prep and paint.';
    const tile = buildScopePackage(
      { name: 'Tile Demo', scope: 'Demolition of 1200 square feet of existing tile.', price: null, pricingItems: [] },
      { projectType: 'flooring' },
      notes
    );
    const laminate = buildScopePackage(
      {
        name: 'Laminate Flooring Installation',
        scope: 'Installation of 1200 square feet of laminate flooring.',
        price: null,
        pricingItems: [],
      },
      { projectType: 'flooring' },
      notes
    );
    const baseboard = buildScopePackage(
      {
        name: 'Baseboard Installation',
        scope: 'Install 500 linear feet of baseboard, prep and paint.',
        price: null,
        pricingItems: [],
      },
      { projectType: 'flooring' },
      notes
    );
    expect(tile.scopeQuantities).toEqual([
      { label: 'Tile Demo', quantity: 1200, unit: 'sqft', quantitySource: 'notes' },
    ]);
    expect(laminate.scopeQuantities).toEqual([
      {
        label: 'Laminate Flooring Installation',
        quantity: 1200,
        unit: 'sqft',
        quantitySource: 'notes',
      },
    ]);
    expect(baseboard.scopeQuantities).toEqual([
      { label: 'Baseboard Installation', quantity: 500, unit: 'lf', quantitySource: 'notes' },
    ]);
    expect(tile.knownSubtotal).toBeNull();
    expect(tile.status).toBe('missing_price');
  });

  test('run-on flooring note: tile removal, tile install, 1000 lf baseboard', () => {
    const notes =
      "Let's create a flooring bid 1200 ft.² of tile removal in 1200 ft.² of tile installation 1000 linear feet of baseboard installation prep and paint";

    const removal = extractScopeQuantitiesForPackage('Tile Removal', '', notes);
    const install = extractScopeQuantitiesForPackage('Tile Installation', '', notes);
    const baseboard = extractScopeQuantitiesForPackage('Baseboard Installation', '', notes);

    expect(removal).toEqual([{ label: 'Tile Removal', quantity: 1200, unit: 'sqft' }]);
    expect(install).toEqual([{ label: 'Tile Installation', quantity: 1200, unit: 'sqft' }]);
    expect(baseboard).toEqual([{ label: 'Baseboard Installation', quantity: 1000, unit: 'lf' }]);

    const aiRooms = [
      { name: 'Tile Demo', scope: 'demo', price: null },
      { name: 'Tile Installation', scope: 'install', price: null },
      { name: 'Interior Painting', scope: '500 lf paint', price: null },
    ];
    const expanded = expandJobScopeRooms(aiRooms, notes, { aggressive: false });
    expect(expanded.map((r) => r.name)).toEqual([
      'Tile Removal',
      'Tile Installation',
      'Baseboard Installation',
    ]);
    expect(detectScopeTasksFromNotes(notes).map((t) => t.id)).toEqual([
      'tile_demo',
      'tile_install',
      'baseboard_install',
    ]);
  });
});
