const {
  classifyEstimateTier,
  isSimpleUnitBid,
  buildScopeChecklist,
  applyScopeAssumptions,
  applyScopeMeasurements,
  enrichDraftComplexity,
} = require('../estimateDraftComplexity');
const { buildScopePackage, syncRoomsFromScopePackages } = require('../estimateDraftPartialPricing');

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

  test('applying flooring checklist keeps combined notes material/labor total intact', () => {
    const notes =
      'Flooring job: demo existing tile 850 sqft labor $3/sqft. Install 850 sqft LVP material $4.50/sqft labor $3.25/sqft. Baseboards 220 LF at $7/LF.';
    const draft = {
      projectType: 'flooring',
      estimateTier: 'room_remodel',
      originalNotes: notes,
      rooms: [
        {
          name: 'Flooring',
          scope: 'Demo existing tile and install LVP flooring',
          price: 9138,
          knownSubtotal: 9138,
          calculatedSubtotal: 9138,
          laborPrice: 5313,
          materialPrice: 3825,
          priceSource: 'calculated',
          status: 'calculated',
          priceProvidedByUser: false,
          scopeQuantities: [{ label: 'Flooring', quantity: 850, unit: 'sqft', quantitySource: 'notes' }],
        },
        {
          name: 'Baseboards',
          scope: 'Install baseboards',
          price: null,
          priceSource: 'missing',
          status: 'partial_pricing',
          scopeQuantities: [{ label: 'Baseboards', quantity: 220, unit: 'lf', quantitySource: 'notes' }],
        },
      ],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const checklist = buildScopeChecklist(draft, 'room_remodel', notes);
    const confirmed = checklist.items.filter((item) => ['floor_demo', 'flooring', 'trim'].includes(item.id));
    const next = applyScopeAssumptions({ ...draft, scopeChecklist: checklist }, confirmed, checklist.suggestedMeasurements);

    const flooring = next.rooms.find((room) => room.name === 'Flooring');
    expect(flooring.price).toBe(9138);
    expect(flooring.laborPrice).toBe(5313);
    expect(flooring.materialPrice).toBe(3825);
    expect(flooring.scopeQuantities).toEqual([
      expect.objectContaining({ quantity: 850, unit: 'sqft', quantitySource: 'notes' }),
    ]);
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

  test('classifies room additions and home additions as addition tier', () => {
    const cases = [
      {
        projectType: 'room_addition',
        notes: 'Add a 240 sqft bedroom addition with foundation, framing, electrical, insulation, drywall, and paint.',
      },
      {
        projectType: 'home_addition',
        notes: 'Home addition with new family room, bathroom tie-in, HVAC extension, roofing tie-in, and finishes.',
      },
      {
        projectType: 'adu',
        notes: 'Build a detached ADU casita with kitchenette, bathroom, utility trenching, foundation, framing, and roofing.',
      },
      {
        projectType: 'garage_conversion',
        notes: 'Garage conversion into living space with insulation, drywall, electrical, HVAC, and flooring.',
      },
    ];

    for (const { projectType, notes } of cases) {
      const draft = { projectType, rooms: [] };
      expect(classifyEstimateTier(draft, notes)).toBe('addition');
      expect(isSimpleUnitBid(draft, notes)).toBe(false);
      const checklist = buildScopeChecklist(draft, 'addition', notes);
      expect(checklist.templateKey).toBe('addition');
      expect(checklist.items.some((i) => i.id === 'foundation')).toBe(true);
      expect(checklist.items.some((i) => i.id === 'framing')).toBe(true);
      expect(checklist.items.some((i) => i.id === 'contingency')).toBe(true);
    }
  });

  test('classifies notes-only addition language as addition tier', () => {
    const notes = 'Room addition: add 320 sqft office with slab foundation, framing, roof tie-in, electrical, drywall and paint.';
    const draft = { projectType: 'other', rooms: [] };
    expect(classifyEstimateTier(draft, notes)).toBe('addition');
    const checklist = buildScopeChecklist(draft, 'addition', notes);
    expect(checklist.templateKey).toBe('addition');
    expect(checklist.title.toLowerCase()).toContain('addition');
    expect(checklist.items.some((i) => i.id === 'roof_tie_in')).toBe(true);
  });

  test('classifies notes-only ground-up language as ground_up tier', () => {
    const notes = 'Ground up build for a 1850 sqft custom home with sitework, foundation, framing, roofing, MEP, drywall and finishes.';
    const draft = { projectType: 'other', rooms: [] };
    expect(classifyEstimateTier(draft, notes)).toBe('ground_up');
    const checklist = buildScopeChecklist(draft, 'ground_up', notes);
    expect(checklist.templateKey).toBe('ground_up');
    expect(checklist.items.some((i) => i.id === 'sitework')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'foundation')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'overhead_profit')).toBe(false);
    expect(checklist.items.some((i) => i.id === 'contingency')).toBe(true);
  });

  test('classifies Step 1 plan-import handoff notes as ground_up (not room_remodel)', () => {
    const notes =
      'Ground-up new construction plan imported and ready to generate. 3,098 SF · 9 detected spaces · 18 scope items.';
    const draft = { projectType: 'other', rooms: [] };
    expect(classifyEstimateTier(draft, notes)).toBe('ground_up');
    const checklist = buildScopeChecklist(draft, 'ground_up', notes);
    expect(checklist.templateKey).toBe('ground_up');
    expect(checklist.items.some((i) => i.id === 'excavation')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'pour_flatwork')).toBe(true);
    expect(checklist.items.some((i) => i.id === 'demo')).toBe(false);
    expect(checklist.items.find((i) => i.id === 'framing')?.label).toBe('Framing');
  });

  test('defaults ground-up plans and permits to Yes even when notes omit permit language', () => {
    const notes = 'New custom home with architectural plans, foundation, framing, and finishes.';
    const checklist = buildScopeChecklist({ projectType: 'other', rooms: [] }, 'ground_up', notes);
    expect(checklist.items.find((i) => i.id === 'plans_engineering')?.state).toBe('included');
    expect(checklist.items.find((i) => i.id === 'permits')?.state).toBe('included');
  });

  test('keeps ground-up permits excluded when notes say owner pulls permits', () => {
    const notes = 'New home build. Owner pulls permits. Architectural plans included.';
    const checklist = buildScopeChecklist({ projectType: 'other', rooms: [] }, 'ground_up', notes);
    expect(checklist.items.find((i) => i.id === 'permits')?.state).toBe('excluded');
    expect(checklist.items.find((i) => i.id === 'plans_engineering')?.state).toBe('included');
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

  test('plumbing trim in bathroom notes does not auto-include trim & baseboard scope', () => {
    const notes =
      'Bathroom remodel. Tile shower walls, new shower pan, move rough plumbing, shower door, final plumbing trim with new fixtures.';
    const checklist = buildScopeChecklist({ projectType: 'bathroom', rooms: [] }, 'room_remodel', notes);
    expect(checklist.items.find((i) => i.id === 'plumbing_trim')?.state).toBe('included');
    expect(checklist.items.find((i) => i.id === 'trim')?.state).toBe('unsure');
  });

  test('bathroom checklist includes toilet even when notes omit it', () => {
    const notes = 'Tile shower walls, waterproofing, and glass shower door.';
    const checklist = buildScopeChecklist({ projectType: 'bathroom', rooms: [] }, 'room_remodel', notes);
    const toilet = checklist.items.find((i) => i.id === 'toilet');
    expect(toilet).toBeTruthy();
    expect(toilet.inputType).toBe('choice');
    expect(toilet.state).toBe('unsure');
  });

  test('baseboard language still includes trim scope', () => {
    const notes = 'Install LVP and baseboards throughout 220 LF.';
    const checklist = buildScopeChecklist({ projectType: 'flooring', rooms: [] }, 'room_remodel', notes);
    expect(checklist.items.find((i) => i.id === 'trim')?.state).toBe('included');
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

  test('applyScopeAssumptions turns confirmed addition phases into missing-price review packages', () => {
    const notes =
      'Room addition: add 240 sqft bedroom addition with slab foundation, framing, roof tie-in, electrical, insulation, drywall, flooring, and paint.';
    const draft = {
      projectType: 'room_addition',
      estimateTier: 'addition',
      originalNotes: notes,
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const checklist = buildScopeChecklist(draft, 'addition', notes);
    const confirmed = checklist.items
      .filter((item) =>
        ['plans_engineering', 'permits', 'foundation', 'framing', 'roof_tie_in', 'electrical_rough', 'drywall', 'flooring', 'paint', 'cleanup'].includes(
          item.id
        )
      )
      .map((item) => ({ ...item, state: 'included' }));

    const next = applyScopeAssumptions({ ...draft, scopeChecklist: checklist }, confirmed, {
      drywallSqft: 900,
      floorAreaSqft: 240,
      wallPaintSqft: 750,
    });

    const packageNames = (next.rooms || []).map((room) => room.name);
    expect(packageNames).toEqual(
      expect.arrayContaining([
        'Plans / engineering',
        'Permits / fees',
        'Footings / slab / foundation',
        'Framing / shell',
        'Roofing / tie-in',
        'Rough electrical',
        'Drywall',
        'Flooring',
        'Paint',
        'Cleanup & disposal',
      ])
    );
    expect(next.rooms.every((room) => room.status === 'missing_price')).toBe(true);
    expect(next.rooms.every((room) => room.priceSource === 'missing')).toBe(true);
    expect(next.rooms.every((room) => room.applyEligible === false)).toBe(true);
    expect(next.rooms.find((room) => room.name === 'Plans / engineering').missingPriceItems).toEqual(
      expect.arrayContaining(['Materials / supplies', 'Install labor'])
    );
    expect(next.scopeAssumptionsConfirmed).toBe(true);
    expect(next.pricingWarnings).toEqual(expect.arrayContaining(['Complex job — pricing applies only to confirmed scope']));
  });

  test('ADU casita notes preselect addition phases and create phase-based review packages', () => {
    const notes =
      'Detached ADU casita with bathroom and kitchenette: plans, permits, utility trenching for water and sewer, slab foundation, framing, roofing, windows and doors, rough plumbing, electrical, mini split HVAC, insulation, drywall, cabinets, countertops, appliance allowance, plumbing fixtures, lighting, flooring, paint, final inspection, cleanup, and contingency.';
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: notes,
      rooms: [
        {
          name: 'Plumbing (Bathroom)',
          scope: 'LLM starter row that should be replaced by confirmed phases',
          status: 'missing_price',
          priceSource: 'missing',
        },
        {
          name: 'Interior Painting',
          scope: 'LLM starter row that should be replaced by confirmed phases',
          status: 'missing_price',
          priceSource: 'missing',
        },
      ],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };

    const checklist = buildScopeChecklist(draft, 'addition', notes);
    expect(checklist.templateKey).toBe('addition');
    expect(checklist.items.filter((item) => item.state === 'included').map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'plans_engineering',
        'permits',
        'utility_trenching',
        'foundation',
        'framing',
        'roof_tie_in',
        'windows_doors',
        'plumbing_rough',
        'electrical_rough',
        'hvac',
        'insulation',
        'drywall',
        'cabinets_counters',
        'plumbing_trim',
        'electrical_trim',
        'appliances',
        'flooring',
        'paint',
        'final_inspections',
        'cleanup',
        'contingency',
      ])
    );

    const confirmed = checklist.items.filter((item) => item.state === 'included');
    const next = applyScopeAssumptions({ ...draft, scopeChecklist: checklist }, confirmed, {
      floorAreaSqft: 650,
      drywallSqft: 2200,
      wallPaintSqft: 1800,
    });

    const packageNames = (next.rooms || []).map((room) => room.name);
    expect(packageNames).toEqual(
      expect.arrayContaining([
        'Plans / engineering',
        'Permits / fees',
        'Utility trenching',
        'Footings / slab / foundation',
        'Framing / shell',
        'Roofing / tie-in',
        'Windows & exterior doors',
        'Rough plumbing',
        'Rough electrical',
        'HVAC',
        'Insulation',
        'Drywall',
        'Cabinets & counters',
        'Plumbing fixtures / trim-out',
        'Electrical devices / fixtures',
        'Appliance install',
        'Flooring',
        'Paint',
        'Final inspections',
        'Cleanup & disposal',
        'Contingency allowance',
      ])
    );
    expect(packageNames.some((name) => /bathroom demo|kitchen remodel|lvp flooring installation|plumbing \(bathroom\)|interior painting/i.test(name))).toBe(false);
    expect(next.rooms.every((room) => room.status === 'missing_price')).toBe(true);
    expect(next.rooms.every((room) => room.applyEligible === false)).toBe(true);
  });

  test('garage conversion notes include interior conversion phases without foundation or roof work', () => {
    const notes =
      'Garage conversion into bedroom suite: permits, frame closet and non-bearing wall, add egress window and exterior door, electrical wiring and outlets, mini split HVAC, insulation, drywall, LVP flooring, paint, baseboards, final inspection, and cleanup. No foundation or roof work included.';
    const draft = {
      projectType: 'garage_conversion',
      estimateTier: 'addition',
      originalNotes: notes,
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };

    const checklist = buildScopeChecklist(draft, 'addition', notes);
    const includedIds = checklist.items.filter((item) => item.state === 'included').map((item) => item.id);
    const excludedIds = checklist.items.filter((item) => item.state === 'excluded').map((item) => item.id);

    expect(includedIds).toEqual(
      expect.arrayContaining([
        'permits',
        'framing',
        'windows_doors',
        'electrical_rough',
        'hvac',
        'insulation',
        'drywall',
        'flooring',
        'paint',
        'interior_trim',
        'final_inspections',
        'cleanup',
      ])
    );
    expect(excludedIds).toEqual(expect.arrayContaining(['foundation', 'roof_tie_in']));

    const confirmed = checklist.items.filter((item) => item.state === 'included');
    const next = applyScopeAssumptions({ ...draft, scopeChecklist: checklist }, confirmed, {
      floorAreaSqft: 430,
      drywallSqft: 1500,
      wallPaintSqft: 1200,
    });

    const packageNames = (next.rooms || []).map((room) => room.name);
    expect(packageNames).toEqual(
      expect.arrayContaining([
        'Permits / fees',
        'Framing / shell',
        'Windows & exterior doors',
        'Rough electrical',
        'HVAC',
        'Insulation',
        'Drywall',
        'Flooring',
        'Paint',
        'Interior doors / trim',
        'Final inspections',
        'Cleanup & disposal',
      ])
    );
    expect(packageNames).not.toEqual(
      expect.arrayContaining(['Footings / slab / foundation', 'Roofing / tie-in'])
    );
    expect(packageNames.some((name) => /bathroom|kitchen|lvp flooring installation/i.test(name))).toBe(false);
    expect(next.rooms.every((room) => room.status === 'missing_price')).toBe(true);
    expect(next.rooms.every((room) => room.applyEligible === false)).toBe(true);
  });

  test('basement finish stays room_remodel and creates generic multi-trade phase packages', () => {
    const notes =
      'Basement finish with framing, rough plumbing for bathroom, electrical wiring and outlets, HVAC duct runs, drywall hang and finish, LVP flooring, paint, trim and doors, permits, and cleanup.';
    const draft = {
      projectType: 'other',
      originalNotes: notes,
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };

    expect(classifyEstimateTier(draft, notes)).toBe('room_remodel');
    const checklist = buildScopeChecklist(draft, 'room_remodel', notes);
    expect(checklist.templateKey).toBe('room_remodel');

    const includedIds = checklist.items.filter((item) => item.state === 'included').map((item) => item.id);
    expect(includedIds).toEqual(
      expect.arrayContaining([
        'framing',
        'plumbing',
        'electrical',
        'hvac',
        'drywall',
        'flooring',
        'paint',
        'trim',
        'permits',
        'cleanup',
      ])
    );

    const confirmed = checklist.items.filter((item) => item.state === 'included');
    const next = applyScopeAssumptions(
      { ...draft, estimateTier: 'room_remodel', scopeChecklist: checklist },
      confirmed,
      {
        floorAreaSqft: 900,
        drywallSqft: 3200,
        wallPaintSqft: 2600,
        baseboardLf: 420,
      }
    );

    const packageNames = (next.rooms || []).map((room) => room.name);
    expect(packageNames).toEqual(
      expect.arrayContaining([
        'Framing or layout changes',
        'Plumbing work',
        'Electrical work',
        'HVAC work',
        'Drywall hang / finish',
        'Flooring install',
        'Interior painting',
        'Trim & doors',
        'Permits & inspections',
        'Cleanup, haul-off & disposal',
      ])
    );
    expect(packageNames.some((name) => /bathroom demo|kitchen remodel|lvp flooring installation/i.test(name))).toBe(false);
    expect(next.rooms.every((room) => room.status === 'missing_price')).toBe(true);
    expect(next.rooms.every((room) => room.applyEligible === false)).toBe(true);
    expect(next.pricingWarnings).toEqual(expect.arrayContaining(['Complex job — pricing applies only to confirmed scope']));
  });

  test('mixed repair restoration stays room_remodel and does not collapse to flooring template', () => {
    const notes =
      'Insurance restoration mixed repair: drywall patch in hallway, paint walls, replace 80 LF baseboards, replace two interior doors, repair small LVP flooring area, and cleanup.';
    const draft = {
      projectType: 'other',
      originalNotes: notes,
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };

    expect(classifyEstimateTier(draft, notes)).toBe('room_remodel');
    const checklist = buildScopeChecklist(draft, 'room_remodel', notes);
    expect(checklist.templateKey).toBe('room_remodel');

    const includedIds = checklist.items.filter((item) => item.state === 'included').map((item) => item.id);
    expect(includedIds).toEqual(
      expect.arrayContaining(['drywall', 'flooring', 'paint', 'trim', 'cleanup'])
    );

    const confirmed = checklist.items.filter((item) => item.state === 'included');
    const next = applyScopeAssumptions(
      { ...draft, estimateTier: 'room_remodel', scopeChecklist: checklist },
      confirmed,
      {
        drywallSqft: 180,
        floorAreaSqft: 120,
        wallPaintSqft: 900,
        baseboardLf: 80,
      }
    );

    const packageNames = (next.rooms || []).map((room) => room.name);
    expect(packageNames).toEqual(
      expect.arrayContaining([
        'Drywall hang / finish',
        'Flooring install',
        'Interior painting',
        'Trim & doors',
        'Cleanup, haul-off & disposal',
      ])
    );
    expect(packageNames).not.toEqual(
      expect.arrayContaining(['Flooring Demo / Removal', 'LVP Flooring Installation', 'Baseboard Installation'])
    );
    expect(next.rooms.every((room) => room.status === 'missing_price')).toBe(true);
    expect(next.rooms.every((room) => room.applyEligible === false)).toBe(true);
  });

  test('applyScopeAssumptions keeps ground-up build as phase-based missing-price packages', () => {
    const notes =
      'Ground up build for a 1850 sqft custom home with plans, permits, sitework, foundation, framing, roofing, MEP rough-in, drywall, cabinets, flooring, paint, appliances, utility taps, and contingency.';
    const draft = {
      projectType: 'new_build',
      estimateTier: 'ground_up',
      originalNotes: notes,
      rooms: [],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const checklist = buildScopeChecklist(draft, 'ground_up', notes);
    expect(checklist.items.some((i) => i.id === 'overhead_profit')).toBe(false);
    const confirmed = checklist.items
      .filter((item) =>
        [
          'plans_engineering',
          'permits',
          'sitework',
          'foundation',
          'framing',
          'roofing',
          'mep_rough',
          'drywall',
          'cabinets',
          'countertops',
          'tile_flooring',
          'interior_paint',
          'interior_trim',
          'utility_taps',
          'contingency',
        ].includes(item.id)
      )
      .map((item) => ({ ...item, state: 'included' }));

    const next = applyScopeAssumptions({ ...draft, scopeChecklist: checklist }, confirmed, {
      drywallSqft: 6200,
      floorAreaSqft: 1850,
    });

    const packageNames = (next.rooms || []).map((room) => room.name);
    expect(packageNames).toEqual(
      expect.arrayContaining([
        'Plans / engineering',
        'Permits / fees (incl. impact)',
        'Sitework',
        'Foundation',
        'Framing',
        'Roofing',
        'MEP rough-in',
        'Drywall',
        'Cabinets / vanity',
        'Counters',
        'Tile & flooring',
        'Interior paint',
        'Finish carpentry / interior trim',
        'Utility taps / connections',
        'Contingency allowance',
      ])
    );
    expect(packageNames).not.toEqual(expect.arrayContaining(['Builder overhead & profit']));
    expect(packageNames.some((name) => /bathroom|kitchen|lvp flooring installation/i.test(name))).toBe(false);
    expect(next.rooms.every((room) => room.status === 'missing_price')).toBe(true);
    expect(next.rooms.every((room) => room.applyEligible === false)).toBe(true);
    expect(next.pricingWarnings).toEqual(
      expect.arrayContaining(['Ground-up planning estimate — verify phases, soft costs, and subs before bidding'])
    );
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

  test('applyScopeMeasurements preserves pricingAcceptance and stamps Applied M/L without takeoff qty', () => {
    const draft = {
      projectType: 'ground_up',
      estimateTier: 'ground_up',
      originalNotes: 'Ground-up home',
      scopePackages: [
        {
          name: 'Finish carpentry / interior trim',
          scope: 'Finish trim package',
          checklistItemId: 'interior_trim',
          price: null,
          status: 'missing_price',
        },
        {
          name: 'Cleanup & disposal',
          scope: 'cleanup',
          checklistItemId: 'cleanup',
          price: null,
          status: 'missing_price',
        },
      ],
      rooms: [],
    };

    const next = applyScopeMeasurements(draft, {
      floorAreaSqft: 3098,
      itemQuantities: {
        interior_trim__material: { quantity: 5519, unit: 'allowance', quantitySource: 'user_entered' },
        interior_trim__labor: { quantity: 4599, unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        interior_trim: {
          selectionStatus: 'accepted',
          totalAmount: 10118,
          materialAmount: 5519,
          laborAmount: 4599,
        },
        cleanup: {
          selectionStatus: 'accepted',
          totalAmount: 1000,
          materialAmount: 0,
          laborAmount: 1000,
        },
      },
    });

    expect(next.scopeMeasurements.pricingAcceptance.interior_trim.totalAmount).toBe(10118);
    expect(next.scopePackages[0]).toMatchObject({
      price: 10118,
      materialPrice: 5519,
      laborPrice: 4599,
      priceSource: 'user_provided',
    });
    expect(next.scopePackages[1]).toMatchObject({
      price: 1000,
      priceSource: 'user_provided',
    });
  });

  test('enrichment preserves selected flooring pricing over note-parsed rates', () => {
    const originalNotes =
      'Flooring job demo existing tile which is 850 ft.2 labor is $3 dollars a square foot for tile demo next install LVP flooring which is 850 ft.? material is $4.50 a square foot and $3.25 a square foot for Labor.';
    const draft = {
      projectType: 'flooring',
      originalNotes,
      estimateTier: 'room_remodel',
      scopeMeasurements: {
        floorAreaSqft: 850,
        itemQuantities: {
          flooring: { quantity: 850, unit: 'sqft', quantitySource: 'user_entered' },
          flooring__allowance: { quantity: 5950, unit: 'allowance', quantitySource: 'user_entered' },
          flooring__material: { quantity: 2550, unit: 'allowance', quantitySource: 'user_entered' },
          flooring__labor: { quantity: 3400, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    };

    const next = enrichDraftComplexity(draft, originalNotes);

    expect(next.scopeMeasurements.itemQuantities.flooring__allowance).toMatchObject({
      quantity: 5950,
      quantitySource: 'user_entered',
    });
    expect(next.scopeMeasurements.itemQuantities.flooring__material).toMatchObject({
      quantity: 2550,
      quantitySource: 'user_entered',
    });
    expect(next.scopeMeasurements.itemQuantities.flooring__labor).toMatchObject({
      quantity: 3400,
      quantitySource: 'user_entered',
    });
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

  test('applyScopeAssumptions carries selected saved-rate split into review packages', () => {
    const notes =
      'Install LVP flooring which is 850 ft.² material is $4.50 a square foot and $3.25 a square foot for Labor.';
    const draft = {
      projectType: 'flooring',
      estimateTier: 'room_remodel',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'flooring' },
      rooms: [
        {
          name: 'LVP Flooring Installation',
          scope: 'Install LVP flooring',
          price: 6587.5,
          materialPrice: 3825,
          laborPrice: 2762.5,
          priceProvidedByUser: false,
          pricedFromSqftAllowances: true,
        },
      ],
      inclusions: [],
      exclusions: [],
      missingInfo: [],
      pricingWarnings: [],
    };
    const items = [
      { id: 'flooring', inputType: 'yes_no', state: 'included', label: 'Flooring install' },
    ];

    const next = applyScopeAssumptions(draft, items, {
      floorAreaSqft: 850,
      itemQuantities: {
        flooring: { quantity: 850, unit: 'sqft', quantitySource: 'user_entered' },
        flooring__material: { quantity: 2550, unit: 'allowance', quantitySource: 'user_entered' },
        flooring__labor: { quantity: 3400, unit: 'allowance', quantitySource: 'user_entered' },
        flooring__allowance: { quantity: 5950, unit: 'allowance', quantitySource: 'user_entered' },
      },
    });

    const room = next.rooms.find((r) => r.name === 'LVP Flooring Installation');
    expect(room).toMatchObject({
      price: 5950,
      knownSubtotal: 5950,
      calculatedSubtotal: 5950,
      materialPrice: 2550,
      laborPrice: 3400,
      priceSource: 'user_provided',
      status: 'user_provided',
    });

    const pkg = buildScopePackage(room, next, next.originalNotes);
    expect(pkg).toMatchObject({
      price: 5950,
      materialPrice: 2550,
      laborPrice: 3400,
      priceSource: 'user_provided',
      status: 'user_provided',
      budgetSplitBasis: { quantity: 850, unit: 'sqft' },
    });
  });

  test('applyScopeAssumptions adds priced custom scope item to review packages', () => {
    const draft = {
      projectType: 'flooring',
      estimateTier: 'room_remodel',
      originalNotes: 'Flooring job with tile demo, LVP install, and baseboards',
      scopeChecklist: { templateKey: 'flooring' },
      rooms: [
        { name: 'Tile Demo', scope: 'Demo existing tile', price: 2550 },
        { name: 'LVP Flooring Installation', scope: 'Install LVP flooring', price: 6587.5 },
        { name: 'Baseboard Installation', scope: 'Baseboard installation', price: 1540 },
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
      {
        id: 'custom_123',
        inputType: 'yes_no',
        state: 'included',
        label: 'Demo',
        helperText: 'Added manually. Price as total, sqft, or LF.',
        category: 'custom',
      },
    ];

    const next = applyScopeAssumptions(draft, items, {
      itemQuantities: {
        custom_123: { quantity: 500, unit: 'sqft', quantitySource: 'user_entered' },
        custom_123__material: { quantity: 2500, unit: 'allowance', quantitySource: 'user_entered' },
        custom_123__labor: { quantity: 2500, unit: 'allowance', quantitySource: 'user_entered' },
        custom_123__allowance: { quantity: 5000, unit: 'allowance', quantitySource: 'user_entered' },
      },
    });

    const custom = (next.rooms || []).find((r) => r.name === 'Demo');
    expect(custom).toMatchObject({
      price: 5000,
      knownSubtotal: 5000,
      materialPrice: 2500,
      laborPrice: 2500,
      status: 'user_provided',
      priceSource: 'user_provided',
      applyEligible: true,
    });
    expect(custom.scopeQuantities?.[0]).toMatchObject({ quantity: 500, unit: 'sqft' });

    const pkg = buildScopePackage(custom, next, next.originalNotes);
    expect(pkg).toMatchObject({
      status: 'user_provided',
      priceSource: 'user_provided',
      materialPrice: 2500,
      laborPrice: 2500,
      budgetSplitBasis: { quantity: 500, unit: 'sqft' },
    });
    const synced = syncRoomsFromScopePackages(next, [pkg]).find((r) => r.name === 'Demo');
    expect(synced).toMatchObject({
      materialPrice: 2500,
      laborPrice: 2500,
      priceSource: 'user_provided',
    });
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

  test('applyScopeMeasurements stamps painting confirmed measurements onto checklist packages', () => {
    const draft = {
      projectType: 'painting',
      scopeChecklist: { templateKey: 'painting' },
      originalNotes: 'Interior and exterior paint',
      scopePackages: [
        {
          name: 'Walls',
          scope: 'Paintable wall surface area only.',
          checklistItemId: 'interior_paint',
          scopeQuantities: [],
        },
        {
          name: 'Baseboards, trim & molding',
          scope: 'Baseboards, window casing, door casing, crown.',
          checklistItemId: 'trim_paint',
          scopeQuantities: [],
        },
        {
          name: 'Interior doors & frames',
          scope: 'Interior door slabs, door edges, and door jambs/frames.',
          checklistItemId: 'door_paint',
          scopeQuantities: [],
        },
        {
          name: 'Cabinets',
          scope: 'Includes cabinet boxes, doors, drawer fronts, and face frames.',
          checklistItemId: 'cabinet_paint',
          scopeQuantities: [],
        },
        {
          name: 'Exterior Paint',
          scope: 'Paintable exterior surface area.',
          checklistItemId: 'exterior_paint',
          scopeQuantities: [],
        },
      ],
    };
    const next = applyScopeMeasurements(draft, {
      combinedPaintableAreaSqft: 1500,
      paintPricingMethod: 'combined',
      baseboardLf: 200,
      interiorDoorCount: 6,
      cabinetRunLf: 25,
      exteriorPaintSqft: 2000,
    });
    expect(next.scopeMeasurements.combinedPaintableAreaSqft).toBe(1500);
    expect(next.scopeMeasurements.interiorDoorCount).toBe(6);
    expect(next.scopeMeasurements.cabinetRunLf).toBe(25);
    expect(next.scopePackages[0].scopeQuantities[0]).toMatchObject({ quantity: 1500, unit: 'sqft' });
    expect(next.scopePackages[1].scopeQuantities[0]).toMatchObject({ quantity: 200, unit: 'lf' });
    expect(next.scopePackages[2].scopeQuantities[0]).toMatchObject({ quantity: 6, unit: 'each' });
    expect(next.scopePackages[3].scopeQuantities[0]).toMatchObject({ quantity: 25, unit: 'lf' });
    expect(next.scopePackages[4].scopeQuantities[0]).toMatchObject({ quantity: 2000, unit: 'sqft' });
  });
});
