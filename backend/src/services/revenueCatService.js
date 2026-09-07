const {
  ENTITLEMENT_FOUNDING_FULL,
  isKnownAppleProductId,
} = require('../constants/billingCatalog');
const { upsertEntitlement } = require('./billingEntitlementStore');

const RC_API_BASE = 'https://api.revenuecat.com/v1';

function getSecretKey() {
  return String(process.env.REVENUECAT_SECRET_API_KEY || '').trim();
}

function isRevenueCatConfigured() {
  const key = getSecretKey();
  return key.length > 0 && !key.includes('your_');
}

async function fetchSubscriber(appUserId) {
  const secret = getSecretKey();
  if (!secret) {
    throw new Error('RevenueCat is not configured');
  }
  const id = encodeURIComponent(String(appUserId).trim());
  const response = await fetch(`${RC_API_BASE}/subscribers/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      json?.message || json?.code || `RevenueCat subscriber fetch failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return json;
}

function parseIsoDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapRcEntitlementToStatus(entitlementInfo) {
  if (!entitlementInfo || typeof entitlementInfo !== 'object') {
    return { status: 'none', isActive: false };
  }

  const expiresDate = parseIsoDate(entitlementInfo.expires_date);
  const graceExpires = parseIsoDate(entitlementInfo.grace_period_expires_date);
  const billingIssue = parseIsoDate(entitlementInfo.billing_issues_detected_at);
  const unsubscribeDetected = parseIsoDate(entitlementInfo.unsubscribe_detected_at);
  const now = new Date();

  if (graceExpires && new Date(graceExpires) > now) {
    return {
      status: 'grace_period',
      expiresAt: expiresDate,
      gracePeriodExpiresAt: graceExpires,
      cancelAtPeriodEnd: Boolean(unsubscribeDetected),
      isActive: true,
    };
  }

  if (expiresDate && new Date(expiresDate) <= now) {
    return {
      status: 'expired',
      expiresAt: expiresDate,
      gracePeriodExpiresAt: graceExpires,
      cancelAtPeriodEnd: Boolean(unsubscribeDetected),
      isActive: false,
    };
  }

  if (billingIssue && (!expiresDate || new Date(expiresDate) > now)) {
    return {
      status: 'grace_period',
      expiresAt: expiresDate,
      gracePeriodExpiresAt: graceExpires,
      cancelAtPeriodEnd: Boolean(unsubscribeDetected),
      isActive: true,
    };
  }

  const periodType = String(entitlementInfo.period_type || '').toLowerCase();
  const isTrial = periodType === 'trial' || periodType === 'intro';

  return {
    status: isTrial ? 'trialing' : 'active',
    expiresAt: expiresDate,
    gracePeriodExpiresAt: graceExpires,
    cancelAtPeriodEnd: Boolean(unsubscribeDetected),
    isActive: true,
  };
}

function extractFoundingEntitlement(subscriberPayload) {
  const entitlements = subscriberPayload?.subscriber?.entitlements || {};
  const founding = entitlements[ENTITLEMENT_FOUNDING_FULL];
  if (!founding) {
    return null;
  }

  const mapped = mapRcEntitlementToStatus(founding);
  const productId =
    founding.product_identifier ||
    subscriberPayload?.subscriber?.subscriptions?.[founding.product_identifier]?.product_identifier ||
    null;

  return {
    ...mapped,
    productId: productId && isKnownAppleProductId(productId) ? productId : founding.product_identifier,
    originalTransactionId:
      subscriberPayload?.subscriber?.subscriptions?.[founding.product_identifier]
        ?.store_transaction_id || null,
  };
}

async function syncEntitlementFromRevenueCat(clerkUserId) {
  const payload = await fetchSubscriber(clerkUserId);
  const parsed = extractFoundingEntitlement(payload);

  if (!parsed || !parsed.isActive) {
    const record = await upsertEntitlement({
      clerkUserId,
      entitlement: ENTITLEMENT_FOUNDING_FULL,
      status: parsed?.status || 'expired',
      expiresAt: parsed?.expiresAt || null,
      gracePeriodExpiresAt: parsed?.gracePeriodExpiresAt || null,
      cancelAtPeriodEnd: parsed?.cancelAtPeriodEnd === true,
      productId: parsed?.productId || null,
      originalTransactionId: parsed?.originalTransactionId || null,
    });
    return { record, subscriber: payload, isActive: false };
  }

  const record = await upsertEntitlement({
    clerkUserId,
    entitlement: ENTITLEMENT_FOUNDING_FULL,
    status: parsed.status,
    expiresAt: parsed.expiresAt,
    gracePeriodExpiresAt: parsed.gracePeriodExpiresAt,
    cancelAtPeriodEnd: parsed.cancelAtPeriodEnd,
    productId: parsed.productId,
    originalTransactionId: parsed.originalTransactionId,
  });

  return { record, subscriber: payload, isActive: true };
}

function mapWebhookEventToEntitlement(event) {
  const appUserId = event?.app_user_id || event?.subscriber?.app_user_id;
  const eventType = String(event?.type || '').toUpperCase();
  const productId =
    event?.product_id ||
    event?.new_product_id ||
    event?.entitlement_ids?.[0] ||
    null;

  let status = 'active';
  if (eventType.includes('EXPIRATION') || eventType === 'EXPIRED') {
    status = 'expired';
  } else if (eventType.includes('CANCELLATION') || eventType === 'CANCELLATION') {
    status = 'cancelled';
  } else if (eventType.includes('BILLING_ISSUE')) {
    status = 'grace_period';
  } else if (eventType.includes('REFUND')) {
    status = 'refunded';
  } else if (eventType.includes('INITIAL_PURCHASE') || eventType.includes('RENEWAL')) {
    status = 'active';
  } else if (eventType.includes('TRIAL')) {
    status = 'trialing';
  }

  const expiresAt = parseIsoDate(
    event?.expiration_at_ms != null ? Number(event.expiration_at_ms) : event?.expiration_at,
  );
  const gracePeriodExpiresAt = parseIsoDate(
    event?.grace_period_expiration_at_ms != null
      ? Number(event.grace_period_expiration_at_ms)
      : event?.grace_period_expiration_at,
  );

  return {
    clerkUserId: appUserId,
    entitlement: ENTITLEMENT_FOUNDING_FULL,
    status,
    productId,
    expiresAt,
    gracePeriodExpiresAt,
    cancelAtPeriodEnd: status === 'cancelled',
    originalTransactionId: event?.original_transaction_id || event?.transaction_id || null,
  };
}

module.exports = {
  isRevenueCatConfigured,
  fetchSubscriber,
  syncEntitlementFromRevenueCat,
  extractFoundingEntitlement,
  mapWebhookEventToEntitlement,
};
