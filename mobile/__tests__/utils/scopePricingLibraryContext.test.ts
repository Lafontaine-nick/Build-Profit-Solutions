import {
  pricingLibrarySectionsToScopeRates,
  resolveLibraryRateForItem,
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

  it('prefers active bid, then library, then saved templates', () => {
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
      materialRate: 5,
      source: 'This bid',
    });

    const ctxNoBid: ScopePricingContext = {
      libraryRates,
      templates: [
        {
          name: 'Old bath',
          laborLineItems: [{ name: 'Floor tile install', unit: 'sqft', unitPrice: 9 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('floor_tile', 'sqft', ctxNoBid)).toMatchObject({
      laborRate: 6,
      source: 'Pricing library',
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
});
