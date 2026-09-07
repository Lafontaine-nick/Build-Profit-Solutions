import {
  buildBacksplashDemoPricingDetails,
  resolveKitchenBacksplashDemoSuggestedPricing,
} from '@/utils/kitchenBacksplashDemoPricing';

describe('kitchenBacksplashDemoPricing', () => {
  it('defaults to moderate removal when difficulty is unset', () => {
    const details = buildBacksplashDemoPricingDetails({ sqft: 28, difficulty: null });
    expect(details.total).toBe(210);
    expect(details.rate).toBe(7.5);
  });

  it('prices light, moderate, and extensive tiers per sqft', () => {
    expect(
      buildBacksplashDemoPricingDetails({ sqft: 28, difficulty: 'light' }).total
    ).toBe(126);
    expect(
      buildBacksplashDemoPricingDetails({ sqft: 28, difficulty: 'moderate' }).total
    ).toBe(210);
    expect(
      buildBacksplashDemoPricingDetails({ sqft: 28, difficulty: 'extensive' }).total
    ).toBe(336);
  });

  it('prices unsure as moderate with planning assumption', () => {
    const details = buildBacksplashDemoPricingDetails({ sqft: 28, difficulty: 'unsure' });
    expect(details.total).toBe(210);
    expect(details.planningAssumption).toMatch(/moderate removal/i);
  });

  it('returns suggested pricing with material/labor split', () => {
    const pricing = resolveKitchenBacksplashDemoSuggestedPricing({
      sqft: 40,
      difficulty: 'moderate',
    });
    expect(pricing?.fill).toMatchObject({
      material: 30,
      labor: 270,
      total: 300,
      basis: { quantity: 40, unit: 'sqft' },
    });
    expect(pricing?.fill?.pricingRecordId).toBe(
      'bps_national:backsplash_demo:kitchen:moderate:40sf'
    );
  });
});
