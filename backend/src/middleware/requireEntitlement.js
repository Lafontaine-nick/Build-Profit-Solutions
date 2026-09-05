const {
  getEntitlementByClerkUserId,
  isRecordActive,
  buildEntitlementResponse,
} = require('../services/billingEntitlementStore');
const { ENTITLEMENT_FOUNDING_FULL } = require('../constants/billingCatalog');
const { isRevenueCatConfigured } = require('../services/revenueCatService');

function isBillingEnforcementEnabled() {
  const raw = process.env.BILLING_ENFORCEMENT_ENABLED;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return process.env.NODE_ENV === 'production' && isRevenueCatConfigured();
}

/**
 * @param {string} requiredEntitlement
 */
function requireEntitlement(requiredEntitlement = ENTITLEMENT_FOUNDING_FULL) {
  return async (req, res, next) => {
    if (!isBillingEnforcementEnabled()) {
      return next();
    }

    const clerkUserId = req.user?.userId;
    if (!clerkUserId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const record = await getEntitlementByClerkUserId(clerkUserId);
      const entitled =
        record &&
        record.entitlement === requiredEntitlement &&
        isRecordActive(record);

      if (!entitled) {
        return res.status(403).json({
          error: 'An active subscription is required to use this feature.',
          code: 'ENTITLEMENT_REQUIRED',
          requiredEntitlement,
          entitlement: buildEntitlementResponse(record),
        });
      }

      req.billingEntitlement = record;
      return next();
    } catch (error) {
      console.error('requireEntitlement error:', error);
      return res.status(503).json({
        error: 'Could not verify subscription status. Try again shortly.',
        code: 'ENTITLEMENT_CHECK_FAILED',
      });
    }
  };
}

module.exports = {
  requireEntitlement,
  isBillingEnforcementEnabled,
};
