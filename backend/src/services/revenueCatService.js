const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';
const ENTITLEMENT_ID = 'founding_full';
const { getPool } = require('./database');
let schemaPromise = null;
const memoryEntitlements = new Map();

function getRevenueCatSecret() {
  return String(process.env.REVENUECAT_SECRET_API_KEY || '').trim();
}

function getWebhookAuth() {
  return String(process.env.REVENUECAT_WEBHOOK_AUTH || '').trim();
}

function isEntitlementActive(entitlement) {
  if (!entitlement || !entitlement.expires_date) return Boolean(entitlement);
  return new Date(entitlement.expires_date).getTime() > Date.now();
}

async function fetchCustomerInfo(appUserId) {
  const secret = getRevenueCatSecret();
  if (!secret) {
    const error = new Error('RevenueCat server API key is not configured');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(
    `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/json',
      },
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload?.message || `RevenueCat customer lookup failed (${response.status})`,
    );
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  return payload?.subscriber || payload;
}

function entitlementFromCustomerInfo(customerInfo) {
  const entitlement = customerInfo?.entitlements?.[ENTITLEMENT_ID];
  return {
    entitlementId: ENTITLEMENT_ID,
    active: isEntitlementActive(entitlement),
    productId: entitlement?.product_identifier || null,
    expiresAt: entitlement?.expires_date || null,
    purchasedAt: entitlement?.purchase_date || null,
    store: entitlement?.store || null,
    originalAppUserId: customerInfo?.original_app_user_id || null,
  };
}

async function ensureSchema() {
  if (!process.env.DATABASE_URL) return null;
  if (!schemaPromise) {
    const pool = getPool();
    schemaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS revenuecat_entitlements (
          app_user_id TEXT PRIMARY KEY,
          entitlement_id TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT FALSE,
          product_id TEXT,
          expires_at TIMESTAMPTZ,
          purchased_at TIMESTAMPTZ,
          store TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS revenuecat_entitlements_active_idx
          ON revenuecat_entitlements (active);
      `)
      .then(() => pool)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

async function upsertEntitlement(appUserId, entitlement) {
  const value = { appUserId, ...entitlement };
  memoryEntitlements.set(appUserId, value);
  const pool = await ensureSchema();
  if (!pool) return value;
  await pool.query(
    `INSERT INTO revenuecat_entitlements
      (app_user_id, entitlement_id, active, product_id, expires_at, purchased_at, store)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (app_user_id) DO UPDATE SET
       entitlement_id = EXCLUDED.entitlement_id,
       active = EXCLUDED.active,
       product_id = EXCLUDED.product_id,
       expires_at = EXCLUDED.expires_at,
       purchased_at = EXCLUDED.purchased_at,
       store = EXCLUDED.store,
       updated_at = NOW()`,
    [
      appUserId,
      entitlement.entitlementId,
      entitlement.active,
      entitlement.productId,
      entitlement.expiresAt,
      entitlement.purchasedAt,
      entitlement.store,
    ],
  );
  return value;
}

async function resolveEntitlement(appUserId) {
  const customerInfo = await fetchCustomerInfo(appUserId);
  return upsertEntitlement(appUserId, entitlementFromCustomerInfo(customerInfo));
}

function assertWebhookAuthorized(request) {
  const expected = getWebhookAuth();
  if (!expected) return process.env.NODE_ENV !== 'production';
  const provided = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return provided === expected;
}

module.exports = {
  ENTITLEMENT_ID,
  assertWebhookAuthorized,
  entitlementFromCustomerInfo,
  ensureSchema,
  fetchCustomerInfo,
  resolveEntitlement,
  upsertEntitlement,
};
