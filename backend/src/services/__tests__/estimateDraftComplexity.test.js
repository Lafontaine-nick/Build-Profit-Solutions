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

  test('classifies single clear unit flooring job as simple_unit', () => {
    const draft = {
      projectType: 'flooring',
      rooms: [{ name: 'LVP Flooring Installation', scope: '1200 sqft LVP flooring installation' }],
    };
    const notes = '1200 sqft LVP flooring installation at $6 per sqft';
    expect(classifyEstimateTier(draft, notes)).toBe('simple_unit');
    expect(isSimpleUnitBid(draft, notes)).toBe(true);
  });

  test('classifies multi-part flooring job as room_remodel for scope confirmation', () => {
    const draft = {
      projectType: 'flooring',
      rooms: [
        { name: 'Tile Demo', scope: '1200 sqft tile demo' },
        { name: 'Tile Installation', scope: '1200 sqft tile install' },
        { name: 'Baseboard Installation', scope: '1200 LF baseboard' },
      ],
    };
    expect(classifyEstimateTier(draft, flooringNotes)).toBe('room_remodel');
    expect(isSimpleUnitBid(draft, flooringNotes)).toBe(false);
    expect(buildScopeChecklist(draft, 'room_remodel', flooringNotes).templateKey).toBe('flooring');
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
    expect(checklist.items.length).toBeGreaterThan(20);
    expect(checklist.title.toLowerCase()).toContain('bathroom');
    expect(checklist.items.some((i) => i.id === 'floor_demo')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'tub_demo')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'shower_floor_demo')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'wet_area_install')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'shower_floor_tile')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'exhaust_fan')).toBe(true);
  });

  test('builds landscaping checklist from project type', () => {
    const draft = { projectType: 'landscaping', rooms: [] };
    const checklist = buildScopeChecklist(draft, 'room_remodel', 'Backyard landscaping with sod and pavers');
    expect(checklist.templateKey).toBe('landscaping');
    expect(checklist.items.some((i) => i.id === 'sod_turf')).toBe(true);
  });

  test('builds dedicated roofing checklist', () => {
    const draft = { projectType: 'roofing', rooms: [] };
    const checklist = buildScopeChecklist(draft, 'room_remodel', 'Roof tear off and 25 squares');
    expect(checklist.templateKey).toBe('roofing');
    expect(checklist.items.some((i) => i.id === 'tear_off')).toBe(true);
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

  test('applyScopeAssumptions does not duplicate existing note-backed railing package', () => {
    const draft = {
      projectType: 'other',
      estimateTier: 'room_remodel',
      originalNotes:
        'Custom shower tile 120 ft? material 6 dollars a square foot Labor is $14 a square foot. Metal railing 48 linear feet $85 per linear foot. 12 tons of rock $95 per ton.',
      scopeChecklist: { templateKey: 'room_remodel' },
      rooms: [
        { name: 'Custom Shower Tile', scope: '120 sqft shower tile', price: 2400, packageStatus: 'calculated' },
        { name: 'Metal Railing', scope: '48 linear feet metal railing', price: 85, packageStatus: 'partial_pricing' },
        { name: 'Rock Supply', scope: '12 tons of rock', price: 95, packageStatus: 'partial_pricing' },
      ],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      { id: 'shower_tile', inputType: 'yes_no', state: 'included', label: 'Shower Tile' },
      { id: 'rock_mulch', inputType: 'yes_no', state: 'included', label: 'Rock / mulch' },
      { id: 'railing', inputType: 'yes_no', state: 'included', label: 'Railing / guardrails' },
    ];

    const next = applyScopeAssumptions(draft, items, {
      showerWallTileSqft: 120,
      railingLf: 48,
      landscapeTons: 12,
      itemQuantities: {
        shower_tile__allowance: { quantity: 2400, unit: 'allowance', quantitySource: 'notes' },
        railing: { quantity: 4080, unit: 'allowance', quantitySource: 'notes' },
        rock_mulch: { quantity: 1140, unit: 'allowance', quantitySource: 'notes' },
      },
    });

    expect((next.rooms || []).filter((r) => /railing/i.test(r.name || ''))).toHaveLength(1);
    expect((next.rooms || []).map((r) => r.name)).toEqual(['Custom Shower Tile', 'Metal Railing', 'Rock Supply']);
    expect(next.rooms.find((r) => r.name === 'Metal Railing')).toMatchObject({
      price: 4080,
      knownSubtotal: 4080,
      status: 'calculated',
    });
    expect(next.rooms.find((r) => r.name === 'Rock Supply')).toMatchObject({
      price: 1140,
      knownSubtotal: 1140,
      status: 'calculated',
    });
  });

  test('applyScopeAssumptions syncs flooring checklist pricing without duplicate demo package', () => {
    const notes =
      'Flooring job demo existing tile which is 850 ft.² labor is $3 dollars a square foot for demo next install LVP flooring which is 850 ft.² material is $4.50 a square foot and $3.25 a square foot for Labor. Also we have baseboard installation 220 linear feet with lump sum of $7 dollars per linear foot.';
    const draft = {
      projectType: 'flooring',
      estimateTier: 'room_remodel',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'flooring' },
      rooms: [
        { name: 'Tile Demo', scope: 'Demo existing tile' },
        {
          name: 'LVP Flooring Installation',
          scope: 'Install LVP flooring',
          price: 6800,
          priceProvidedByUser: false,
          pricedFromSqftAllowances: true,
        },
        { name: 'Baseboard Installation', scope: 'Baseboard installation' },
      ],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      { id: 'floor_demo', inputType: 'yes_no', state: 'included', label: 'Flooring demo / removal' },
      { id: 'flooring', inputType: 'yes_no', state: 'included', label: 'Flooring install' },
      { id: 'trim', inputType: 'yes_no', state: 'included', label: 'Trim & baseboard install' },
    ];

    const next = applyScopeAssumptions(draft, items, {
      floorAreaSqft: 850,
      baseboardLf: 220,
      itemQuantities: {
        floor_demo: { quantity: 2550, unit: 'allowance', quantitySource: 'notes' },
        flooring: { quantity: 6587.5, unit: 'allowance', quantitySource: 'notes' },
        trim: { quantity: 1540, unit: 'allowance', quantitySource: 'notes' },
      },
    });

    expect(next.rooms.map((r) => r.name)).toEqual([
      'Tile Demo',
      'LVP Flooring Installation',
      'Baseboard Installation',
    ]);
    expect(next.rooms.find((r) => r.name === 'Tile Demo')).toMatchObject({ price: 2550 });
    expect(next.rooms.find((r) => r.name === 'LVP Flooring Installation')).toMatchObject({ price: 6587.5 });
    expect(next.rooms.find((r) => r.name === 'Baseboard Installation')).toMatchObject({ price: 1540 });
  });

  test('applyScopeAssumptions adds tub install package with labor and material hints', () => {
    const draft = {
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      originalNotes: 'Tub to shower conversion',
      scopeChecklist: { templateKey: 'bathroom' },
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      {
        id: 'wet_area_install',
        inputType: 'choice',
        choiceId: 'tub',
        state: 'included',
        label: 'Wet area install',
      },
    ];
    const next = applyScopeAssumptions(draft, items);
    const tub = (next.rooms || []).find((r) => /tub installation/i.test(r.name || ''));
    expect(tub).toBeDefined();
    expect(tub.missingPriceItems).toEqual(
      expect.arrayContaining(['Tub / surround materials', 'Tub install labor'])
    );
    expect(tub.scopeQuantities?.[0]).toMatchObject({ quantity: 1, unit: 'each' });
  });

  test('applyScopeAssumptions adds prefab pan package with labor and material hints', () => {
    const draft = {
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      originalNotes: 'New prefab shower pan',
      scopeChecklist: { templateKey: 'bathroom' },
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      {
        id: 'wet_area_install',
        inputType: 'choice',
        choiceId: 'prefab',
        state: 'included',
        label: 'Wet area install',
      },
    ];
    const next = applyScopeAssumptions(draft, items);
    const pan = (next.rooms || []).find((r) => /prefab shower pan/i.test(r.name || ''));
    expect(pan).toBeDefined();
    expect(pan.missingPriceItems).toEqual(
      expect.arrayContaining(['Prefab pan / base materials', 'Shower pan install labor'])
    );
  });
});
