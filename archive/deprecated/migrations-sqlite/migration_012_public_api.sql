-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- ============================================================================
-- MIGRATION 012: Public API & Webhooks System
-- Created: 2025-10-31
-- Purpose: Add tables for Enterprise tier API access, API keys, webhooks, and usage tracking
-- Ticket: MAN-14
-- ============================================================================

-- ============================================================================
-- API KEYS TABLE
-- Stores API keys for Enterprise tier programmatic access
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users (Enterprise tier only)

  -- Key identification
  key_id TEXT NOT NULL UNIQUE,            -- First part of API key (16 chars hex)
  hashed_secret TEXT NOT NULL,            -- SHA-256 hash of secret (never store plain secret)
  name TEXT NOT NULL,                     -- Descriptive name for the key

  -- Permissions
  scopes TEXT NOT NULL,                   -- JSON array: ['manuscripts:read', 'manuscripts:write', '*']

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 100,   -- Requests per minute
  rate_limit_per_day INTEGER DEFAULT 10000,    -- Requests per day

  -- Status
  is_active INTEGER DEFAULT 1,            -- Boolean: key is active
  created_at BIGINT NOT NULL,            -- Unix timestamp
  last_used_at INTEGER,                   -- Unix timestamp
  revoked_at INTEGER,                     -- Unix timestamp when revoked

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- ============================================================================
-- API USAGE LOGS TABLE
-- Tracks API usage for rate limiting and analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id TEXT PRIMARY KEY,                    -- UUID
  api_key_id TEXT NOT NULL,               -- Foreign key to api_keys (not key_id, but db id)

  -- Request details
  endpoint TEXT NOT NULL,                 -- e.g., '/api/v1/manuscripts'
  method TEXT NOT NULL,                   -- GET, POST, PUT, DELETE
  status_code INTEGER NOT NULL,           -- HTTP status code
  response_time_ms INTEGER,               -- Response time in milliseconds

  -- Timestamp
  timestamp INTEGER NOT NULL              -- Unix timestamp
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_logs(endpoint);

-- ============================================================================
-- WEBHOOKS TABLE
-- Stores webhook configurations for event notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Webhook configuration
  url TEXT NOT NULL,                      -- Webhook delivery URL
  events TEXT NOT NULL,                   -- JSON array of event types
  secret TEXT NOT NULL,                   -- Secret for HMAC signature verification

  -- Status
  is_active INTEGER DEFAULT 1,            -- Boolean: webhook is active
  created_at BIGINT NOT NULL,            -- Unix timestamp
  last_delivery_at INTEGER,               -- Unix timestamp of last successful delivery

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);

-- ============================================================================
-- WEBHOOK DELIVERIES TABLE
-- Logs webhook delivery attempts
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,                    -- UUID
  webhook_id TEXT NOT NULL,               -- Foreign key to webhooks
  delivery_id TEXT NOT NULL,              -- Unique delivery attempt ID

  -- Delivery details
  event_type TEXT NOT NULL,               -- Event type (e.g., 'manuscript.uploaded')
  status_code INTEGER NOT NULL,           -- HTTP status code (0 if network error)
  error_message TEXT,                     -- Error message if failed

  -- Timestamp
  delivered_at INTEGER NOT NULL,          -- Unix timestamp

  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered ON webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type);

-- ============================================================================
-- WEBHOOK RETRIES TABLE
-- Tracks scheduled webhook retry attempts
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_retries (
  id TEXT PRIMARY KEY,                    -- UUID
  webhook_id TEXT NOT NULL,               -- Foreign key to webhooks
  delivery_id TEXT NOT NULL,              -- Original delivery ID

  -- Retry details
  attempt INTEGER NOT NULL,               -- Retry attempt number (1-5)
  scheduled_at INTEGER NOT NULL,          -- Unix timestamp when retry should execute
  payload TEXT NOT NULL,                  -- JSON payload to deliver

  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_retries_scheduled ON webhook_retries(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_webhook_retries_webhook ON webhook_retries(webhook_id);

-- ============================================================================
-- API ANALYTICS VIEWS
-- Pre-computed views for API analytics
-- ============================================================================

-- View: API usage summary by user
CREATE OR REPLACE VIEW api_usage_summary AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT ak.id) as total_api_keys,
  COUNT(DISTINCT CASE WHEN ak.is_active = 1 THEN ak.id END) as active_api_keys,
  COUNT(aul.id) as total_api_requests,
  AVG(aul.response_time_ms) as avg_response_time,
  SUM(CASE WHEN aul.status_code >= 200 AND aul.status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN aul.status_code >= 400 THEN 1 ELSE 0 END) as error_requests
FROM users u
LEFT JOIN api_keys ak ON u.id = ak.user_id
LEFT JOIN api_usage_logs aul ON ak.id = aul.api_key_id
WHERE u.subscription_tier = 'enterprise'
GROUP BY u.id, u.email, u.subscription_tier;

-- View: API endpoint popularity
CREATE OR REPLACE VIEW api_endpoint_stats AS
SELECT
  endpoint,
  method,
  COUNT(*) as total_requests,
  AVG(response_time_ms) as avg_response_time,
  MIN(response_time_ms) as min_response_time,
  MAX(response_time_ms) as max_response_time,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests,
  (SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
FROM api_usage_logs
GROUP BY endpoint, method
ORDER BY total_requests DESC;

-- View: Recent API activity
CREATE OR REPLACE VIEW recent_api_activity AS
SELECT
  u.email as user_email,
  ak.name as api_key_name,
  aul.endpoint,
  aul.method,
  aul.status_code,
  aul.response_time_ms,
  aul.timestamp
FROM api_usage_logs aul
JOIN api_keys ak ON aul.api_key_id = ak.id
JOIN users u ON ak.user_id = u.id
ORDER BY aul.timestamp DESC
LIMIT 100;

-- View: Webhook delivery health
CREATE OR REPLACE VIEW webhook_health AS
SELECT
  w.id as webhook_id,
  u.email as user_email,
  w.url as webhook_url,
  w.is_active,
  COUNT(wd.id) as total_deliveries,
  SUM(CASE WHEN wd.status_code >= 200 AND wd.status_code < 300 THEN 1 ELSE 0 END) as successful_deliveries,
  SUM(CASE WHEN wd.status_code >= 400 OR wd.status_code = 0 THEN 1 ELSE 0 END) as failed_deliveries,
  (SUM(CASE WHEN wd.status_code >= 200 AND wd.status_code < 300 THEN 1 ELSE 0 END) * 100.0 / COUNT(wd.id)) as success_rate,
  MAX(wd.delivered_at) as last_delivery_at
FROM webhooks w
JOIN users u ON w.user_id = u.id
LEFT JOIN webhook_deliveries wd ON w.id = wd.webhook_id
GROUP BY w.id, u.email, w.url, w.is_active;

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================
INSERT INTO schema_version (version, applied_at, description)
VALUES (12, strftime('%s', 'now'), 'Migration 012: Public API & Webhooks System (MAN-14)');

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration adds Enterprise tier API access capabilities:
--
-- 1. api_keys: Secure API key management
--    - Key generation with SHA-256 hashing
--    - Scoped permissions (manuscripts:read, manuscripts:write, etc.)
--    - Per-key rate limiting
--    - Key lifecycle management (active, revoked)
--
-- 2. api_usage_logs: Request tracking and analytics
--    - Endpoint usage tracking
--    - Response time monitoring
--    - Status code distribution
--    - Rate limit enforcement data
--
-- 3. webhooks: Event notification system
--    - User-configured webhook URLs
--    - Event filtering (subscribe to specific events)
--    - HMAC signature authentication
--    - Enable/disable webhooks
--
-- 4. webhook_deliveries: Delivery tracking
--    - Success/failure logging
--    - Response codes and error messages
--    - Delivery history for debugging
--
-- 5. webhook_retries: Automatic retry handling
--    - Exponential backoff (1min, 5min, 25min, 2hr, 10hr)
--    - Up to 5 retry attempts
--    - Payload persistence for retries
--
-- 6. Views: Analytics and monitoring
--    - API usage summary per user
--    - Endpoint performance metrics
--    - Recent API activity feed
--    - Webhook delivery health
--
-- Security Features:
-- - API keys never stored in plain text (SHA-256 hashed)
-- - Webhook payloads signed with HMAC-SHA256
-- - Rate limiting per key (per-minute and per-day)
-- - Scoped permissions (principle of least privilege)
--
-- Integration Points:
-- - Links to users table (Enterprise tier only)
-- - Works with existing manuscript analysis workflow
-- - Event-driven architecture via webhooks
-- - Cost tracking via existing cost_tracking table
--
-- Business Value:
-- - Enterprise tier differentiator
-- - Enables B2B integrations
-- - Programmatic access for automation
-- - Webhook notifications for DOUBLE PRECISION-time updates
-- - API usage tracking for billing
-- - Self-service API key management
--
-- Available API Endpoints:
-- - POST /api/v1/manuscripts - Upload manuscript
-- - GET /api/v1/manuscripts - List manuscripts
-- - POST /api/v1/manuscripts/:id/analyze - Trigger analysis
-- - GET /api/v1/manuscripts/:id/status - Check status
-- - GET /api/v1/manuscripts/:id/results - Get results
-- - POST /api/v1/webhooks - Configure webhooks
-- - GET /api/v1/usage - Get usage stats
--
-- Available Webhook Events:
-- - manuscript.uploaded
-- - manuscript.updated
-- - manuscript.deleted
-- - analysis.started
-- - analysis.complete
-- - analysis.failed
-- - assets.started
-- - assets.complete
-- - assets.failed
-- - audiobook.generated
-- - review.new
-- - review.negative
-- - publishing.started
-- - publishing.complete
-- - * (all events)
--
-- API Authentication:
-- - Bearer token authentication
-- - Format: Authorization: Bearer sk_{keyId}_{secret}
-- - Keys generated via dashboard or API
--
-- Rate Limits (default):
-- - 100 requests per minute
-- - 10,000 requests per day
-- - Customizable per key
--
-- Webhook Signature Verification:
-- - X-Webhook-Signature: sha256={hmac}
-- - Payload signed with webhook secret
-- - Prevents unauthorized deliveries
--
-- Future Enhancements:
-- 1. OAuth 2.0 flow for third-party apps
-- 2. API key rotation/regeneration
-- 3. More granular permissions (read-only, write-only per resource)
-- 4. API versioning strategy
-- 5. GraphQL API alongside REST
-- 6. SDK generation (Python, Node.js, Ruby)
-- 7. API marketplace for integrations
-- 8. Webhook event filtering (advanced rules)
-- ============================================================================
