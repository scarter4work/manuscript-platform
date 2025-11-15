-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- ============================================================================
-- MIGRATION 004: Cost Tracking and Budget Management
-- Created: 2025-10-26
-- Purpose: Track operational costs and implement budget alerts
-- ============================================================================

-- ============================================================================
-- COST TRACKING TABLE
-- Tracks all billable operations with detailed cost attribution
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_tracking (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT,                           -- Foreign key to users (nullable for system operations)
  manuscript_id TEXT,                     -- Foreign key to manuscripts (nullable)
  cost_center TEXT NOT NULL,              -- claude_api, cloudflare_workers, cloudflare_d1, cloudflare_r2, cloudflare_kv, cloudflare_queues, stripe_fees, email
  feature_name TEXT NOT NULL,             -- analysis, asset_generation, formatting, social_media, auth, storage, etc
  operation TEXT NOT NULL,                -- Specific operation: analyze_developmental, generate_book_description, etc
  cost_usd DOUBLE PRECISION NOT NULL,                 -- Cost in USD
  tokens_input INTEGER,                   -- Input tokens for Claude API (nullable)
  tokens_output INTEGER,                  -- Output tokens for Claude API (nullable)
  metadata TEXT,                          -- JSON: additional details (model used, file sizes, etc)
  created_at BIGINT NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL
);

-- Indexes for cost analysis queries
CREATE INDEX IF NOT EXISTS idx_cost_user ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_manuscript ON cost_tracking(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_cost_center ON cost_tracking(cost_center);
CREATE INDEX IF NOT EXISTS idx_cost_feature ON cost_tracking(feature_name);
CREATE INDEX IF NOT EXISTS idx_cost_created ON cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_user_date ON cost_tracking(user_id, created_at);

-- ============================================================================
-- BUDGET CONFIGURATION TABLE
-- Stores budget limits and current spend tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget_config (
  id INTEGER PRIMARY KEY DEFAULT 1,      -- Single row config (enforced by CHECK)
  monthly_limit_usd DOUBLE PRECISION NOT NULL,       -- Total monthly budget in USD
  daily_limit_usd DOUBLE PRECISION,                  -- Optional daily limit
  alert_threshold_50 INTEGER DEFAULT 1,  -- Send alert at 50% (boolean)
  alert_threshold_75 INTEGER DEFAULT 1,  -- Send alert at 75% (boolean)
  alert_threshold_90 INTEGER DEFAULT 1,  -- Send alert at 90% (boolean)
  alert_threshold_100 INTEGER DEFAULT 1, -- Send alert at 100% (boolean)
  auto_disable_at_limit INTEGER DEFAULT 1, -- Auto-disable expensive features at 100% (boolean)
  current_month TEXT NOT NULL,           -- YYYY-MM format
  current_spend_usd DOUBLE PRECISION DEFAULT 0,      -- Running total for current month
  last_alert_sent TEXT,                  -- Last alert threshold reached
  updated_at BIGINT NOT NULL,           -- Unix timestamp
  CHECK (id = 1)                         -- Enforce single row
);

-- Initialize with default budget ($2000/month as per MAN-35)
INSERT INTO budget_config (
  id,
  monthly_limit_usd,
  daily_limit_usd,
  current_month,
  current_spend_usd,
  updated_at
) VALUES (
  1,
  2000.00,
  200.00,
  TO_CHAR(NOW(), 'YYYY-MM'),
  0.00,
  EXTRACT(EPOCH FROM NOW())::BIGINT
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- BUDGET ALERTS TABLE
-- Tracks all budget alerts sent to admins
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget_alerts (
  id TEXT PRIMARY KEY,                   -- UUID
  alert_type TEXT NOT NULL,              -- 50_percent, 75_percent, 90_percent, 100_percent, daily_limit, critical
  threshold_amount_usd DOUBLE PRECISION NOT NULL,    -- Budget threshold that triggered alert
  current_spend_usd DOUBLE PRECISION NOT NULL,       -- Actual spend when alert fired
  period TEXT NOT NULL,                  -- YYYY-MM or YYYY-MM-DD for daily alerts
  message TEXT NOT NULL,                 -- Alert message
  severity TEXT NOT NULL,                -- info, warning, critical
  sent_at BIGINT NOT NULL,              -- Unix timestamp when alert was sent
  acknowledged INTEGER DEFAULT 0,        -- Boolean: has admin reviewed?
  acknowledged_by TEXT,                  -- Admin user ID who acknowledged
  acknowledged_at INTEGER,               -- Unix timestamp of acknowledgment
  FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for alert management
CREATE INDEX IF NOT EXISTS idx_alerts_type ON budget_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_sent ON budget_alerts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON budget_alerts(acknowledged);

-- ============================================================================
-- USER COST LIMITS TABLE
-- Per-user monthly cost caps to prevent abuse
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_cost_limits (
  user_id TEXT PRIMARY KEY,              -- Foreign key to users
  monthly_limit_usd DOUBLE PRECISION NOT NULL,       -- Per-user monthly cost limit
  current_month TEXT NOT NULL,           -- YYYY-MM format
  current_spend_usd DOUBLE PRECISION DEFAULT 0,      -- Running total for current month
  limit_exceeded INTEGER DEFAULT 0,      -- Boolean: has limit been exceeded?
  exceeded_at INTEGER,                   -- Unix timestamp when limit was exceeded
  updated_at BIGINT NOT NULL,           -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for checking user limits
CREATE INDEX IF NOT EXISTS idx_user_limits_month ON user_cost_limits(current_month);

-- Initialize cost limits for existing users based on subscription tier
-- FREE: $5/month, PRO: $50/month, ENTERPRISE: $500/month
INSERT INTO user_cost_limits (user_id, monthly_limit_usd, current_month, updated_at)
SELECT
  id,
  CASE subscription_tier
    WHEN 'FREE' THEN 5.00
    WHEN 'PRO' THEN 50.00
    WHEN 'ENTERPRISE' THEN 500.00
    ELSE 5.00
  END,
  TO_CHAR(NOW(), 'YYYY-MM'),
  EXTRACT(EPOCH FROM NOW())::BIGINT
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- COST ANALYSIS VIEWS
-- Pre-computed views for common cost queries
-- ============================================================================

-- View: Daily cost breakdown
CREATE OR REPLACE VIEW daily_costs AS
SELECT
  DATE(TO_TIMESTAMP(created_at)) as date,
  cost_center,
  feature_name,
  COUNT(*) as operation_count,
  SUM(cost_usd) as total_cost_usd,
  SUM(tokens_input) as total_input_tokens,
  SUM(tokens_output) as total_output_tokens
FROM cost_tracking
GROUP BY DATE(TO_TIMESTAMP(created_at)), cost_center, feature_name
ORDER BY date DESC;

-- View: User cost summary (current month)
CREATE OR REPLACE VIEW user_monthly_costs AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT c.manuscript_id) as manuscripts_analyzed,
  COUNT(*) as total_operations,
  SUM(c.cost_usd) as total_cost_usd,
  l.monthly_limit_usd,
  l.current_spend_usd,
  l.limit_exceeded
FROM users u
LEFT JOIN cost_tracking c ON u.id = c.user_id AND TO_CHAR(TO_TIMESTAMP(c.created_at), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
LEFT JOIN user_cost_limits l ON u.id = l.user_id
GROUP BY u.id, u.email, u.subscription_tier, l.monthly_limit_usd, l.current_spend_usd, l.limit_exceeded;

-- View: Feature cost breakdown (current month)
CREATE OR REPLACE VIEW feature_costs_monthly AS
SELECT
  feature_name,
  cost_center,
  COUNT(*) as operation_count,
  SUM(cost_usd) as total_cost_usd,
  AVG(cost_usd) as avg_cost_usd,
  MIN(cost_usd) as min_cost_usd,
  MAX(cost_usd) as max_cost_usd
FROM cost_tracking
WHERE TO_CHAR(TO_TIMESTAMP(created_at), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY feature_name, cost_center
ORDER BY total_cost_usd DESC;

-- View: Top cost generators (users spending the most this month)
CREATE OR REPLACE VIEW top_spenders_monthly AS
SELECT
  u.id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT c.manuscript_id) as manuscripts,
  SUM(c.cost_usd) as total_spent_usd,
  l.monthly_limit_usd,
  ROUND((SUM(c.cost_usd) / l.monthly_limit_usd) * 100, 2) as limit_usage_percent
FROM users u
JOIN cost_tracking c ON u.id = c.user_id
LEFT JOIN user_cost_limits l ON u.id = l.user_id
WHERE TO_CHAR(TO_TIMESTAMP(c.created_at), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY u.id, u.email, u.subscription_tier, l.monthly_limit_usd
ORDER BY total_spent_usd DESC
LIMIT 50;

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================
INSERT INTO schema_version (version, applied_at, description)
VALUES (4, EXTRACT(EPOCH FROM NOW())::BIGINT, 'Migration 004: Cost Tracking and Budget Management')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration adds comprehensive cost tracking capabilities:
--
-- 1. cost_tracking: Logs every billable operation with cost attribution
-- 2. budget_config: Stores monthly budget limits and current spend
-- 3. budget_alerts: Tracks all budget alerts sent to admins
-- 4. user_cost_limits: Per-user monthly spending caps
-- 5. Views: Pre-computed cost analysis views for admin dashboard
--
-- Cost Attribution:
-- - Every Claude API call is tracked with input/output tokens
-- - Cloudflare service usage tracked per feature
-- - Stripe fees calculated and logged per transaction
-- - Email costs tracked per email sent
--
-- Budget Enforcement:
-- - Alerts sent at 50%, 75%, 90%, 100% thresholds
-- - Optional auto-disable expensive features at 100%
-- - Per-user limits prevent abuse
-- - Daily limits to catch runaway costs
--
-- Next Steps:
-- 1. Implement cost tracking middleware
-- 2. Add cost calculation utilities
-- 3. Build admin cost dashboard
-- 4. Set up email alerts for budget thresholds
-- ============================================================================
