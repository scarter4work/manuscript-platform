-- Minimal PostgreSQL schema for auth handler tests
-- Creates only the tables needed for authentication testing

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('author', 'publisher', 'admin', 'reader')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP,
  bio TEXT,
  website TEXT,
  social_media TEXT
);

-- Verification tokens table (for email verification and password reset)
CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verification', 'password_reset')),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  changes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_type ON verification_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
