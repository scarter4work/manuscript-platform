-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- Migration 003: Payment Processing Tables
-- Adds subscription management, payment history, and usage tracking
-- Created: October 13, 2025

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- Tracks user subscriptions and billing periods
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  stripe_subscription_id TEXT UNIQUE,     -- Stripe subscription ID
  stripe_customer_id TEXT NOT NULL,       -- Stripe customer ID
  plan_type TEXT NOT NULL,                -- free/pro/enterprise
  status TEXT NOT NULL,                   -- active/canceled/past_due/incomplete
  current_period_start INTEGER NOT NULL,  -- Unix timestamp
  current_period_end INTEGER NOT NULL,    -- Unix timestamp
  cancel_at_period_end INTEGER DEFAULT 0, -- Boolean: 0=will renew, 1=will cancel
  created_at BIGINT NOT NULL,            -- Unix timestamp
  updated_at BIGINT NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for subscription queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- PAYMENT HISTORY TABLE
-- Tracks all payments (subscriptions and one-time purchases)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  subscription_id TEXT,                   -- Foreign key to subscriptions (null for one-time)
  stripe_payment_intent_id TEXT,          -- Stripe payment intent ID
  stripe_invoice_id TEXT,                 -- Stripe invoice ID (for subscriptions)
  amount INTEGER NOT NULL,                -- Amount in cents
  currency TEXT DEFAULT 'usd',            -- Currency code
  payment_type TEXT NOT NULL,             -- subscription/one_time
  status TEXT NOT NULL,                   -- succeeded/pending/failed/refunded
  description TEXT,                       -- Human-readable description
  metadata TEXT,                          -- JSON: additional payment details
  created_at BIGINT NOT NULL,            -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- Indexes for payment history queries
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- ============================================================================
-- USAGE TRACKING TABLE
-- Tracks manuscript analyses for billing and limit enforcement
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  subscription_id TEXT,                   -- Foreign key to subscriptions (null for pay-per)
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  analysis_type TEXT NOT NULL,            -- full/basic
  assets_generated INTEGER DEFAULT 0,     -- Boolean: 0=no, 1=yes
  credits_used INTEGER DEFAULT 1,         -- Credits consumed (usually 1 per manuscript)
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  billing_period_start INTEGER NOT NULL,  -- For monthly limit tracking
  billing_period_end INTEGER NOT NULL,    -- For monthly limit tracking
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Indexes for usage tracking queries
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp DESC);

-- ============================================================================
-- ADD SUBSCRIPTION FIELD TO USERS TABLE
-- Track user's current subscription status
-- ============================================================================
-- ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
-- ^ Skipped: Column already exists from previous migration

-- ============================================================================
-- VIEW: Current User Subscriptions with Usage
-- Useful for checking limits and displaying billing info
-- ============================================================================
CREATE OR REPLACE VIEW user_subscriptions_with_usage AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  s.id as subscription_id,
  s.stripe_subscription_id,
  s.stripe_customer_id,
  s.plan_type,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  COUNT(ut.id) as manuscripts_this_period,
  CASE
    WHEN s.plan_type = 'free' THEN 1
    WHEN s.plan_type = 'pro' THEN 10
    WHEN s.plan_type = 'enterprise' THEN 999999
    ELSE 1
  END as monthly_limit
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
  AND ut.billing_period_start = s.current_period_start
  AND ut.billing_period_end = s.current_period_end
GROUP BY u.id, s.id;

-- ============================================================================
-- INSERT DEFAULT FREE SUBSCRIPTIONS FOR EXISTING USERS
-- Give all existing users a free subscription
-- ============================================================================
INSERT INTO subscriptions (id, user_id, stripe_customer_id, plan_type, status, current_period_start, current_period_end, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),  -- Generate UUID
  id,
  'default_' || id,             -- Placeholder customer ID
  'free',
  'active',
  strftime('%s', 'now'),
  strftime('%s', 'now', '+1 month'),
  strftime('%s', 'now'),
  strftime('%s', 'now')
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions WHERE subscriptions.user_id = users.id
);

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (3, strftime('%s', 'now'), 'Migration 003: Payment processing tables');
