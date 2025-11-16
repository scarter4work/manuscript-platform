-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- Manuscript Platform - D1 Database Schema
-- Phase A: Foundation for multi-user manuscript management
-- Created: October 12, 2025

-- ============================================================================
-- USERS TABLE
-- Stores user accounts (authors, publishers, admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT UNIQUE NOT NULL,             -- Unique email address
  password_hash TEXT NOT NULL,            -- bcrypt hashed password
  full_name TEXT,                         -- User's full name (optional)
  role TEXT DEFAULT 'author',             -- author/publisher/admin
  subscription_tier TEXT DEFAULT 'FREE',  -- FREE/PRO/ENTERPRISE (for rate limiting)
  created_at BIGINT NOT NULL,            -- Unix timestamp
  updated_at BIGINT NOT NULL,            -- Unix timestamp
  last_login INTEGER,                     -- Unix timestamp of last login
  email_verified INTEGER DEFAULT 0,      -- 0 = not verified, 1 = verified
  stripe_customer_id TEXT                 -- Stripe customer ID for payment processing
);

-- Index for fast email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- MANUSCRIPTS TABLE
-- Tracks all uploaded manuscripts with metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS manuscripts (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users table
  title TEXT NOT NULL,                    -- Manuscript title
  r2_key TEXT NOT NULL,                   -- Path to file in R2 storage
  file_hash TEXT NOT NULL,                -- SHA-256 hash for duplicate detection
  status TEXT DEFAULT 'draft',            -- draft/submitted/under_review/accepted/rejected
  genre TEXT,                             -- thriller/romance/fantasy/etc
  word_count INTEGER,                     -- Total word count
  file_type TEXT,                         -- .txt/.pdf/.docx
  metadata TEXT,                          -- JSON: additional metadata
  uploaded_at INTEGER NOT NULL,           -- Unix timestamp
  updated_at BIGINT NOT NULL,            -- Unix timestamp
  flagged_for_review INTEGER DEFAULT 0,  -- Boolean: flagged for DMCA/content issues
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manuscripts_user ON manuscripts(user_id);
CREATE INDEX IF NOT EXISTS idx_manuscripts_hash ON manuscripts(file_hash);
CREATE INDEX IF NOT EXISTS idx_manuscripts_status ON manuscripts(status);
CREATE INDEX IF NOT EXISTS idx_manuscripts_created ON manuscripts(uploaded_at DESC);

-- ============================================================================
-- SUBMISSIONS TABLE
-- Tracks manuscript submissions to publishers
-- ============================================================================
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  publisher_id TEXT NOT NULL,             -- Foreign key to users (role=publisher)
  status TEXT DEFAULT 'pending',          -- pending/accepted/rejected
  submitted_at INTEGER NOT NULL,          -- Unix timestamp
  notes TEXT,                             -- Submission notes/cover letter
  response_notes TEXT,                    -- Publisher feedback
  responded_at INTEGER,                   -- Unix timestamp of response
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for filtering submissions
CREATE INDEX IF NOT EXISTS idx_submissions_manuscript ON submissions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_submissions_publisher ON submissions(publisher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- ============================================================================
-- AUDIT LOG TABLE
-- Tracks all user actions for compliance and security
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,                    -- UUID
  user_id TEXT NOT NULL,                  -- Foreign key to users
  action TEXT NOT NULL,                   -- upload/download/delete/update/view/login/logout/payment/register
  resource_type TEXT NOT NULL,            -- manuscript/user/submission/payment/auth
  resource_id TEXT NOT NULL,              -- ID of affected resource
  timestamp BIGINT NOT NULL,              -- Unix timestamp
  ip_address TEXT,                        -- IP address of request
  user_agent TEXT,                        -- User agent string
  metadata TEXT,                          -- JSON: additional context
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ============================================================================
-- DMCA REQUESTS TABLE
-- Tracks copyright takedown requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS dmca_requests (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  requester_name TEXT NOT NULL,           -- Name of person filing claim
  requester_email TEXT NOT NULL,          -- Contact email
  requester_company TEXT,                 -- Company name (optional)
  claim_details TEXT NOT NULL,            -- Description of copyright claim
  original_work_url TEXT,                 -- URL where original work can be found
  good_faith_attestation INTEGER DEFAULT 0, -- Good faith belief statement
  accuracy_attestation INTEGER DEFAULT 0,   -- Accuracy under penalty of perjury
  digital_signature TEXT,                 -- Typed name as digital signature
  submitted_at INTEGER NOT NULL,          -- Unix timestamp
  status TEXT DEFAULT 'pending',          -- pending/reviewing/resolved/rejected
  resolution_notes TEXT,                  -- Admin notes on resolution
  resolved_at INTEGER,                    -- Unix timestamp of resolution
  resolved_by TEXT,                       -- Admin user ID who resolved
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Indexes for DMCA admin dashboard
CREATE INDEX IF NOT EXISTS idx_dmca_status ON dmca_requests(status);
CREATE INDEX IF NOT EXISTS idx_dmca_submitted ON dmca_requests(submitted_at DESC);

-- ============================================================================
-- SESSIONS TABLE (Alternative to KV)
-- Optional: Can use D1 instead of KV for sessions
-- Currently using KV, but this table is here for reference
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,            -- UUID session identifier
  user_id TEXT NOT NULL,                  -- Foreign key to users
  created_at BIGINT NOT NULL,            -- Unix timestamp
  expires_at BIGINT NOT NULL,            -- Unix timestamp
  ip_address TEXT,                        -- IP address of session creation
  user_agent TEXT,                        -- User agent string
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for session cleanup (delete expired)
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- VERIFICATION TOKENS TABLE
-- Stores email verification and password reset tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification_tokens (
  token TEXT PRIMARY KEY,                 -- Random token (32 bytes hex)
  user_id TEXT NOT NULL,                  -- Foreign key to users
  token_type TEXT NOT NULL,               -- email_verification/password_reset
  created_at BIGINT NOT NULL,            -- Unix timestamp
  expires_at BIGINT NOT NULL,            -- Unix timestamp
  used INTEGER DEFAULT 0,                 -- 0 = not used, 1 = used
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for token cleanup
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON verification_tokens(expires_at);

-- ============================================================================
-- INITIAL DATA
-- Create default admin account (password: Admin123!)
-- In production, change this immediately after first login
-- ============================================================================
-- Password hash for "Admin123!" with bcrypt cost 12
-- Generate with: bcrypt.hash("Admin123!", 12)
-- This is a placeholder - regenerate in production!

INSERT INTO users (id, email, password_hash, role, created_at, updated_at, email_verified) VALUES (
  'admin-default-001',
  'admin@manuscript-platform.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLkJ7ZRy',  -- Admin123!
  'admin',
  EXTRACT(EPOCH FROM NOW())::BIGINT,
  EXTRACT(EPOCH FROM NOW())::BIGINT,
  1
);

-- ============================================================================
-- DATABASE METADATA
-- Track schema version for migrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,            -- Schema version number
  applied_at INTEGER NOT NULL,            -- Unix timestamp
  description TEXT NOT NULL               -- Description of changes
);

INSERT INTO schema_version (version, applied_at, description) VALUES (1, EXTRACT(EPOCH FROM NOW())::BIGINT, 'Initial schema - Phase A: Database Foundation');

-- ============================================================================
-- QUERY HELPERS & VIEWS
-- Common queries as views for better performance
-- ============================================================================

-- View: User's manuscripts with latest upload date
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

-- View: Pending DMCA requests (for admin dashboard)
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

-- View: Recent audit activity (last 24 hours)
CREATE OR REPLACE VIEW recent_activity AS
SELECT
  a.*,
  u.email as user_email
FROM audit_log a
JOIN users u ON a.user_id = u.id
WHERE a.created_at > (EXTRACT(EPOCH FROM NOW())::BIGINT - 86400)
ORDER BY a.created_at DESC;

-- ============================================================================
-- NOTES FOR FUTURE MIGRATIONS
-- ============================================================================
-- Migration files should be named: migration_NNN_description.sql
-- Example: migration_002_add_collaboration.sql
--
-- Each migration should:
-- 1. Check current schema_version
-- 2. Apply changes
-- 3. Insert new version into schema_version table
--
-- Rollback strategy: Keep backup before applying migrations
-- ============================================================================
