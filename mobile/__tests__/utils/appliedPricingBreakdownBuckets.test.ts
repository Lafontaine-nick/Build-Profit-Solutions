import {
  appliedPricingBucketForScope,
  APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS,
  APPLIED_PRICING_LABOR_ONLY_SCOPE_KEYS,
  inferNationalMaterialLaborSplit,
} from '@/utils/appliedPricingBreakdownBuckets';

describe('appliedPricingBreakdownBuckets', () => {
  it('maps scope keys to the user-facing summary columns', () => {
    expect(appliedPricingBucketForScope('contingency')).toBe('allowance');
    expect(appliedPricingBucketForScope('plans_engineering')).toBe('allowance');
    expect(appliedPricingBucketForScope('permits')).toBe('allowance');
    expect(appliedPricingBucketForScope('cleanup')).toBe('material_labor');
    expect(appliedPricingBucketForScope('plumbing_trim')).toBe('material_labor');
    expect(appliedPricingBucketForScope('electrical_trim')).toBe('material_labor');
    expect(appliedPricingBucketForScope('haul_off')).toBe('material_labor');
    expect(appliedPricingBucketForScope('drywall')).toBe('material_labor');
  });

  it('keeps cleanup and haul-off out of allowance keys', () => {
    expect(APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS.has('cleanup')).toBe(false);
    expect(APPLIED_PRICING_LABOR_ONLY_SCOPE_KEYS.has('cleanup')).toBe(false);
    expect(APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS.has('haul_off')).toBe(false);
  });

  it('splits fixture and haul-off totals using national planning shares', () => {
    expect(inferNationalMaterialLaborSplit('plumbing_trim', 5600)).toEqual({
      material: 3640,
      labor: 1960,
    });
    expect(inferNationalMaterialLaborSplit('electrical_trim', 3400)).toEqual({
      material: 1972,
      labor: 1428,
    });
    expect(inferNationalMaterialLaborSplit('haul_off', 1000)).toEqual({
      material: 450,
      labor: 550,
    });
    expect(inferNationalMaterialLaborSplit('cleanup', 1000)).toEqual({
      material: 450,
      labor: 550,
    });
  });
});
