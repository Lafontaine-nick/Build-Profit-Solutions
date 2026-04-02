-- Beta / launch feedback (run once on production DB, e.g. Render shell: psql $DATABASE_URL -f beta_feedback.sql)
CREATE TABLE IF NOT EXISTS beta_feedback (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  email VARCHAR(255),
  feedback_type VARCHAR(64) NOT NULL,
  severity VARCHAR(32),
  description TEXT NOT NULL,
  intended_action TEXT,
  expected_result TEXT,
  screenshot_data TEXT,
  route_name TEXT,
  feature_area VARCHAR(64),
  project_id VARCHAR(128),
  estimate_id VARCHAR(128),
  ai_context_flag BOOLEAN DEFAULT FALSE,
  app_version VARCHAR(64),
  platform VARCHAR(32),
  device_info TEXT,
  metadata JSONB,
  status VARCHAR(32) DEFAULT 'new',
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON beta_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback (status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback (feedback_type);

-- Lightweight telemetry (optional; logs key product events during beta)
CREATE TABLE IF NOT EXISTS app_telemetry_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  event_name VARCHAR(128) NOT NULL,
  properties JSONB,
  app_version VARCHAR(64),
  platform VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_created ON app_telemetry_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_event ON app_telemetry_events (event_name);
