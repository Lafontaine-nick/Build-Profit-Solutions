const { normalizeDraft } = require('../estimateDraftFromNotes');

describe('partial pricing (universal construction)', () => {
  test('kitchen partial notes: $13k known, not missing_price whole room', () => {
    const notes = `Kitchen remodel. New countertops, roughly 2 slabs 150 sq ft. Countertops roughly $5,000.
New cabinets, let's say $8,000. New sink with faucet. Tile backsplash, 30 sq ft.`;

    const draft = normalizeDraft(
      {
        projectTitle: 'Kitchen remodel',
        projectType: 'kitchen',
        rooms: [
          {
            name: 'Kitchen Remodel',
            scope: notes,
            price: null,
            laborPrice: null,
            materialPrice: null,
            priceIncludesLaborAndMaterials: false,
            priceProvidedByUser: false,
          },
        ],
        allowances: [],
      },
      { originalNotes: notes }
    );

    const kitchen = draft.scopePackages.find((p) => /kitchen/i.test(p.name));
    expect(kitchen).toBeDefined();
    expect(kitchen.status).toBe('partial_pricing');
    expect(kitchen.knownSubtotal).toBeGreaterThanOrEqual(13000);
    expect(kitchen.missingPriceItems.length).toBeGreaterThan(0);
    expect(draft.needsReviewItems.some((m) => /partial pricing/i.test(m))).toBe(true);
    expect(kitchen.applyEligible).toBe(true);
  });

  test('complete lump sum stays confirmed', () => {
    const draft = normalizeDraft({
      projectType: 'bathroom',
      rooms: [
        {
          name: 'Master Bath',
          scope: 'full remodel',
          price: 18500,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
    });
    expect(draft.scopePackages[0].status).toBe('user_provided');
  });
});
