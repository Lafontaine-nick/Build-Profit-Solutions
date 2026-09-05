import {
  APPLE_PRODUCT_IDS,
  ENTITLEMENT_FOUNDING_FULL,
  ENTITLEMENT_TO_PLAN_ID,
  FOUNDING_PLAN_FEATURES,
  REVENUECAT_OFFERING_ID,
  entitlementToPlanId,
  isKnownAppleProductId,
} from '@/constants/billingCatalog';

describe('billingCatalog', () => {
  it('uses stable Apple product ids without embedded prices', () => {
    expect(APPLE_PRODUCT_IDS.monthly).toBe('com.buildprofitsolutions.founding.monthly');
    expect(APPLE_PRODUCT_IDS.annual).toBe('com.buildprofitsolutions.founding.annual');
  });

  it('maps founding_full to premium plan id', () => {
    expect(ENTITLEMENT_TO_PLAN_ID[ENTITLEMENT_FOUNDING_FULL]).toBe('premium');
    expect(entitlementToPlanId(ENTITLEMENT_FOUNDING_FULL)).toBe('premium');
  });

  it('recognizes configured product ids', () => {
    expect(isKnownAppleProductId(APPLE_PRODUCT_IDS.monthly)).toBe(true);
    expect(isKnownAppleProductId('com.example.other')).toBe(false);
  });

  it('uses founding offering id', () => {
    expect(REVENUECAT_OFFERING_ID).toBe('founding');
  });

  it('exposes founding plan feature list for billing UI', () => {
    expect(FOUNDING_PLAN_FEATURES.length).toBeGreaterThan(0);
    expect(FOUNDING_PLAN_FEATURES[0]).toMatch(/Unlimited projects/i);
  });
});
