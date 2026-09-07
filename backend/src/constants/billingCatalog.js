/**
 * Canonical billing catalog — keep in sync with mobile/constants/billingCatalog.ts
 */

const ENTITLEMENT_FOUNDING_FULL = 'founding_full';

const REVENUECAT_OFFERING_ID = 'founding';

const APPLE_PRODUCT_IDS = {
  monthly: 'com.buildprofitsolutions.founding.monthly',
  annual: 'com.buildprofitsolutions.founding.annual',
};

/** Maps internal entitlement → legacy mobile plan id for existing UI hooks. */
const ENTITLEMENT_TO_PLAN_ID = {
  [ENTITLEMENT_FOUNDING_FULL]: 'premium',
};

const ALL_APPLE_PRODUCT_IDS = Object.values(APPLE_PRODUCT_IDS);

function isKnownAppleProductId(productId) {
  return ALL_APPLE_PRODUCT_IDS.includes(String(productId || '').trim());
}

module.exports = {
  ENTITLEMENT_FOUNDING_FULL,
  REVENUECAT_OFFERING_ID,
  APPLE_PRODUCT_IDS,
  ENTITLEMENT_TO_PLAN_ID,
  ALL_APPLE_PRODUCT_IDS,
  isKnownAppleProductId,
};
