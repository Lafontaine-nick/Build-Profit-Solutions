const { normalizeDraft } = require('../estimateDraftFromNotes');
const { getPricingProposal } = require('../pricingEngine/getPricingProposal');
const { expandFloorJobRooms, detectFloorTasksFromNotes } = require('../estimateDraftFloorSplit');

describe('estimateDraftFloorSplit', () => {
  const notes =
    'Build me a floor remodel bid 1200 ft.² of tile demo 1200 ft.² laminate flooring installation';

  test('detects demo + laminate tasks in notes', () => {
    const tasks = detectFloorTasksFromNotes(notes);
    expect(tasks.map((t) => t.id)).toEqual(['tile_demo', 'laminate_install']);
  });

  test('splits single generic Flooring room into tile demo + laminate packages', () => {
    const draft = normalizeDraft(
      {
        projectType: 'flooring',
        rooms: [
          {
            name: 'Flooring',
            scope: '1200 sqft laminate flooring installation',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [],
      },
      { originalNotes: notes }
    );

    expect(draft.scopePackages.map((p) => p.name)).toEqual([
      'Tile Removal',
      'Laminate Flooring Installation',
    ]);
    expect(draft.scopePackages[0].scopeQuantities?.[0]).toMatchObject({
      quantity: 1200,
      unit: 'sqft',
    });
  });

  test('Nick template matches tile demo after split (laminate may stay unmatched)', async () => {
    const draft = normalizeDraft(
      {
        projectType: 'flooring',
        rooms: [{ name: 'Flooring', scope: '1200 sqft flooring', price: null, priceIncludesLaborAndMaterials: false }],
        allowances: [],
      },
      { originalNotes: notes }
    );

    const nick = {
      name: 'Nick',
      payload: {
        materialLineItems: [{ name: 'Tile', mode: 'sqft', rate: 5, unitPrice: 5 }],
        laborLineItems: [
          { name: 'Tile demo', mode: 'sqft', rate: 2 },
          { name: 'Tile install', mode: 'sqft', rate: 5 },
        ],
      },
    };

    const result = await getPricingProposal({
      draft,
      userId: 'dev',
      savedTemplates: [nick],
      mode: 'saved_only',
    });

    expect(result.empty).toBe(false);
    expect(result.lines.some((l) => /demo/i.test(l.packageName) || /demo/i.test(l.label))).toBe(true);
    expect(result.lines.some((l) => l.packageName === 'Laminate Flooring Installation')).toBe(false);
  });

  test('splits when LLM returned tile demo + generic Flooring (laminate missing from room names)', () => {
    const rooms = expandFloorJobRooms(
      [
        { name: 'Tile Demo', scope: '1200 sqft demo', price: null },
        { name: 'Flooring', scope: '1200 sqft laminate flooring installation', price: null },
      ],
      notes,
      { aggressive: true }
    );
    expect(rooms.map((r) => r.name)).toEqual(['Tile Removal', 'Laminate Flooring Installation']);
  });

  test('does not split when LLM already returned separate rooms', () => {
    const rooms = expandFloorJobRooms(
      [
        { name: 'Tile Demo', scope: '1200 sqft demo', price: null },
        { name: 'Laminate Flooring Installation', scope: '1200 sqft install', price: null },
      ],
      notes
    );
    expect(rooms).toHaveLength(2);
    expect(rooms[0].name).toBe('Tile Removal');
  });
});
