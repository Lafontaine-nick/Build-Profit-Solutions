const { getPool } = require('./database');
const { ENTITLEMENT_FOUNDING_FULL } = require('../constants/billingCatalog');

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'grace_period']);

let schemaPromise = null;
const memoryEntitlements = new Map();
const memoryWebhookEvents = new Set();

async function ensureSchema() {
  if (!process.env.DATABASE_URL) return null;
  if (!schemaPromise) {
    const pool = getPool();
    schemaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS user_entitlements (
          clerk_user_id TEXT PRIMARY KEY,
          entitlement TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT 'revenuecat',
          external_customer_id TEXT,
          product_id TEXT,
          status TEXT NOT NULL,
          expires_at TIMESTAMPTZ,
          grace_period_expires_at TIMESTAMPTZ,
          cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
          original_transaction_id TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS user_entitlements_status_idx
          ON user_entitlements (status);
        CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          clerk_user_id TEXT,
          payload JSONB NOT NULL,
          processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS revenuecat_webhook_events_clerk_idx
          ON revenuecat_webhook_events (clerk_user_id);
      `)
      .then(() => pool)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

function normalizeRecord(row) {
  if (!row) return null;
  return {
    clerkUserId: row.clerk_user_id,
    entitlement: row.entitlement,
    provider: row.provider,
    externalCustomerId: row.external_customer_id,
    productId: row.product_id,
    status: row.status,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    gracePeriodExpiresAt: row.grace_period_expires_at
      ? new Date(row.grace_period_expires_at).toISOString()
      : null,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    originalTransactionId: row.original_transaction_id,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function isRecordActive(record, now = new Date()) {
  if (!record) return false;
  const status = String(record.status || '').toLowerCase();

  if (status === 'refunded' || status === 'expired') {
    return false;
  }

  const graceEnd = record.gracePeriodExpiresAt ? new Date(record.gracePeriodExpiresAt) : null;
  if (graceEnd && graceEnd > now) {
    return true;
  }

  const expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
  if (expiresAt && expiresAt <= now) {
    return false;
  }

  if (ACTIVE_STATUSES.has(status)) {
    return true;
  }

  if (status === 'cancelled' && expiresAt && expiresAt > now) {
    return true;
  }

  return false;
}

async function getEntitlementByClerkUserId(clerkUserId) {
  if (!clerkUserId) return null;
  const pool = await ensureSchema();
  if (!pool) {
    return normalizeRecord(memoryEntitlements.get(clerkUserId));
  }
  const result = await pool.query(
    `SELECT * FROM user_entitlements WHERE clerk_user_id = $1 LIMIT 1`,
    [clerkUserId],
  );
  return normalizeRecord(result.rows[0]);
}

async function upsertEntitlement(row) {
  const clerkUserId = String(row.clerkUserId || '').trim();
  if (!clerkUserId) {
    throw new Error('clerkUserId is required');
  }

  const value = {
    clerkUserId,
    entitlement: row.entitlement || ENTITLEMENT_FOUNDING_FULL,
    provider: row.provider || 'revenuecat',
    externalCustomerId: row.externalCustomerId || clerkUserId,
    productId: row.productId || null,
    status: row.status || 'unknown',
    expiresAt: row.expiresAt || null,
    gracePeriodExpiresAt: row.gracePeriodExpiresAt || null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    originalTransactionId: row.originalTransactionId || null,
  };

  memoryEntitlements.set(clerkUserId, {
    clerk_user_id: value.clerkUserId,
    entitlement: value.entitlement,
    provider: value.provider,
    external_customer_id: value.externalCustomerId,
    product_id: value.productId,
    status: value.status,
    expires_at: value.expiresAt,
    grace_period_expires_at: value.gracePeriodExpiresAt,
    cancel_at_period_end: value.cancelAtPeriodEnd,
    original_transaction_id: value.originalTransactionId,
    updated_at: new Date(),
  });

  const pool = await ensureSchema();
  if (!pool) {
    return normalizeRecord(memoryEntitlements.get(clerkUserId));
  }

  const result = await pool.query(
    `INSERT INTO user_entitlements (
      clerk_user_id, entitlement, provider, external_customer_id, product_id,
      status, expires_at, grace_period_expires_at, cancel_at_period_end,
      original_transaction_id, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      entitlement = EXCLUDED.entitlement,
      provider = EXCLUDED.provider,
      external_customer_id = EXCLUDED.external_customer_id,
      product_id = EXCLUDED.product_id,
      status = EXCLUDED.status,
      expires_at = EXCLUDED.expires_at,
      grace_period_expires_at = EXCLUDED.grace_period_expires_at,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      original_transaction_id = EXCLUDED.original_transaction_id,
      updated_at = NOW()
    RETURNING *`,
    [
      value.clerkUserId,
      value.entitlement,
      value.provider,
      value.externalCustomerId,
      value.productId,
      value.status,
      value.expiresAt,
      value.gracePeriodExpiresAt,
      value.cancelAtPeriodEnd,
      value.originalTransactionId,
    ],
  );
  return normalizeRecord(result.rows[0]);
}

async function recordWebhookEvent(eventId, eventType, clerkUserId, payload) {
  if (!eventId) return true;
  const pool = await ensureSchema();
  if (!pool) {
    if (memoryWebhookEvents.has(eventId)) return false;
    memoryWebhookEvents.add(eventId);
    return true;
  }
  const result = await pool.query(
    `INSERT INTO revenuecat_webhook_events (event_id, event_type, clerk_user_id, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType || 'unknown', clerkUserId || null, JSON.stringify(payload || {})],
  );
  return result.rowCount === 1;
}

function buildEntitlementResponse(record) {
  const active = isRecordActive(record);
  return {
    entitlement: record?.entitlement || null,
    status: record?.status || 'none',
    isActive: active,
    expiresAt: record?.expiresAt || null,
    gracePeriodExpiresAt: record?.gracePeriodExpiresAt || null,
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd === true,
    productId: record?.productId || null,
    provider: record?.provider || null,
  };
}

module.exports = {
  getEntitlementByClerkUserId,
  upsertEntitlement,
  recordWebhookEvent,
  isRecordActive,
  buildEntitlementResponse,
  /** @internal test helper */
  _resetMemoryForTests() {
    memoryEntitlements.clear();
    memoryWebhookEvents.clear();
    schemaPromise = null;
  },
};
