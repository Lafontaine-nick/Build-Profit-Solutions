const {
  classifyEstimateTier,
  isSimpleUnitBid,
  buildScopeChecklist,
  applyScopeAssumptions,
  applyScopeMeasurements,
} = require('../estimateDraftComplexity');

describe('estimateDraftComplexity', () => {
  const flooringNotes =
    '1200 sqft tile demo, 1200 sqft tile installation, 1200 LF baseboard install';

  test('classifies clear unit flooring job as simple_unit', () => {
    const draft = {
      projectType: 'flooring',
      rooms: [
        { name: 'Tile Demo', scope: '1200 sqft tile demo' },
        { name: 'Tile Installation', scope: '1200 sqft tile install' },
        { name: 'Baseboard Installation', scope: '1200 LF baseboard' },
      ],
    };
    expect(classifyEstimateTier(draft, flooringNotes)).toBe('simple_unit');
    expect(isSimpleUnitBid(draft, flooringNotes)).toBe(true);
  });

  test('classifies bathroom remodel as room_remodel', () => {
    const notes = 'Full bathroom remodel, new shower tile, move toilet, quartz vanity';
    const draft = { projectType: 'bathroom', rooms: [{ name: 'Master Bath', scope: notes }] };
    expect(classifyEstimateTier(draft, notes)).toBe('room_remodel');
  });

  test('classifies new build as ground_up', () => {
    const notes = 'Build 1869 sqft semi-custom home in Lehi';
    const draft = { projectType: 'new_build', rooms: [] };
    expect(classifyEstimateTier(draft, notes)).toBe('ground_up');
  });

  test('builds bathroom checklist for remodel', () => {
    const draft = { projectType: 'bathroom', rooms: [] };
    const checklist = buildScopeChecklist(draft, 'room_remodel', 'bathroom remodel');
    expect(checklist).not.toBeNull();
    expect(checklist.items.length).toBeGreaterThan(10);
    expect(checklist.title.toLowerCase()).toContain('bathroom');
  });

  test('applyScopeAssumptions merges inclusions and exclusions', () => {
    const draft = {
      projectType: 'bathroom',
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      { id: 'demo', label: 'Demo / tear-out of existing bathroom', inputType: 'yes_no', state: 'included' },
      { id: 'permits', label: 'Permits & inspections', inputType: 'yes_no', state: 'excluded' },
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        choiceId: 'replacing',
        state: 'included',
        options: [{ id: 'replacing', label: 'Replacing' }],
      },
    ];
    const next = applyScopeAssumptions(draft, items);
    expect(next.scopeAssumptionsConfirmed).toBe(true);
    expect(next.inclusions.some((l) => l.includes('Demo'))).toBe(true);
    expect(next.inclusions.some((l) => l.includes('Toilet: Replacing'))).toBe(true);
    expect(next.exclusions.some((l) => l.includes('Permits'))).toBe(true);
  });

  test('applyScopeMeasurements stamps sqft and lf on matching scope packages', () => {
    const draft = {
      projectType: 'bathroom',
      originalNotes: 'Full bathroom remodel',
      scopePackages: [
        { name: 'Floor Tile Installation', scope: 'Bathroom floor tile', scopeQuantities: [] },
        { name: 'Shower Tile Installation', scope: 'New shower wall tile', scopeQuantities: [] },
        { name: 'Baseboard Installation', scope: 'New baseboard trim', scopeQuantities: [] },
        { name: 'Toilet Installation', scope: 'Replace toilet', scopeQuantities: [] },
        { name: 'Electrical Work (Bathroom)', scope: 'New circuits', scopeQuantities: [] },
      ],
    };
    const next = applyScopeMeasurements(draft, { sqft: 90, lf: 24, showerWallTileSqft: 88 });
    expect(next.scopeMeasurements.bathroomFloorSqft).toBe(90);
    expect(next.scopeMeasurements.baseboardLf).toBe(24);
    expect(next.scopePackages[0].scopeQuantities[0]).toMatchObject({ quantity: 90, unit: 'sqft' });
    expect(next.scopePackages[1].scopeQuantities[0]).toMatchObject({ quantity: 88, unit: 'sqft' });
    expect(next.scopePackages[2].scopeQuantities[0]).toMatchObject({ quantity: 24, unit: 'lf' });
    expect(next.scopePackages[3].scopeQuantities[0]).toMatchObject({ quantity: 1, unit: 'each' });
    expect(next.scopePackages[4].scopeQuantities || []).toHaveLength(0);
    expect(next.originalNotes).toContain('90 sqft bathroom floor');
    expect(next.originalNotes).toContain('24 lf baseboard');
  });

  test('applyScopeAssumptions adds Bathroom Demo when demo is confirmed in checklist', () => {
    const draft = {
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      originalNotes: 'Full bathroom remodel, new shower tile, vanity, toilet, paint',
      scopeChecklist: { templateKey: 'bathroom' },
      rooms: [
        { name: 'Shower Tile Installation', scope: 'New shower tile' },
        { name: 'Vanity Installation', scope: 'New vanity' },
        { name: 'Toilet Installation', scope: 'Replace toilet' },
        { name: 'Interior Painting', scope: 'Paint walls' },
      ],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      {
        id: 'demo',
        inputType: 'yes_no',
        state: 'included',
        label: 'Demo / tear-out of existing bathroom',
      },
      { id: 'shower_tile', inputType: 'yes_no', state: 'included', label: 'Shower wall tile' },
    ];
    const next = applyScopeAssumptions(draft, items, { sqft: 90 });
    const demo = (next.rooms || []).find((r) => /bathroom demo/i.test(r.name || ''));
    expect(demo).toBeDefined();
    expect(demo.scopeQuantities?.[0]).toMatchObject({ quantity: 90, unit: 'sqft' });
  });
});
