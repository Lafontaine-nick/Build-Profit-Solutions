const { normalizeDraft } = require('../estimateDraftFromNotes');
const { computeEstimateConfidence, buildWhatAiDid, hasNoPricing } = require('../estimateDraftPhase2');

describe('estimateDraftPhase2', () => {
  test('high confidence for quantity × rate flooring job', () => {
    const draft = normalizeDraft(
      {
        projectType: 'other',
        projectDescription: '1200 sqft laminate',
        rooms: [
          {
            name: 'Flooring',
            scope: '1200 sqft laminate install and tile demo',
            price: null,
            priceIncludesLaborAndMaterials: false,
          },
        ],
        allowances: [
          { name: 'Material', amount: 4, unit: '/sqft', description: '' },
          { name: 'Install labor', amount: 5, unit: '/sqft', description: '' },
        ],
      },
      { originalNotes: '1200 sqft laminate $4/sqft material $5/sqft labor' }
    );

    expect(draft.estimateConfidence?.level).toBe('high');
    expect(draft.whatAiDid?.length).toBeGreaterThan(0);
    expect(draft.whatAiDid.some((l) => /Calculated/i.test(l))).toBe(true);
  });

  test('scope-only notes → low confidence and no pricing', () => {
    const draft = normalizeDraft({
      projectType: 'bathroom',
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
});
