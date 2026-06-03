-- Contractor Pricing Library / Pricing Memory (future-ready)
-- Run manually or via migration tooling when PostgreSQL is available.

CREATE TABLE IF NOT EXISTS contractor_pricing_memory (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    company_id VARCHAR(255),
    project_type VARCHAR(64),
    trade VARCHAR(64),
    category VARCHAR(32) NOT NULL DEFAULT 'labor',
    scope_item_name VARCHAR(255) NOT NULL,
    unit_type VARCHAR(32) NOT NULL DEFAULT 'lump_sum',
    quantity NUMERIC(14, 4),
    unit_rate NUMERIC(14, 4),
    labor_amount NUMERIC(14, 2),
    material_amount NUMERIC(14, 2),
    subcontractor_amount NUMERIC(14, 2),
    equipment_amount NUMERIC(14, 2),
    total_amount NUMERIC(14, 2),
    markup_pct NUMERIC(8, 2),
    margin_pct NUMERIC(8, 2),
    region VARCHAR(64),
    pricing_source VARCHAR(48) NOT NULL,
    bid_status VARCHAR(32) NOT NULL,
    project_id VARCHAR(128),
    estimate_id VARCHAR(128),
    actual_job_cost NUMERIC(14, 2),
    final_profit_margin NUMERIC(8, 2),
    is_test_bid BOOLEAN DEFAULT false,
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpm_user_trade ON contractor_pricing_memory(user_id, trade);
CREATE INDEX IF NOT EXISTS idx_cpm_user_scope ON contractor_pricing_memory(user_id, scope_item_name);
CREATE INDEX IF NOT EXISTS idx_cpm_user_unit ON contractor_pricing_memory(user_id, unit_type, unit_rate);

-- Optional JSONB preferences on user_settings (when column exists)
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pricing_memory_preferences JSONB DEFAULT '{}'::jsonb;
