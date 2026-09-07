const express = require('express');
const { authenticateToken } = require('../middleware/authenticateToken');
const {
  ENTITLEMENT_ID,
  assertWebhookAuthorized,
  entitlementFromCustomerInfo,
  resolveEntitlement,
} = require('../services/revenueCatService');

const router = express.Router();

function appUserIdForRequest(req) {
  return String(req.user?.userId || req.user?.sub || '').trim();
}

router.get('/entitlement', authenticateToken, async (req, res) => {
  const appUserId = appUserIdForRequest(req);
  if (!appUserId) return res.status(403).json({ error: 'Authenticated user id is required' });

  try {
    const entitlement = await resolveEntitlement(appUserId);
    res.json({ entitlement });
  } catch (error) {
    res.status(error.statusCode || 502).json({
      error: error.message || 'Unable to verify RevenueCat entitlement',
    });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  const appUserId = appUserIdForRequest(req);
  if (!appUserId) return res.status(403).json({ error: 'Authenticated user id is required' });

  try {
    const entitlement = await resolveEntitlement(appUserId);
    res.json({ entitlement });
  } catch (error) {
    res.status(error.statusCode || 502).json({
      error: error.message || 'Unable to sync RevenueCat entitlement',
    });
  }
});

router.post('/revenuecat-webhook', express.json(), async (req, res) => {
  if (!assertWebhookAuthorized(req)) {
    return res.status(401).json({ error: 'Invalid RevenueCat webhook authorization' });
  }

  const event = req.body?.event || {};
  const appUserId = String(event.app_user_id || event.original_app_user_id || '').trim();
  if (!appUserId) return res.status(400).json({ error: 'RevenueCat app user id is required' });

  // The webhook is intentionally idempotent. Entitlements are verified from RevenueCat
  // rather than trusting event fields supplied by the client or an old webhook payload.
  try {
    const entitlement = await resolveEntitlement(appUserId);
    console.log('[billing] RevenueCat entitlement updated', {
      appUserId,
      entitlementId: ENTITLEMENT_ID,
      active: entitlement.active,
      eventType: event.type || 'unknown',
    });
    return res.json({ received: true, entitlement });
  } catch (error) {
    console.error('[billing] RevenueCat webhook verification failed:', error.message);
    return res.status(error.statusCode || 502).json({ error: 'Webhook verification failed' });
  }
});

module.exports = router;
