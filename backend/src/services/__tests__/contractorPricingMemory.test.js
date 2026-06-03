const { capturePricingMemory, buildSuggestionsForDraft } = require('../contractorPricingMemory');
const { extractCaptureEntries } = require('../contractorPricingMemory/capture');
const { clearMemory } = require('../contractorPricingMemory/storage');
const { normalizeDraft } = require('../estimateDraftFromNotes');

describe('contractorPricingMemory', () => {
  const userId = 'test-user-pricing-memory';

  beforeEach(() => {
    clearMemory(userId);
  });

  test('does not capture from scope-only draft', () => {
    const entries = extractCaptureEntries({
      draft: normalizeDraft({
        rooms: [{ name: 'Bath', scope: 'demo tile, vanity', price: null, priceIncludesLaborAndMaterials: false }],
        allowances: [],
      }),
      meta: { bidStatus: 'applied' },
    });
    expect(entries.length).toBe(0);
  });

  test('captures calculated flooring rates on apply', () => {
    const draft = normalizeDraft(
      {
        projectType: 'other',
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
          { name: 'Laminate material', amount: 4, unit: '/sqft', description: '' },
          { name: 'Install labor', amount: 5, unit: '/sqft', description: '' },
        ],
      },
      { originalNotes: '1200 sqft $4/sqft material $5/sqft labor' }
    );

    const result = capturePricingMemory(userId, {
      draft,
      meta: { bidStatus: 'applied' },
    });
    expect(result.captured).toBeGreaterThan(0);

    const memory = buildSuggestionsForDraft(
      normalizeDraft({
        projectType: 'other',
        projectDescription: '900 sqft LVP install',
        rooms: [{ name: 'Flooring', scope: '900 sqft laminate', price: null, priceIncludesLaborAndMaterials: false }],
        allowances: [],
        detectedTrades: ['flooring'],
      }),
      userId
    );
    expect(memory.suggestions.length).toBeGreaterThan(0);
    expect(memory.suggestions[0].label).toMatch(/past approved bids/i);
  });

  test('skips test bids when excludeTestBids is on', () => {
    const draft = normalizeDraft({
      rooms: [
        {
          name: 'Demo job',
          scope: 'test remodel',
          price: 5000,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
      allowances: [],
    });
    const result = capturePricingMemory(userId, {
      draft,
      meta: { bidStatus: 'applied', isTestBid: true, projectTitle: 'Test demo bid' },
    });
    expect(result.captured).toBe(0);
    expect(result.skipped).toBe('test_bid');
  });
});
