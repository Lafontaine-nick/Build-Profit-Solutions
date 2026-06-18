import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  resolveScopeItemSuggestedPricing,
  resolveTemplateRateForItem,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
} from '@/utils/scopeItemQuantities';

function inputWith(
  fields: Partial<Record<string, string>>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: {},
  } as ScopeMeasurementsInputExtended;
}

// National-average flooring rate: material $4/sqft, labor $5/sqft.
describe('resolveScopeItemSuggestedPricing', () => {
  it('splits a lump-sum total into material + labor using the national ratio', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 5000,
      unit: 'allowance',
      quantitySource: 'notes' as const,
      dualAllowance: { quantity: 5000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({ mode: 'note_total_split', material: 4000, labor: 1000, total: 5000 });
    expect(fill?.materialSource).toBe('national_average');
  });

  it('shows saved flooring rates as a comparison instead of splitting a note total into saved material plus remainder', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 3825,
      unit: 'allowance',
      quantitySource: 'notes' as const,
      dualAllowance: { quantity: 3825, unit: 'allowance' },
    };
    const pricingContext: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'LVP plank flooring', unit: 'sqft', unitPrice: 3 }],
          laborLineItems: [{ name: 'LVP install labor', unit: 'sqft', unitPrice: 4 }],
        },
      ],
    };

    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved,
      pricingContext
    );

    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      material: 2550,
      labor: 3400,
      total: 5950,
      materialSource: 'template',
      laborSource: 'template',
      isComparison: true,
    });
  });

  it('fills the missing labor leg when notes priced only material', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualMaterial: { quantity: 4000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({ mode: 'fill_missing', material: 4000, labor: 5000 });
    expect(fill?.materialSource).toBe('notes');
    expect(fill?.laborSource).toBe('national_average');
  });

  it('fills the missing material leg when notes priced only labor', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualLabor: { quantity: 3000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({ mode: 'fill_missing', material: 4000, labor: 3000 });
    expect(fill?.materialSource).toBe('national_average');
    expect(fill?.laborSource).toBe('notes');
  });

  it('splits flooring demo lump totals into material + labor budget tracking', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 2550,
      unit: 'allowance',
      quantitySource: 'notes' as const,
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('floor_demo', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({
      mode: 'note_total_split',
      material: 425,
      labor: 2125,
      total: 2550,
      materialSource: 'national_average',
    });
  });

  it('shows only a comparison when notes priced both legs', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 850,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualMaterial: { quantity: 4500, unit: 'allowance' },
      dualLabor: { quantity: 3250, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      material: 3400,
      labor: 4250,
      total: 7650,
      isComparison: true,
    });
  });

  it('prefers a saved template rate over the national average for quantity-only items', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = { quantity: 1000, unit: 'sqft', quantitySource: 'inferred' as const };
    const pricingContext: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'LVP plank flooring', unit: 'sqft', unitPrice: 6 }],
          laborLineItems: [{ name: 'LVP install labor', unit: 'sqft', unitPrice: 4 }],
        },
      ],
    };
    const { fill } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved, pricingContext);
    expect(fill).toMatchObject({ material: 6000, labor: 4000, mode: 'suggested_price' });
    expect(fill?.materialSource).toBe('template');
    expect(fill?.laborSource).toBe('template');
    expect(fill?.rateSourceLabel).toContain('LVP Floors');
  });
});

describe('resolveTemplateRateForItem', () => {
  it('matches saved line items within the same trade family and unit', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'Vinyl plank flooring', unit: 'sqft', unitPrice: 5.5 }],
          laborLineItems: [{ name: 'Flooring install labor', unit: 'sqft', unitPrice: 3.25 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toMatchObject({
      materialRate: 5.5,
      laborRate: 3.25,
      source: 'LVP Floors',
    });
  });

  it('matches saved sqft labor lines stored as hours and rate', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'Nick',
          materialLineItems: [{ name: 'LVP flooring', unit: 'sqft', unitPrice: 3 }],
          laborLineItems: [{ name: 'LVP install', mode: 'sqft', hours: 1200, rate: 4, total: 4800 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toMatchObject({
      materialRate: 3,
      laborRate: 4,
      source: 'Nick',
    });
  });

  it('does not borrow a wall-tile rate for a flooring scope', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'Bath Tile',
          materialLineItems: [{ name: 'Wall tile', unit: 'sqft', unitPrice: 8 }],
          laborLineItems: [{ name: 'Wall tile setting', unit: 'sqft', unitPrice: 14 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toBeNull();
  });

  it('ignores rates whose unit does not match the scope unit', () => {
    const ctx: ScopePricingContext = {
      bid: {
        name: 'This bid',
        materialLineItems: [{ name: 'LVP flooring', unit: 'ea', unitPrice: 200 }],
        laborLineItems: [],
      },
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toBeNull();
  });
});
