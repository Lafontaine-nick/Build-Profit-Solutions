const { getPool } = require('./database');

let schemaPromise = null;
const memoryEvents = new Set();
const memoryEntitlements = new Map();

async function ensureSchema() {
  if (!process.env.DATABASE_URL) return null;
  if (!schemaPromise) {
    const pool = getPool();
    schemaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          payload JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS stripe_entitlements (
          customer_id TEXT PRIMARY KEY,
          email TEXT,
          subscription_id TEXT UNIQUE,
          status TEXT NOT NULL,
          price_id TEXT,
          current_period_end TIMESTAMPTZ,
          cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS stripe_entitlements_email_idx
          ON stripe_entitlements (LOWER(email));
      `)
      .then(() => pool)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}

async function recordEvent(event) {
  if (!event?.id) return true;
  const pool = await ensureSchema();
  if (!pool) {
    if (memoryEvents.has(event.id)) return false;
    memoryEvents.add(event.id);
    return true;
  }
  const result = await pool.query(
    `INSERT INTO stripe_webhook_events (event_id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (event_id) DO NOTHING`,
    [event.id, event.type || 'unknown', JSON.stringify(event)],
  );
  return result.rowCount === 1;
}

async function upsertEntitlement(subscription) {
  if (!subscription?.id) return;
  const customer =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;
  if (!customer) return;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const email =
    typeof subscription.customer === 'object' ? subscription.customer.email || null : null;
  const value = {
    customerId: customer,
    email,
    subscriptionId: subscription.id,
    status: subscription.status || 'unknown',
    priceId,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
  };
  memoryEntitlements.set(customer, value);

  const pool = await ensureSchema();
  if (!pool) return;
  await pool.query(
    `INSERT INTO stripe_entitlements
      (customer_id, email, subscription_id, status, price_id, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (customer_id) DO UPDATE SET
       email = EXCLUDED.email,
       subscription_id = EXCLUDED.subscription_id,
       status = EXCLUDED.status,
       price_id = EXCLUDED.price_id,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [
      value.customerId,
      value.email,
      value.subscriptionId,
      value.status,
      value.priceId,
      value.currentPeriodEnd,
      value.cancelAtPeriodEnd,
    ],
  );
}

async function markPaymentEvent(invoice) {
  if (!invoice?.id) return;
  const pool = await ensureSchema();
  if (pool) {
    await pool.query(
      `INSERT INTO stripe_webhook_events (event_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        `invoice:${invoice.id}:${invoice.status || 'unknown'}`,
        `invoice.${invoice.status || 'unknown'}`,
        JSON.stringify(invoice),
      ],
    );
  }
}

module.exports = {
  ensureSchema,
  recordEvent,
  upsertEntitlement,
  markPaymentEvent,
};
