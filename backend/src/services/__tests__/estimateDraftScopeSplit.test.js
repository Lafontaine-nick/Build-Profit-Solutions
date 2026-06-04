const {
  expandJobScopeRooms,
  detectScopeTasksFromNotes,
  roomsAlreadyFullySplit,
} = require('../estimateDraftScopeSplit');
const { normalizeDraft } = require('../estimateDraftFromNotes');
const { pickLibraryRates } = require('../pricingEngine/sources/savedPricing');

describe('estimateDraftScopeSplit', () => {
  const floorNotes =
    'Build me a floor remodel bid 1200 ft.² of tile demo 1200 ft.² laminate flooring installation';

  test('detects floor tasks from notes', () => {
    const tasks = detectScopeTasksFromNotes(floorNotes);
    expect(tasks.map((t) => t.id)).toEqual(['tile_demo', 'laminate_install']);
  });

  test('detects tile install from run-on note with demo and install in one sentence', () => {
    const notes =
      'Create me a flooring bid, 1200 sqft tile demo and 1200 sqft tile installation, and 1000 linear ft of baseboard install';
    const tasks = detectScopeTasksFromNotes(notes);
    expect(tasks.map((t) => t.id)).toEqual(
      expect.arrayContaining(['tile_demo', 'tile_install', 'baseboard_install'])
    );
  });

  test('detects tile demo, tile install, and laminate from floor remodel notes', () => {
    const notes = `Floor remodel
1200 square feet of tile demo
100 square feet of tile installation
1200 square feet of laminate installation`;
    const tasks = detectScopeTasksFromNotes(notes);
    expect(tasks.map((t) => t.id)).toEqual(['tile_demo', 'tile_install', 'laminate_install']);

    const draft = normalizeDraft({ projectDescription: notes, originalNotes: notes });
    expect(draft.rooms.map((r) => r.name)).toEqual([
      'Tile Removal',
      'Tile Installation',
      'Laminate Flooring Installation',
    ]);
    expect(draft.whatAiDid.some((l) => /1,200 sqft for Tile Removal/.test(l))).toBe(true);
    expect(draft.whatAiDid.some((l) => /100 sqft for Tile Installation/.test(l))).toBe(true);
  });

  test('splits single generic Flooring room', () => {
    const rooms = expandJobScopeRooms(
      [{ name: 'Flooring', scope: '1200 sqft laminate', price: null }],
      floorNotes,
      { aggressive: false }
    );
    expect(rooms.map((r) => r.name)).toEqual(['Tile Removal', 'Laminate Flooring Installation']);
  });

  test('splits bathroom remodel into task packages (aggressive)', () => {
    const notes =
      'Gut master bath, 80 sqft shower tile install, new vanity 48 inch, set toilet, paint bath 400 sqft';
    const tasks = detectScopeTasksFromNotes(notes);
    expect(tasks.map((t) => t.id)).toEqual(
      expect.arrayContaining(['bath_demo', 'shower_tile', 'vanity_install', 'toilet_install', 'interior_paint'])
    );

    const rooms = expandJobScopeRooms(
      [{ name: 'Bathroom Remodel', scope: 'full bath gut and finish', price: null }],
      notes,
      { aggressive: true }
    );
    expect(rooms.length).toBeGreaterThanOrEqual(4);
    expect(rooms.some((r) => /shower tile/i.test(r.name))).toBe(true);
    expect(rooms.some((r) => /vanity/i.test(r.name))).toBe(true);
  });

  test('splits kitchen notes into cabinet + countertop packages', () => {
    const notes = 'Kitchen demo, new cabinet installation, quartz countertop install, tile backsplash';
    const rooms = expandJobScopeRooms(
      [{ name: 'Kitchen Remodel', scope: 'full kitchen', price: null }],
      notes,
      { aggressive: true }
    );
    expect(rooms.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        'Kitchen Demo',
        'Cabinet Installation',
        'Countertop Installation',
        'Backsplash Installation',
      ])
    );
  });

  test('does not split when each task already has a dedicated room', () => {
    const notes = floorNotes;
    const rooms = [
      { name: 'Tile Demo', scope: '1200 sqft demo', price: null },
      { name: 'Laminate Flooring Installation', scope: '1200 sqft install', price: null },
    ];
    expect(roomsAlreadyFullySplit(rooms, detectScopeTasksFromNotes(notes))).toBe(true);
    expect(expandJobScopeRooms(rooms, notes, { aggressive: true })).toHaveLength(2);
  });

  test('pickLibraryRates matches demo labor from pricing library entries', () => {
    const draft = normalizeDraft(
      {
        projectType: 'flooring',
        rooms: [{ name: 'Tile Demo', scope: '1200 sqft tile demo', price: null }],
        allowances: [],
      },
      { originalNotes: floorNotes }
    );

    const scopeItem = {
      scopeName: 'Tile Demo',
      scope: '1200 sqft tile demo',
      quantity: 1200,
      unit: 'sqft',
    };

    const libraryRates = pickLibraryRates(scopeItem, [
      { scopeItemName: 'Tile demo labor', category: 'labor', unitType: 'sqft', unitRate: 3.25 },
      { scopeItemName: 'Tile demo labor', category: 'labor', unitType: 'sqft', unitRate: 3.5 },
    ], draft);

    expect(libraryRates).toHaveLength(1);
    expect(libraryRates[0].pricingType).toBe('labor');
    expect(libraryRates[0].rate).toBeCloseTo(3.375, 2);
  });

  test('recommend prefers saved_pricing over saved_template when both available', () => {
    const { pickRecommended } = require('../pricingEngine/recommend');
    const scopeItem = { scopeName: 'Tile Demo', quantity: 1200, unit: 'sqft' };
    const lookups = {
      saved_pricing: {
        available: true,
        rates: [{ pricingType: 'labor', label: 'Tile demo', rate: 3.5, unit: 'sqft', confidence: 'medium' }],
      },
      saved_template: {
        available: true,
        rates: [{ pricingType: 'labor', label: 'Tile demo', rate: 2, unit: 'sqft', confidence: 'medium' }],
      },
      company_default: { available: false, rates: [] },
    };
    const { recommended, proposedRates } = pickRecommended(scopeItem, lookups, { savedOnly: true });
    expect(recommended?.source).toBe('saved_pricing');
    expect(proposedRates[0].rate).toBe(3.5);
  });
});
