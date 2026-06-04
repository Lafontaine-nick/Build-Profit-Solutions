const { normalizeDraft } = require('../estimateDraftFromNotes');

const FLOOR_SCOPE_NOTES =
  "OK, let's create a bid. I have a floor job. I have 1200 ft.² of tile demo. I have 1200 ft.² of laminate flooring installation and 500 linear feet of baseboard installation, caulk and paint";

describe('three note variants (Phase 1)', () => {
  test('variant A — scope only: quantities without rates', () => {
    const draft = normalizeDraft(
      {
        projectType: 'flooring',
        projectTitle: 'Floor job',
        rooms: [
          {
            name: 'Tile Demo',
            scope: 'Demolish 1200 sqft of existing tile',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
          {
            name: 'Laminate Flooring',
            scope: 'Install 1200 sqft laminate flooring',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
          {
            name: 'Baseboard',
            scope: 'Install 500 linear feet of baseboard, caulk and paint',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [],
      },
      { originalNotes: FLOOR_SCOPE_NOTES }
    );

    expect(draft.noteProfile?.primary).toBe('scope_only');
    expect(draft.noPricingDetected).toBe(true);
    expect(draft.knownSubtotal || 0).toBe(0);
    expect(draft.scopePackages.every((p) => p.status === 'missing_price')).toBe(true);
    expect(draft.scopePackages.some((p) => (p.scopeQuantities || []).length > 0)).toBe(true);
    expect(draft.whatAiDid.some((l) => /no material or labor rates/i.test(l))).toBe(true);
  });

  test('variant B — exact rate: $/sqft material + labor calculated', () => {
    const draft = normalizeDraft({
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
        },
      ],
      allowances: [
        { name: 'Tile', amount: 3, unit: '/sqft', description: '' },
        { name: 'Labor for tiling', amount: 5, unit: '/sqft', description: '' },
      ],
    });

    expect(draft.noteProfile?.primary).toBe('exact_rate');
    expect(draft.noPricingDetected).toBe(false);
    expect(draft.rooms[0].price).toBe(4000);
    expect(draft.scopePackages[0].status).toBe('calculated');
    expect(draft.estimateConfidence?.level).toBe('high');
    expect(draft.whatAiDid.some((l) => /Calculated/i.test(l))).toBe(true);
  });

  test('variant C — lump sum: user total preserved, skips scope-only', () => {
    const draft = normalizeDraft({
      projectType: 'bathroom',
      rooms: [
        {
          name: 'Master bathroom',
          scope: 'full remodel',
          price: 18500,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
      allowances: [],
    });

    expect(draft.noteProfile?.primary).toBe('lump_sum');
    expect(draft.noPricingDetected).toBe(false);
    expect(draft.scopePackages[0].status).toBe('user_provided');
    expect(draft.rooms[0].price).toBe(18500);
    expect(draft.whatAiDid.some((l) => /Preserved your total/i.test(l))).toBe(true);
  });
});
