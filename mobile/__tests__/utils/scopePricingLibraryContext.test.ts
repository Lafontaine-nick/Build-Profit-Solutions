import {
  pricingLibrarySectionsToScopeRates,
  resolveLibraryRateForItem,
  resolveLibraryLumpSumForItem,
  deriveLibraryScopeRate,
} from '@/utils/scopePricingLibraryContext';
import { resolveTemplateRateForItem, type ScopePricingContext } from '@/utils/scopeItemQuantities';

describe('scopePricingLibraryContext', () => {
  const libraryRates = pricingLibrarySectionsToScopeRates([
    {
      trade: 'tile',
      label: 'Tile',
      items: [
        {
          id: '1',
          scopeItemName: 'Shower wall tile',
          category: 'material',
          unitType: 'sqft',
          unitRate: 12,
          usageCount: 3,
          lastUsedAt: '2026-01-01',
          pricingSource: 'applied',
        },
        {
          id: '2',
          scopeItemName: 'Shower wall tile labor',
          category: 'labor',
          unitType: 'sqft',
          unitRate: 14,
          usageCount: 3,
          lastUsedAt: '2026-01-01',
          pricingSource: 'applied',
        },
        {
          id: '3',
          scopeItemName: 'LVP flooring',
          category: 'material',
          unitType: 'sqft',
          unitRate: 4.5,
          usageCount: 2,
          lastUsedAt: '2026-01-01',
          pricingSource: 'applied',
        },
      ],
    },
  ]);

  it('resolves median library mat/labor for a matching scope item', () => {
    expect(resolveLibraryRateForItem('shower_tile', 'sqft', libraryRates)).toMatchObject({
      materialRate: 12,
      laborRate: 14,
      source: 'Pricing library',
    });
  });

  it('does not cross-match flooring with wall tile library entries', () => {
    expect(resolveLibraryRateForItem('flooring', 'sqft', libraryRates)).toMatchObject({
      materialRate: 4.5,
      laborRate: null,
    });
    expect(resolveLibraryRateForItem('shower_tile', 'sqft', libraryRates)?.materialRate).toBe(12);
  });

  it('derives per-sqft library rates from lump-sum capture rows with quantity', () => {
    const rates = pricingLibrarySectionsToScopeRates([
      {
        trade: 'bathroom',
        label: 'Bathroom',
        items: [
          {
            id: '1',
            scopeItemName: 'Shower waterproofing & backer board — materials',
            category: 'material',
            unitType: 'lump_sum',
            unitRate: null,
            quantity: 80,
            totalAmount: 400,
            usageCount: 1,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
          {
            id: '2',
            scopeItemName: 'Shower waterproofing & backer board — labor',
            category: 'labor',
            unitType: 'lump_sum',
            unitRate: null,
            quantity: 80,
            totalAmount: 800,
            usageCount: 1,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
        ],
      },
    ]);
    expect(deriveLibraryScopeRate(rates[0]!)).toMatchObject({ unitType: 'sqft', unitRate: 5 });
    expect(resolveLibraryRateForItem('waterproofing', 'sqft', rates)).toMatchObject({
      materialRate: 5,
      laborRate: 10,
      source: 'Pricing library',
    });
  });

  it('resolves flat lump-sum waterproofing library capture using takeoff qty', () => {
    const rates = pricingLibrarySectionsToScopeRates([
      {
        trade: 'bathroom',
        label: 'Bathroom',
        items: [
          {
            id: '1',
            scopeItemName: 'Shower waterproofing & backer board',
            category: 'lump_sum',
            unitType: 'lump_sum',
            unitRate: null,
            quantity: null,
            totalAmount: 1100,
            usageCount: 1,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
        ],
      },
    ]);
    expect(
      resolveLibraryRateForItem('waterproofing', 'sqft', rates, undefined, 80)
    ).toMatchObject({
      materialRate: 5.73,
      laborRate: 8.02,
      source: 'Pricing library',
    });
  });

  it('matches library rows by checklistItemId and legacy scope names', () => {
    const rates = pricingLibrarySectionsToScopeRates([
      {
        trade: 'bathroom',
        label: 'Bathroom',
        items: [
          {
            id: '1',
            scopeItemName: 'Shower waterproofing & backer board — materials',
            checklistItemId: 'waterproofing',
            category: 'material',
            unitType: 'sqft',
            unitRate: 5,
            usageCount: 1,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
          {
            id: '2',
            scopeItemName: 'Shower waterproofing & backer board — labor',
            checklistItemId: 'waterproofing',
            category: 'labor',
            unitType: 'sqft',
            unitRate: 8.75,
            usageCount: 1,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
        ],
      },
    ]);
    expect(resolveLibraryRateForItem('waterproofing', 'sqft', rates, undefined, 80)).toMatchObject({
      materialRate: 5,
      laborRate: 8.75,
      source: 'Pricing library',
    });
    expect(
      resolveLibraryRateForItem('waterproofing', 'sqft', rates, undefined, 80)?.materialRate! *
        80 +
        resolveLibraryRateForItem('waterproofing', 'sqft', rates, undefined, 80)?.laborRate! * 80
    ).toBeCloseTo(1100, 0);
  });
});

describe('resolveTemplateRateForItem with pricing library', () => {
  const libraryRates = pricingLibrarySectionsToScopeRates([
    {
      trade: 'tile',
      label: 'Tile',
      items: [
        {
          id: '1',
          scopeItemName: 'Floor tile install',
          category: 'labor',
          unitType: 'sqft',
          unitRate: 6,
          usageCount: 2,
          lastUsedAt: '2026-01-01',
          pricingSource: 'applied',
        },
      ],
    },
  ]);

  it('prefers pricing library over active bid line items, then saved templates', () => {
    const ctx: ScopePricingContext = {
      bid: {
        name: 'This bid',
        materialLineItems: [{ name: 'Floor tile', unit: 'sqft', unitPrice: 5 }],
        laborLineItems: [],
      },
      libraryRates,
      templates: [
        {
          name: 'Old bath',
          laborLineItems: [{ name: 'Floor tile install', unit: 'sqft', unitPrice: 9 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('floor_tile', 'sqft', ctx)).toMatchObject({
      laborRate: 6,
      source: 'Pricing library',
    });

    const ctxNoLibrary: ScopePricingContext = {
      bid: {
        name: 'This bid',
        materialLineItems: [{ name: 'Floor tile', unit: 'sqft', unitPrice: 5 }],
        laborLineItems: [],
      },
      libraryRates: [],
      templates: [
        {
          name: 'Old bath',
          laborLineItems: [{ name: 'Floor tile install', unit: 'sqft', unitPrice: 9 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('floor_tile', 'sqft', ctxNoLibrary)).toMatchObject({
      materialRate: 5,
      source: 'This bid',
    });

    const ctxTemplateOnly: ScopePricingContext = {
      templates: [
        {
          name: 'Old bath',
          laborLineItems: [{ name: 'Floor tile install', unit: 'sqft', unitPrice: 9 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('floor_tile', 'sqft', ctxTemplateOnly)).toMatchObject({
      laborRate: 9,
      source: 'Old bath',
    });
  });

  it('resolves flat allowance totals for permits and plans from pricing library', () => {
    const rates = pricingLibrarySectionsToScopeRates([
      {
        trade: 'general',
        label: 'General',
        items: [
          {
            id: 'p1',
            scopeItemName: 'Permits',
            checklistItemId: 'permits',
            category: 'lump_sum',
            unitType: 'allowance',
            unitRate: 4200,
            totalAmount: 4200,
            quantity: 1,
            usageCount: 2,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
          {
            id: 'p2',
            scopeItemName: 'Plans & engineering',
            checklistItemId: 'plans_engineering',
            category: 'lump_sum',
            unitType: 'allowance',
            unitRate: 8500,
            totalAmount: 8500,
            quantity: 1,
            usageCount: 1,
            lastUsedAt: '2026-01-01',
            pricingSource: 'user_provided',
          },
        ],
      },
    ]);
    expect(resolveLibraryLumpSumForItem('permits', rates)).toBe(4200);
    expect(resolveLibraryLumpSumForItem('plans_engineering', rates)).toBe(8500);
  });
});
