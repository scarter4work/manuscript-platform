-- ============================================================================
-- MANUSCRIPT PLATFORM - POSTGRESQL SCHEMA
-- ============================================================================
-- Complete production-ready PostgreSQL schema
-- Replaces: schema.sql (SQLite artifacts) + consolidated_missing_migrations.sql
--
-- Created: 2025-11-16
-- PostgreSQL Version: 12+
--
-- Changes from SQLite/D1:
--   - BIGINT/INTEGER timestamps → TIMESTAMP/TIMESTAMPTZ
--   - INTEGER booleans → BOOLEAN
--   - TEXT JSON → JSONB
--   - Proper CASCADE constraints
--   - PostgreSQL-specific optimizations
-- ============================================================================

BEGIN;

-- ============================================================================
-- USERS TABLE
-- Stores user accounts (authors, publishers, admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'author',
  subscription_tier TEXT DEFAULT 'FREE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP,
  email_verified BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- MANUSCRIPTS TABLE
-- Tracks all uploaded manuscripts with metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS manuscripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  genre TEXT,
  word_count INTEGER,
  file_type TEXT,
  metadata JSONB,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  flagged_for_review BOOLEAN DEFAULT FALSE,
  dmca_status TEXT DEFAULT 'clear',
  dmca_takedown_date TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_manuscripts_user ON manuscripts(user_id);
CREATE INDEX IF NOT EXISTS idx_manuscripts_hash ON manuscripts(file_hash);
CREATE INDEX IF NOT EXISTS idx_manuscripts_status ON manuscripts(status);
CREATE INDEX IF NOT EXISTS idx_manuscripts_uploaded ON manuscripts(uploaded_at DESC);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- Tracks user subscription plans (Stripe integration)
-- ============================================================================
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

-- ============================================================================
-- PAYMENT HISTORY TABLE
-- Tracks all payments and transactions
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(created_at DESC);

-- ============================================================================
-- USAGE TRACKING TABLE
-- Tracks AI analysis usage for billing
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  manuscript_id TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  assets_generated INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 1,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_subscription ON usage_tracking(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp ON usage_tracking(timestamp DESC);

-- ============================================================================
-- SUBMISSIONS TABLE
-- Tracks manuscript submissions to publishers
-- ============================================================================
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  publisher_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  response_notes TEXT,
  responded_at TIMESTAMP,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submissions_manuscript ON submissions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_submissions_publisher ON submissions(publisher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- ============================================================================
-- AUDIT LOG TABLE
-- Tracks all user actions for compliance and security
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ============================================================================
-- DMCA REQUESTS TABLE
-- Tracks copyright takedown requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS dmca_requests (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_company TEXT,
  claim_details TEXT NOT NULL,
  original_work_url TEXT,
  good_faith_attestation BOOLEAN DEFAULT FALSE,
  accuracy_attestation BOOLEAN DEFAULT FALSE,
  digital_signature TEXT,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dmca_status ON dmca_requests(status);
CREATE INDEX IF NOT EXISTS idx_dmca_submitted ON dmca_requests(submitted_at DESC);

-- ============================================================================
-- SESSIONS TABLE
-- Redis-backed session management (optional, using Redis instead)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ============================================================================
-- VERIFICATION TOKENS TABLE
-- Stores email verification and password reset tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_expires ON verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON verification_tokens(user_id);

-- ============================================================================
-- SCHEMA VERSION TABLE
-- Track database migrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL
);

-- ============================================================================
-- ANALYSIS REPORTS TABLE (from migration_020)
-- ============================================================================
CREATE TABLE IF NOT EXISTS analysis_reports (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  report_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_manuscript ON analysis_reports(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_user ON analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_status ON analysis_reports(status);

-- ============================================================================
-- FILE STORAGE TABLE (from migration_021)
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_storage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_key TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  bucket TEXT NOT NULL,
  upload_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_storage_user ON file_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_bucket ON file_storage(bucket);

-- ============================================================================
-- RATE LIMITING TABLE (from migration_022)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_end);

-- ============================================================================
-- SECURITY INCIDENTS TABLE (from migration_038)
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  description TEXT NOT NULL,
  file_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON security_incidents(created_at DESC);

-- ============================================================================
-- FILE SCAN RESULTS TABLE (from migration_038)
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_scan_results (
  id TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  scan_type TEXT NOT NULL,
  scan_result TEXT NOT NULL,
  viruses_found TEXT[],
  scan_duration_ms INTEGER,
  file_size BIGINT,
  scanner_version TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_scan_results_hash ON file_scan_results(file_hash);
CREATE INDEX IF NOT EXISTS idx_file_scan_results_result ON file_scan_results(scan_result);

-- ============================================================================
-- SCANNER HEALTH TABLE (from migration_038)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scanner_health (
  id TEXT PRIMARY KEY,
  scanner_type TEXT NOT NULL,
  status TEXT NOT NULL,
  last_check TIMESTAMP NOT NULL,
  error_message TEXT,
  metadata JSONB
);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- User manuscripts with details
CREATE OR REPLACE VIEW user_manuscripts AS
SELECT
  m.id,
  m.user_id,
  m.title,
  m.status,
  m.genre,
  m.word_count,
  m.uploaded_at,
  m.updated_at,
  u.email as user_email,
  u.role as user_role
FROM manuscripts m
JOIN users u ON m.user_id = u.id;

-- Pending DMCA requests
CREATE OR REPLACE VIEW pending_dmca AS
SELECT
  d.*,
  m.title as manuscript_title,
  u.email as manuscript_owner_email
FROM dmca_requests d
JOIN manuscripts m ON d.manuscript_id = m.id
JOIN users u ON m.user_id = u.id
WHERE d.status = 'pending'
ORDER BY d.submitted_at DESC;

-- User subscriptions with usage
CREATE OR REPLACE VIEW user_subscriptions_with_usage AS
SELECT
  s.id,
  s.user_id,
  u.email,
  u.full_name,
  s.plan_type,
  s.status,
  s.current_period_start,
  s.current_period_end,
  COALESCE(SUM(ut.credits_used), 0) AS total_credits_used
FROM subscriptions s
JOIN users u ON s.user_id = u.id
LEFT JOIN usage_tracking ut ON s.id = ut.subscription_id
  AND ut.timestamp >= s.current_period_start
  AND ut.timestamp < s.current_period_end
GROUP BY s.id, s.user_id, u.email, u.full_name, s.plan_type, s.status,
         s.current_period_start, s.current_period_end;

-- Security incident summary
CREATE OR REPLACE VIEW security_incident_summary AS
SELECT
  incident_type,
  severity,
  COUNT(*) as incident_count,
  MAX(created_at) as last_occurrence
FROM security_incidents
WHERE resolved_at IS NULL
GROUP BY incident_type, severity
ORDER BY severity DESC, incident_count DESC;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (1, NOW(), 'Initial PostgreSQL schema - complete migration from SQLite')
ON CONFLICT (version) DO NOTHING;

-- Create default admin account (password: Admin123!)
-- CHANGE THIS IMMEDIATELY IN PRODUCTION
INSERT INTO users (id, email, password_hash, role, created_at, updated_at, email_verified)
VALUES (
  'admin-default-001',
  'admin@manuscript-platform.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLkJ7ZRy',
  'admin',
  NOW(),
  NOW(),
  TRUE
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
-- This schema is production-ready for PostgreSQL 12+
--
-- Key differences from SQLite:
--   - All timestamps are proper TIMESTAMP columns (not Unix epochs)
--   - All booleans are BOOLEAN type (not INTEGER 0/1)
--   - JSON columns use JSONB for better performance
--   - Arrays use TEXT[] instead of comma-separated strings
--   - Uses NOW() and DEFAULT for timestamps
--
-- Application code must handle TIMESTAMP properly:
--   - JavaScript: new Date(timestamp) for TIMESTAMP columns
--   - SQL queries: WHERE created_at > NOW() - INTERVAL '1 day'
--
-- Migration from production:
--   - Export data from production
--   - Convert Unix timestamps to TIMESTAMP format
--   - Convert INTEGER 0/1 to BOOLEAN
--   - Import into new schema
-- ============================================================================
