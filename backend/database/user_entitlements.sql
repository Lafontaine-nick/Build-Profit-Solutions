-- User entitlements (RevenueCat / Apple IAP). Safe to run repeatedly.

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
