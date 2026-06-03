const {
  normalizeDraft,
  parseSquareFeetFromText,
  isPerSqftAllowance,
  classifyAllowanceKind,
} = require('../estimateDraftFromNotes');
const { inferBuilderMode } = require('../estimateDraftEnrichment');

describe('estimateDraftFromNotes sqft × allowance pricing', () => {
  test('parseSquareFeetFromText handles common phrasing', () => {
    expect(parseSquareFeetFromText('500 sqft floor and walls')).toBe(500);
    expect(parseSquareFeetFromText('about 500 square feet of work')).toBe(500);
    expect(parseSquareFeetFromText('no area here')).toBeNull();
  });

  test('classifies per-sqft allowances', () => {
    expect(
      isPerSqftAllowance({ name: 'Tile', amount: 3, unit: '/sqft', description: '' })
    ).toBe(true);
    expect(classifyAllowanceKind({ name: 'Labor for tiling', description: '' })).toBe('labor');
    expect(classifyAllowanceKind({ name: 'Tile', description: '' })).toBe('material');
  });

  test('Nik-style notes: 500 sqft × $3 tile + $5 labor → $4,000 split', () => {
    const draft = normalizeDraft({
      projectTitle: 'Nik Bathroom Remodel',
      projectType: 'bathroom',
      projectDescription: '500 square feet of bathroom remodel work',
      rooms: [
        {
          name: 'Nik Bathroom',
          scope: 'demo, tub, repaint, shower door, fixtures',
          price: null,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: false,
        },
      ],
      allowances: [
        { name: 'Tile', amount: 3, unit: '/sqft', description: '' },
        { name: 'Labor for tiling', amount: 5, unit: '/sqft', description: '' },
      ],
      missingInfo: ['customer phone', 'start date'],
    });

    expect(draft.rooms[0].price).toBe(4000);
    expect(draft.rooms[0].materialPrice).toBe(1500);
    expect(draft.rooms[0].laborPrice).toBe(2500);
    expect(draft.rooms[0].priceIncludesLaborAndMaterials).toBe(false);
    expect(draft.calculatedLineItemTotal).toBe(4000);
    expect(draft.calculatedLaborTotal).toBe(2500);
    expect(draft.calculatedMaterialTotal).toBe(1500);
    expect(draft.pricingWarnings.some((w) => /500 sqft/i.test(w))).toBe(true);
    expect(draft.missingInfo.some((m) => /overall bid total was not found/i.test(m))).toBe(false);
    expect(draft.scopePackages[0].status).toBe('calculated');
    expect(draft.builderMode).toBe('organize_calculate');
  });

  test('organize_only inferred from notes skips sqft calculation', () => {
    const draft = normalizeDraft(
      {
        projectDescription: '500 sqft',
        rooms: [{ name: 'Bath', scope: 'tile', price: null, priceIncludesLaborAndMaterials: false }],
        allowances: [{ name: 'Tile', amount: 3, unit: '/sqft', description: '' }],
      },
      { builderMode: 'organize_only', originalNotes: 'organize only — tile $3/sqft' }
    );
    expect(draft.rooms[0].price).toBeNull();
    expect(draft.allowances[0].status).toBe('needs_review');
  });

  test('Ruth-style lump sum room price is unchanged', () => {
    const draft = normalizeDraft({
      projectType: 'home_addition',
      rooms: [
        {
          name: 'Master bathroom',
          scope: 'full remodel',
          price: 12500,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
      allowances: [{ name: 'LVP', amount: 3, unit: '/sqft', description: 'allowance only' }],
      projectDescription: 'whole home 2000 sqft',
    });

    expect(draft.rooms[0].price).toBe(12500);
    expect(draft.rooms[0].laborPrice).toBeNull();
    expect(draft.rooms[0].materialPrice).toBeNull();
    expect(draft.rooms[0].priceIncludesLaborAndMaterials).toBe(true);
  });

  test('explicit labor and material amounts from notes are preserved', () => {
    const draft = normalizeDraft({
      projectType: 'kitchen',
      rooms: [
        {
          name: 'Kitchen',
          scope: 'cabinets and counters',
          price: 19000,
          laborPrice: 8000,
          materialPrice: 11000,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: true,
        },
      ],
      allowances: [],
    });

    expect(draft.rooms[0].laborPrice).toBe(8000);
    expect(draft.rooms[0].materialPrice).toBe(11000);
    expect(draft.rooms[0].price).toBe(19000);
  });

  test('lump-sum rooms get optional split previews without manual mode', () => {
    const draft = normalizeDraft({
      projectType: 'kitchen',
      rooms: [
        {
          name: 'Kitchen',
          scope: 'remodel includes cabinets',
          price: 28629,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
      allowances: [],
    });
    expect(inferBuilderMode('Kitchen remodel $28,629 includes labor and materials', draft)).toBe(
      'organize_calculate'
    );
    expect(draft.suggestedSplits?.length).toBe(1);
    expect(draft.suggestedSplits[0].previewOnly).toBe(true);
    expect(draft.suggestedSplits[0].suggestedLabor).toBeGreaterThan(0);
  });

  test('flooring job: 1200 sqft demo+install labor, material, 500 lf baseboard', () => {
    const notes =
      '1200 sqft tile demo and 1200 sqft laminate install. Material allowance $4/sqft. Install labor $5/sqft. Demo labor $5/sqft. Baseboard 500 linear feet — labor $2.50/lf, material $0.85/lf.';
    const draft = normalizeDraft(
      {
        projectType: 'other',
        projectDescription: '1200 sqft laminate flooring with baseboard',
        rooms: [
          {
            name: 'Flooring',
            scope: 'Demolish 1200 sqft tile and install 1200 sqft laminate flooring',
            price: null,
            laborPrice: null,
            materialPrice: null,
            priceIncludesLaborAndMaterials: false,
          },
          {
            name: 'Baseboard',
            scope: 'Install approximately 500 linear feet of baseboard',
            price: null,
            laborPrice: null,
            materialPrice: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [
          {
            name: 'Laminate material allowance',
            amount: 4,
            unit: '/sqft',
            description: 'material cost allowance four dollars a square foot',
          },
          {
            name: 'Install labor budget',
            amount: 5,
            unit: '/sqft',
            description: 'five dollars a square foot to install new flooring',
          },
          {
            name: 'Tile demo labor',
            amount: 5,
            unit: '/sqft',
            description: 'five dollars a square foot to demo the tile',
          },
          {
            name: 'Baseboard labor',
            amount: 2.5,
            unit: '/lf',
            description: 'two and a half dollars per linear foot',
          },
          {
            name: 'Baseboard material',
            amount: 0.85,
            unit: '/lf',
            description: '85 cents per linear foot',
          },
        ],
      },
      { originalNotes: notes }
    );

    const flooring = draft.rooms.find((r) => r.name === 'Flooring');
    const baseboard = draft.rooms.find((r) => r.name === 'Baseboard');

    expect(flooring.price).toBe(16800);
    expect(flooring.laborPrice).toBe(12000);
    expect(flooring.materialPrice).toBe(4800);
    expect(baseboard.price).toBe(1675);
    expect(baseboard.laborPrice).toBe(1250);
    expect(baseboard.materialPrice).toBe(425);
    expect(draft.calculatedLineItemTotal).toBe(18475);
    expect(draft.calculatedLaborTotal).toBe(13250);
    expect(draft.calculatedMaterialTotal).toBe(5225);
    expect(draft.pricingWarnings.filter((w) => /Flooring:/i.test(w)).length).toBe(1);
    expect(draft.pricingWarnings.filter((w) => /Baseboard:/i.test(w)).length).toBe(1);
  });

  test('$/sqft allowances without sqft prompt for area', () => {
    const draft = normalizeDraft({
      projectType: 'bathroom',
      projectDescription: 'bathroom remodel',
      rooms: [
        {
          name: 'Bath',
          scope: 'tile work',
          price: null,
          priceIncludesLaborAndMaterials: false,
        },
      ],
      allowances: [
        { name: 'Tile', amount: 3, unit: '/sqft', description: '' },
        { name: 'Labor for tiling', amount: 5, unit: '/sqft', description: '' },
      ],
    });

    expect(draft.rooms[0].price).toBeNull();
    expect(draft.pricingWarnings.some((w) => /square footage/i.test(w))).toBe(true);
    expect(draft.missingInfo.some((m) => /Square footage/i.test(m))).toBe(true);
  });
});
