const { ENTITLEMENT_ID, resolveEntitlement } = require('../services/revenueCatService');

function billingEnforcementEnabled() {
  return String(process.env.BILLING_ENFORCEMENT_ENABLED || '').toLowerCase() === 'true';
}

async function requireRevenueCatEntitlement(req, res, next) {
  if (!billingEnforcementEnabled()) return next();

  const appUserId = String(req.user?.userId || req.user?.sub || '').trim();
  if (!appUserId) return res.status(401).json({ error: 'Authenticated user id is required' });

  try {
    const entitlement = await resolveEntitlement(appUserId);
    if (!entitlement.active) {
      return res.status(403).json({
        error: 'Active subscription required',
        code: 'ENTITLEMENT_REQUIRED',
        entitlementId: ENTITLEMENT_ID,
      });
    }
    req.billingEntitlement = entitlement;
    return next();
  } catch (error) {
    console.error('[billing] entitlement enforcement failed:', error.message);
    return res.status(503).json({
      error: 'Subscription status could not be verified',
      code: 'ENTITLEMENT_VERIFICATION_UNAVAILABLE',
    });
  }
}

module.exports = { requireRevenueCatEntitlement };
