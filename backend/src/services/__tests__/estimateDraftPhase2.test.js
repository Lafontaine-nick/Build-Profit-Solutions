const { normalizeDraft } = require('../estimateDraftFromNotes');
const { computeEstimateConfidence, buildWhatAiDid, hasNoPricing, detectNoteProfile } = require('../estimateDraftPhase2');

describe('estimateDraftPhase2', () => {
  test('high confidence for quantity × rate flooring job', () => {
    const draft = normalizeDraft(
      {
        projectType: 'flooring',
        projectDescription: '1200 sqft laminate',
        rooms: [
          {
            name: 'Flooring',
            scope: '1200 sqft laminate install',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [
          { name: 'Material', amount: 4, unit: '/sqft', description: '' },
          { name: 'Install labor', amount: 5, unit: '/sqft', description: '' },
        ],
      },
      { originalNotes: '1200 sqft laminate install $4/sqft material $5/sqft labor' }
    );

    expect(draft.estimateConfidence?.level).toBe('high');
    expect(draft.whatAiDid?.length).toBeGreaterThan(0);
    expect(draft.whatAiDid.some((l) => /Calculated/i.test(l))).toBe(true);
  });

  test('scope-only notes → low confidence and no pricing', () => {
    const draft = normalizeDraft({
      projectType: 'bathroom',
      scopeAssumptionsConfirmed: true,
      rooms: [
        {
          name: 'Bathroom',
          scope: 'demo shower, new tile, vanity, toilet, paint',
          price: null,
          priceIncludesLaborAndMaterials: false,
        },
      ],
      allowances: [],
    });

    expect(hasNoPricing(draft, draft.scopePackages)).toBe(true);
    expect(draft.noPricingDetected).toBe(true);
    expect(draft.estimateConfidence?.level).toBe('low');
    expect(draft.noteProfile?.primary).toBe('scope_only');
  });

  test('lump sum preserved → user_provided status', () => {
    const draft = normalizeDraft({
      projectType: 'bathroom',
      scopeAssumptionsConfirmed: true,
      rooms: [
        {
          name: 'Bathroom',
          scope: 'full remodel',
          price: 18500,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
      allowances: [],
    });

    expect(draft.scopePackages[0].status).toBe('user_provided');
    const conf = computeEstimateConfidence(draft, draft.scopePackages);
    expect(['high', 'medium']).toContain(conf.level);
    const lines = buildWhatAiDid(draft, draft.scopePackages);
    expect(lines.some((l) => /Preserved your total/i.test(l))).toBe(true);
  });

  test('explicit labor + material split preserved from notes', () => {
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
    expect(draft.scopePackages[0].status).toBe('user_provided');
    expect(draft.noteProfile?.primary).toBe('lump_sum');
    const lines = buildWhatAiDid(draft, draft.scopePackages);
    expect(lines.some((l) => /Calculated|Preserved/i.test(l))).toBe(true);
  });

  test('mixed profile: partial kitchen pricing + unpriced scope', () => {
    const notes = `Kitchen remodel. Countertops roughly $5,000. Cabinets $8,000. Tile backsplash 30 sq ft — no price yet.`;

    const draft = normalizeDraft(
      {
        projectType: 'kitchen',
        scopeAssumptionsConfirmed: true,
        rooms: [
          {
            name: 'Kitchen Remodel',
            scope: notes,
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [],
      },
      { originalNotes: notes }
    );

    expect(draft.noteProfile?.primary).toBe('mixed');
    expect(draft.scopePackages[0].status).toBe('partial_pricing');
    expect(draft.estimateConfidence?.level).toBe('medium');
    expect(draft.whatAiDid.some((l) => /Partial pricing/i.test(l))).toBe(true);
  });

  test('detectNoteProfile classifies exact_rate vs lump_sum vs scope_only', () => {
    const exact = detectNoteProfile(
      [{ status: 'calculated' }, { status: 'calculated' }],
      { calculatedLineItemTotal: 4000 }
    );
    expect(exact.primary).toBe('exact_rate');

    const lump = detectNoteProfile([{ status: 'user_provided' }], { calculatedLineItemTotal: 18500 });
    expect(lump.primary).toBe('lump_sum');

    const scope = detectNoteProfile([{ status: 'missing_price' }, { status: 'missing_price' }], {
      calculatedLineItemTotal: 0,
    });
    expect(scope.primary).toBe('scope_only');
  });
});
