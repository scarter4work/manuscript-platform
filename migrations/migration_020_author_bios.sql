-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- WARNING: SQLite triggers detected - requires manual conversion to PostgreSQL function + trigger syntax
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- Migration 020: Author Bio Generation System
-- Creates tables for storing generated author bios

-- Author bios table
CREATE TABLE IF NOT EXISTS author_bios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT,
  author_name TEXT NOT NULL,
  genre TEXT NOT NULL,
  length TEXT NOT NULL CHECK (length IN ('short', 'medium', 'long')),
  variations TEXT NOT NULL, -- JSON array of bio variations
  generated_at TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_author_bios_user ON author_bios(user_id);
CREATE INDEX IF NOT EXISTS idx_author_bios_manuscript ON author_bios(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_author_bios_length ON author_bios(length);
CREATE INDEX IF NOT EXISTS idx_author_bios_created ON author_bios(created_at);

-- Update trigger for author_bios
CREATE TRIGGER IF NOT EXISTS update_author_bios_timestamp
AFTER UPDATE ON author_bios
FOR EACH ROW
BEGIN
  UPDATE author_bios SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Add author profile fields to users table (if not exists)
-- These are used for bio generation
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_media TEXT; -- JSON: {twitter, facebook, instagram, etc}

-- Author bio statistics view
CREATE OR REPLACE VIEW author_bio_stats AS
SELECT
  user_id,
  COUNT(*) as total_bios,
  COUNT(DISTINCT manuscript_id) as manuscripts_with_bios,
  COUNT(DISTINCT genre) as genres_covered,
  SUM(CASE WHEN length = 'short' THEN 1 ELSE 0 END) as short_bios,
  SUM(CASE WHEN length = 'medium' THEN 1 ELSE 0 END) as medium_bios,
  SUM(CASE WHEN length = 'long' THEN 1 ELSE 0 END) as long_bios,
  MAX(created_at) as last_generated
FROM author_bios
GROUP BY user_id;

-- Sample data for testing (optional, comment out for production)
-- INSERT INTO author_bios (id, user_id, manuscript_id, author_name, genre, length, variations, generated_at, created_at)
-- VALUES (
--   'sample-bio-1',
--   'test-user-1',
--   'test-manuscript-1',
--   'Jane Author',
--   'thriller',
--   'medium',
--   '[{"id":"bio-medium-achievement-focused","approach":"achievement-focused","text":"Jane Author is an award-winning thriller writer whose debut novel topped the bestseller lists...","wordCount":180,"tone":"Mysterious and intriguing, with hints of suspense","length":"medium"}]',
--   '2025-01-15T10:00:00Z',
--   EXTRACT(EPOCH FROM NOW())::BIGINT
-- );
