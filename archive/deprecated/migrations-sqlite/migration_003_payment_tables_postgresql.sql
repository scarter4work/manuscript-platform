-- Migration 003: Payment Processing Tables (PostgreSQL Compatible)
-- Adds subscription management, payment history, and usage tracking
-- Created: October 13, 2025
-- Converted to PostgreSQL: November 15, 2025

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- Tracks user subscriptions and billing periods
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,                -- free/pro/enterprise
  status TEXT NOT NULL,                   -- active/canceled/past_due/incomplete
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

-- ============================================================================
-- PAYMENT HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount INTEGER NOT NULL,                -- Amount in cents
  currency TEXT DEFAULT 'usd',
  payment_type TEXT NOT NULL,             -- subscription/one_time
  status TEXT NOT NULL,                   -- succeeded/pending/failed/refunded
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- ============================================================================
-- USAGE TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,            -- manuscript/analysis/export
  resource_id TEXT NOT NULL,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  tracked_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(billing_period_start, billing_period_end);

-- ============================================================================
-- VIEW: Current User Subscriptions with Usage
-- ============================================================================
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
    WHEN COALESCE(s.plan_type, 'free') = 'free' THEN 1
    WHEN s.plan_type = 'pro' THEN 10
    WHEN s.plan_type = 'enterprise' THEN 999999
    ELSE 1
  END as monthly_limit
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
  AND ut.billing_period_start = s.current_period_start
  AND ut.billing_period_end = s.current_period_end
GROUP BY u.id, u.email, u.subscription_tier, s.id, s.stripe_subscription_id,
         s.stripe_customer_id, s.plan_type, s.status, s.current_period_start,
         s.current_period_end, s.cancel_at_period_end;

-- ============================================================================
-- INSERT DEFAULT FREE SUBSCRIPTIONS FOR EXISTING USERS
-- ============================================================================
INSERT INTO subscriptions (id, user_id, stripe_customer_id, plan_type, status, current_period_start, current_period_end, created_at, updated_at)
SELECT
  gen_random_uuid()::TEXT,
  id,
  'default_' || id,
  'free',
  'active',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
FROM users
WHERE id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT (id) DO NOTHING;
