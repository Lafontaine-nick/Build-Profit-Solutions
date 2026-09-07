/**
 * Canonical billing catalog — keep in sync with backend/src/constants/billingCatalog.js
 */

export const ENTITLEMENT_FOUNDING_FULL = 'founding_full';

/** Alias used by legacy mobile billing helpers. */
export const REVENUECAT_ENTITLEMENT_ID = ENTITLEMENT_FOUNDING_FULL;

export const REVENUECAT_OFFERING_ID = 'founding';

/** App Store subscriptions are registered under the production bundle only. */
export const PRODUCTION_IOS_BUNDLE_ID = 'com.buildprofitsolutions.mobile';

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

/** Shown until App Store pricing is returned for the founding monthly product. */
export const FOUNDING_PROFESSIONAL_FALLBACK_PRICE = '$99/month';

export const FOUNDING_PROFESSIONAL_FEATURES = [
  'Unlimited projects',
  'Build with AI and AI Assistant',
  'Plan/PDF takeoff and photo scope detection',
  'SKU scanning and supplier price lookup',
  'Tax Center and receipt OCR',
  'Contractor-branded estimate PDFs',
  'Job costing, budgets, and change orders',
  'Project photos, daily logs, and calendar tools',
];

export const ALL_APPLE_PRODUCT_IDS = Object.values(APPLE_PRODUCT_IDS);

export function isKnownAppleProductId(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return ALL_APPLE_PRODUCT_IDS.includes(productId.trim() as (typeof ALL_APPLE_PRODUCT_IDS)[number]);
}

export function entitlementToPlanId(entitlement: string | null | undefined): string | null {
  if (!entitlement) return null;
  return ENTITLEMENT_TO_PLAN_ID[entitlement] ?? null;
}
