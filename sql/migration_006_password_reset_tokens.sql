-- Migration 006: Add password_reset_tokens table
-- Created: October 26, 2025
-- Purpose: Store password reset tokens with enhanced security (hashed tokens)

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,                    -- UUID for the token record
  user_id TEXT NOT NULL,                  -- Foreign key to users table
  token_hash TEXT NOT NULL,               -- SHA-256 hash of the reset token
  expires_at TEXT NOT NULL,               -- ISO 8601 timestamp
  created_at TEXT NOT NULL,               -- ISO 8601 timestamp
  used_at TEXT,                           -- ISO 8601 timestamp (NULL if unused)
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (6, strftime('%s', 'now'), 'Add password_reset_tokens table with hashed tokens');
