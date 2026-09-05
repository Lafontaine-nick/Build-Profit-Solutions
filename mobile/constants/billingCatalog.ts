/**
 * Canonical billing catalog — keep in sync with backend/src/constants/billingCatalog.js
 */

export const ENTITLEMENT_FOUNDING_FULL = 'founding_full';

export const REVENUECAT_OFFERING_ID = 'founding';

export const APPLE_PRODUCT_IDS = {
  monthly: 'com.buildprofitsolutions.founding.monthly',
  annual: 'com.buildprofitsolutions.founding.annual',
} as const;

export const REVENUECAT_PACKAGE_IDS = {
  monthly: '$rc_monthly',
  annual: '$rc_annual',
} as const;

/** Maps server entitlement → legacy mobile plan id for existing hooks. */
export const ENTITLEMENT_TO_PLAN_ID: Record<string, string> = {
  [ENTITLEMENT_FOUNDING_FULL]: 'premium',
};

export const FOUNDING_PLAN_DISPLAY_NAME = 'Founding Professional';

export const ALL_APPLE_PRODUCT_IDS = Object.values(APPLE_PRODUCT_IDS);

export function isKnownAppleProductId(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return ALL_APPLE_PRODUCT_IDS.includes(productId.trim() as (typeof ALL_APPLE_PRODUCT_IDS)[number]);
}

export function entitlementToPlanId(entitlement: string | null | undefined): string | null {
  if (!entitlement) return null;
  return ENTITLEMENT_TO_PLAN_ID[entitlement] ?? null;
}
