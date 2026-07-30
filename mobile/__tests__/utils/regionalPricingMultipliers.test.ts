import {
  applyRegionalMultiplierToBudgetSplit,
  normalizeUsStateCode,
  resolveRegionalPricingMultiplier,
  STATE_REGIONAL_MULTIPLIERS,
} from '@/utils/regionalPricingMultipliers';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

describe('regionalPricingMultipliers', () => {
  it('normalizes state names and abbreviations', () => {
    expect(normalizeUsStateCode('ca')).toBe('CA');
    expect(normalizeUsStateCode('California')).toBe('CA');
    expect(normalizeUsStateCode('')).toBeNull();
  });

  it('returns 1.0 when no state is provided', () => {
    expect(resolveRegionalPricingMultiplier(null)).toMatchObject({
      multiplier: 1,
      geographicBasis: 'national',
      rateSourceLabel: 'Suggested · National Average',
    });
  });

  it('applies California multiplier', () => {
    const regional = resolveRegionalPricingMultiplier({ state: 'CA' });
    expect(regional.multiplier).toBe(STATE_REGIONAL_MULTIPLIERS.CA);
    expect(regional.geographicBasis).toBe('state');
    expect(regional.rateSourceLabel).toContain('CA regional');
  });

  it('scales national-average budget splits', () => {
    const regional = resolveRegionalPricingMultiplier({ state: 'CA' });
    const adjusted = applyRegionalMultiplierToBudgetSplit(
      { unit: 'sqft', material: 4, labor: 5, sourceLabel: 'National Average' },
      regional
    );
    expect(adjusted.material).toBe(5.52);
    expect(adjusted.labor).toBe(6.9);
    expect(adjusted.regionalStateCode).toBe('CA');
  });
});

describe('resolveScopeItemSuggestedPricing regional adjustment', () => {
  it('scales national-average flooring rates for California', () => {
    const input = emptyQuickMeasurementInput();
    input.floorAreaSqft = '1000';
    const resolved = { quantity: 1000, unit: 'sqft', quantitySource: 'inferred' as const };
    const { fill } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved, {
      state: 'CA',
    });
    expect(fill).toMatchObject({
      material: 5520,
      labor: 6900,
      total: 12420,
      materialSource: 'national_average',
      laborSource: 'national_average',
    });
    expect(fill?.rateSourceLabel).toContain('CA regional');
  });

  it('does not scale saved template rates', () => {
    const input = emptyQuickMeasurementInput();
    input.floorAreaSqft = '1000';
    const resolved = { quantity: 1000, unit: 'sqft', quantitySource: 'inferred' as const };
    const { fill } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved, {
      state: 'CA',
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'LVP plank flooring', unit: 'sqft', unitPrice: 3 }],
          laborLineItems: [{ name: 'LVP install labor', unit: 'sqft', unitPrice: 4 }],
        },
      ],
    });
    expect(fill).toMatchObject({ material: 3000, labor: 4000, total: 7000 });
    expect(fill?.rateSourceLabel).toContain('Saved pricing');
  });

  it('scales permit allowance for higher-cost states', () => {
    const input = emptyQuickMeasurementInput();
    input.itemQuantities = {
      permits: { quantity: '1', unit: 'allowance', quantitySource: 'user_entered' },
    };
    const resolved = { quantity: 1, unit: 'allowance', quantitySource: 'user_entered' as const };
    const { fill } = resolveScopeItemSuggestedPricing('permits', input, 'addition', resolved, {
      state: 'NY',
    });
    expect(fill?.total).toBe(4550);
    expect(fill?.rateSourceLabel).toContain('NY regional');
  });
});
