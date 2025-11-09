-- Migration 008: Advanced Email Notification System
-- Adds email preferences, logging, and comprehensive notification system
-- Created: October 30, 2025
-- Related: MAN-17

-- ============================================================================
-- EMAIL_PREFERENCES TABLE
-- Stores user preferences for each notification type
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_preferences (
  id TEXT PRIMARY KEY,                      -- UUID
  user_id TEXT NOT NULL,                    -- Foreign key to users

  -- Notification Type Preferences (1 = enabled, 0 = disabled)
  analysis_complete INTEGER DEFAULT 1,      -- Manuscript analysis finished
  asset_generation_complete INTEGER DEFAULT 1, -- Marketing assets ready
  payment_confirmation INTEGER DEFAULT 1,   -- Subscription created/renewed
  payment_failed INTEGER DEFAULT 1,         -- Payment declined (always important)
  usage_warning INTEGER DEFAULT 1,          -- Approaching manuscript limit
  dmca_notification INTEGER DEFAULT 1,      -- DMCA claim submitted
  team_invitation INTEGER DEFAULT 1,        -- Invited to team
  team_activity INTEGER DEFAULT 0,          -- Team activity updates
  weekly_digest INTEGER DEFAULT 1,          -- Weekly usage stats
  admin_alerts INTEGER DEFAULT 1,           -- Admin-only alerts

  -- Unsubscribe token for one-click unsubscribe
  unsubscribe_token TEXT UNIQUE,            -- One-click unsubscribe token

  -- Timestamps
  created_at INTEGER NOT NULL,              -- Unix timestamp
  updated_at INTEGER NOT NULL,              -- Unix timestamp

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)                           -- One preference row per user
);

-- Indexes for email preferences
CREATE INDEX IF NOT EXISTS idx_email_prefs_user ON email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_prefs_unsub_token ON email_preferences(unsubscribe_token);

-- ============================================================================
-- EMAIL_LOG TABLE
-- Logs all sent emails for tracking and analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,                      -- UUID
  user_id TEXT,                             -- Foreign key to users (null for admin emails)

  -- Email Details
  to_email TEXT NOT NULL,                   -- Recipient email
  subject TEXT NOT NULL,                    -- Email subject
  email_type TEXT NOT NULL,                 -- Type of notification

  -- Delivery Status
  status TEXT DEFAULT 'pending',            -- pending/sent/failed/bounced
  sent_at INTEGER,                          -- Unix timestamp when sent
  failed_at INTEGER,                        -- Unix timestamp when failed
  error_message TEXT,                       -- Error details if failed

  -- Tracking
  opened INTEGER DEFAULT 0,                 -- 1 if email was opened
  opened_at INTEGER,                        -- Unix timestamp when opened
  clicked INTEGER DEFAULT 0,                -- 1 if any link was clicked
  clicked_at INTEGER,                       -- Unix timestamp when clicked

  -- Metadata
  metadata TEXT,                            -- JSON: additional context
  created_at INTEGER NOT NULL,              -- Unix timestamp

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for email log
CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_sent_at ON email_log(sent_at DESC);

-- ============================================================================
-- VIEWS: Email Analytics
-- ============================================================================

-- View: Email stats by type
CREATE VIEW IF NOT EXISTS email_stats_by_type AS
SELECT
  email_type,
  COUNT(*) as total_sent,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN opened = 1 THEN 1 ELSE 0 END) as opened,
  SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) as clicked,
  ROUND(AVG(CASE WHEN opened = 1 THEN 100.0 ELSE 0 END), 2) as open_rate,
  ROUND(AVG(CASE WHEN clicked = 1 THEN 100.0 ELSE 0 END), 2) as click_rate
FROM email_log
WHERE status = 'sent'
GROUP BY email_type;

-- View: Recent email activity (last 7 days)
CREATE VIEW IF NOT EXISTS recent_email_activity AS
SELECT
  el.id,
  el.user_id,
  el.to_email,
  el.subject,
  el.email_type,
  el.status,
  el.sent_at,
  el.opened,
  el.clicked,
  u.email as user_email,
  u.full_name
FROM email_log el
LEFT JOIN users u ON el.user_id = u.id
WHERE el.created_at > strftime('%s', 'now', '-7 days')
ORDER BY el.created_at DESC;

-- ============================================================================
-- DEFAULT EMAIL PREFERENCES
-- ============================================================================

-- Create default email preferences for existing users
INSERT INTO email_preferences (
  id,
  user_id,
  unsubscribe_token,
  created_at,
  updated_at
)
SELECT
  hex(randomblob(16)),                      -- Generate UUID
  id,
  hex(randomblob(32)),                      -- Generate unsubscribe token
  strftime('%s', 'now'),
  strftime('%s', 'now')
FROM users
WHERE id NOT IN (SELECT user_id FROM email_preferences);

-- ============================================================================
-- EMAIL TYPE DEFINITIONS
-- ============================================================================
-- Email Types:
-- - analysis_complete: Manuscript analysis finished
-- - asset_generation_complete: Marketing assets ready
-- - payment_confirmation: Subscription created/renewed
-- - payment_failed: Card declined, action required
-- - usage_warning: Approaching manuscript limit (80%, 90%, 100%)
-- - dmca_notification: DMCA claim submitted (existing)
-- - team_invitation: Invited to join team (MAN-13)
-- - team_activity: Team member added/removed, manuscript shared
-- - weekly_digest: Weekly usage stats and recommendations
-- - admin_alerts: New user signups, suspicious activity
-- ============================================================================

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (8, strftime('%s', 'now'), 'Migration 008: Advanced email notification system (MAN-17)');
