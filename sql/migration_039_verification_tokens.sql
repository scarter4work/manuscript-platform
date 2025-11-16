-- Migration 039: Add verification_tokens table
-- This table was in the original SQLite schema but missing from PostgreSQL production

CREATE TABLE IF NOT EXISTS verification_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for token cleanup
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
