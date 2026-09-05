const express = require('express');
const { authenticateToken } = require('../middleware/authenticateToken');
const {
  getEntitlementByClerkUserId,
  buildEntitlementResponse,
  recordWebhookEvent,
  upsertEntitlement,
} = require('../services/billingEntitlementStore');
const {
  syncEntitlementFromRevenueCat,
  mapWebhookEventToEntitlement,
  isRevenueCatConfigured,
} = require('../services/revenueCatService');
const { ENTITLEMENT_TO_PLAN_ID } = require('../constants/billingCatalog');

const router = express.Router();

function verifyRevenueCatWebhookAuth(req) {
  const expected = String(process.env.REVENUECAT_WEBHOOK_AUTH || '').trim();
  if (!expected || expected.includes('your_')) {
    return process.env.NODE_ENV !== 'production';
  }
  const header = String(req.headers.authorization || '').trim();
  if (!header) return false;
  if (header === expected) return true;
  if (header === `Bearer ${expected}`) return true;
  return false;
}

/**
 * GET /api/billing/entitlement — verified subscription state for the signed-in user.
 */
router.get('/entitlement', authenticateToken, async (req, res) => {
  try {
    const clerkUserId = req.user?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const record = await getEntitlementByClerkUserId(clerkUserId);
    const payload = buildEntitlementResponse(record);
    const planId = payload.entitlement
      ? ENTITLEMENT_TO_PLAN_ID[payload.entitlement] || null
      : null;

    return res.json({
      success: true,
      ...payload,
      planId,
    });
  } catch (error) {
    console.error('GET /billing/entitlement error:', error);
    return res.status(500).json({ error: 'Could not load subscription status' });
  }
});

/**
 * POST /api/billing/sync — required immediately after purchase or restore on iOS.
 * Queries RevenueCat with the authenticated Clerk user id and updates the DB.
 */
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const clerkUserId = req.user?.userId;
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!isRevenueCatConfigured()) {
      return res.status(503).json({
        error: 'Subscription sync is not configured on the server.',
        code: 'REVENUECAT_NOT_CONFIGURED',
      });
    }

    const { record, isActive } = await syncEntitlementFromRevenueCat(clerkUserId);
    const payload = buildEntitlementResponse(record);
    const planId = payload.entitlement
      ? ENTITLEMENT_TO_PLAN_ID[payload.entitlement] || null
      : null;

    return res.json({
      success: true,
      synced: true,
      isActive,
      ...payload,
      planId,
    });
  } catch (error) {
    console.error('POST /billing/sync error:', error);
    const status = error?.status === 404 ? 404 : 502;
    return res.status(status).json({
      error: error?.message || 'Subscription sync failed',
      code: 'SYNC_FAILED',
    });
  }
});

/**
 * POST /api/billing/revenuecat-webhook — lifecycle updates (renewal, cancel, refund, etc.)
 */
router.post('/revenuecat-webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    if (!verifyRevenueCatWebhookAuth(req)) {
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    const body = req.body || {};
    const event = body.event || body;
    const eventId = String(event?.id || event?.event_timestamp_ms || '').trim();
    const eventType = String(event?.type || 'unknown');

    if (!eventId) {
      return res.status(400).json({ error: 'Missing RevenueCat event id' });
    }

    const appUserId = String(event?.app_user_id || '').trim();
    const isNew = await recordWebhookEvent(eventId, eventType, appUserId, body);
    if (!isNew) {
      return res.json({ success: true, duplicate: true });
    }

    const mapped = mapWebhookEventToEntitlement(event);
    if (!mapped?.clerkUserId) {
      return res.json({ success: true, ignored: true });
    }

    await upsertEntitlement({
      clerkUserId: mapped.clerkUserId,
      entitlement: mapped.entitlement,
      status: mapped.status,
      productId: mapped.productId,
      expiresAt: mapped.expiresAt,
      gracePeriodExpiresAt: mapped.gracePeriodExpiresAt,
      cancelAtPeriodEnd: mapped.cancelAtPeriodEnd,
      originalTransactionId: mapped.originalTransactionId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /billing/revenuecat-webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
