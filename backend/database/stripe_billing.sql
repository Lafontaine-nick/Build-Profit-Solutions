-- Stripe billing state and webhook idempotency.
-- Safe to run repeatedly before production billing is enabled.

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
