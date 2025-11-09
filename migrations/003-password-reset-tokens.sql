-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- Migration: Add password_reset_tokens table
-- Purpose: Enable secure password reset functionality
-- Date: 2025-10-25

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,  -- SHA-256 hash of reset token
  expires_at TEXT NOT NULL,  -- ISO 8601 datetime
  created_at TEXT NOT NULL,  -- ISO 8601 datetime
  used_at TEXT NULL,         -- ISO 8601 datetime (null if unused)

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
  ON password_reset_tokens(token_hash);

-- Index for cleaning up expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
  ON password_reset_tokens(expires_at);

-- Index for user lookup (to invalidate old tokens)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens(user_id);
