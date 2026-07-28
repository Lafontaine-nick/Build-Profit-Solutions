import {
  computeInteriorPaintSuggestedTotal,
  formatInteriorPaintEffectiveRate,
  resolveBathroomInteriorPaintSuggestedPricing,
  roundInteriorPaintPriceToNearest25,
  splitInteriorPaintMaterialLabor,
} from '@/utils/bathroomInteriorPaintPricing';

describe('bathroomInteriorPaintPricing', () => {
  it('applies $350 standalone minimum for small areas', () => {
    expect(
      computeInteriorPaintSuggestedTotal({
        sqft: 40,
        mobilization: 'standalone',
        surface: 'walls',
        condition: 'same_color',
      })
    ).toEqual({ rawTotal: 134, total: 350, minimumApplied: true });

    expect(
      computeInteriorPaintSuggestedTotal({
        sqft: 80,
        mobilization: 'standalone',
        surface: 'walls',
        condition: 'same_color',
      })
    ).toEqual({ rawTotal: 268, total: 350, minimumApplied: true });

    expect(
      computeInteriorPaintSuggestedTotal({
        sqft: 100,
        mobilization: 'unsure',
        surface: 'walls',
        condition: 'same_color',
      })
    ).toEqual({ rawTotal: 335, total: 350, minimumApplied: true });
  });

  it('rounds measured-area pricing to nearest $25', () => {
    expect(
      computeInteriorPaintSuggestedTotal({
        sqft: 150,
        mobilization: 'standalone',
        surface: 'walls',
        condition: 'same_color',
      })
    ).toEqual({ rawTotal: 502.5, total: 500, minimumApplied: false });

    expect(
      computeInteriorPaintSuggestedTotal({
        sqft: 300,
        mobilization: 'standalone',
        surface: 'walls',
        condition: 'same_color',
      })
    ).toEqual({ rawTotal: 1005, total: 1000, minimumApplied: false });
  });

  it('waives minimum when painter is already mobilized', () => {
    expect(
      computeInteriorPaintSuggestedTotal({
        sqft: 80,
        mobilization: 'bundled',
        surface: 'walls',
        condition: 'same_color',
      })
    ).toEqual({ rawTotal: 268, total: 275, minimumApplied: false });
  });

  it('splits material and labor at minimum', () => {
    expect(splitInteriorPaintMaterialLabor(350, true)).toEqual({
      material: 75,
      labor: 275,
    });
  });

  it('formats effective rate for minimum-priced small job', () => {
    expect(formatInteriorPaintEffectiveRate(350, 80)).toBe('$4.38/sq. ft. effective rate');
  });

  it('rounds to nearest $25', () => {
    expect(roundInteriorPaintPriceToNearest25(268)).toBe(275);
    expect(roundInteriorPaintPriceToNearest25(502.5)).toBe(500);
    expect(roundInteriorPaintPriceToNearest25(1005)).toBe(1000);
  });

  it('resolves 80 SF standalone suggested pricing at $350', () => {
    const result = resolveBathroomInteriorPaintSuggestedPricing({
      sqft: 80,
      mobilization: 'standalone',
      surface: 'walls',
      condition: 'same_color',
      itemId: 'interior_paint',
    });
    expect(result?.fill?.total).toBe(350);
    expect(result?.fill?.material).toBe(75);
    expect(result?.fill?.labor).toBe(275);
    expect(result?.fill?.rateSourceLabel).toBe('National-average planning allowance');
  });
});
