-- ============================================================================
-- HOTFIX: Create user_subscriptions_with_usage view for production
-- Production DB doesn't have subscriptions/usage_tracking tables yet
-- This creates a simplified view that allows uploads to work
-- ============================================================================

-- Create a view that gives all users unlimited free access
CREATE OR REPLACE VIEW user_subscriptions_with_usage AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  NULL::TEXT as subscription_id,
  NULL::TEXT as stripe_subscription_id,
  NULL::TEXT as stripe_customer_id,
  'free' as plan_type,
  'active' as subscription_status,
  NOW() as current_period_start,
  NOW() + INTERVAL '30 days' as current_period_end,
  FALSE as cancel_at_period_end,
  0 as manuscripts_this_period,
  999999 as monthly_limit  -- Unlimited for now
FROM users u;

-- Verify the view works
SELECT * FROM user_subscriptions_with_usage LIMIT 1;
