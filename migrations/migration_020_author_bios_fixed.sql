-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- WARNING: SQLite triggers detected - requires manual conversion to PostgreSQL function + trigger syntax
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- Migration 020: Author Bio Generation System
-- Creates tables for storing generated author bios

-- Author bios table
CREATE TABLE author_bios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT,
  author_name TEXT NOT NULL,
  genre TEXT NOT NULL,
  length TEXT NOT NULL CHECK (length IN ('short', 'medium', 'long')),
  variations TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX idx_author_bios_user ON author_bios(user_id);
CREATE INDEX idx_author_bios_manuscript ON author_bios(manuscript_id);
CREATE INDEX idx_author_bios_length ON author_bios(length);
CREATE INDEX idx_author_bios_created ON author_bios(created_at);

-- Update trigger for author_bios
CREATE TRIGGER update_author_bios_timestamp
AFTER UPDATE ON author_bios
FOR EACH ROW
BEGIN
  UPDATE author_bios SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Author bio statistics view
CREATE VIEW author_bio_stats AS
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
