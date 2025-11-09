-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- WARNING: SQLite triggers detected - requires manual conversion to PostgreSQL function + trigger syntax
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- Migration 022: Enhanced Manuscript Metadata System (Issue #51) - FIXED
-- Expands manuscript metadata for publishing decisions

-- Add NEW metadata columns to manuscripts table (skip word_count and genre - they already exist)
ALTER TABLE manuscripts ADD COLUMN primary_genre TEXT;
ALTER TABLE manuscripts ADD COLUMN sub_genres TEXT;
ALTER TABLE manuscripts ADD COLUMN age_category TEXT CHECK (age_category IN
  ('adult', 'young_adult', 'middle_grade', 'childrens', 'all_ages'));
ALTER TABLE manuscripts ADD COLUMN content_warnings TEXT;
ALTER TABLE manuscripts ADD COLUMN completion_status TEXT DEFAULT 'complete' CHECK (completion_status IN
  ('complete', 'in_progress', 'revision', 'outline'));
ALTER TABLE manuscripts ADD COLUMN completion_percentage INTEGER DEFAULT 100 CHECK (completion_percentage BETWEEN 0 AND 100);
ALTER TABLE manuscripts ADD COLUMN target_audience TEXT;
ALTER TABLE manuscripts ADD COLUMN series_info TEXT;
ALTER TABLE manuscripts ADD COLUMN publication_status TEXT DEFAULT 'unpublished' CHECK (publication_status IN
  ('unpublished', 'self_published', 'traditionally_published', 'previously_published'));
ALTER TABLE manuscripts ADD COLUMN rights_status TEXT;

-- Genre taxonomy table
CREATE TABLE IF NOT EXISTS genres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_genre_id TEXT,
  description TEXT,
  typical_word_count_min INTEGER,
  typical_word_count_max INTEGER,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (parent_genre_id) REFERENCES genres(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_genres_parent ON genres(parent_genre_id);
CREATE INDEX IF NOT EXISTS idx_genres_active ON genres(is_active);
CREATE INDEX IF NOT EXISTS idx_genres_name ON genres(name);

-- Content warnings reference table
CREATE TABLE IF NOT EXISTS content_warning_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('violence', 'sexual', 'substance', 'mental_health', 'discrimination', 'other')),
  description TEXT,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_content_warnings_category ON content_warning_types(category);
CREATE INDEX IF NOT EXISTS idx_content_warnings_active ON content_warning_types(is_active);

-- Manuscript metadata history
CREATE TABLE IF NOT EXISTS manuscript_metadata_history (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL,
  changed_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_metadata_history_manuscript ON manuscript_metadata_history(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_metadata_history_changed_at ON manuscript_metadata_history(changed_at);

-- Update trigger for genres table
CREATE TRIGGER IF NOT EXISTS update_genres_timestamp
AFTER UPDATE ON genres
FOR EACH ROW
BEGIN
  UPDATE genres SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Statistics view for genre usage
CREATE OR REPLACE VIEW genre_usage_stats AS
SELECT
  g.id,
  g.name,
  g.parent_genre_id,
  COUNT(DISTINCT m.id) as manuscript_count,
  AVG(m.word_count) as avg_word_count,
  MIN(m.word_count) as min_word_count,
  MAX(m.word_count) as max_word_count
FROM genres g
LEFT JOIN manuscripts m ON m.primary_genre = g.id
WHERE g.is_active = 1
GROUP BY g.id, g.name, g.parent_genre_id;

-- View for manuscripts with validation warnings
CREATE OR REPLACE VIEW manuscript_metadata_validation AS
SELECT
  m.id,
  m.title,
  m.primary_genre,
  m.word_count,
  m.age_category,
  g.typical_word_count_min,
  g.typical_word_count_max,
  CASE
    WHEN m.word_count IS NULL THEN 'missing_word_count'
    WHEN m.word_count < g.typical_word_count_min THEN 'word_count_too_low'
    WHEN m.word_count > g.typical_word_count_max THEN 'word_count_too_high'
    ELSE 'valid'
  END as validation_status,
  CASE
    WHEN m.primary_genre IS NULL THEN 'missing_genre'
    WHEN m.age_category IS NULL THEN 'missing_age_category'
    ELSE 'complete'
  END as metadata_completeness
FROM manuscripts m
LEFT JOIN genres g ON m.primary_genre = g.id;
