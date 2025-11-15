-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- Migration 004: Add rate limiting support
-- MAN-25: Rate Limiting & DDoS Protection
-- Created: October 25, 2025

-- Add subscription_tier to users table for quick tier lookup during rate limiting
-- This denormalizes data from subscriptions table for performance
ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'FREE';

-- Update existing users to have FREE tier
UPDATE users SET subscription_tier = 'FREE' WHERE subscription_tier IS NULL;

-- Index for rate limit queries
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(subscription_tier);

-- Update subscription_tier when subscription changes (done in application code)
-- Possible values: 'FREE', 'PRO', 'ENTERPRISE'
-- Admin users bypass rate limits via role='admin'
