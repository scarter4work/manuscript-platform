-- Manuscript Platform Database Schema
-- Run this to set up the database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    created_at TEXT NOT NULL,
    last_login TEXT,
    plan TEXT DEFAULT 'free', -- free, pro, enterprise
    manuscripts_count INTEGER DEFAULT 0,
    monthly_analyses INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Sessions table (for JWT refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Manuscripts table
CREATE TABLE IF NOT EXISTS manuscripts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    report_id TEXT UNIQUE NOT NULL,
    manuscript_key TEXT NOT NULL, -- R2 key
    original_filename TEXT NOT NULL,
    file_size INTEGER,
    genre TEXT,
    status TEXT DEFAULT 'uploaded', -- uploaded, analyzing, complete, error
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_manuscripts_user_id ON manuscripts(user_id);
CREATE INDEX IF NOT EXISTS idx_manuscripts_report_id ON manuscripts(report_id);
CREATE INDEX IF NOT EXISTS idx_manuscripts_created_at ON manuscripts(created_at);

-- Analysis results table
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    manuscript_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL, -- developmental, line-editing, copy-editing
    status TEXT DEFAULT 'pending', -- pending, running, complete, error
    overall_score REAL,
    issues_count INTEGER,
    completed_at TEXT,
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

CREATE INDEX IF NOT EXISTS idx_analyses_manuscript_id ON analyses(manuscript_id);

-- Usage tracking (for billing/limits)
CREATE TABLE IF NOT EXISTS usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- upload, analysis, download
    resource_type TEXT, -- manuscript, report
    resource_id TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp);

-- Payment history (for future billing)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL, -- pending, completed, failed
    plan TEXT NOT NULL,
    stripe_payment_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
