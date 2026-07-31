const { capturePricingMemory, buildSuggestionsForDraft } = require('../contractorPricingMemory');
const { buildMissingPriceSuggestions, inferTradeForMissing } = require('../contractorPricingMemory/suggestMissing');
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

  test('does not capture calculated allowance rates on apply', () => {
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
    expect(result.captured).toBe(0);
  });

  test('captures manually entered waterproofing rates on apply', () => {
    const draft = {
      projectType: 'bathroom',
      scopePackages: [
        {
          name: 'Shower waterproofing & backer board',
          checklistItemId: 'waterproofing',
          status: 'user_provided',
          priceProvidedByUser: true,
          laborPrice: 700,
          materialPrice: 400,
          scope: '80 sqft shower walls',
        },
      ],
    };

    const result = capturePricingMemory(userId, {
      draft,
      meta: { bidStatus: 'applied' },
    });
    expect(result.captured).toBeGreaterThan(0);

    const memory = buildSuggestionsForDraft(
      normalizeDraft({
        projectType: 'bathroom',
        scopePackages: [
          {
            name: 'Shower waterproofing',
            checklistItemId: 'waterproofing',
            status: 'missing_price',
            scope: '80 sqft',
          },
        ],
      }),
      userId
    );
    expect(memory.suggestions.length).toBeGreaterThan(0);
  });

  test('does not save an applied national-average price to the library', () => {
    const draft = {
      projectType: 'bathroom',
      scopeMeasurements: {
        pricingAcceptance: {
          shower_tile: {
            selectionStatus: 'accepted',
            pricingSourceKind: 'national_average',
            pricingSourceLabel: 'National Average',
          },
        },
      },
      scopePackages: [
        {
          name: 'Shower wall tile installation',
          checklistItemId: 'shower_tile',
          status: 'user_provided',
          priceProvidedByUser: true,
          laborPrice: 1440,
          materialPrice: 640,
          scope: '80 sqft shower walls',
        },
      ],
    };

    const result = capturePricingMemory(userId, {
      draft,
      meta: { bidStatus: 'applied' },
    });
    expect(result.captured).toBe(0);
  });

  test('captures manually entered lump-sum permits allowance on apply', () => {
    const draft = {
      projectType: 'ground_up',
      scopePackages: [
        {
          name: 'Permits',
          checklistItemId: 'permits',
          status: 'user_provided',
          priceProvidedByUser: true,
          price: 4200,
          scope: 'Building permits and impact fees',
        },
      ],
    };

    const result = capturePricingMemory(userId, {
      draft,
      meta: { bidStatus: 'applied' },
    });
    expect(result.captured).toBe(1);

    const { listLibraryEntries } = require('../contractorPricingMemory/storage');
    const entry = listLibraryEntries(userId)[0];
    expect(entry).toMatchObject({
      checklistItemId: 'permits',
      unitType: 'allowance',
      totalAmount: 4200,
      unitRate: 4200,
      pricingSource: 'user_provided',
    });
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

  test('regional missing-price suggestions use trade from item not project kitchen rate', () => {
    const draft = {
      projectType: 'home_addition',
      originalNotes: 'Master bathroom remodel',
      scopePackages: [
        {
          name: 'Master bathroom',
          scope: 'Demo shower and tile',
          status: 'partial_pricing',
          trade: 'bathroom',
          missingPriceItems: ['Demo / removal', 'Glass / shower door'],
          scopeQuantities: [],
        },
      ],
    };
    const demoTrade = inferTradeForMissing({
      label: 'Demo / removal',
      packageName: 'Master bathroom',
      scope: 'Demo shower and tile',
    });
    const glassTrade = inferTradeForMissing({
      label: 'Glass / shower door',
      packageName: 'Master bathroom',
      scope: 'Demo shower and tile',
    });
    expect(demoTrade).toBe('demo');
    expect(glassTrade).not.toBe('kitchen');

    const { suggestions } = buildMissingPriceSuggestions(draft, userId);
    const demo = suggestions.find((s) => /demo/i.test(s.missingItem));
    const glass = suggestions.find((s) => /glass/i.test(s.missingItem));
    expect(demo?.suggestedUnitRate).not.toBe(95);
    expect(glass?.unitType).toBe('lump_sum');
  });

  test('baseboard lf scope priced as baseboard not painting sqft', () => {
    const notes =
      '1200 sqft tile demo, 1200 sqft tile install, install baseboards 500 linear feet paint and prep';
    const draft = {
      projectType: 'flooring',
      originalNotes: notes,
      scopePackages: [
        {
          name: 'Interior Painting',
          scope: '500 linear feet baseboard installation, prep and paint',
          status: 'missing_price',
          missingPriceItems: [],
          scopeQuantities: [{ quantity: 500, unit: 'lf', label: 'Interior Painting' }],
        },
      ],
    };
    const trade = inferTradeForMissing({
      label: 'Interior Painting — full package pricing',
      packageName: 'Interior Painting',
      scope: draft.scopePackages[0].scope,
      scopeQuantities: draft.scopePackages[0].scopeQuantities,
    });
    expect(trade).toBe('baseboard');

    const { suggestions } = buildMissingPriceSuggestions(draft, userId);
    const material = suggestions.find((s) => /material/i.test(s.scopeItemName));
    const labor = suggestions.find((s) => /labor/i.test(s.scopeItemName));
    expect(material?.unitType).toBe('lf');
    expect(material?.suggestedUnitRate).toBe(2);
    expect(labor?.unitType).toBe('lf');
    expect(labor?.suggestedUnitRate).toBe(5);
    expect(material?.quantity).toBe(500);
    expect(material?.estimatedTotal).toBe(1000);
    expect(labor?.estimatedTotal).toBe(2500);
  });

  test('baseboard per-LF missing hints do not duplicate regional material and labor', () => {
    const draft = {
      projectType: 'flooring',
      originalNotes: '1000 linear feet baseboard install',
      scopePackages: [
        {
          name: 'Baseboard',
          scope: '1000 lf baseboard install',
          status: 'missing_price',
          missingPriceItems: [
            'Material rate per LF',
            'Labor install rate per LF',
            'Caulk & paint',
          ],
          scopeQuantities: [{ quantity: 1000, unit: 'lf', label: 'Baseboard' }],
        },
      ],
    };
    const { suggestions } = buildMissingPriceSuggestions(draft, userId);
    const materials = suggestions.filter((s) => s.lineType === 'material');
    const labors = suggestions.filter((s) => s.lineType === 'labor');
    expect(materials.length).toBe(1);
    expect(labors.length).toBe(1);
    expect(materials[0].quantity).toBe(1000);
    expect(labors[0].quantity).toBe(1000);
  });

  test('saved template tile line is not suggested for baseboard missing items', () => {
    const draft = {
      projectType: 'flooring',
      originalNotes: '1200 sqft tile install, 1000 lf baseboard',
      scopePackages: [
        {
          name: 'Baseboard',
          scope: '1000 lf baseboard',
          status: 'missing_price',
          missingPriceItems: ['Material rate per LF'],
          scopeQuantities: [{ quantity: 1000, unit: 'lf', label: 'Baseboard' }],
        },
      ],
    };
    const templates = [
      {
        name: 'Saved bid',
        payload: {
          laborLineItems: [{ name: 'Tile install', total: 6000 }],
          materialLineItems: [],
        },
      },
    ];
    const { suggestions } = buildMissingPriceSuggestions(draft, userId, {
      savedTemplates: templates,
    });
    expect(suggestions.some((s) => /tile install/i.test(String(s.scopeItemName || '')))).toBe(
      false
    );
  });
});
