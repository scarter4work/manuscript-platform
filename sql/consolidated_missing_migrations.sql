-- ============================================================================
-- CONSOLIDATED MISSING MIGRATIONS (PostgreSQL Compatible)
-- ============================================================================
-- This file consolidates migrations 002-022 that were missing from production
-- Production database had migrations 020-038 applied, missing 002-019
--
-- Created: 2025-11-15
-- PostgreSQL Version: 12+
--
-- Usage:
--   psql $DATABASE_URL -f sql/consolidated_missing_migrations.sql
--
-- Included Migrations:
--   - migration_002: DMCA fields
--   - migration_003: Payment tables + user_subscriptions_with_usage view
--   - migration_004: Cost tracking & rate limiting
--   - migration_005: Full name field
--   - migration_006: Password reset tokens
--   - migration_007: Team collaboration
--   - migration_008: Email system
--   - migration_009: Audiobook tables (SKIPPED - complex, not critical)
--   - migration_010: Review system (SKIPPED - complex, not critical)
--   - migration_011-013: Publishing/API (SKIPPED - references missing tables)
--   - migration_019-022: Already applied or not needed
-- ============================================================================

BEGIN;

-- ============================================================================
-- MIGRATION 002: DMCA Fields
-- ============================================================================
DO $$
BEGIN
    -- Add DMCA-related columns to manuscripts if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='manuscripts' AND column_name='dmca_status') THEN
        ALTER TABLE manuscripts ADD COLUMN dmca_status TEXT DEFAULT 'clear';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='manuscripts' AND column_name='dmca_takedown_date') THEN
        ALTER TABLE manuscripts ADD COLUMN dmca_takedown_date TIMESTAMP;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION 003: Payment Processing Tables
-- ============================================================================

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Payment history table
CREATE TABLE IF NOT EXISTS payment_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_type TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON payment_history(subscription_id);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  tracked_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(billing_period_start, billing_period_end);

-- Critical view for upload functionality
CREATE OR REPLACE VIEW user_subscriptions_with_usage AS
SELECT
  u.id as user_id,
  u.email,
  COALESCE(u.subscription_tier, 'FREE') as subscription_tier,
  s.id as subscription_id,
  s.stripe_subscription_id,
  s.stripe_customer_id,
  COALESCE(s.plan_type, 'free') as plan_type,
  COALESCE(s.status, 'active') as subscription_status,
  s.current_period_start,
  s.current_period_end,
  COALESCE(s.cancel_at_period_end, FALSE) as cancel_at_period_end,
  COUNT(ut.id) as manuscripts_this_period,
  CASE
    WHEN COALESCE(s.plan_type, 'free') = 'free' THEN 999999
    WHEN s.plan_type = 'pro' THEN 999999
    WHEN s.plan_type = 'enterprise' THEN 999999
    ELSE 999999
  END as monthly_limit
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
  AND ut.billing_period_start = s.current_period_start
  AND ut.billing_period_end = s.current_period_end
GROUP BY u.id, u.email, u.subscription_tier, s.id, s.stripe_subscription_id,
         s.stripe_customer_id, s.plan_type, s.status, s.current_period_start,
         s.current_period_end, s.cancel_at_period_end;

-- Create default free subscriptions for all existing users
INSERT INTO subscriptions (id, user_id, stripe_customer_id, plan_type, status, current_period_start, current_period_end)
SELECT
  gen_random_uuid()::TEXT,
  id,
  'default_' || id,
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days'
FROM users
WHERE id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MIGRATION 004: Cost Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  cost_usd NUMERIC(10,4) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_manuscript ON cost_tracking(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_service ON cost_tracking(service);

-- ============================================================================
-- MIGRATION 005: Full Name (Already exists, skip)
-- ============================================================================
-- Column already exists in production

-- ============================================================================
-- MIGRATION 006: Password Reset Tokens (Already exists, skip)
-- ============================================================================
-- Table already exists in production

-- ============================================================================
-- MIGRATION 007: Team Collaboration
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  permissions JSONB,
  joined_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================================================
-- MIGRATION 008: Email System
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  from_email TEXT DEFAULT 'noreply@selfpubhub.co',
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for);

-- ============================================================================
-- Record migrations as applied
-- ============================================================================
INSERT INTO schema_migrations (migration_name, applied_at)
VALUES
  ('migration_002_dmca_fields', NOW()),
  ('migration_003_payment_tables', NOW()),
  ('migration_004_cost_tracking', NOW()),
  ('migration_007_team_collaboration', NOW()),
  ('migration_008_email_system', NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verification queries (run these to verify success)
-- ============================================================================
-- SELECT * FROM user_subscriptions_with_usage LIMIT 1;
-- SELECT COUNT(*) FROM subscriptions;
-- SELECT migration_name FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;
