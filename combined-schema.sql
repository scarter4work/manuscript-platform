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
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
  UPDATE author_bios SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Add author profile fields to users table (if not exists)
-- These are used for bio generation
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_media TEXT; -- JSON: {twitter, facebook, instagram, etc}

-- Author bio statistics view
CREATE VIEW IF NOT EXISTS author_bio_stats AS
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
--   unixepoch()
-- );
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
  UPDATE author_bios SET updated_at = unixepoch() WHERE id = NEW.id;
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
-- Migration 021: Cover Design Briefs System
-- Creates table for storing AI-generated cover design briefs

-- Cover design briefs table
CREATE TABLE cover_design_briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  genre TEXT NOT NULL,
  brief_data TEXT NOT NULL, -- JSON: complete cover brief from CoverDesignAgent
  generated_at TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX idx_cover_briefs_user ON cover_design_briefs(user_id);
CREATE INDEX idx_cover_briefs_manuscript ON cover_design_briefs(manuscript_id);
CREATE INDEX idx_cover_briefs_genre ON cover_design_briefs(genre);
CREATE INDEX idx_cover_briefs_created ON cover_design_briefs(created_at);

-- Update trigger for cover_design_briefs
CREATE TRIGGER update_cover_briefs_timestamp
AFTER UPDATE ON cover_design_briefs
FOR EACH ROW
BEGIN
  UPDATE cover_design_briefs SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Statistics view for cover briefs
CREATE VIEW cover_brief_stats AS
SELECT
  user_id,
  COUNT(*) as total_briefs,
  COUNT(DISTINCT manuscript_id) as manuscripts_with_briefs,
  COUNT(DISTINCT genre) as genres_covered,
  MAX(created_at) as last_generated
FROM cover_design_briefs
GROUP BY user_id;
-- Migration 022: Enhanced Manuscript Metadata System (Issue #51)
-- Expands manuscript metadata for publishing decisions

-- Add new metadata columns to manuscripts table
ALTER TABLE manuscripts ADD COLUMN primary_genre TEXT;
ALTER TABLE manuscripts ADD COLUMN sub_genres TEXT; -- JSON array of sub-genre IDs
ALTER TABLE manuscripts ADD COLUMN age_category TEXT CHECK (age_category IN
  ('adult', 'young_adult', 'middle_grade', 'childrens', 'all_ages'));
ALTER TABLE manuscripts ADD COLUMN content_warnings TEXT; -- JSON array of warning types
ALTER TABLE manuscripts ADD COLUMN completion_status TEXT DEFAULT 'complete' CHECK (completion_status IN
  ('complete', 'in_progress', 'revision', 'outline'));
ALTER TABLE manuscripts ADD COLUMN completion_percentage INTEGER DEFAULT 100 CHECK (completion_percentage BETWEEN 0 AND 100);
ALTER TABLE manuscripts ADD COLUMN target_audience TEXT; -- JSON: demographics + psychographics
ALTER TABLE manuscripts ADD COLUMN series_info TEXT; -- JSON: is_standalone, book_number, series_name, series_id
ALTER TABLE manuscripts ADD COLUMN word_count INTEGER;
ALTER TABLE manuscripts ADD COLUMN publication_status TEXT DEFAULT 'unpublished' CHECK (publication_status IN
  ('unpublished', 'self_published', 'traditionally_published', 'previously_published'));
ALTER TABLE manuscripts ADD COLUMN rights_status TEXT; -- JSON: available rights and territories

-- Genre taxonomy table
CREATE TABLE genres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_genre_id TEXT, -- For hierarchical genres (NULL for top-level)
  description TEXT,
  typical_word_count_min INTEGER,
  typical_word_count_max INTEGER,
  display_order INTEGER DEFAULT 0, -- For UI ordering
  is_active INTEGER DEFAULT 1, -- Can be disabled without deleting
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (parent_genre_id) REFERENCES genres(id) ON DELETE SET NULL
);

CREATE INDEX idx_genres_parent ON genres(parent_genre_id);
CREATE INDEX idx_genres_active ON genres(is_active);
CREATE INDEX idx_genres_name ON genres(name);

-- Content warnings reference table
CREATE TABLE content_warning_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('violence', 'sexual', 'substance', 'mental_health', 'discrimination', 'other')),
  description TEXT,
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_content_warnings_category ON content_warning_types(category);
CREATE INDEX idx_content_warnings_active ON content_warning_types(is_active);

-- Manuscript metadata history (for tracking changes)
CREATE TABLE manuscript_metadata_history (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL, -- user_id
  changed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX idx_metadata_history_manuscript ON manuscript_metadata_history(manuscript_id);
CREATE INDEX idx_metadata_history_changed_at ON manuscript_metadata_history(changed_at);

-- Update trigger for genres table
CREATE TRIGGER update_genres_timestamp
AFTER UPDATE ON genres
FOR EACH ROW
BEGIN
  UPDATE genres SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Statistics view for genre usage
CREATE VIEW genre_usage_stats AS
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
CREATE VIEW manuscript_metadata_validation AS
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

-- ===================================================================
-- SEED DATA: Genre Taxonomy (50+ genres)
-- ===================================================================

-- Top-Level: Fiction
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('fiction', 'Fiction', NULL, 'Narrative literature created from imagination', 40000, 120000, 1);

-- Fiction > Literary Fiction
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('literary-fiction', 'Literary Fiction', 'fiction', 'Character-driven fiction with artistic merit', 80000, 100000, 1);

-- Fiction > Thriller
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('thriller', 'Thriller', 'fiction', 'Fast-paced suspenseful fiction', 70000, 90000, 2),
('psychological-thriller', 'Psychological Thriller', 'thriller', 'Mind-bending suspense focused on character psychology', 70000, 90000, 1),
('legal-thriller', 'Legal Thriller', 'thriller', 'Courtroom drama and legal suspense', 70000, 90000, 2),
('medical-thriller', 'Medical Thriller', 'thriller', 'Medical mysteries and healthcare suspense', 70000, 90000, 3),
('techno-thriller', 'Techno-Thriller', 'thriller', 'Technology-driven suspense', 70000, 90000, 4),
('espionage-thriller', 'Espionage Thriller', 'thriller', 'Spy novels and international intrigue', 70000, 100000, 5);

-- Fiction > Mystery
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('mystery', 'Mystery', 'fiction', 'Crime-solving and detective fiction', 70000, 90000, 3),
('cozy-mystery', 'Cozy Mystery', 'mystery', 'Amateur sleuth in small-town setting', 60000, 80000, 1),
('hard-boiled', 'Hard-Boiled Detective', 'mystery', 'Gritty urban detective fiction', 70000, 90000, 2),
('police-procedural', 'Police Procedural', 'mystery', 'Realistic law enforcement investigation', 70000, 90000, 3),
('noir', 'Noir', 'mystery', 'Dark, cynical crime fiction', 70000, 90000, 4);

-- Fiction > Romance
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('romance', 'Romance', 'fiction', 'Love stories with emotional focus', 70000, 100000, 4),
('contemporary-romance', 'Contemporary Romance', 'romance', 'Modern-day love stories', 70000, 90000, 1),
('historical-romance', 'Historical Romance', 'romance', 'Romance set in historical periods', 80000, 100000, 2),
('paranormal-romance', 'Paranormal Romance', 'romance', 'Romance with supernatural elements', 75000, 95000, 3),
('romantic-suspense', 'Romantic Suspense', 'romance', 'Romance combined with thriller elements', 75000, 95000, 4),
('romantic-comedy', 'Romantic Comedy', 'romance', 'Humorous love stories', 70000, 90000, 5);

-- Fiction > Fantasy
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('fantasy', 'Fantasy', 'fiction', 'Magical and imaginative worlds', 90000, 120000, 5),
('epic-fantasy', 'Epic Fantasy', 'fantasy', 'Large-scale fantasy with world-building', 100000, 150000, 1),
('urban-fantasy', 'Urban Fantasy', 'fantasy', 'Magic in contemporary urban settings', 80000, 100000, 2),
('high-fantasy', 'High Fantasy', 'fantasy', 'Secondary world fantasy', 100000, 120000, 3),
('dark-fantasy', 'Dark Fantasy', 'fantasy', 'Fantasy with horror elements', 90000, 120000, 4),
('sword-and-sorcery', 'Sword & Sorcery', 'fantasy', 'Action-oriented fantasy adventures', 80000, 100000, 5);

-- Fiction > Science Fiction
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('science-fiction', 'Science Fiction', 'fiction', 'Speculative fiction based on science', 90000, 120000, 6),
('hard-sf', 'Hard Science Fiction', 'science-fiction', 'Scientifically accurate SF', 90000, 120000, 1),
('space-opera', 'Space Opera', 'science-fiction', 'Epic space adventures', 100000, 140000, 2),
('cyberpunk', 'Cyberpunk', 'science-fiction', 'High-tech dystopian futures', 80000, 100000, 3),
('dystopian', 'Dystopian', 'science-fiction', 'Dark future societies', 80000, 100000, 4),
('post-apocalyptic', 'Post-Apocalyptic', 'science-fiction', 'After civilization collapse', 80000, 100000, 5),
('time-travel', 'Time Travel', 'science-fiction', 'Stories involving time manipulation', 80000, 100000, 6);

-- Fiction > Horror
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('horror', 'Horror', 'fiction', 'Fiction designed to frighten or disturb', 70000, 90000, 7),
('gothic-horror', 'Gothic Horror', 'horror', 'Atmospheric horror with dark settings', 70000, 90000, 1),
('psychological-horror', 'Psychological Horror', 'horror', 'Mental and emotional terror', 70000, 90000, 2),
('supernatural-horror', 'Supernatural Horror', 'horror', 'Ghosts, demons, and otherworldly threats', 70000, 90000, 3);

-- Fiction > Historical Fiction
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('historical-fiction', 'Historical Fiction', 'fiction', 'Stories set in historical periods', 80000, 120000, 8);

-- Fiction > Young Adult (YA)
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('young-adult', 'Young Adult', 'fiction', 'Fiction for teen readers (13-18)', 50000, 80000, 9),
('ya-contemporary', 'YA Contemporary', 'young-adult', 'Realistic modern YA fiction', 50000, 75000, 1),
('ya-fantasy', 'YA Fantasy', 'young-adult', 'Fantasy for young adults', 60000, 85000, 2),
('ya-science-fiction', 'YA Science Fiction', 'young-adult', 'SF for young adults', 60000, 85000, 3),
('ya-dystopian', 'YA Dystopian', 'young-adult', 'Dystopian fiction for teens', 55000, 80000, 4);

-- Top-Level: Nonfiction
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('nonfiction', 'Nonfiction', NULL, 'Factual and informational writing', 40000, 90000, 2);

-- Nonfiction > Memoir
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('memoir', 'Memoir', 'nonfiction', 'Personal life stories', 60000, 80000, 1);

-- Nonfiction > Biography
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('biography', 'Biography', 'nonfiction', 'Life stories of others', 70000, 100000, 2);

-- Nonfiction > Business
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('business', 'Business', 'nonfiction', 'Business and entrepreneurship', 40000, 60000, 3);

-- Nonfiction > Self-Help
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('self-help', 'Self-Help', 'nonfiction', 'Personal development and improvement', 40000, 60000, 4);

-- Nonfiction > History
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('history', 'History', 'nonfiction', 'Historical accounts and analysis', 70000, 100000, 5);

-- Nonfiction > True Crime
INSERT INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('true-crime', 'True Crime', 'nonfiction', 'Real criminal cases and investigations', 60000, 80000, 6);

-- ===================================================================
-- SEED DATA: Content Warning Types (20+ warnings)
-- ===================================================================

INSERT INTO content_warning_types (id, name, category, description, severity, display_order) VALUES
-- Violence
('violence-graphic', 'Graphic Violence', 'violence', 'Detailed descriptions of physical violence', 'severe', 1),
('violence-moderate', 'Violence', 'violence', 'Non-graphic violence', 'moderate', 2),
('violence-war', 'War/Combat', 'violence', 'Military combat or war scenes', 'moderate', 3),
('violence-torture', 'Torture', 'violence', 'Depictions of torture', 'severe', 4),
('violence-death', 'Death/Dying', 'violence', 'Characters dying or dead', 'moderate', 5),
('violence-self-harm', 'Self-Harm', 'violence', 'Self-inflicted injury', 'severe', 6),

-- Sexual Content
('sexual-explicit', 'Explicit Sexual Content', 'sexual', 'Detailed sexual scenes', 'severe', 7),
('sexual-moderate', 'Sexual Content', 'sexual', 'Non-explicit sexual situations', 'moderate', 8),
('sexual-assault', 'Sexual Assault/Rape', 'sexual', 'Sexual violence', 'severe', 9),

-- Substance Use
('substance-alcohol', 'Alcohol Use', 'substance', 'Alcohol consumption', 'mild', 10),
('substance-drugs', 'Drug Use', 'substance', 'Illegal drug use', 'moderate', 11),
('substance-addiction', 'Addiction', 'substance', 'Substance addiction themes', 'moderate', 12),

-- Mental Health
('mental-suicide', 'Suicide', 'mental_health', 'Suicide or suicidal ideation', 'severe', 13),
('mental-depression', 'Depression', 'mental_health', 'Clinical depression themes', 'moderate', 14),
('mental-anxiety', 'Anxiety/Panic', 'mental_health', 'Anxiety disorders or panic attacks', 'moderate', 15),
('mental-trauma', 'Trauma/PTSD', 'mental_health', 'Traumatic events or PTSD', 'severe', 16),

-- Discrimination/Abuse
('discrimination-racism', 'Racism', 'discrimination', 'Racial discrimination or slurs', 'moderate', 17),
('discrimination-sexism', 'Sexism', 'discrimination', 'Gender discrimination', 'moderate', 18),
('discrimination-homophobia', 'Homophobia', 'discrimination', 'Anti-LGBTQ+ discrimination', 'moderate', 19),
('abuse-domestic', 'Domestic Abuse', 'discrimination', 'Intimate partner violence', 'severe', 20),
('abuse-child', 'Child Abuse', 'discrimination', 'Abuse of children', 'severe', 21),

-- Other
('language-profanity', 'Strong Language', 'other', 'Profanity and explicit language', 'mild', 22),
('horror-body-horror', 'Body Horror', 'other', 'Disturbing body transformation or gore', 'severe', 23),
('eating-disorder', 'Eating Disorder', 'other', 'Eating disorder themes', 'moderate', 24);
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
  changed_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
  UPDATE genres SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Statistics view for genre usage
CREATE VIEW IF NOT EXISTS genre_usage_stats AS
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
CREATE VIEW IF NOT EXISTS manuscript_metadata_validation AS
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
-- Seed Data for Enhanced Metadata System

-- Top-Level: Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('fiction', 'Fiction', NULL, 'Narrative literature created from imagination', 40000, 120000, 1);

-- Fiction > Literary Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('literary-fiction', 'Literary Fiction', 'fiction', 'Character-driven fiction with artistic merit', 80000, 100000, 1);

-- Fiction > Thriller
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('thriller', 'Thriller', 'fiction', 'Fast-paced suspenseful fiction', 70000, 90000, 2),
('psychological-thriller', 'Psychological Thriller', 'thriller', 'Mind-bending suspense focused on character psychology', 70000, 90000, 1),
('legal-thriller', 'Legal Thriller', 'thriller', 'Courtroom drama and legal suspense', 70000, 90000, 2),
('medical-thriller', 'Medical Thriller', 'thriller', 'Medical mysteries and healthcare suspense', 70000, 90000, 3),
('techno-thriller', 'Techno-Thriller', 'thriller', 'Technology-driven suspense', 70000, 90000, 4),
('espionage-thriller', 'Espionage Thriller', 'thriller', 'Spy novels and international intrigue', 70000, 100000, 5);

-- Fiction > Mystery
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('mystery', 'Mystery', 'fiction', 'Crime-solving and detective fiction', 70000, 90000, 3),
('cozy-mystery', 'Cozy Mystery', 'mystery', 'Amateur sleuth in small-town setting', 60000, 80000, 1),
('hard-boiled', 'Hard-Boiled Detective', 'mystery', 'Gritty urban detective fiction', 70000, 90000, 2),
('police-procedural', 'Police Procedural', 'mystery', 'Realistic law enforcement investigation', 70000, 90000, 3),
('noir', 'Noir', 'mystery', 'Dark, cynical crime fiction', 70000, 90000, 4);

-- Fiction > Romance
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('romance', 'Romance', 'fiction', 'Love stories with emotional focus', 70000, 100000, 4),
('contemporary-romance', 'Contemporary Romance', 'romance', 'Modern-day love stories', 70000, 90000, 1),
('historical-romance', 'Historical Romance', 'romance', 'Romance set in historical periods', 80000, 100000, 2),
('paranormal-romance', 'Paranormal Romance', 'romance', 'Romance with supernatural elements', 75000, 95000, 3),
('romantic-suspense', 'Romantic Suspense', 'romance', 'Romance combined with thriller elements', 75000, 95000, 4),
('romantic-comedy', 'Romantic Comedy', 'romance', 'Humorous love stories', 70000, 90000, 5);

-- Fiction > Fantasy
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('fantasy', 'Fantasy', 'fiction', 'Magical and imaginative worlds', 90000, 120000, 5),
('epic-fantasy', 'Epic Fantasy', 'fantasy', 'Large-scale fantasy with world-building', 100000, 150000, 1),
('urban-fantasy', 'Urban Fantasy', 'fantasy', 'Magic in contemporary urban settings', 80000, 100000, 2),
('high-fantasy', 'High Fantasy', 'fantasy', 'Secondary world fantasy', 100000, 120000, 3),
('dark-fantasy', 'Dark Fantasy', 'fantasy', 'Fantasy with horror elements', 90000, 120000, 4),
('sword-and-sorcery', 'Sword & Sorcery', 'fantasy', 'Action-oriented fantasy adventures', 80000, 100000, 5);

-- Fiction > Science Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('science-fiction', 'Science Fiction', 'fiction', 'Speculative fiction based on science', 90000, 120000, 6),
('hard-sf', 'Hard Science Fiction', 'science-fiction', 'Scientifically accurate SF', 90000, 120000, 1),
('space-opera', 'Space Opera', 'science-fiction', 'Epic space adventures', 100000, 140000, 2),
('cyberpunk', 'Cyberpunk', 'science-fiction', 'High-tech dystopian futures', 80000, 100000, 3),
('dystopian', 'Dystopian', 'science-fiction', 'Dark future societies', 80000, 100000, 4),
('post-apocalyptic', 'Post-Apocalyptic', 'science-fiction', 'After civilization collapse', 80000, 100000, 5),
('time-travel', 'Time Travel', 'science-fiction', 'Stories involving time manipulation', 80000, 100000, 6);

-- Fiction > Horror
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('horror', 'Horror', 'fiction', 'Fiction designed to frighten or disturb', 70000, 90000, 7),
('gothic-horror', 'Gothic Horror', 'horror', 'Atmospheric horror with dark settings', 70000, 90000, 1),
('psychological-horror', 'Psychological Horror', 'horror', 'Mental and emotional terror', 70000, 90000, 2),
('supernatural-horror', 'Supernatural Horror', 'horror', 'Ghosts, demons, and otherworldly threats', 70000, 90000, 3);

-- Fiction > Historical Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('historical-fiction', 'Historical Fiction', 'fiction', 'Stories set in historical periods', 80000, 120000, 8);

-- Fiction > Young Adult
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('young-adult', 'Young Adult', 'fiction', 'Fiction for teen readers (13-18)', 50000, 80000, 9),
('ya-contemporary', 'YA Contemporary', 'young-adult', 'Realistic modern YA fiction', 50000, 75000, 1),
('ya-fantasy', 'YA Fantasy', 'young-adult', 'Fantasy for young adults', 60000, 85000, 2),
('ya-science-fiction', 'YA Science Fiction', 'young-adult', 'SF for young adults', 60000, 85000, 3),
('ya-dystopian', 'YA Dystopian', 'young-adult', 'Dystopian fiction for teens', 55000, 80000, 4);

-- Top-Level: Nonfiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('nonfiction', 'Nonfiction', NULL, 'Factual and informational writing', 40000, 90000, 2);

-- Nonfiction > Memoir
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('memoir', 'Memoir', 'nonfiction', 'Personal life stories', 60000, 80000, 1);

-- Nonfiction > Biography
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('biography', 'Biography', 'nonfiction', 'Life stories of others', 70000, 100000, 2);

-- Nonfiction > Business
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('business', 'Business', 'nonfiction', 'Business and entrepreneurship', 40000, 60000, 3);

-- Nonfiction > Self-Help
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('self-help', 'Self-Help', 'nonfiction', 'Personal development and improvement', 40000, 60000, 4);

-- Nonfiction > History
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('history', 'History', 'nonfiction', 'Historical accounts and analysis', 70000, 100000, 5);

-- Nonfiction > True Crime
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('true-crime', 'True Crime', 'nonfiction', 'Real criminal cases and investigations', 60000, 80000, 6);

-- Content Warning Types
INSERT OR IGNORE INTO content_warning_types (id, name, category, description, severity, display_order) VALUES
-- Violence
('violence-graphic', 'Graphic Violence', 'violence', 'Detailed descriptions of physical violence', 'severe', 1),
('violence-moderate', 'Violence', 'violence', 'Non-graphic violence', 'moderate', 2),
('violence-war', 'War/Combat', 'violence', 'Military combat or war scenes', 'moderate', 3),
('violence-torture', 'Torture', 'violence', 'Depictions of torture', 'severe', 4),
('violence-death', 'Death/Dying', 'violence', 'Characters dying or dead', 'moderate', 5),
('violence-self-harm', 'Self-Harm', 'violence', 'Self-inflicted injury', 'severe', 6),
-- Sexual Content
('sexual-explicit', 'Explicit Sexual Content', 'sexual', 'Detailed sexual scenes', 'severe', 7),
('sexual-moderate', 'Sexual Content', 'sexual', 'Non-explicit sexual situations', 'moderate', 8),
('sexual-assault', 'Sexual Assault/Rape', 'sexual', 'Sexual violence', 'severe', 9),
-- Substance Use
('substance-alcohol', 'Alcohol Use', 'substance', 'Alcohol consumption', 'mild', 10),
('substance-drugs', 'Drug Use', 'substance', 'Illegal drug use', 'moderate', 11),
('substance-addiction', 'Addiction', 'substance', 'Substance addiction themes', 'moderate', 12),
-- Mental Health
('mental-suicide', 'Suicide', 'mental_health', 'Suicide or suicidal ideation', 'severe', 13),
('mental-depression', 'Depression', 'mental_health', 'Clinical depression themes', 'moderate', 14),
('mental-anxiety', 'Anxiety/Panic', 'mental_health', 'Anxiety disorders or panic attacks', 'moderate', 15),
('mental-trauma', 'Trauma/PTSD', 'mental_health', 'Traumatic events or PTSD', 'severe', 16),
-- Discrimination/Abuse
('discrimination-racism', 'Racism', 'discrimination', 'Racial discrimination or slurs', 'moderate', 17),
('discrimination-sexism', 'Sexism', 'discrimination', 'Gender discrimination', 'moderate', 18),
('discrimination-homophobia', 'Homophobia', 'discrimination', 'Anti-LGBTQ+ discrimination', 'moderate', 19),
('abuse-domestic', 'Domestic Abuse', 'discrimination', 'Intimate partner violence', 'severe', 20),
('abuse-child', 'Child Abuse', 'discrimination', 'Abuse of children', 'severe', 21),
-- Other
('language-profanity', 'Strong Language', 'other', 'Profanity and explicit language', 'mild', 22),
('horror-body-horror', 'Body Horror', 'other', 'Disturbing body transformation or gore', 'severe', 23),
('eating-disorder', 'Eating Disorder', 'other', 'Eating disorder themes', 'moderate', 24);
-- Migration 023: Supporting Documents (Issue #49)
-- Enables query letters, synopsis, and sample chapters management

-- Supporting documents table
CREATE TABLE IF NOT EXISTS supporting_documents (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN
    ('query_letter', 'short_synopsis', 'long_synopsis',
     'sample_chapters', 'other')),
  content TEXT NOT NULL, -- Stored directly (not in R2 for easy versioning)
  file_name TEXT,
  version_number INTEGER DEFAULT 1,
  is_current_version INTEGER DEFAULT 1,
  word_count INTEGER,
  notes TEXT,
  generated_by_ai INTEGER DEFAULT 0,
  ai_prompt TEXT, -- Store prompt used for AI generation
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supporting_docs_manuscript ON supporting_documents(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_supporting_docs_user ON supporting_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_supporting_docs_type ON supporting_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_supporting_docs_current ON supporting_documents(is_current_version);
CREATE INDEX IF NOT EXISTS idx_supporting_docs_created ON supporting_documents(created_at);

-- Update trigger for supporting_documents
CREATE TRIGGER IF NOT EXISTS update_supporting_docs_timestamp
AFTER UPDATE ON supporting_documents
FOR EACH ROW
BEGIN
  UPDATE supporting_documents SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Statistics view for supporting documents
CREATE VIEW IF NOT EXISTS supporting_docs_stats AS
SELECT
  user_id,
  manuscript_id,
  document_type,
  COUNT(*) as total_versions,
  MAX(version_number) as latest_version,
  SUM(CASE WHEN is_current_version = 1 THEN 1 ELSE 0 END) as current_count,
  AVG(word_count) as avg_word_count,
  MAX(created_at) as last_updated
FROM supporting_documents
GROUP BY user_id, manuscript_id, document_type;

-- View for current documents only
CREATE VIEW IF NOT EXISTS current_supporting_documents AS
SELECT
  sd.*,
  m.title as manuscript_title,
  u.full_name as author_name
FROM supporting_documents sd
INNER JOIN manuscripts m ON sd.manuscript_id = m.id
INNER JOIN users u ON sd.user_id = u.id
WHERE sd.is_current_version = 1;
-- Migration 024: Submission Package Bundler (Issue #50)
-- Creates tables for bundling manuscripts with supporting documents into submission packages

-- submission_packages: Main package metadata
CREATE TABLE IF NOT EXISTS submission_packages (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  package_type TEXT NOT NULL CHECK (package_type IN
    ('partial', 'full', 'query_only', 'custom', 'contest')),
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  metadata TEXT, -- JSON: { target_publisher, submission_guidelines, notes, etc. }
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- package_document_map: Tracks which documents are in each package
CREATE TABLE IF NOT EXISTS package_document_map (
  package_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'manuscript', 'query_letter', 'synopsis', 'author_bio', 'sample_chapters'
  document_order INTEGER DEFAULT 1,
  include_full BOOLEAN DEFAULT 1, -- For manuscripts: full or partial (sample chapters)
  PRIMARY KEY (package_id, document_id),
  FOREIGN KEY (package_id) REFERENCES submission_packages(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submission_packages_manuscript ON submission_packages(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_submission_packages_user ON submission_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_submission_packages_type ON submission_packages(package_type);
CREATE INDEX IF NOT EXISTS idx_submission_packages_created ON submission_packages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_package_document_map_package ON package_document_map(package_id);

-- Auto-update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_submission_packages_timestamp
AFTER UPDATE ON submission_packages
BEGIN
  UPDATE submission_packages SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Package statistics view
CREATE VIEW IF NOT EXISTS package_stats AS
SELECT
  sp.id,
  sp.package_name,
  sp.package_type,
  COUNT(pdm.document_id) as document_count,
  sp.created_at,
  m.title as manuscript_title
FROM submission_packages sp
LEFT JOIN package_document_map pdm ON sp.id = pdm.package_id
LEFT JOIN manuscripts m ON sp.manuscript_id = m.id
GROUP BY sp.id;
-- Migration 025: Nuanced Submission Response System (Issue #52)
-- Expands submission tracking with detailed response types, feedback categorization, and R&R workflow

-- Create submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  package_id TEXT, -- FK to submission_packages
  publisher_name TEXT NOT NULL,
  publisher_type TEXT CHECK (publisher_type IN ('agent', 'publisher', 'magazine', 'contest', 'other')),
  submission_date INTEGER NOT NULL DEFAULT (unixepoch()),
  response_date INTEGER,
  status TEXT DEFAULT 'pending', -- Legacy field for backwards compatibility
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES submission_packages(id) ON DELETE SET NULL
);

-- Add new columns for nuanced responses (using ALTER TABLE for existing installs)
-- Note: SQLite doesn't support adding columns with CHECK constraints in ALTER TABLE,
-- so we'll validate in application code instead

-- Response tracking
ALTER TABLE submissions ADD COLUMN response_type TEXT DEFAULT 'pending';
-- Valid values: 'pending', 'form_rejection', 'personal_rejection', 'revise_resubmit',
--                'request_full', 'hold', 'waitlist', 'offer', 'withdrawn'

ALTER TABLE submissions ADD COLUMN feedback_text TEXT;
ALTER TABLE submissions ADD COLUMN feedback_category TEXT; -- JSON array: ["plot", "character", "pacing"]

-- R&R (Revise & Resubmit) tracking
ALTER TABLE submissions ADD COLUMN is_resubmission INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN original_submission_id TEXT; -- FK to original submission
ALTER TABLE submissions ADD COLUMN revision_notes TEXT;
ALTER TABLE submissions ADD COLUMN resubmission_deadline INTEGER; -- Unix timestamp

-- Additional metadata
ALTER TABLE submissions ADD COLUMN response_notes TEXT; -- Internal notes about response
ALTER TABLE submissions ADD COLUMN submission_type TEXT; -- 'query', 'partial', 'full'

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_submissions_manuscript ON submissions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_package ON submissions(package_id);
CREATE INDEX IF NOT EXISTS idx_submissions_response_type ON submissions(response_type);
CREATE INDEX IF NOT EXISTS idx_submissions_resubmission ON submissions(is_resubmission);
CREATE INDEX IF NOT EXISTS idx_submissions_original ON submissions(original_submission_id);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(submission_date DESC);

-- Auto-update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_submissions_timestamp
AFTER UPDATE ON submissions
BEGIN
  UPDATE submissions SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Feedback categorization table
CREATE TABLE IF NOT EXISTS submission_feedback (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN
    ('plot', 'character', 'pacing', 'voice', 'dialogue', 'worldbuilding',
     'marketability', 'length', 'genre_fit', 'other')),
  feedback_text TEXT NOT NULL,
  addressed INTEGER DEFAULT 0, -- Boolean: was this addressed in revision?
  response_notes TEXT, -- How author addressed this feedback
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission ON submission_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_type ON submission_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_addressed ON submission_feedback(addressed);

-- Auto-update trigger for submission_feedback
CREATE TRIGGER IF NOT EXISTS update_submission_feedback_timestamp
AFTER UPDATE ON submission_feedback
BEGIN
  UPDATE submission_feedback SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Submission statistics view
CREATE VIEW IF NOT EXISTS submission_stats AS
SELECT
  s.id,
  s.manuscript_id,
  s.publisher_name,
  s.publisher_type,
  s.submission_date,
  s.response_date,
  s.response_type,
  s.is_resubmission,
  m.title as manuscript_title,
  COUNT(DISTINCT sf.id) as feedback_count,
  SUM(CASE WHEN sf.addressed = 1 THEN 1 ELSE 0 END) as feedback_addressed_count
FROM submissions s
LEFT JOIN manuscripts m ON s.manuscript_id = m.id
LEFT JOIN submission_feedback sf ON s.id = sf.submission_id
GROUP BY s.id;
-- Migration 026: Human-Style Developmental Editor (Issue #60)
-- AI editing agent that mimics conversational, encouraging editorial style from BA creative writing editor
-- Source: 10 PDFs with ~100 pages of handwritten editorial feedback

-- Human-style editing annotations table
CREATE TABLE IF NOT EXISTS human_style_edits (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chapter_number INTEGER,
  paragraph_index INTEGER,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN
    ('question', 'suggestion', 'praise', 'issue', 'continuity')),
  comment_text TEXT NOT NULL,
  alternatives TEXT, -- JSON array of alternative phrasings (for suggestions)
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  chapter_context TEXT, -- References to previous chapters if continuity issue
  addressed INTEGER DEFAULT 0, -- Boolean: has author addressed this feedback?
  author_response TEXT, -- Optional: author's notes about how they addressed it
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_human_edits_manuscript ON human_style_edits(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_human_edits_user ON human_style_edits(user_id);
CREATE INDEX IF NOT EXISTS idx_human_edits_chapter ON human_style_edits(manuscript_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_human_edits_type ON human_style_edits(annotation_type);
CREATE INDEX IF NOT EXISTS idx_human_edits_addressed ON human_style_edits(addressed);
CREATE INDEX IF NOT EXISTS idx_human_edits_created ON human_style_edits(created_at DESC);

-- Auto-update trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_human_edits_timestamp
AFTER UPDATE ON human_style_edits
BEGIN
  UPDATE human_style_edits SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Chapter analysis sessions (track when chapters were analyzed)
CREATE TABLE IF NOT EXISTS human_edit_sessions (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  analysis_cost REAL, -- Claude API cost in USD
  annotation_count INTEGER DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  suggestion_count INTEGER DEFAULT 0,
  praise_count INTEGER DEFAULT 0,
  issue_count INTEGER DEFAULT 0,
  continuity_count INTEGER DEFAULT 0,
  chapter_context TEXT, -- Summary of previous chapters used for continuity
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_human_sessions_manuscript ON human_edit_sessions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_human_sessions_user ON human_edit_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_human_sessions_chapter ON human_edit_sessions(manuscript_id, chapter_number);

-- Statistics view
CREATE VIEW IF NOT EXISTS human_edit_stats AS
SELECT
  h.manuscript_id,
  h.user_id,
  m.title as manuscript_title,
  COUNT(DISTINCT h.id) as total_annotations,
  COUNT(DISTINCT h.chapter_number) as chapters_analyzed,
  SUM(CASE WHEN h.annotation_type = 'question' THEN 1 ELSE 0 END) as question_count,
  SUM(CASE WHEN h.annotation_type = 'suggestion' THEN 1 ELSE 0 END) as suggestion_count,
  SUM(CASE WHEN h.annotation_type = 'praise' THEN 1 ELSE 0 END) as praise_count,
  SUM(CASE WHEN h.annotation_type = 'issue' THEN 1 ELSE 0 END) as issue_count,
  SUM(CASE WHEN h.annotation_type = 'continuity' THEN 1 ELSE 0 END) as continuity_count,
  SUM(CASE WHEN h.addressed = 1 THEN 1 ELSE 0 END) as addressed_count,
  ROUND(SUM(CASE WHEN h.addressed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(h.id), 2) as addressed_percentage,
  SUM(s.analysis_cost) as total_cost
FROM human_style_edits h
LEFT JOIN manuscripts m ON h.manuscript_id = m.id
LEFT JOIN human_edit_sessions s ON h.manuscript_id = s.manuscript_id AND h.chapter_number = s.chapter_number
GROUP BY h.manuscript_id, h.user_id;
-- Migration 027: Social Media Marketing Content Generator (Issue #45)
-- AI-powered marketing kit generation with platform-specific social media posts,
-- email templates, content calendar, trailer scripts, and reader magnets

-- Master table for marketing kits
CREATE TABLE IF NOT EXISTS marketing_kits (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kit_name TEXT NOT NULL, -- e.g., "Launch Marketing Kit", "Series Promo Kit"
  genre TEXT,
  target_audience TEXT, -- JSON: demographics, reader interests
  tone TEXT, -- 'professional', 'casual', 'humorous', 'dramatic'
  generation_cost REAL, -- Claude API cost
  generated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketing_kits_manuscript ON marketing_kits(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_marketing_kits_user ON marketing_kits(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_kits_created ON marketing_kits(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_marketing_kits_timestamp
AFTER UPDATE ON marketing_kits
BEGIN
  UPDATE marketing_kits SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Social media posts (platform-specific)
CREATE TABLE IF NOT EXISTS social_media_posts (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN
    ('twitter', 'facebook', 'instagram', 'tiktok', 'linkedin', 'threads', 'bluesky')),
  post_type TEXT NOT NULL CHECK (post_type IN
    ('announcement', 'character_spotlight', 'quote', 'behind_scenes',
     'engagement_question', 'countdown', 'review_request', 'giveaway', 'other')),
  post_text TEXT NOT NULL,
  hashtags TEXT, -- Comma-separated or JSON array
  image_suggestion TEXT, -- Description of recommended image
  optimal_posting_time TEXT, -- e.g., "Weekdays 9am-11am EST"
  character_count INTEGER, -- For platforms with limits
  engagement_hook TEXT, -- Call-to-action or engagement strategy
  post_order INTEGER DEFAULT 0, -- Sequence in campaign
  is_used INTEGER DEFAULT 0, -- Boolean: has author used this post?
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_posts_kit ON social_media_posts(kit_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_type ON social_media_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_social_posts_order ON social_media_posts(post_order);

-- 30-day content calendar
CREATE TABLE IF NOT EXISTS content_calendar (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  day_number INTEGER NOT NULL, -- Day 1-30 (or more)
  calendar_date INTEGER, -- Optional: actual Unix timestamp if scheduled
  platform TEXT NOT NULL,
  post_id TEXT, -- FK to social_media_posts (optional)
  activity_type TEXT NOT NULL CHECK (activity_type IN
    ('post', 'engage', 'email', 'story', 'live', 'blog', 'other')),
  activity_description TEXT NOT NULL,
  time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  completed INTEGER DEFAULT 0, -- Boolean: has author completed this?
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES social_media_posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_kit ON content_calendar(kit_id);
CREATE INDEX IF NOT EXISTS idx_calendar_day ON content_calendar(day_number);
CREATE INDEX IF NOT EXISTS idx_calendar_platform ON content_calendar(platform);
CREATE INDEX IF NOT EXISTS idx_calendar_completed ON content_calendar(completed);

-- Marketing materials (emails, scripts, magnets)
CREATE TABLE IF NOT EXISTS marketing_materials (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN
    ('launch_email', 'trailer_script', 'reader_magnet', 'blog_post',
     'press_release', 'interview_qa', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT, -- 'markdown', 'html', 'plain_text', 'script'
  word_count INTEGER,
  estimated_duration TEXT, -- For video scripts: "2-3 minutes"
  additional_notes TEXT, -- Production notes, requirements, tips
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_materials_kit ON marketing_materials(kit_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON marketing_materials(material_type);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_marketing_materials_timestamp
AFTER UPDATE ON marketing_materials
BEGIN
  UPDATE marketing_materials SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Hashtag strategy table (optional, for tracking performance)
CREATE TABLE IF NOT EXISTS hashtag_strategy (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  genre TEXT NOT NULL,
  platform TEXT NOT NULL,
  hashtag TEXT NOT NULL,
  category TEXT CHECK (category IN
    ('genre', 'trending', 'community', 'author', 'promotional')),
  estimated_reach TEXT, -- 'high', 'medium', 'low'
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hashtags_kit ON hashtag_strategy(kit_id);
CREATE INDEX IF NOT EXISTS idx_hashtags_genre ON hashtag_strategy(genre);
CREATE INDEX IF NOT EXISTS idx_hashtags_platform ON hashtag_strategy(platform);

-- Statistics view
CREATE VIEW IF NOT EXISTS marketing_kit_stats AS
SELECT
  k.id as kit_id,
  k.manuscript_id,
  k.user_id,
  k.kit_name,
  k.genre,
  m.title as manuscript_title,
  COUNT(DISTINCT p.id) as total_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'twitter' THEN p.id END) as twitter_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'facebook' THEN p.id END) as facebook_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'instagram' THEN p.id END) as instagram_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'tiktok' THEN p.id END) as tiktok_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'linkedin' THEN p.id END) as linkedin_posts,
  COUNT(DISTINCT c.id) as calendar_items,
  COUNT(DISTINCT mat.id) as materials_count,
  SUM(CASE WHEN p.is_used = 1 THEN 1 ELSE 0 END) as posts_used,
  SUM(CASE WHEN c.completed = 1 THEN 1 ELSE 0 END) as calendar_completed,
  k.generation_cost,
  k.generated_at
FROM marketing_kits k
LEFT JOIN manuscripts m ON k.manuscript_id = m.id
LEFT JOIN social_media_posts p ON k.id = p.kit_id
LEFT JOIN content_calendar c ON k.id = c.kit_id
LEFT JOIN marketing_materials mat ON k.id = mat.kit_id
GROUP BY k.id;
-- Migration 028: Manuscript Formatting Engine (Issue #44)
-- EPUB and PDF conversion with professional formatting for Amazon KDP publishing

-- Formatted manuscript files table
CREATE TABLE IF NOT EXISTS formatted_manuscripts (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  format_type TEXT NOT NULL CHECK (format_type IN
    ('epub', 'pdf', 'mobi', 'preview_epub', 'preview_pdf')),
  file_key TEXT NOT NULL, -- R2 bucket key
  file_size INTEGER, -- Bytes
  file_url TEXT, -- Presigned URL or public URL
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Format-specific settings
  trim_size TEXT, -- For PDF: '6x9', '5x8', '5.5x8.5'
  page_count INTEGER,
  has_bleed INTEGER DEFAULT 0, -- Boolean: print bleed margins
  font_family TEXT DEFAULT 'Georgia',
  font_size INTEGER DEFAULT 12,

  -- Front matter options
  include_title_page INTEGER DEFAULT 1,
  include_copyright INTEGER DEFAULT 1,
  include_dedication INTEGER DEFAULT 0,
  dedication_text TEXT,
  include_toc INTEGER DEFAULT 1,

  -- Back matter options
  include_author_bio INTEGER DEFAULT 1,
  include_series_info INTEGER DEFAULT 0,
  include_newsletter_signup INTEGER DEFAULT 0,
  newsletter_url TEXT,

  -- Formatting options
  chapter_start_page TEXT DEFAULT 'odd' CHECK (chapter_start_page IN ('any', 'odd', 'even')),
  use_drop_caps INTEGER DEFAULT 0,
  use_scene_breaks INTEGER DEFAULT 1,
  scene_break_symbol TEXT DEFAULT '* * *',
  justify_text INTEGER DEFAULT 1,
  enable_hyphenation INTEGER DEFAULT 1,

  -- Validation
  is_validated INTEGER DEFAULT 0,
  validation_errors TEXT, -- JSON array of validation issues
  passes_amazon_specs INTEGER DEFAULT 0,

  -- Metadata
  generation_cost REAL, -- API/processing cost
  processing_time_ms INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_formatted_manuscripts_manuscript ON formatted_manuscripts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_formatted_manuscripts_user ON formatted_manuscripts(user_id);
CREATE INDEX IF NOT EXISTS idx_formatted_manuscripts_format ON formatted_manuscripts(format_type);
CREATE INDEX IF NOT EXISTS idx_formatted_manuscripts_status ON formatted_manuscripts(status);
CREATE INDEX IF NOT EXISTS idx_formatted_manuscripts_created ON formatted_manuscripts(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_formatted_manuscripts_timestamp
AFTER UPDATE ON formatted_manuscripts
BEGIN
  UPDATE formatted_manuscripts SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Formatting templates (reusable formatting configurations)
CREATE TABLE IF NOT EXISTS formatting_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL for system templates
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('epub', 'pdf', 'both')),
  is_system_template INTEGER DEFAULT 0, -- Boolean: built-in template
  description TEXT,

  -- Template settings (JSON object with all formatting options)
  template_settings TEXT NOT NULL, -- JSON

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_formatting_templates_user ON formatting_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_formatting_templates_type ON formatting_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_formatting_templates_system ON formatting_templates(is_system_template);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_formatting_templates_timestamp
AFTER UPDATE ON formatting_templates
BEGIN
  UPDATE formatting_templates SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Formatting job queue (for async processing)
CREATE TABLE IF NOT EXISTS formatting_jobs (
  id TEXT PRIMARY KEY,
  formatted_manuscript_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('epub', 'pdf', 'validation', 'preview')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (formatted_manuscript_id) REFERENCES formatted_manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_formatting_jobs_status ON formatting_jobs(status);
CREATE INDEX IF NOT EXISTS idx_formatting_jobs_priority ON formatting_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_formatting_jobs_created ON formatting_jobs(created_at);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_formatting_jobs_timestamp
AFTER UPDATE ON formatting_jobs
BEGIN
  UPDATE formatting_jobs SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Statistics view
CREATE VIEW IF NOT EXISTS formatting_stats AS
SELECT
  f.manuscript_id,
  f.user_id,
  m.title as manuscript_title,
  COUNT(DISTINCT f.id) as total_formats,
  COUNT(DISTINCT CASE WHEN f.format_type = 'epub' THEN f.id END) as epub_count,
  COUNT(DISTINCT CASE WHEN f.format_type = 'pdf' THEN f.id END) as pdf_count,
  COUNT(DISTINCT CASE WHEN f.format_type = 'preview_epub' THEN f.id END) as preview_count,
  COUNT(DISTINCT CASE WHEN f.status = 'completed' THEN f.id END) as completed_count,
  COUNT(DISTINCT CASE WHEN f.status = 'failed' THEN f.id END) as failed_count,
  COUNT(DISTINCT CASE WHEN f.passes_amazon_specs = 1 THEN f.id END) as amazon_validated_count,
  SUM(f.generation_cost) as total_cost,
  MAX(f.created_at) as last_formatted
FROM formatted_manuscripts f
LEFT JOIN manuscripts m ON f.manuscript_id = m.id
GROUP BY f.manuscript_id, f.user_id;
-- Migration 029: Communication & Feedback System (Issue #55)
-- Publisher-author messaging, form letters, notifications, revision requests

-- Notification preferences for users
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Email notification toggles
  email_on_submission_received INTEGER DEFAULT 1, -- Publisher: new submission
  email_on_status_change INTEGER DEFAULT 1,       -- Author: submission status changed
  email_on_decision INTEGER DEFAULT 1,            -- Author: final decision made
  email_on_message INTEGER DEFAULT 1,             -- Both: new message received
  email_on_revision_request INTEGER DEFAULT 1,    -- Author: R&R received
  email_on_revision_submitted INTEGER DEFAULT 1,  -- Publisher: revision submitted

  -- Notification frequency
  digest_frequency TEXT DEFAULT 'immediate' CHECK (digest_frequency IN
    ('immediate', 'daily', 'weekly', 'none')),

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_notification_preferences_timestamp
AFTER UPDATE ON notification_preferences
BEGIN
  UPDATE notification_preferences SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Message templates for publishers (form letters)
CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  publisher_id TEXT, -- NULL for system templates
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN
    ('rejection', 'request_and_revise', 'request_full', 'offer', 'acknowledgment', 'custom')),
  is_system_template INTEGER DEFAULT 0, -- Boolean: built-in template

  -- Template content
  subject_line TEXT NOT NULL,
  body_text TEXT NOT NULL,

  -- Available merge fields (JSON array)
  merge_fields TEXT, -- ["{{author_name}}", "{{manuscript_title}}", "{{submission_date}}", etc.]

  -- Usage tracking
  times_used INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_templates_publisher ON message_templates(publisher_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_system ON message_templates(is_system_template);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_message_templates_timestamp
AFTER UPDATE ON message_templates
BEGIN
  UPDATE message_templates SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Messages on submissions (threaded conversations)
CREATE TABLE IF NOT EXISTS submission_messages (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,

  -- Message metadata
  message_type TEXT NOT NULL CHECK (message_type IN
    ('status_update', 'feedback', 'revision_request', 'general', 'system')),
  subject TEXT,
  body TEXT NOT NULL,

  -- Attachments (JSON array of R2 keys)
  attachments TEXT,

  -- Read tracking
  is_read INTEGER DEFAULT 0,
  read_at INTEGER,

  -- Reply threading
  parent_message_id TEXT, -- For threaded replies

  sent_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES submission_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_messages_submission ON submission_messages(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_sender ON submission_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_recipient ON submission_messages(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_read ON submission_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_submission_messages_sent ON submission_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_messages_parent ON submission_messages(parent_message_id);

-- Revision requests (Request & Revise workflow)
CREATE TABLE IF NOT EXISTS revision_requests (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL, -- Publisher ID

  -- Revision details
  requested_changes TEXT NOT NULL, -- Detailed feedback
  revision_type TEXT CHECK (revision_type IN
    ('minor', 'moderate', 'major', 'substantial')),
  deadline INTEGER, -- Unix timestamp

  -- Author response
  author_response TEXT, -- Author's response/questions
  author_response_at INTEGER,

  -- Resubmission tracking
  resubmission_manuscript_id TEXT, -- New manuscript version
  resubmitted_at INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'accepted', 'declined', 'resubmitted', 'expired')),

  -- Decision
  decision TEXT, -- Publisher's decision after revision
  decision_at INTEGER,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resubmission_manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_requests_submission ON revision_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_requester ON revision_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_status ON revision_requests(status);
CREATE INDEX IF NOT EXISTS idx_revision_requests_deadline ON revision_requests(deadline);
CREATE INDEX IF NOT EXISTS idx_revision_requests_created ON revision_requests(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_revision_requests_timestamp
AFTER UPDATE ON revision_requests
BEGIN
  UPDATE revision_requests SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Notification queue (for email sending)
CREATE TABLE IF NOT EXISTS notification_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN
    ('submission_received', 'status_change', 'decision', 'message', 'revision_request', 'revision_submitted')),

  -- Email content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Related entities
  submission_id TEXT,
  message_id TEXT,
  revision_request_id TEXT,

  -- Send tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'sent', 'failed')),
  sent_at INTEGER,
  error_message TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES submission_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (revision_request_id) REFERENCES revision_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created ON notification_queue(created_at);

-- Statistics view
CREATE VIEW IF NOT EXISTS communication_stats AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(DISTINCT CASE WHEN sm.sender_user_id = u.id THEN sm.id END) as messages_sent,
  COUNT(DISTINCT CASE WHEN sm.recipient_user_id = u.id THEN sm.id END) as messages_received,
  COUNT(DISTINCT CASE WHEN sm.recipient_user_id = u.id AND sm.is_read = 0 THEN sm.id END) as unread_messages,
  COUNT(DISTINCT CASE WHEN rr.requested_by_user_id = u.id THEN rr.id END) as revision_requests_sent,
  COUNT(DISTINCT mt.id) as templates_created,
  MAX(sm.sent_at) as last_message_at
FROM users u
LEFT JOIN submission_messages sm ON u.id = sm.sender_user_id OR u.id = sm.recipient_user_id
LEFT JOIN revision_requests rr ON u.id = rr.requested_by_user_id
LEFT JOIN message_templates mt ON u.id = mt.publisher_id
GROUP BY u.id;
-- Migration 030: Slush Pile Management System (Issue #54)
-- Publisher inbox, assignments, ratings, consensus, decision workflow

-- Submission assignments (assign to readers/editors)
CREATE TABLE IF NOT EXISTS submission_assignments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  assigned_to_user_id TEXT NOT NULL, -- FK to users (role=publisher)
  assigned_by_user_id TEXT NOT NULL, -- FK to users (who assigned)
  assignment_date INTEGER NOT NULL DEFAULT (unixepoch()),
  completion_date INTEGER, -- When reader finished review
  status TEXT DEFAULT 'pending' CHECK (status IN
    ('pending', 'in_progress', 'completed', 'skipped')),
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignments_submission ON submission_assignments(submission_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to ON submission_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON submission_assignments(assigned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON submission_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON submission_assignments(assignment_date DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_submission_assignments_timestamp
AFTER UPDATE ON submission_assignments
BEGIN
  UPDATE submission_assignments SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Submission ratings (scoring system)
CREATE TABLE IF NOT EXISTS submission_ratings (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  rater_user_id TEXT NOT NULL, -- FK to users
  assignment_id TEXT, -- Optional: linked to assignment

  -- Scoring (1-10 scale)
  overall_score REAL NOT NULL CHECK (overall_score >= 1 AND overall_score <= 10),
  plot_score REAL CHECK (plot_score >= 1 AND plot_score <= 10),
  writing_quality_score REAL CHECK (writing_quality_score >= 1 AND writing_quality_score <= 10),
  marketability_score REAL CHECK (marketability_score >= 1 AND marketability_score <= 10),
  voice_score REAL CHECK (voice_score >= 1 AND voice_score <= 10),

  -- Recommendation
  recommendation TEXT CHECK (recommendation IN
    ('pass', 'consider', 'request_full', 'revise_resubmit', 'offer')),

  -- Detailed feedback
  strengths TEXT, -- What works well
  weaknesses TEXT, -- What needs improvement
  notes TEXT, -- Internal notes for team

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES submission_assignments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_submission ON submission_ratings(submission_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater ON submission_ratings(rater_user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_recommendation ON submission_ratings(recommendation);
CREATE INDEX IF NOT EXISTS idx_ratings_overall_score ON submission_ratings(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_assignment ON submission_ratings(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created ON submission_ratings(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_submission_ratings_timestamp
AFTER UPDATE ON submission_ratings
BEGIN
  UPDATE submission_ratings SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Submission discussions (internal comments/notes)
CREATE TABLE IF NOT EXISTS submission_discussions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- FK to users (who commented)
  comment_text TEXT NOT NULL,
  is_internal INTEGER DEFAULT 1, -- Boolean: internal vs sent to author
  parent_comment_id TEXT, -- For threaded discussions
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES submission_discussions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discussions_submission ON submission_discussions(submission_id);
CREATE INDEX IF NOT EXISTS idx_discussions_user ON submission_discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_date ON submission_discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussions_parent ON submission_discussions(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_discussions_internal ON submission_discussions(is_internal);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_submission_discussions_timestamp
AFTER UPDATE ON submission_discussions
BEGIN
  UPDATE submission_discussions SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Consensus view (aggregate ratings)
CREATE VIEW IF NOT EXISTS submission_consensus AS
SELECT
  sr.submission_id,
  COUNT(DISTINCT sr.rater_user_id) as total_readers,
  AVG(sr.overall_score) as avg_overall_score,
  AVG(sr.plot_score) as avg_plot_score,
  AVG(sr.writing_quality_score) as avg_writing_quality_score,
  AVG(sr.marketability_score) as avg_marketability_score,
  AVG(sr.voice_score) as avg_voice_score,

  -- Count recommendations
  SUM(CASE WHEN sr.recommendation = 'pass' THEN 1 ELSE 0 END) as pass_count,
  SUM(CASE WHEN sr.recommendation = 'consider' THEN 1 ELSE 0 END) as consider_count,
  SUM(CASE WHEN sr.recommendation = 'request_full' THEN 1 ELSE 0 END) as request_full_count,
  SUM(CASE WHEN sr.recommendation = 'revise_resubmit' THEN 1 ELSE 0 END) as rr_count,
  SUM(CASE WHEN sr.recommendation = 'offer' THEN 1 ELSE 0 END) as offer_count,

  -- Most common recommendation (mode)
  (SELECT recommendation FROM submission_ratings
   WHERE submission_id = sr.submission_id
   GROUP BY recommendation
   ORDER BY COUNT(*) DESC LIMIT 1) as consensus_recommendation,

  MAX(sr.created_at) as last_rating_at
FROM submission_ratings sr
GROUP BY sr.submission_id;

-- Publisher slush pile statistics
CREATE VIEW IF NOT EXISTS publisher_slush_stats AS
SELECT
  u.id as publisher_id,
  u.email,
  u.display_name,

  -- Assignment stats
  COUNT(DISTINCT CASE WHEN sa.assigned_by_user_id = u.id THEN sa.id END) as assignments_made,
  COUNT(DISTINCT CASE WHEN sa.assigned_to_user_id = u.id THEN sa.id END) as assignments_received,
  COUNT(DISTINCT CASE WHEN sa.assigned_to_user_id = u.id AND sa.status = 'completed' THEN sa.id END) as assignments_completed,

  -- Rating stats
  COUNT(DISTINCT sr.id) as ratings_given,
  AVG(sr.overall_score) as avg_rating_given,

  -- Discussion stats
  COUNT(DISTINCT sd.id) as comments_made,

  -- Response time (days from assignment to completion)
  AVG(CASE WHEN sa.completion_date IS NOT NULL
    THEN (sa.completion_date - sa.assignment_date) / 86400.0
    ELSE NULL END) as avg_response_days

FROM users u
LEFT JOIN submission_assignments sa ON u.id = sa.assigned_by_user_id OR u.id = sa.assigned_to_user_id
LEFT JOIN submission_ratings sr ON u.id = sr.rater_user_id
LEFT JOIN submission_discussions sd ON u.id = sd.user_id
WHERE u.role = 'publisher'
GROUP BY u.id;
-- Migration 031: Submission Windows & Deadline Tracking (Issue #53)
-- Publisher submission windows, deadlines, alerts

-- Publishers/agents table (basic profile)
CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  publisher_type TEXT CHECK (publisher_type IN
    ('traditional_publisher', 'indie_press', 'literary_agent', 'magazine', 'anthology', 'contest')),
  website TEXT,
  submission_guidelines_url TEXT,
  email TEXT,

  -- Historical data
  avg_response_time_days INTEGER, -- Average response time in days
  acceptance_rate REAL, -- % of submissions accepted (0.0 - 1.0)

  -- Metadata
  genres_accepted TEXT, -- JSON array of genres
  accepts_simultaneous INTEGER DEFAULT 1, -- Boolean
  requires_exclusive INTEGER DEFAULT 0, -- Boolean
  notes TEXT,

  is_active INTEGER DEFAULT 1, -- Boolean: still accepting submissions
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_publishers_type ON publishers(publisher_type);
CREATE INDEX IF NOT EXISTS idx_publishers_active ON publishers(is_active);
CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_publishers_timestamp
AFTER UPDATE ON publishers
BEGIN
  UPDATE publishers SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Publisher submission windows
CREATE TABLE IF NOT EXISTS publisher_submission_windows (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,

  -- Window type
  window_type TEXT NOT NULL CHECK (window_type IN
    ('rolling', 'periodic', 'annual', 'contest', 'closed')),

  -- Status
  is_open INTEGER DEFAULT 1, -- Boolean

  -- Timing
  opens_at INTEGER, -- Unix timestamp (NULL for rolling/always open)
  closes_at INTEGER, -- Unix timestamp (NULL for rolling)

  -- Capacity
  capacity_limit INTEGER, -- Max submissions (NULL for unlimited)
  current_submissions INTEGER DEFAULT 0,

  -- Genre-specific windows
  genres_accepted TEXT, -- JSON array (NULL = all genres)

  -- Metadata
  window_name TEXT, -- "Spring 2025 Reading Period"
  description TEXT,
  notes TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_windows_publisher ON publisher_submission_windows(publisher_id);
CREATE INDEX IF NOT EXISTS idx_windows_is_open ON publisher_submission_windows(is_open);
CREATE INDEX IF NOT EXISTS idx_windows_opens ON publisher_submission_windows(opens_at);
CREATE INDEX IF NOT EXISTS idx_windows_closes ON publisher_submission_windows(closes_at DESC);
CREATE INDEX IF NOT EXISTS idx_windows_type ON publisher_submission_windows(window_type);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_submission_windows_timestamp
AFTER UPDATE ON publisher_submission_windows
BEGIN
  UPDATE publisher_submission_windows SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Submission deadlines (per-submission tracking)
CREATE TABLE IF NOT EXISTS submission_deadlines (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,

  -- Deadline type
  deadline_type TEXT NOT NULL CHECK (deadline_type IN
    ('response_expected', 'revise_resubmit', 'contract_expires', 'contest', 'window_closes', 'other')),

  -- Timing
  deadline_date INTEGER NOT NULL, -- Unix timestamp
  reminder_days_before INTEGER DEFAULT 7, -- Send reminder N days before

  -- Reminders
  reminder_sent INTEGER DEFAULT 0, -- Boolean
  reminder_sent_at INTEGER,

  -- Metadata
  deadline_name TEXT, -- "R&R Deadline for Novel Submission"
  description TEXT,
  notes TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deadlines_submission ON submission_deadlines(submission_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON submission_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_type ON submission_deadlines(deadline_type);
CREATE INDEX IF NOT EXISTS idx_deadlines_reminder_sent ON submission_deadlines(reminder_sent);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_submission_deadlines_timestamp
AFTER UPDATE ON submission_deadlines
BEGIN
  UPDATE submission_deadlines SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Window alerts (user subscriptions to publisher windows)
CREATE TABLE IF NOT EXISTS window_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  publisher_id TEXT NOT NULL,

  -- Alert preferences
  alert_on_open INTEGER DEFAULT 1, -- Notify when window opens
  alert_on_closing_soon INTEGER DEFAULT 1, -- Notify 7 days before close
  alert_on_capacity_warning INTEGER DEFAULT 1, -- Notify when 80% full

  -- Alert history
  last_alerted_at INTEGER,
  alerts_sent_count INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE,
  UNIQUE(user_id, publisher_id)
);

CREATE INDEX IF NOT EXISTS idx_window_alerts_user ON window_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_window_alerts_publisher ON window_alerts(publisher_id);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_window_alerts_timestamp
AFTER UPDATE ON window_alerts
BEGIN
  UPDATE window_alerts SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- View: Currently open windows
CREATE VIEW IF NOT EXISTS open_submission_windows AS
SELECT
  psw.*,
  p.name as publisher_name,
  p.publisher_type,
  p.website,
  p.avg_response_time_days,

  -- Calculate days until close
  CASE
    WHEN psw.closes_at IS NOT NULL
    THEN CAST((psw.closes_at - unixepoch()) / 86400.0 AS INTEGER)
    ELSE NULL
  END as days_until_close,

  -- Capacity status
  CASE
    WHEN psw.capacity_limit IS NOT NULL
    THEN CAST((psw.current_submissions * 100.0 / psw.capacity_limit) AS INTEGER)
    ELSE NULL
  END as capacity_percent

FROM publisher_submission_windows psw
JOIN publishers p ON psw.publisher_id = p.id
WHERE psw.is_open = 1
  AND (psw.closes_at IS NULL OR psw.closes_at > unixepoch())
  AND (psw.capacity_limit IS NULL OR psw.current_submissions < psw.capacity_limit);

-- View: Opening soon (next 30 days)
CREATE VIEW IF NOT EXISTS windows_opening_soon AS
SELECT
  psw.*,
  p.name as publisher_name,
  p.publisher_type,
  p.website,

  -- Days until open
  CAST((psw.opens_at - unixepoch()) / 86400.0 AS INTEGER) as days_until_open

FROM publisher_submission_windows psw
JOIN publishers p ON psw.publisher_id = p.id
WHERE psw.is_open = 0
  AND psw.opens_at IS NOT NULL
  AND psw.opens_at > unixepoch()
  AND psw.opens_at <= (unixepoch() + 2592000) -- 30 days
ORDER BY psw.opens_at ASC;

-- View: Upcoming deadlines
CREATE VIEW IF NOT EXISTS upcoming_deadlines AS
SELECT
  sd.*,
  m.title as manuscript_title,
  m.author,
  m.genre,

  -- Days until deadline
  CAST((sd.deadline_date - unixepoch()) / 86400.0 AS INTEGER) as days_until_deadline,

  -- Overdue flag
  CASE WHEN sd.deadline_date < unixepoch() THEN 1 ELSE 0 END as is_overdue

FROM submission_deadlines sd
JOIN manuscripts m ON sd.submission_id = m.id
WHERE sd.deadline_date > (unixepoch() - 604800) -- Show 7 days past due
ORDER BY sd.deadline_date ASC;
-- Migration 032: Amazon KDP Integration System
-- Enables semi-automated Amazon KDP publishing with pre-filled metadata and validation

-- KDP Packages Table
-- Tracks generated KDP submission packages (ZIP files)
CREATE TABLE IF NOT EXISTS kdp_packages (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  package_status TEXT NOT NULL DEFAULT 'pending' CHECK (package_status IN
    ('pending', 'generating', 'ready', 'failed', 'expired')),
  package_key TEXT, -- R2 key for the ZIP file
  package_size INTEGER,
  epub_key TEXT, -- R2 key for EPUB file
  cover_key TEXT, -- R2 key for cover image
  metadata_key TEXT, -- R2 key for metadata.txt
  instructions_key TEXT, -- R2 key for instructions.pdf
  validation_passed INTEGER DEFAULT 0,
  expiration_date INTEGER, -- Expires after 30 days
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- KDP Metadata Table
-- Stores Amazon KDP-specific metadata for each package
CREATE TABLE IF NOT EXISTS kdp_metadata (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,

  -- Book Details
  title TEXT NOT NULL,
  subtitle TEXT,
  series_name TEXT,
  series_number INTEGER,
  edition_number INTEGER DEFAULT 1,

  -- Author Information
  author_name TEXT NOT NULL,
  contributors TEXT, -- JSON array: [{name, role}]

  -- Description & Marketing
  description TEXT NOT NULL, -- Max 4000 characters
  description_length INTEGER,
  author_bio TEXT, -- Max 2500 characters

  -- Categories & Keywords
  primary_category TEXT,
  secondary_category TEXT,
  bisac_codes TEXT, -- JSON array of BISAC codes
  keywords TEXT NOT NULL, -- JSON array of 7 keyword phrases
  age_range_min INTEGER,
  age_range_max INTEGER,
  grade_level TEXT,

  -- Publishing Rights
  publishing_rights TEXT NOT NULL CHECK (publishing_rights IN
    ('worldwide', 'territories_included', 'territories_excluded')),
  territories TEXT, -- JSON array of territory codes
  isbn_type TEXT CHECK (isbn_type IN ('amazon_free', 'author_owned', 'none')),
  isbn TEXT,

  -- Publication Date
  publication_date INTEGER, -- Unix timestamp (or NULL for "publish immediately")

  -- Pricing & Distribution
  price_usd REAL,
  price_gbp REAL,
  price_eur REAL,
  price_cad REAL,
  price_aud REAL,
  royalty_option TEXT CHECK (royalty_option IN ('35', '70')),
  kdp_select_enrolled INTEGER DEFAULT 0, -- Exclusive to Amazon for 90 days
  enable_lending INTEGER DEFAULT 1,

  -- Format Information
  format_type TEXT CHECK (format_type IN ('ebook', 'paperback', 'hardcover')),
  trim_size TEXT, -- For print (e.g., "6x9")
  bleed_settings TEXT CHECK (bleed_settings IN ('no_bleed', 'bleed')),
  paper_color TEXT CHECK (paper_color IN ('white', 'cream')),

  -- Content Flags
  adult_content INTEGER DEFAULT 0,
  public_domain INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- KDP Validation Results Table
-- Tracks validation results for KDP packages
CREATE TABLE IF NOT EXISTS kdp_validation_results (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  validation_type TEXT NOT NULL CHECK (validation_type IN
    ('file_format', 'cover_specs', 'metadata', 'content', 'full_package')),
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  issues TEXT, -- JSON array of validation issues
  recommendations TEXT, -- JSON array of recommendations
  validated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE
);

-- KDP Publishing Status Table
-- Tracks publishing attempts and status (for future automation)
CREATE TABLE IF NOT EXISTS kdp_publishing_status (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  publishing_method TEXT CHECK (publishing_method IN
    ('manual_guided', 'semi_automated', 'fully_automated')),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN
    ('preparing', 'uploading', 'in_review', 'live', 'failed', 'cancelled')),
  kdp_asin TEXT, -- Amazon Standard Identification Number (when live)
  kdp_url TEXT, -- URL to live book page
  error_message TEXT,
  published_at INTEGER, -- When it went live
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- KDP Royalty Calculations Table
-- Stores royalty estimates based on pricing
CREATE TABLE IF NOT EXISTS kdp_royalty_calculations (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  price_usd REAL NOT NULL,
  royalty_option TEXT NOT NULL CHECK (royalty_option IN ('35', '70')),

  -- Calculated Royalties
  royalty_per_sale_usd REAL,
  delivery_cost_usd REAL, -- For 70% royalty (based on file size)
  net_royalty_usd REAL,

  -- File size (affects delivery cost)
  file_size_mb REAL,

  -- Minimum price requirements
  minimum_price_35 REAL,
  maximum_price_35 REAL,
  minimum_price_70 REAL,
  maximum_price_70 REAL,

  -- Recommendation
  recommended_royalty TEXT,
  recommendation_reason TEXT,

  calculated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kdp_packages_manuscript ON kdp_packages(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_user ON kdp_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_status ON kdp_packages(package_status);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_created ON kdp_packages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdp_metadata_package ON kdp_metadata(package_id);
CREATE INDEX IF NOT EXISTS idx_kdp_metadata_manuscript ON kdp_metadata(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_kdp_metadata_isbn ON kdp_metadata(isbn);

CREATE INDEX IF NOT EXISTS idx_kdp_validation_package ON kdp_validation_results(package_id);
CREATE INDEX IF NOT EXISTS idx_kdp_validation_type ON kdp_validation_results(validation_type);

CREATE INDEX IF NOT EXISTS idx_kdp_publishing_package ON kdp_publishing_status(package_id);
CREATE INDEX IF NOT EXISTS idx_kdp_publishing_user ON kdp_publishing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_kdp_publishing_status ON kdp_publishing_status(status);
CREATE INDEX IF NOT EXISTS idx_kdp_publishing_asin ON kdp_publishing_status(kdp_asin);

CREATE INDEX IF NOT EXISTS idx_kdp_royalty_package ON kdp_royalty_calculations(package_id);

-- Triggers for auto-update timestamps
CREATE TRIGGER IF NOT EXISTS kdp_packages_updated
AFTER UPDATE ON kdp_packages
FOR EACH ROW
BEGIN
  UPDATE kdp_packages SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS kdp_metadata_updated
AFTER UPDATE ON kdp_metadata
FOR EACH ROW
BEGIN
  UPDATE kdp_metadata SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS kdp_publishing_status_updated
AFTER UPDATE ON kdp_publishing_status
FOR EACH ROW
BEGIN
  UPDATE kdp_publishing_status SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- View: KDP Package Statistics
CREATE VIEW IF NOT EXISTS kdp_stats AS
SELECT
  COUNT(DISTINCT kp.id) as total_packages,
  COUNT(DISTINCT CASE WHEN kp.package_status = 'ready' THEN kp.id END) as ready_packages,
  COUNT(DISTINCT CASE WHEN kp.validation_passed = 1 THEN kp.id END) as validated_packages,
  COUNT(DISTINCT kps.id) as total_publishing_attempts,
  COUNT(DISTINCT CASE WHEN kps.status = 'live' THEN kps.id END) as live_books,
  AVG(CASE WHEN krc.royalty_option = '70' THEN krc.net_royalty_usd END) as avg_royalty_70,
  AVG(CASE WHEN krc.royalty_option = '35' THEN krc.net_royalty_usd END) as avg_royalty_35
FROM kdp_packages kp
LEFT JOIN kdp_publishing_status kps ON kp.id = kps.package_id
LEFT JOIN kdp_royalty_calculations krc ON kp.id = krc.package_id;
-- Migration 033: Market Analysis & Amazon Comp Title Research
-- Enables data-driven publishing decisions through Amazon marketplace analysis

-- Comp Titles Table
-- Stores Amazon comparable titles for analysis
CREATE TABLE IF NOT EXISTS comp_titles (
  id TEXT PRIMARY KEY,
  asin TEXT NOT NULL UNIQUE, -- Amazon Standard Identification Number

  -- Book Information
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  publication_date INTEGER, -- Unix timestamp

  -- Market Data
  price_usd REAL,
  price_currency TEXT DEFAULT 'USD',
  bestseller_rank INTEGER, -- Overall Amazon rank
  category_ranks TEXT, -- JSON array: [{category, rank}]

  -- Review Data
  review_count INTEGER DEFAULT 0,
  average_rating REAL, -- 1.0 to 5.0
  rating_distribution TEXT, -- JSON: {5: count, 4: count, ...}

  -- Metadata
  genre TEXT,
  categories TEXT, -- JSON array of Amazon categories
  keywords TEXT, -- JSON array of keywords (extracted or inferred)
  page_count INTEGER,
  format TEXT, -- 'Kindle Edition', 'Paperback', 'Hardcover', 'Audiobook'

  -- KDP Data (if available)
  kdp_select INTEGER DEFAULT 0,
  lending_enabled INTEGER DEFAULT 0,

  -- Scraping Metadata
  amazon_url TEXT,
  last_scraped_at INTEGER,
  scrape_source TEXT, -- 'manual', 'api', 'web_scrape'

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Market Analysis Reports Table
-- Stores generated market analysis reports for manuscripts
CREATE TABLE IF NOT EXISTS market_analysis_reports (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Analysis Parameters
  genre TEXT NOT NULL,
  search_keywords TEXT, -- JSON array of keywords used for search
  comp_titles_count INTEGER DEFAULT 0, -- Number of comp titles analyzed

  -- Pricing Analysis
  recommended_price_usd REAL,
  price_range_min REAL,
  price_range_max REAL,
  price_confidence_score REAL, -- 0.0 to 1.0
  price_reasoning TEXT,

  -- Category Recommendations
  recommended_categories TEXT, -- JSON array of up to 10 categories
  category_confidence_scores TEXT, -- JSON object: {category: score}

  -- Keyword Recommendations
  recommended_keywords TEXT, -- JSON array of 7 keyword phrases
  keyword_search_volumes TEXT, -- JSON object: {keyword: estimated_volume}
  keyword_competition_scores TEXT, -- JSON object: {keyword: competition_level}

  -- Market Positioning
  positioning_strategy TEXT, -- Strategic positioning recommendation
  target_audience_profile TEXT,
  competitive_advantages TEXT, -- JSON array of identified advantages
  market_gaps TEXT, -- JSON array of identified opportunities

  -- Market Trends
  market_saturation_level TEXT, -- 'low', 'medium', 'high'
  trend_direction TEXT, -- 'growing', 'stable', 'declining'
  seasonal_patterns TEXT, -- JSON object describing seasonal trends

  -- Report Metadata
  report_text TEXT, -- Full markdown report
  report_summary TEXT, -- Executive summary
  ai_cost REAL, -- Cost of Claude API calls

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'analyzing', 'completed', 'failed')),
  error_message TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Market Analysis Comp Titles Link Table
-- Links specific comp titles to analysis reports
CREATE TABLE IF NOT EXISTS analysis_comp_titles (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  comp_title_id TEXT NOT NULL,
  relevance_score REAL, -- 0.0 to 1.0, how relevant this comp is
  similarity_reasons TEXT, -- JSON array of why this comp was selected
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (analysis_id) REFERENCES market_analysis_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (comp_title_id) REFERENCES comp_titles(id) ON DELETE CASCADE,
  UNIQUE(analysis_id, comp_title_id)
);

-- Amazon Search Queries Table
-- Tracks search queries for comp title discovery
CREATE TABLE IF NOT EXISTS amazon_search_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  manuscript_id TEXT,

  -- Query Details
  query_text TEXT NOT NULL,
  genre TEXT,
  filters TEXT, -- JSON object: {format, price_range, rating_min, etc.}

  -- Results
  results_count INTEGER DEFAULT 0,
  comp_titles_found TEXT, -- JSON array of ASINs

  -- Metadata
  search_timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  search_source TEXT, -- 'manual', 'automatic', 'scheduled'

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Pricing Analysis Table
-- Stores detailed pricing analysis across genres
CREATE TABLE IF NOT EXISTS pricing_analysis (
  id TEXT PRIMARY KEY,
  genre TEXT NOT NULL,

  -- Price Distribution
  sample_size INTEGER NOT NULL, -- Number of books analyzed
  min_price REAL,
  max_price REAL,
  avg_price REAL,
  median_price REAL,
  mode_price REAL, -- Most common price point

  -- Price Ranges (percentiles)
  price_p25 REAL, -- 25th percentile
  price_p50 REAL, -- 50th percentile (median)
  price_p75 REAL, -- 75th percentile
  price_p90 REAL, -- 90th percentile

  -- Sweet Spots
  bestseller_avg_price REAL, -- Average price of top 100 bestsellers
  high_rated_avg_price REAL, -- Average price of 4.5+ rated books

  -- Format Breakdown
  kindle_avg_price REAL,
  paperback_avg_price REAL,
  hardcover_avg_price REAL,

  -- Metadata
  analyzed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  data_freshness TEXT, -- 'fresh' (< 7 days), 'stale' (> 7 days)

  UNIQUE(genre, analyzed_at)
);

-- Market Trends Table
-- Tracks market trends over time
CREATE TABLE IF NOT EXISTS market_trends (
  id TEXT PRIMARY KEY,
  genre TEXT NOT NULL,

  -- Trend Metrics
  trend_period TEXT, -- 'daily', 'weekly', 'monthly'
  period_start INTEGER NOT NULL, -- Unix timestamp
  period_end INTEGER NOT NULL,

  -- Volume Metrics
  new_releases_count INTEGER,
  bestseller_turnover_rate REAL, -- How often top 100 changes
  avg_review_velocity REAL, -- Reviews per day for recent releases

  -- Saturation Indicators
  competition_level TEXT, -- 'low', 'medium', 'high', 'saturated'
  barrier_to_entry TEXT, -- 'low', 'medium', 'high'

  -- Pricing Trends
  avg_price_change_pct REAL, -- % change from previous period

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comp_titles_asin ON comp_titles(asin);
CREATE INDEX IF NOT EXISTS idx_comp_titles_genre ON comp_titles(genre);
CREATE INDEX IF NOT EXISTS idx_comp_titles_rank ON comp_titles(bestseller_rank);
CREATE INDEX IF NOT EXISTS idx_comp_titles_price ON comp_titles(price_usd);
CREATE INDEX IF NOT EXISTS idx_comp_titles_rating ON comp_titles(average_rating);
CREATE INDEX IF NOT EXISTS idx_comp_titles_scraped ON comp_titles(last_scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_manuscript ON market_analysis_reports(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_user ON market_analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_genre ON market_analysis_reports(genre);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_status ON market_analysis_reports(status);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_created ON market_analysis_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_comp_analysis ON analysis_comp_titles(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_comp_title ON analysis_comp_titles(comp_title_id);
CREATE INDEX IF NOT EXISTS idx_analysis_comp_relevance ON analysis_comp_titles(relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_search_queries_user ON amazon_search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_manuscript ON amazon_search_queries(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_genre ON amazon_search_queries(genre);
CREATE INDEX IF NOT EXISTS idx_search_queries_timestamp ON amazon_search_queries(search_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_analysis_genre ON pricing_analysis(genre);
CREATE INDEX IF NOT EXISTS idx_pricing_analysis_analyzed ON pricing_analysis(analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_trends_genre ON market_trends(genre);
CREATE INDEX IF NOT EXISTS idx_market_trends_period ON market_trends(period_start DESC);

-- Triggers for auto-update timestamps
CREATE TRIGGER IF NOT EXISTS comp_titles_updated
AFTER UPDATE ON comp_titles
FOR EACH ROW
BEGIN
  UPDATE comp_titles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS market_analysis_reports_updated
AFTER UPDATE ON market_analysis_reports
FOR EACH ROW
BEGIN
  UPDATE market_analysis_reports SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- View: Market Analysis Statistics
CREATE VIEW IF NOT EXISTS market_analysis_stats AS
SELECT
  COUNT(DISTINCT mar.id) as total_analyses,
  COUNT(DISTINCT mar.manuscript_id) as manuscripts_analyzed,
  COUNT(DISTINCT ct.id) as total_comp_titles,
  AVG(mar.comp_titles_count) as avg_comp_titles_per_analysis,
  AVG(mar.price_confidence_score) as avg_price_confidence,
  SUM(mar.ai_cost) as total_ai_cost,
  COUNT(DISTINCT CASE WHEN mar.status = 'completed' THEN mar.id END) as completed_analyses,
  COUNT(DISTINCT CASE WHEN mar.status = 'failed' THEN mar.id END) as failed_analyses
FROM market_analysis_reports mar
LEFT JOIN analysis_comp_titles act ON mar.id = act.analysis_id
LEFT JOIN comp_titles ct ON act.comp_title_id = ct.id;

-- View: Genre Pricing Summary
CREATE VIEW IF NOT EXISTS genre_pricing_summary AS
SELECT
  genre,
  COUNT(*) as book_count,
  MIN(price_usd) as min_price,
  MAX(price_usd) as max_price,
  AVG(price_usd) as avg_price,
  AVG(CASE WHEN bestseller_rank <= 100 THEN price_usd END) as bestseller_avg_price,
  AVG(CASE WHEN average_rating >= 4.5 THEN price_usd END) as high_rated_avg_price
FROM comp_titles
WHERE price_usd IS NOT NULL
GROUP BY genre;
-- Migration 034: Sales & Royalty Tracking Dashboard
-- Comprehensive sales analytics, royalty tracking, and performance metrics

-- Sales Data Table
-- Stores individual sales transactions from all platforms
CREATE TABLE IF NOT EXISTS sales_data (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Sale Details
  sale_date INTEGER NOT NULL, -- Unix timestamp
  platform TEXT NOT NULL, -- 'kdp', 'draft2digital', 'ingramspark', 'apple_books', 'google_play', 'kobo'
  format TEXT NOT NULL, -- 'ebook', 'paperback', 'hardcover', 'audiobook'

  -- Financial Data
  units_sold INTEGER DEFAULT 0,
  list_price REAL, -- Original list price
  revenue REAL DEFAULT 0, -- Gross revenue (before platform cut)
  royalty_earned REAL DEFAULT 0, -- Author's royalty
  royalty_rate REAL, -- Percentage (e.g., 0.70 for 70%)
  currency TEXT DEFAULT 'USD',

  -- Geographic Data
  country_code TEXT, -- ISO country code (US, UK, CA, etc.)
  marketplace TEXT, -- 'amazon.com', 'amazon.co.uk', etc.

  -- Marketing Attribution
  promotion_id TEXT, -- Link to marketing campaign if applicable
  source TEXT, -- 'organic', 'paid_ad', 'promotion', 'free_promo'

  -- Kindle Unlimited (KDP specific)
  kenp_pages_read INTEGER DEFAULT 0, -- Kindle Unlimited pages read
  kenp_revenue REAL DEFAULT 0, -- Revenue from KENP

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Royalty Payments Table
-- Tracks actual payments received from platforms
CREATE TABLE IF NOT EXISTS royalty_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Payment Details
  payment_period_start INTEGER NOT NULL, -- Start of payment period
  payment_period_end INTEGER NOT NULL, -- End of payment period
  payment_date INTEGER, -- Actual payment date (null if pending)
  expected_payment_date INTEGER, -- Expected payment date

  -- Financial Data
  amount REAL NOT NULL, -- Payment amount
  currency TEXT DEFAULT 'USD',
  exchange_rate REAL, -- If converted from foreign currency

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'processing', 'paid', 'reconciled', 'disputed')),

  -- Tax Data
  tax_withheld REAL DEFAULT 0, -- Tax withholding (if applicable)
  tax_country TEXT, -- Country where tax was withheld

  -- Reconciliation
  sales_count INTEGER, -- Number of sales in this payment
  expected_amount REAL, -- Expected amount based on sales data
  discrepancy REAL, -- Difference between expected and actual
  reconciliation_notes TEXT,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bestseller Rank Tracking
-- Tracks Amazon BSR and category ranks over time
CREATE TABLE IF NOT EXISTS bestseller_ranks (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,

  -- Platform & Category
  platform TEXT NOT NULL DEFAULT 'kdp', -- Currently focused on Amazon
  category TEXT NOT NULL, -- Amazon category path

  -- Rank Data
  overall_rank INTEGER, -- Overall store rank (Amazon BSR)
  category_rank INTEGER, -- Rank within specific category

  -- Snapshot Metadata
  tracked_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Sales Aggregations Table
-- Pre-computed aggregations for fast dashboard queries
CREATE TABLE IF NOT EXISTS sales_aggregations (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Aggregation Period
  period_type TEXT NOT NULL CHECK (period_type IN
    ('daily', 'weekly', 'monthly', 'yearly')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,

  -- Platform Breakdown
  platform TEXT NOT NULL,

  -- Aggregated Metrics
  total_units_sold INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_royalties REAL DEFAULT 0,

  -- Format Breakdown
  ebook_units INTEGER DEFAULT 0,
  paperback_units INTEGER DEFAULT 0,
  hardcover_units INTEGER DEFAULT 0,
  audiobook_units INTEGER DEFAULT 0,

  ebook_revenue REAL DEFAULT 0,
  paperback_revenue REAL DEFAULT 0,
  hardcover_revenue REAL DEFAULT 0,
  audiobook_revenue REAL DEFAULT 0,

  -- Kindle Unlimited
  kenp_pages_read INTEGER DEFAULT 0,
  kenp_revenue REAL DEFAULT 0,

  -- Geographic Breakdown (top 5 countries JSON)
  top_countries TEXT, -- JSON: [{"country": "US", "units": 100}, ...]

  -- Computed at
  computed_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(manuscript_id, period_type, period_start, platform)
);

-- Platform Connections Table
-- Stores API credentials and connection status for publishing platforms
CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'kdp', 'draft2digital', 'ingramspark', etc.

  -- Connection Status
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN
    ('connected', 'disconnected', 'error', 'expired')),

  -- Credentials (encrypted)
  api_key_encrypted TEXT, -- Encrypted API key
  api_secret_encrypted TEXT, -- Encrypted API secret
  access_token_encrypted TEXT, -- OAuth access token
  refresh_token_encrypted TEXT, -- OAuth refresh token
  token_expires_at INTEGER, -- Token expiration timestamp

  -- Platform-specific metadata
  platform_user_id TEXT, -- User ID on the platform
  platform_username TEXT,

  -- Sync Status
  last_sync_at INTEGER, -- Last successful data sync
  last_sync_status TEXT, -- 'success', 'failed', 'partial'
  last_sync_error TEXT,
  next_sync_at INTEGER, -- Next scheduled sync

  -- Metadata
  connected_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, platform)
);

-- Sales Goals Table
-- Track author sales goals and milestones
CREATE TABLE IF NOT EXISTS sales_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT, -- Null for user-wide goals

  -- Goal Details
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN
    ('units', 'revenue', 'royalties', 'reviews', 'rank')),

  target_value REAL NOT NULL, -- Target number (e.g., 1000 units, $5000 revenue)
  current_value REAL DEFAULT 0, -- Current progress

  -- Time Frame
  start_date INTEGER NOT NULL,
  end_date INTEGER, -- Null for ongoing goals

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN
    ('active', 'completed', 'abandoned')),
  completed_at INTEGER,

  -- Notifications
  notify_on_milestone INTEGER DEFAULT 1, -- Boolean: notify at 25%, 50%, 75%, 100%
  last_notification_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Marketing Campaigns Table
-- Track marketing campaigns for sales attribution
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,

  -- Campaign Details
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL, -- 'bookbub', 'amazon_ads', 'facebook_ads', 'free_promo', 'price_drop', 'newsletter'

  -- Campaign Period
  start_date INTEGER NOT NULL,
  end_date INTEGER,

  -- Budget & Spend
  budget REAL,
  spend REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',

  -- Target Metrics
  target_metric TEXT, -- 'sales', 'downloads', 'page_reads', 'reviews'
  target_value REAL,

  -- Campaign Settings (JSON)
  settings TEXT, -- JSON: platform-specific settings

  -- Results (computed)
  units_sold INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  roi REAL, -- Return on investment

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft', 'scheduled', 'active', 'completed', 'cancelled')),

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Series Sales Table
-- Aggregated series-level sales analytics
CREATE TABLE IF NOT EXISTS series_sales (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Aggregation Period
  period_type TEXT NOT NULL CHECK (period_type IN
    ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,

  -- Series Metrics
  total_units_sold INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_royalties REAL DEFAULT 0,

  -- Read-through Analysis
  book_1_sales INTEGER DEFAULT 0,
  book_2_sales INTEGER DEFAULT 0,
  book_3_sales INTEGER DEFAULT 0,
  book_4_sales INTEGER DEFAULT 0,
  book_5_sales INTEGER DEFAULT 0,

  read_through_rate_1_to_2 REAL, -- Percentage of Book 1 readers who buy Book 2
  read_through_rate_2_to_3 REAL,
  read_through_rate_3_to_4 REAL,

  -- Bundle Sales
  bundle_units_sold INTEGER DEFAULT 0,
  bundle_revenue REAL DEFAULT 0,

  -- Computed at
  computed_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(series_id, period_type, period_start)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_sales_data_manuscript ON sales_data(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_user ON sales_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_platform ON sales_data(platform);
CREATE INDEX IF NOT EXISTS idx_sales_data_format ON sales_data(format);
CREATE INDEX IF NOT EXISTS idx_sales_data_country ON sales_data(country_code);

CREATE INDEX IF NOT EXISTS idx_royalty_payments_user ON royalty_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_platform ON royalty_payments(platform);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_date ON royalty_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_status ON royalty_payments(status);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_period ON royalty_payments(payment_period_start DESC);

CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_manuscript ON bestseller_ranks(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_tracked ON bestseller_ranks(tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_category ON bestseller_ranks(category);
CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_overall ON bestseller_ranks(overall_rank);

CREATE INDEX IF NOT EXISTS idx_sales_agg_manuscript ON sales_aggregations(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sales_agg_user ON sales_aggregations(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_agg_period ON sales_aggregations(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sales_agg_platform ON sales_aggregations(platform);

CREATE INDEX IF NOT EXISTS idx_platform_conn_user ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_conn_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_conn_status ON platform_connections(status);
CREATE INDEX IF NOT EXISTS idx_platform_conn_sync ON platform_connections(last_sync_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_goals_user ON sales_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_manuscript ON sales_goals(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_status ON sales_goals(status);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_user ON marketing_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_manuscript ON marketing_campaigns(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_dates ON marketing_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_series_sales_series ON series_sales(series_id);
CREATE INDEX IF NOT EXISTS idx_series_sales_user ON series_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_series_sales_period ON series_sales(period_type, period_start DESC);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS sales_data_updated
AFTER UPDATE ON sales_data
FOR EACH ROW
BEGIN
  UPDATE sales_data SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS royalty_payments_updated
AFTER UPDATE ON royalty_payments
FOR EACH ROW
BEGIN
  UPDATE royalty_payments SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS platform_connections_updated
AFTER UPDATE ON platform_connections
FOR EACH ROW
BEGIN
  UPDATE platform_connections SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS sales_goals_updated
AFTER UPDATE ON sales_goals
FOR EACH ROW
BEGIN
  UPDATE sales_goals SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS marketing_campaigns_updated
AFTER UPDATE ON marketing_campaigns
FOR EACH ROW
BEGIN
  UPDATE marketing_campaigns SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Views for Analytics

-- Sales Overview View
CREATE VIEW IF NOT EXISTS sales_overview AS
SELECT
  sd.manuscript_id,
  sd.user_id,
  m.title as manuscript_title,
  COUNT(sd.id) as total_transactions,
  SUM(sd.units_sold) as total_units_sold,
  SUM(sd.revenue) as total_revenue,
  SUM(sd.royalty_earned) as total_royalties,
  SUM(sd.kenp_pages_read) as total_kenp_pages,
  SUM(sd.kenp_revenue) as total_kenp_revenue,
  AVG(sd.royalty_rate) as avg_royalty_rate,
  MIN(sd.sale_date) as first_sale_date,
  MAX(sd.sale_date) as last_sale_date
FROM sales_data sd
JOIN manuscripts m ON sd.manuscript_id = m.id
GROUP BY sd.manuscript_id, sd.user_id, m.title;

-- Platform Performance View
CREATE VIEW IF NOT EXISTS platform_performance AS
SELECT
  sd.platform,
  sd.user_id,
  COUNT(DISTINCT sd.manuscript_id) as books_count,
  SUM(sd.units_sold) as total_units,
  SUM(sd.revenue) as total_revenue,
  SUM(sd.royalty_earned) as total_royalties,
  AVG(sd.royalty_rate) as avg_royalty_rate
FROM sales_data sd
GROUP BY sd.platform, sd.user_id;

-- Recent Sales Activity View (Last 30 Days)
CREATE VIEW IF NOT EXISTS recent_sales_activity AS
SELECT
  sd.manuscript_id,
  sd.user_id,
  m.title as manuscript_title,
  sd.platform,
  sd.format,
  SUM(sd.units_sold) as units_sold_30d,
  SUM(sd.revenue) as revenue_30d,
  SUM(sd.royalty_earned) as royalties_30d
FROM sales_data sd
JOIN manuscripts m ON sd.manuscript_id = m.id
WHERE sd.sale_date >= unixepoch('now', '-30 days')
GROUP BY sd.manuscript_id, sd.user_id, m.title, sd.platform, sd.format;

-- Royalty Payment Summary View
CREATE VIEW IF NOT EXISTS royalty_payment_summary AS
SELECT
  rp.user_id,
  rp.platform,
  COUNT(*) as payment_count,
  SUM(rp.amount) as total_paid,
  SUM(CASE WHEN rp.status = 'pending' THEN rp.amount ELSE 0 END) as pending_amount,
  SUM(CASE WHEN rp.status = 'paid' THEN rp.amount ELSE 0 END) as paid_amount,
  AVG(rp.amount) as avg_payment,
  MAX(rp.payment_date) as last_payment_date
FROM royalty_payments rp
GROUP BY rp.user_id, rp.platform;

-- Sales Goals Progress View
CREATE VIEW IF NOT EXISTS sales_goals_progress AS
SELECT
  sg.id,
  sg.user_id,
  sg.manuscript_id,
  m.title as manuscript_title,
  sg.goal_name,
  sg.goal_type,
  sg.target_value,
  sg.current_value,
  ROUND((sg.current_value * 100.0 / sg.target_value), 2) as progress_percentage,
  sg.status,
  sg.start_date,
  sg.end_date
FROM sales_goals sg
LEFT JOIN manuscripts m ON sg.manuscript_id = m.id;
-- Migration 035: Rights Management System
-- Track publishing rights, territorial restrictions, and rights status for manuscripts

-- Manuscript Rights Table
-- Tracks individual rights grants for manuscripts
CREATE TABLE IF NOT EXISTS manuscript_rights (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Rights Type
  rights_type TEXT NOT NULL CHECK (rights_type IN (
    'first_serial',          -- First publication in magazine/journal
    'north_american',        -- US and Canada only
    'world_english',         -- All English-speaking territories
    'world',                 -- All territories, all languages
    'translation',           -- Non-English publications
    'audio',                 -- Audiobook production
    'film_tv',               -- Screen adaptations (film, TV, streaming)
    'electronic',            -- Ebook publication
    'print',                 -- Physical book publication
    'dramatic',              -- Stage performance
    'merchandising',         -- Character merchandising
    'anthology',             -- Inclusion in anthology/collection
    'excerpt'                -- Publication of excerpts
  )),

  -- Rights Status
  rights_status TEXT NOT NULL DEFAULT 'available' CHECK (rights_status IN (
    'available',    -- Rights are available for offer
    'offered',      -- Rights have been offered to publisher
    'granted',      -- Rights have been granted/sold
    'expired',      -- Rights grant has expired
    'reverted',     -- Rights have reverted to author
    'reserved'      -- Author is reserving these rights
  )),

  -- Grant Details
  granted_to_publisher_id TEXT, -- Publisher who holds the rights
  granted_to_publisher_name TEXT, -- Publisher name (if not in our system)

  -- Exclusivity
  exclusive INTEGER DEFAULT 0, -- Boolean: 1 = exclusive, 0 = non-exclusive

  -- Time Period
  grant_start_date INTEGER, -- Unix timestamp when rights grant begins
  grant_end_date INTEGER, -- Unix timestamp when rights grant expires
  grant_duration_years INTEGER, -- Duration in years (e.g., 5 years)

  -- Reversion
  reversion_clause TEXT, -- Text description of reversion conditions
  auto_reversion INTEGER DEFAULT 0, -- Boolean: auto-revert when contract ends
  reversion_date INTEGER, -- Actual date rights reverted

  -- Territory Restrictions
  territories TEXT, -- JSON array of country codes (e.g., ["US", "CA", "UK"])
  territory_restrictions TEXT, -- Description of territorial restrictions

  -- Language Restrictions
  languages TEXT, -- JSON array of language codes (e.g., ["en", "es", "fr"])

  -- Financial Terms
  advance REAL, -- Advance payment for rights
  royalty_rate REAL, -- Royalty percentage (e.g., 0.10 for 10%)
  royalty_escalation TEXT, -- Description of royalty escalation clauses

  -- Contract Details
  contract_file_key TEXT, -- R2 key for contract document
  contract_signed_date INTEGER,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Previously Published Tracking
-- Track if manuscript was previously published and rights status
CREATE TABLE IF NOT EXISTS publication_history (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Publication Details
  publication_type TEXT NOT NULL CHECK (publication_type IN (
    'magazine',
    'journal',
    'anthology',
    'self_published',
    'traditional_publisher',
    'online',
    'contest',
    'other'
  )),

  publication_name TEXT NOT NULL, -- Name of magazine, journal, publisher, etc.
  publication_date INTEGER, -- Unix timestamp
  publication_url TEXT, -- URL if published online

  -- Rights Sold
  rights_sold TEXT, -- JSON array of rights types sold (e.g., ["first_serial", "electronic"])

  -- Rights Status
  rights_currently_held TEXT NOT NULL DEFAULT 'author', -- 'author', 'publisher', 'public_domain'
  rights_reversion_date INTEGER, -- When rights reverted to author
  rights_reversion_documentation TEXT, -- Description of reversion documentation

  -- Details
  isbn TEXT, -- ISBN if applicable
  circulation INTEGER, -- Circulation/distribution count
  payment_received REAL, -- Payment received for publication

  notes TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rights Offers Table
-- Track rights offers made to publishers
CREATE TABLE IF NOT EXISTS rights_offers (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  submission_id TEXT, -- Link to submission if applicable

  -- Publisher
  publisher_id TEXT,
  publisher_name TEXT NOT NULL,

  -- Rights Offered
  rights_offered TEXT NOT NULL, -- JSON array of rights types offered

  -- Offer Details
  offer_date INTEGER NOT NULL DEFAULT (unixepoch()),
  response_deadline INTEGER, -- Deadline for publisher response

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Awaiting response
    'accepted',    -- Publisher accepted
    'rejected',    -- Publisher rejected
    'countered',   -- Publisher made counter-offer
    'withdrawn',   -- Author withdrew offer
    'expired'      -- Deadline passed
  )),

  -- Response
  response_date INTEGER,
  response_notes TEXT,

  -- Terms Proposed
  proposed_advance REAL,
  proposed_royalty_rate REAL,
  proposed_duration_years INTEGER,
  proposed_exclusive INTEGER DEFAULT 0,

  notes TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE SET NULL
);

-- Rights Conflicts Table
-- Track potential conflicts when same rights are offered/granted to multiple publishers
CREATE TABLE IF NOT EXISTS rights_conflicts (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  rights_type TEXT NOT NULL,

  -- Conflicting Rights
  rights_id_1 TEXT NOT NULL, -- First rights record
  rights_id_2 TEXT NOT NULL, -- Second rights record (conflicting)

  -- Conflict Details
  conflict_type TEXT NOT NULL CHECK (conflict_type IN (
    'territorial_overlap',  -- Same territory granted to multiple publishers
    'time_overlap',         -- Overlapping time periods
    'exclusive_violation',  -- Non-exclusive grant conflicts with exclusive
    'reversion_dispute'     -- Dispute over reversion status
  )),

  conflict_detected_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Resolution
  resolved INTEGER DEFAULT 0, -- Boolean
  resolved_at INTEGER,
  resolution_notes TEXT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (rights_id_1) REFERENCES manuscript_rights(id) ON DELETE CASCADE,
  FOREIGN KEY (rights_id_2) REFERENCES manuscript_rights(id) ON DELETE CASCADE
);

-- Rights Templates Table
-- Pre-configured rights packages for common scenarios
CREATE TABLE IF NOT EXISTS rights_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL for system templates

  -- Template Details
  template_name TEXT NOT NULL,
  template_description TEXT,

  -- Rights Included
  rights_types TEXT NOT NULL, -- JSON array of rights types

  -- Default Terms
  default_exclusive INTEGER DEFAULT 0,
  default_duration_years INTEGER,
  default_territories TEXT, -- JSON array
  default_languages TEXT, -- JSON array

  -- Template Type
  template_type TEXT CHECK (template_type IN (
    'system',      -- System-provided template
    'custom'       -- User-created template
  )) DEFAULT 'custom',

  is_active INTEGER DEFAULT 1, -- Boolean

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert System Templates
INSERT INTO rights_templates (
  id, user_id, template_name, template_description, rights_types,
  default_exclusive, default_duration_years, template_type
) VALUES
  (
    'template-full-world',
    NULL,
    'Full World Rights',
    'All rights, all territories, all languages',
    '["world", "electronic", "print", "audio", "film_tv", "translation", "merchandising"]',
    1,
    NULL,
    'system'
  ),
  (
    'template-north-american',
    NULL,
    'North American Print & Electronic',
    'Print and electronic rights for North America only',
    '["north_american", "electronic", "print"]',
    1,
    5,
    'system'
  ),
  (
    'template-world-english',
    NULL,
    'World English Rights',
    'English-language rights worldwide',
    '["world_english", "electronic", "print"]',
    1,
    7,
    'system'
  ),
  (
    'template-first-serial',
    NULL,
    'First Serial Rights Only',
    'First publication rights (magazine/journal)',
    '["first_serial"]',
    0,
    NULL,
    'system'
  ),
  (
    'template-audio-only',
    NULL,
    'Audio Rights Only',
    'Audiobook production rights',
    '["audio"]',
    0,
    5,
    'system'
  ),
  (
    'template-film-tv',
    NULL,
    'Film & TV Rights',
    'Screen adaptation rights',
    '["film_tv", "dramatic", "merchandising"]',
    1,
    10,
    'system'
  );

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_manuscript ON manuscript_rights(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_user ON manuscript_rights(user_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_type ON manuscript_rights(rights_type);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_status ON manuscript_rights(rights_status);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_publisher ON manuscript_rights(granted_to_publisher_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_exclusive ON manuscript_rights(exclusive);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_dates ON manuscript_rights(grant_start_date, grant_end_date);

CREATE INDEX IF NOT EXISTS idx_publication_history_manuscript ON publication_history(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_publication_history_user ON publication_history(user_id);
CREATE INDEX IF NOT EXISTS idx_publication_history_type ON publication_history(publication_type);
CREATE INDEX IF NOT EXISTS idx_publication_history_date ON publication_history(publication_date DESC);

CREATE INDEX IF NOT EXISTS idx_rights_offers_manuscript ON rights_offers(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_rights_offers_user ON rights_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_rights_offers_submission ON rights_offers(submission_id);
CREATE INDEX IF NOT EXISTS idx_rights_offers_status ON rights_offers(status);
CREATE INDEX IF NOT EXISTS idx_rights_offers_date ON rights_offers(offer_date DESC);

CREATE INDEX IF NOT EXISTS idx_rights_conflicts_manuscript ON rights_conflicts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_rights_conflicts_type ON rights_conflicts(rights_type);
CREATE INDEX IF NOT EXISTS idx_rights_conflicts_resolved ON rights_conflicts(resolved);

CREATE INDEX IF NOT EXISTS idx_rights_templates_user ON rights_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_rights_templates_type ON rights_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_rights_templates_active ON rights_templates(is_active);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS manuscript_rights_updated
AFTER UPDATE ON manuscript_rights
FOR EACH ROW
BEGIN
  UPDATE manuscript_rights SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS publication_history_updated
AFTER UPDATE ON publication_history
FOR EACH ROW
BEGIN
  UPDATE publication_history SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS rights_offers_updated
AFTER UPDATE ON rights_offers
FOR EACH ROW
BEGIN
  UPDATE rights_offers SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS rights_templates_updated
AFTER UPDATE ON rights_templates
FOR EACH ROW
BEGIN
  UPDATE rights_templates SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Views for Analytics

-- Rights Summary by Manuscript
CREATE VIEW IF NOT EXISTS rights_summary AS
SELECT
  mr.manuscript_id,
  m.title as manuscript_title,
  mr.user_id,
  COUNT(DISTINCT mr.id) as total_rights_grants,
  COUNT(DISTINCT CASE WHEN mr.rights_status = 'granted' THEN mr.id END) as active_grants,
  COUNT(DISTINCT CASE WHEN mr.exclusive = 1 THEN mr.id END) as exclusive_grants,
  GROUP_CONCAT(DISTINCT mr.rights_type) as rights_types_granted,
  SUM(mr.advance) as total_advances,
  MAX(mr.grant_end_date) as latest_expiration
FROM manuscript_rights mr
JOIN manuscripts m ON mr.manuscript_id = m.id
GROUP BY mr.manuscript_id, m.title, mr.user_id;

-- Available Rights by Manuscript
CREATE VIEW IF NOT EXISTS available_rights AS
SELECT
  m.id as manuscript_id,
  m.title as manuscript_title,
  m.user_id,
  -- List rights that are NOT granted or offered
  CASE WHEN mr_granted.rights_type IS NULL THEN 'first_serial' ELSE NULL END as first_serial_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'north_american' ELSE NULL END as north_american_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'world_english' ELSE NULL END as world_english_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'translation' ELSE NULL END as translation_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'audio' ELSE NULL END as audio_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'film_tv' ELSE NULL END as film_tv_available
FROM manuscripts m
LEFT JOIN manuscript_rights mr_granted ON m.id = mr_granted.manuscript_id
  AND mr_granted.rights_status IN ('granted', 'offered')
WHERE mr_granted.id IS NULL;

-- Rights Expiring Soon (next 90 days)
CREATE VIEW IF NOT EXISTS rights_expiring_soon AS
SELECT
  mr.id,
  mr.manuscript_id,
  m.title as manuscript_title,
  mr.user_id,
  mr.rights_type,
  mr.granted_to_publisher_name,
  mr.grant_end_date,
  (mr.grant_end_date - unixepoch()) / 86400 as days_until_expiration
FROM manuscript_rights mr
JOIN manuscripts m ON mr.manuscript_id = m.id
WHERE mr.rights_status = 'granted'
  AND mr.grant_end_date IS NOT NULL
  AND mr.grant_end_date <= unixepoch() + (90 * 86400)
  AND mr.grant_end_date > unixepoch()
ORDER BY mr.grant_end_date ASC;

-- Publication History Summary
CREATE VIEW IF NOT EXISTS publication_history_summary AS
SELECT
  ph.manuscript_id,
  m.title as manuscript_title,
  ph.user_id,
  COUNT(*) as publication_count,
  GROUP_CONCAT(DISTINCT ph.publication_type) as publication_types,
  MIN(ph.publication_date) as first_publication,
  MAX(ph.publication_date) as latest_publication,
  SUM(ph.payment_received) as total_payments_received
FROM publication_history ph
JOIN manuscripts m ON ph.manuscript_id = m.id
GROUP BY ph.manuscript_id, m.title, ph.user_id;
-- Migration 036: Platform-Specific AI Chat Assistants with Self-Updating Knowledge Base
-- Specialized AI agents for each publishing platform (KDP, Draft2Digital, IngramSpark, etc.)
-- with daily documentation crawling and automatic workflow updates

-- Drop existing tables if they exist (fresh start for AI chat system)
DROP TABLE IF EXISTS workflow_change_notifications;
DROP TABLE IF EXISTS doc_fetch_log;
DROP TABLE IF EXISTS agent_conversations;
DROP TABLE IF EXISTS user_workflows;
DROP TABLE IF EXISTS workflows;
DROP TABLE IF EXISTS agent_knowledge;
DROP TABLE IF EXISTS platform_docs;
DROP TABLE IF EXISTS agent_config;

-- Platform Documentation Table (Versioned)
-- Stores fetched documentation from platform help pages
CREATE TABLE IF NOT EXISTS platform_docs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp',              -- Amazon KDP
    'draft2digital',    -- Draft2Digital
    'ingramspark',      -- IngramSpark
    'apple_books',      -- Apple Books
    'barnes_noble',     -- Barnes & Noble Press
    'kobo',             -- Kobo Writing Life
    'google_play'       -- Google Play Books
  )),

  -- Documentation Details
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'account_setup',
    'book_details',
    'content_upload',
    'pricing_rights',
    'preview_publish',
    'troubleshooting',
    'faq',
    'api_reference',
    'general'
  )),

  source_url TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL, -- Full HTML/markdown content

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id TEXT, -- Link to previous version

  -- Change Detection
  content_hash TEXT NOT NULL, -- SHA-256 hash for change detection
  change_detected INTEGER DEFAULT 0, -- Boolean: was change detected?
  change_significance TEXT CHECK (change_significance IN (
    'critical',   -- Breaking changes, new requirements
    'important',  -- Feature changes, updated processes
    'minor',      -- Typos, clarifications, formatting
    'none'        -- No meaningful changes
  )),
  change_summary TEXT, -- Claude-generated summary of changes

  -- Metadata
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  analyzed_at INTEGER, -- When Claude analyzed changes

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (previous_version_id) REFERENCES platform_docs(id) ON DELETE SET NULL
);

-- Agent Knowledge Base
-- Extracted knowledge for each platform agent
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  -- Knowledge Entry
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
    'requirement',       -- Platform requirements
    'procedure',         -- Step-by-step procedures
    'error_solution',    -- Error messages and solutions
    'terminology',       -- Platform-specific terms
    'best_practice',     -- Recommended approaches
    'limitation',        -- Platform limitations
    'pricing_strategy',  -- Pricing recommendations
    'recent_change'      -- Recent platform updates
  )),

  topic TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Source Tracking
  source_doc_id TEXT, -- Link to platform_docs
  confidence_score REAL DEFAULT 1.0, -- 0.0-1.0 confidence

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT, -- Previous knowledge entry this replaces

  is_current INTEGER DEFAULT 1, -- Boolean: is this the current version?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (source_doc_id) REFERENCES platform_docs(id) ON DELETE SET NULL,
  FOREIGN KEY (supersedes_id) REFERENCES agent_knowledge(id) ON DELETE SET NULL
);

-- Workflow Definitions (JSON-based)
-- Step-by-step publishing processes for each platform
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  workflow_name TEXT NOT NULL,
  workflow_description TEXT,

  -- Workflow Definition (JSON)
  steps TEXT NOT NULL, -- JSON array of workflow steps
  -- Step structure:
  -- [{
  --   "stepId": "account-setup",
  --   "stepName": "Account Setup",
  --   "description": "Create and verify your KDP account",
  --   "estimatedMinutes": 15,
  --   "substeps": [...],
  --   "requirements": [...],
  --   "dependencies": ["previous-step-id"],
  --   "troubleshooting": {...}
  -- }]

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id TEXT,

  -- Status
  is_active INTEGER DEFAULT 1, -- Boolean: is this the current workflow?

  -- Change Tracking
  changelog TEXT, -- Description of changes from previous version
  auto_generated INTEGER DEFAULT 0, -- Boolean: auto-generated from doc changes?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (previous_version_id) REFERENCES workflows(id) ON DELETE SET NULL
);

-- User Workflow Progress
-- Track user progress through publishing workflows
CREATE TABLE IF NOT EXISTS user_workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT, -- Optional: link to specific manuscript

  workflow_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Progress Tracking
  current_step_id TEXT, -- Current step in workflow
  steps_completed TEXT, -- JSON array of completed step IDs

  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'not_started',
    'in_progress',
    'completed',
    'abandoned',
    'blocked'
  )),

  -- Metrics
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  last_activity_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Blocking Issues
  blocked_reason TEXT, -- Why workflow is blocked

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Agent Conversations
-- Chat history between user and platform agents
CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  user_workflow_id TEXT, -- Link to workflow if in context

  -- Message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,

  -- Context
  current_step_id TEXT, -- Step user is on when asking
  context_metadata TEXT, -- JSON: additional context (manuscript_id, etc.)

  -- Agent Response Metadata
  response_type TEXT CHECK (response_type IN (
    'guidance',          -- Step-by-step guidance
    'troubleshooting',   -- Error resolution
    'clarification',     -- Answering questions
    'celebration',       -- Celebrating progress
    'alert'              -- Recent platform changes
  )),

  -- AI Metadata
  model_used TEXT, -- Claude model version
  tokens_used INTEGER,
  cost REAL,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_workflow_id) REFERENCES user_workflows(id) ON DELETE SET NULL
);

-- Documentation Fetch Log
-- Track daily documentation fetches
CREATE TABLE IF NOT EXISTS doc_fetch_log (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,

  fetch_status TEXT NOT NULL CHECK (fetch_status IN (
    'success',
    'failed',
    'partial',
    'skipped'
  )),

  urls_fetched INTEGER DEFAULT 0,
  urls_failed INTEGER DEFAULT 0,

  changes_detected INTEGER DEFAULT 0, -- Count of docs with changes
  new_docs_added INTEGER DEFAULT 0,

  error_message TEXT,

  fetch_started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  fetch_completed_at INTEGER,
  duration_seconds REAL,

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Platform Agent Configuration
-- Configuration for each platform agent
CREATE TABLE IF NOT EXISTS agent_config (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  agent_name TEXT NOT NULL,
  agent_description TEXT,

  -- System Prompt
  system_prompt TEXT NOT NULL, -- Base system prompt for agent

  -- Documentation Sources
  doc_sources TEXT NOT NULL, -- JSON array of URLs to crawl
  -- [{"url": "https://kdp.amazon.com/help", "type": "account_setup"}]

  -- Agent Personality
  tone TEXT DEFAULT 'professional', -- professional, friendly, enthusiastic
  expertise_level TEXT DEFAULT 'expert', -- beginner, intermediate, expert

  -- Crawl Settings
  crawl_enabled INTEGER DEFAULT 1, -- Boolean: enable daily crawls
  crawl_frequency_hours INTEGER DEFAULT 24, -- How often to crawl
  last_crawl_at INTEGER,
  next_crawl_at INTEGER,

  is_active INTEGER DEFAULT 1, -- Boolean: is agent active?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User Notifications for Workflow Changes
-- Notify users when workflows change due to platform updates
CREATE TABLE IF NOT EXISTS workflow_change_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Change Details
  change_type TEXT NOT NULL CHECK (change_type IN (
    'requirement_added',
    'requirement_removed',
    'step_added',
    'step_removed',
    'step_modified',
    'order_changed'
  )),

  change_description TEXT NOT NULL,
  change_significance TEXT CHECK (change_significance IN ('critical', 'important', 'minor')),

  -- Notification Status
  notification_sent INTEGER DEFAULT 0, -- Boolean: has notification been sent?
  notification_sent_at INTEGER,

  user_acknowledged INTEGER DEFAULT 0, -- Boolean: has user seen it?
  user_acknowledged_at INTEGER,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Insert Default Agent Configurations
INSERT INTO agent_config (
  id, platform, agent_name, agent_description, system_prompt, doc_sources, tone
) VALUES
  (
    'agent-kdp',
    'kdp',
    'KDP Publishing Assistant',
    'Expert in Amazon Kindle Direct Publishing workflows, requirements, and best practices.',
    'You are an expert Amazon KDP (Kindle Direct Publishing) specialist. You guide authors through the entire KDP publishing process with patience and precision. You stay up-to-date with KDP requirements and help troubleshoot common issues. You reference exact field names, button labels, and platform terminology. You celebrate user progress and provide actionable, step-by-step guidance.',
    '[{"url":"https://kdp.amazon.com/en_US/help","type":"general"},{"url":"https://kdp.amazon.com/en_US/help/topic/G200634390","type":"account_setup"},{"url":"https://kdp.amazon.com/en_US/help/topic/G200635650","type":"content_upload"},{"url":"https://kdp.amazon.com/en_US/help/topic/G200634560","type":"pricing_rights"}]',
    'professional'
  ),
  (
    'agent-d2d',
    'draft2digital',
    'Draft2Digital Assistant',
    'Expert in Draft2Digital multi-retailer publishing.',
    'You are an expert Draft2Digital specialist. You help authors publish to multiple retailers simultaneously through D2D. You understand retailer-specific requirements and help optimize distribution settings. You provide clear, actionable guidance for the D2D platform.',
    '[{"url":"https://help.draft2digital.com/","type":"general"}]',
    'friendly'
  ),
  (
    'agent-ingramspark',
    'ingramspark',
    'IngramSpark Assistant',
    'Expert in IngramSpark print and wholesale distribution.',
    'You are an expert IngramSpark specialist. You guide authors through print book setup, ISBN assignment, and wholesale distribution. You understand print specifications, trim sizes, and distribution channels. You provide detailed technical guidance for print publishing.',
    '[{"url":"https://www.ingramspark.com/support","type":"general"}]',
    'professional'
  ),
  (
    'agent-apple',
    'apple_books',
    'Apple Books Assistant',
    'Expert in Apple Books publishing.',
    'You are an expert Apple Books specialist. You guide authors through Apple Books publishing requirements, metadata optimization, and Apple-specific features. You help with Apple Books Author app and iTunes Producer workflows.',
    '[{"url":"https://authors.apple.com/support","type":"general"}]',
    'friendly'
  ),
  (
    'agent-bn',
    'barnes_noble',
    'Barnes & Noble Press Assistant',
    'Expert in Barnes & Noble Press publishing.',
    'You are an expert Barnes & Noble Press specialist. You help authors publish to B&N both in print and ebook formats. You understand B&N-specific requirements and help optimize book listings for the B&N marketplace.',
    '[{"url":"https://press.barnesandnoble.com/support","type":"general"}]',
    'professional'
  ),
  (
    'agent-kobo',
    'kobo',
    'Kobo Writing Life Assistant',
    'Expert in Kobo Writing Life publishing.',
    'You are an expert Kobo Writing Life specialist. You guide authors through Kobo-specific publishing requirements and help optimize for international markets where Kobo has strong presence. You understand Kobo promotional tools.',
    '[{"url":"https://www.kobo.com/us/en/p/writinglife","type":"general"}]',
    'friendly'
  ),
  (
    'agent-google',
    'google_play',
    'Google Play Books Assistant',
    'Expert in Google Play Books publishing.',
    'You are an expert Google Play Books specialist. You help authors publish through Google Play Books Partner Center. You understand Google-specific requirements and help optimize for Android ecosystem.',
    '[{"url":"https://support.google.com/books/partner","type":"general"}]',
    'professional'
  );

-- Insert KDP Workflow (Example - Full workflow)
INSERT INTO workflows (
  id, platform, workflow_name, workflow_description, steps, version, is_active
) VALUES (
  'workflow-kdp-ebook-v1',
  'kdp',
  'KDP Ebook Publishing',
  'Complete workflow for publishing an ebook on Amazon KDP',
  '[
    {
      "stepId": "account-setup",
      "stepName": "Account Setup",
      "description": "Create and verify your Amazon KDP account",
      "estimatedMinutes": 15,
      "substeps": [
        "Go to kdp.amazon.com",
        "Sign in with Amazon account or create new",
        "Complete tax interview (W-9 or W-8BEN)",
        "Add banking information for royalty payments",
        "Verify email address"
      ],
      "requirements": [
        "Valid email address",
        "Tax identification number (SSN or EIN)",
        "Bank account for payments"
      ],
      "troubleshooting": {
        "Tax interview stuck": "Complete all required fields. For non-US authors, use W-8BEN form.",
        "Bank verification failed": "Ensure bank account is in your name and routing number is correct."
      }
    },
    {
      "stepId": "book-details",
      "stepName": "Enter Book Details",
      "description": "Add title, author, description, and metadata",
      "estimatedMinutes": 20,
      "dependencies": ["account-setup"],
      "substeps": [
        "Click ''+ Create'' > ''Paperback'' or ''Kindle eBook''",
        "Enter book title and subtitle",
        "Add author name",
        "Write book description (up to 4000 characters)",
        "Select up to 10 keywords",
        "Choose 2 BISAC categories",
        "Set age range and grade level (if applicable)",
        "Upload cover image (recommended 2560 x 1600 pixels)"
      ],
      "requirements": [
        "Book title (required)",
        "Author name (required)",
        "Description 200-4000 characters",
        "Cover image: JPG/PNG, 1000px minimum height",
        "ISBN (optional for ebook, KDP provides free ASIN)"
      ],
      "troubleshooting": {
        "Cover upload failed": "Ensure image is JPG or PNG, at least 1000px tall, under 50MB.",
        "Categories not saving": "Select categories from Browse dropdown, not free-text entry."
      }
    },
    {
      "stepId": "content-upload",
      "stepName": "Upload Manuscript",
      "description": "Upload formatted ebook file",
      "estimatedMinutes": 10,
      "dependencies": ["book-details"],
      "substeps": [
        "Prepare manuscript in EPUB, MOBI, DOC, or DOCX format",
        "Click ''Upload eBook manuscript''",
        "Select file from computer",
        "Wait for file processing (1-5 minutes)",
        "Enable/disable DRM",
        "Preview book with online previewer"
      ],
      "requirements": [
        "Formatted manuscript file (EPUB recommended)",
        "File size under 650MB",
        "Proper formatting with chapter breaks",
        "Embedded fonts (if using custom fonts)"
      ],
      "troubleshooting": {
        "File upload timeout": "Try smaller file size or convert to EPUB format.",
        "Formatting issues in preview": "Use KDP Kindle Create tool to reformat manuscript.",
        "Images not displaying": "Ensure images are under 5MB each and in JPG format."
      }
    },
    {
      "stepId": "pricing-rights",
      "stepName": "Set Pricing & Rights",
      "description": "Choose territories, pricing, and royalty options",
      "estimatedMinutes": 15,
      "dependencies": ["content-upload"],
      "substeps": [
        "Select territories (worldwide or specific countries)",
        "Choose royalty option: 35% or 70%",
        "Set list price in USD (70% royalty: $2.99-$9.99 required)",
        "Enable/disable Kindle Unlimited and KDP Select",
        "Set prices for other marketplaces (UK, DE, etc.)",
        "Choose pre-order options (optional)"
      ],
      "requirements": [
        "Price between $0.99 - $200",
        "For 70% royalty: $2.99 - $9.99 in US",
        "For 70% royalty: file size under 3MB (or delivery fees apply)"
      ],
      "troubleshooting": {
        "70% royalty not available": "Ensure price is $2.99-$9.99 and book meets file size requirements.",
        "KDP Select greyed out": "Ensure book is not published elsewhere (must be exclusive to Amazon)."
      }
    },
    {
      "stepId": "preview-publish",
      "stepName": "Preview & Publish",
      "description": "Final review and publish book",
      "estimatedMinutes": 10,
      "dependencies": ["pricing-rights"],
      "substeps": [
        "Click ''Preview book'' to review final version",
        "Check cover, formatting, front matter, back matter",
        "Review all metadata one final time",
        "Agree to KDP Terms and Conditions",
        "Click ''Publish your Kindle eBook''",
        "Wait for review (typically 24-72 hours)"
      ],
      "requirements": [
        "All required fields completed",
        "Content passes automated quality checks",
        "Agreement to KDP Terms"
      ],
      "troubleshooting": {
        "Publish button disabled": "Check for red error messages in any section. All required fields must be completed.",
        "Book rejected after submission": "Review rejection email for specific issues (usually content quality or metadata)."
      }
    }
  ]',
  1,
  1
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_platform_docs_platform ON platform_docs(platform);
CREATE INDEX IF NOT EXISTS idx_platform_docs_type ON platform_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_platform_docs_version ON platform_docs(version DESC);
CREATE INDEX IF NOT EXISTS idx_platform_docs_hash ON platform_docs(content_hash);
CREATE INDEX IF NOT EXISTS idx_platform_docs_change ON platform_docs(change_detected);
CREATE INDEX IF NOT EXISTS idx_platform_docs_fetched ON platform_docs(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_platform ON agent_knowledge(platform);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON agent_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_current ON agent_knowledge(is_current);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_topic ON agent_knowledge(topic);

CREATE INDEX IF NOT EXISTS idx_workflows_platform ON workflows(platform);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_version ON workflows(version DESC);

CREATE INDEX IF NOT EXISTS idx_user_workflows_user ON user_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workflows_manuscript ON user_workflows(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_user_workflows_platform ON user_workflows(platform);
CREATE INDEX IF NOT EXISTS idx_user_workflows_status ON user_workflows(status);
CREATE INDEX IF NOT EXISTS idx_user_workflows_activity ON user_workflows(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_platform ON agent_conversations(platform);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_workflow ON agent_conversations(user_workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created ON agent_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_fetch_log_platform ON doc_fetch_log(platform);
CREATE INDEX IF NOT EXISTS idx_doc_fetch_log_status ON doc_fetch_log(fetch_status);
CREATE INDEX IF NOT EXISTS idx_doc_fetch_log_started ON doc_fetch_log(fetch_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_notifications_user ON workflow_change_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_platform ON workflow_change_notifications(platform);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_sent ON workflow_change_notifications(notification_sent);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_ack ON workflow_change_notifications(user_acknowledged);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS platform_docs_updated
AFTER UPDATE ON platform_docs
FOR EACH ROW
BEGIN
  UPDATE platform_docs SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_knowledge_updated
AFTER UPDATE ON agent_knowledge
FOR EACH ROW
BEGIN
  UPDATE agent_knowledge SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS workflows_updated
AFTER UPDATE ON workflows
FOR EACH ROW
BEGIN
  UPDATE workflows SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS user_workflows_updated
AFTER UPDATE ON user_workflows
FOR EACH ROW
BEGIN
  UPDATE user_workflows SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_config_updated
AFTER UPDATE ON agent_config
FOR EACH ROW
BEGIN
  UPDATE agent_config SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Views for Analytics

-- Active User Workflows Summary
CREATE VIEW IF NOT EXISTS active_workflows_summary AS
SELECT
  uw.platform,
  uw.status,
  COUNT(*) as workflow_count,
  AVG((unixepoch() - uw.started_at) / 86400.0) as avg_days_in_progress
FROM user_workflows uw
WHERE uw.status = 'in_progress'
GROUP BY uw.platform, uw.status;

-- Documentation Change Activity
CREATE VIEW IF NOT EXISTS doc_change_activity AS
SELECT
  pd.platform,
  pd.change_significance,
  COUNT(*) as change_count,
  MAX(pd.fetched_at) as last_change_detected
FROM platform_docs pd
WHERE pd.change_detected = 1
  AND pd.fetched_at >= unixepoch() - (30 * 86400) -- Last 30 days
GROUP BY pd.platform, pd.change_significance;

-- Agent Conversation Stats
CREATE VIEW IF NOT EXISTS agent_conversation_stats AS
SELECT
  ac.platform,
  ac.user_id,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN ac.role = 'user' THEN 1 END) as user_messages,
  COUNT(CASE WHEN ac.role = 'assistant' THEN 1 END) as assistant_messages,
  SUM(ac.tokens_used) as total_tokens,
  SUM(ac.cost) as total_cost,
  MIN(ac.created_at) as first_interaction,
  MAX(ac.created_at) as last_interaction
FROM agent_conversations ac
GROUP BY ac.platform, ac.user_id;

-- Workflow Completion Rates
CREATE VIEW IF NOT EXISTS workflow_completion_rates AS
SELECT
  uw.platform,
  w.workflow_name,
  COUNT(*) as total_started,
  COUNT(CASE WHEN uw.status = 'completed' THEN 1 END) as completed_count,
  ROUND(
    CAST(COUNT(CASE WHEN uw.status = 'completed' THEN 1 END) AS REAL) / COUNT(*) * 100,
    2
  ) as completion_rate_percent,
  AVG(CASE WHEN uw.completed_at IS NOT NULL
    THEN (uw.completed_at - uw.started_at) / 86400.0
  END) as avg_days_to_complete
FROM user_workflows uw
JOIN workflows w ON uw.workflow_id = w.id
GROUP BY uw.platform, w.workflow_name;
-- Migration 037: Competitive Analysis & Market Positioning
-- Comp title analysis, author platform tracking, and marketing hooks generation

-- Drop existing tables and views if they exist (fresh start)
DROP VIEW IF EXISTS market_positioning_overview;
DROP VIEW IF EXISTS marketing_hooks_by_manuscript;
DROP VIEW IF EXISTS author_platform_summary;
DROP VIEW IF EXISTS comp_title_summary;

DROP TRIGGER IF EXISTS platform_scores_updated;
DROP TRIGGER IF EXISTS market_reports_updated;
DROP TRIGGER IF EXISTS bookstore_positioning_updated;
DROP TRIGGER IF EXISTS marketing_hooks_updated;
DROP TRIGGER IF EXISTS author_platform_updated;
DROP TRIGGER IF EXISTS comp_titles_updated;

DROP TABLE IF EXISTS author_platform_scores;
DROP TABLE IF EXISTS market_positioning_reports;
DROP TABLE IF EXISTS bookstore_positioning;
DROP TABLE IF EXISTS marketing_hooks;
DROP TABLE IF EXISTS author_platform;
DROP TABLE IF EXISTS comp_titles;

-- Comparable Titles Table
-- Track comp titles identified for each manuscript
CREATE TABLE IF NOT EXISTS comp_titles (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Comp Title Details
  comp_title TEXT NOT NULL,
  comp_author TEXT NOT NULL,
  comp_asin TEXT, -- Amazon ASIN
  comp_isbn TEXT,

  -- Similarity Analysis
  similarity_score REAL, -- 0.0-1.0 how similar to manuscript
  why_comparable TEXT, -- AI-generated explanation

  -- Market Data
  amazon_sales_rank INTEGER,
  amazon_category_rank INTEGER,
  amazon_category TEXT,
  price REAL,
  publication_date INTEGER, -- Unix timestamp
  page_count INTEGER,
  format TEXT, -- 'ebook', 'paperback', 'hardcover', 'audiobook'

  -- Review Data
  avg_rating REAL, -- 0.0-5.0
  review_count INTEGER,

  -- Marketing Analysis
  cover_style TEXT, -- AI analysis of cover design
  blurb_style TEXT, -- AI analysis of book description
  marketing_approach TEXT, -- How the book is marketed

  -- Data Source
  data_source TEXT DEFAULT 'manual' CHECK (data_source IN (
    'manual',       -- Manually added by user
    'ai_suggested', -- Suggested by Market Analysis Agent
    'amazon_api',   -- Fetched from Amazon API
    'goodreads'     -- Fetched from Goodreads
  )),

  -- Tracking
  last_updated INTEGER, -- Last time data was refreshed
  is_active INTEGER DEFAULT 1, -- Boolean: still tracking this comp?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Author Platform Tracking
-- Track author's social media and platform presence
CREATE TABLE IF NOT EXISTS author_platform (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Platform Type
  platform_type TEXT NOT NULL CHECK (platform_type IN (
    'twitter',
    'facebook',
    'instagram',
    'tiktok',
    'youtube',
    'goodreads',
    'amazon_author_central',
    'website',
    'email_list',
    'podcast',
    'blog',
    'linkedin',
    'pinterest',
    'other'
  )),

  -- Platform Details
  platform_name TEXT, -- Custom name (e.g., "My Author Newsletter")
  url TEXT,
  username TEXT,

  -- Metrics
  follower_count INTEGER,
  subscriber_count INTEGER, -- For email lists, YouTube, podcasts
  engagement_rate REAL, -- Percentage (e.g., 0.05 for 5%)

  -- Verification
  verified INTEGER DEFAULT 0, -- Boolean: verified account?

  -- Activity
  post_frequency TEXT, -- 'daily', 'weekly', 'monthly', 'sporadic'
  last_post_date INTEGER,

  -- Monetization
  monetized INTEGER DEFAULT 0, -- Boolean: earning from this platform?
  monthly_revenue REAL,

  -- Status
  is_active INTEGER DEFAULT 1, -- Boolean: still using this platform?

  -- Tracking
  last_updated INTEGER NOT NULL DEFAULT (unixepoch()),

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Marketing Hooks
-- AI-generated marketing hooks for manuscripts
CREATE TABLE IF NOT EXISTS marketing_hooks (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Hook Type
  hook_type TEXT NOT NULL CHECK (hook_type IN (
    'elevator_pitch',    -- 30-second pitch
    'logline',          -- One-sentence summary
    'tagline',          -- Short catchy phrase
    'unique_selling_proposition', -- What makes it unique
    'comparable_titles', -- "For fans of X meets Y"
    'hook_sentence',    -- Opening hook
    'back_cover_copy',  -- Back cover description
    'social_media_bio', -- Author bio for social media
    'press_release',    -- Media pitch angle
    'reader_promise'    -- What readers will get
  )),

  -- Hook Content
  hook_text TEXT NOT NULL,

  -- Effectiveness Metrics
  effectiveness_score REAL, -- 0.0-1.0 AI-predicted effectiveness
  target_audience TEXT, -- Who this hook targets

  -- Variations
  variation_number INTEGER DEFAULT 1, -- Multiple versions of same hook type

  -- Testing
  user_rating INTEGER, -- 1-5 stars, how much user likes it
  used_in_marketing INTEGER DEFAULT 0, -- Boolean: actually used?

  -- AI Metadata
  model_used TEXT,
  generated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Target Bookstore Shelf Analysis
-- AI analysis of where book would be shelved
CREATE TABLE IF NOT EXISTS bookstore_positioning (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Primary Shelf
  primary_category TEXT NOT NULL, -- Main genre/category
  primary_section TEXT, -- Physical section (e.g., "Fiction", "Mystery", "Thriller")

  -- Secondary Categories
  secondary_categories TEXT, -- JSON array of additional categories

  -- Shelf Placement
  placement_type TEXT CHECK (placement_type IN (
    'face_out',    -- Cover facing outward (premium placement)
    'spine_out',   -- Spine only visible (standard)
    'endcap',      -- End of aisle display
    'table',       -- Featured table
    'window'       -- Window display
  )),
  placement_probability REAL, -- 0.0-1.0 likelihood of face-out placement

  -- Physical Book Design Recommendations
  cover_design_notes TEXT, -- AI recommendations for physical cover
  trim_size_recommendation TEXT, -- Recommended book size
  spine_width_estimate REAL, -- Estimated spine width in inches

  -- Positioning Strategy
  positioning_strategy TEXT, -- How to position the book in market
  target_reader_profile TEXT, -- Who the ideal reader is

  -- Competitive Positioning
  differentiation_points TEXT, -- What makes it stand out on shelf

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Market Positioning Reports
-- Comprehensive market analysis reports
CREATE TABLE IF NOT EXISTS market_positioning_reports (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Report Metadata
  report_date INTEGER NOT NULL DEFAULT (unixepoch()),
  report_version INTEGER DEFAULT 1,

  -- Market Analysis
  genre_trends TEXT, -- Current trends in the genre
  market_saturation TEXT, -- How saturated is this market
  pricing_analysis TEXT, -- Pricing recommendations

  -- Competitive Landscape
  top_competitors TEXT, -- JSON array of top comp title IDs
  market_gap_analysis TEXT, -- Where there's opportunity

  -- Positioning Recommendations
  unique_angle TEXT, -- Recommended unique positioning
  target_demographics TEXT, -- JSON: age, gender, interests, etc.
  marketing_channels TEXT, -- Recommended marketing channels

  -- Platform Strategy
  platform_priorities TEXT, -- Which platforms to focus on
  launch_strategy TEXT, -- Recommended launch approach

  -- Financial Projections
  estimated_sales_rank INTEGER, -- Predicted Amazon rank
  estimated_monthly_sales INTEGER,
  estimated_monthly_revenue REAL,

  -- AI Metadata
  model_used TEXT,
  confidence_score REAL, -- 0.0-1.0 how confident the analysis is

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Author Platform Score
-- Aggregate score of author's platform strength
CREATE TABLE IF NOT EXISTS author_platform_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Overall Score
  overall_score INTEGER, -- 0-100 platform strength

  -- Category Scores
  social_media_score INTEGER, -- 0-100
  email_list_score INTEGER, -- 0-100
  website_traffic_score INTEGER, -- 0-100
  engagement_score INTEGER, -- 0-100
  authority_score INTEGER, -- 0-100 (media, speaking, etc.)

  -- Detailed Metrics
  total_followers INTEGER,
  total_subscribers INTEGER,
  avg_engagement_rate REAL,

  -- Monetization
  estimated_monthly_reach INTEGER,
  monetization_potential REAL, -- 0.0-1.0

  -- Recommendations
  improvement_areas TEXT, -- JSON array of areas to improve
  next_steps TEXT, -- Recommended actions

  -- Tracking
  score_date INTEGER NOT NULL DEFAULT (unixepoch()),

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_comp_titles_manuscript ON comp_titles(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_comp_titles_user ON comp_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_titles_active ON comp_titles(is_active);
CREATE INDEX IF NOT EXISTS idx_comp_titles_similarity ON comp_titles(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_comp_titles_source ON comp_titles(data_source);

CREATE INDEX IF NOT EXISTS idx_author_platform_user ON author_platform(user_id);
CREATE INDEX IF NOT EXISTS idx_author_platform_type ON author_platform(platform_type);
CREATE INDEX IF NOT EXISTS idx_author_platform_active ON author_platform(is_active);
CREATE INDEX IF NOT EXISTS idx_author_platform_followers ON author_platform(follower_count DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_hooks_manuscript ON marketing_hooks(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_user ON marketing_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_type ON marketing_hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_effectiveness ON marketing_hooks(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_used ON marketing_hooks(used_in_marketing);

CREATE INDEX IF NOT EXISTS idx_bookstore_positioning_manuscript ON bookstore_positioning(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_bookstore_positioning_user ON bookstore_positioning(user_id);
CREATE INDEX IF NOT EXISTS idx_bookstore_positioning_category ON bookstore_positioning(primary_category);

CREATE INDEX IF NOT EXISTS idx_market_reports_manuscript ON market_positioning_reports(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_market_reports_user ON market_positioning_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_market_reports_date ON market_positioning_reports(report_date DESC);

CREATE INDEX IF NOT EXISTS idx_platform_scores_user ON author_platform_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_scores_overall ON author_platform_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_platform_scores_date ON author_platform_scores(score_date DESC);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS comp_titles_updated
AFTER UPDATE ON comp_titles
FOR EACH ROW
BEGIN
  UPDATE comp_titles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS author_platform_updated
AFTER UPDATE ON author_platform
FOR EACH ROW
BEGIN
  UPDATE author_platform SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS marketing_hooks_updated
AFTER UPDATE ON marketing_hooks
FOR EACH ROW
BEGIN
  UPDATE marketing_hooks SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS bookstore_positioning_updated
AFTER UPDATE ON bookstore_positioning
FOR EACH ROW
BEGIN
  UPDATE bookstore_positioning SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS market_reports_updated
AFTER UPDATE ON market_positioning_reports
FOR EACH ROW
BEGIN
  UPDATE market_positioning_reports SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS platform_scores_updated
AFTER UPDATE ON author_platform_scores
FOR EACH ROW
BEGIN
  UPDATE author_platform_scores SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Views for Analytics

-- Comp Title Summary
CREATE VIEW IF NOT EXISTS comp_title_summary AS
SELECT
  ct.manuscript_id,
  m.title as manuscript_title,
  COUNT(*) as total_comp_titles,
  AVG(ct.similarity_score) as avg_similarity,
  AVG(ct.price) as avg_comp_price,
  AVG(ct.avg_rating) as avg_comp_rating,
  MIN(ct.amazon_sales_rank) as best_comp_sales_rank,
  MAX(ct.review_count) as max_comp_reviews
FROM comp_titles ct
JOIN manuscripts m ON ct.manuscript_id = m.id
WHERE ct.is_active = 1
GROUP BY ct.manuscript_id, m.title;

-- Author Platform Summary
CREATE VIEW IF NOT EXISTS author_platform_summary AS
SELECT
  ap.user_id,
  COUNT(*) as total_platforms,
  SUM(ap.follower_count) as total_followers,
  SUM(ap.subscriber_count) as total_subscribers,
  AVG(ap.engagement_rate) as avg_engagement,
  COUNT(CASE WHEN ap.verified = 1 THEN 1 END) as verified_platforms,
  COUNT(CASE WHEN ap.is_active = 1 THEN 1 END) as active_platforms
FROM author_platform ap
GROUP BY ap.user_id;

-- Marketing Hooks by Manuscript
CREATE VIEW IF NOT EXISTS marketing_hooks_by_manuscript AS
SELECT
  mh.manuscript_id,
  m.title as manuscript_title,
  mh.hook_type,
  COUNT(*) as variation_count,
  AVG(mh.effectiveness_score) as avg_effectiveness,
  COUNT(CASE WHEN mh.used_in_marketing = 1 THEN 1 END) as used_count
FROM marketing_hooks mh
JOIN manuscripts m ON mh.manuscript_id = m.id
GROUP BY mh.manuscript_id, m.title, mh.hook_type;

-- Market Positioning Overview
CREATE VIEW IF NOT EXISTS market_positioning_overview AS
SELECT
  m.id as manuscript_id,
  m.title,
  m.genre,
  ct_summary.total_comp_titles,
  ct_summary.avg_comp_price,
  bp.primary_category,
  bp.placement_probability,
  mpr.estimated_monthly_sales,
  mpr.confidence_score
FROM manuscripts m
LEFT JOIN comp_title_summary ct_summary ON m.id = ct_summary.manuscript_id
LEFT JOIN bookstore_positioning bp ON m.id = bp.manuscript_id
LEFT JOIN (
  SELECT manuscript_id, estimated_monthly_sales, confidence_score
  FROM market_positioning_reports
  WHERE (manuscript_id, report_date) IN (
    SELECT manuscript_id, MAX(report_date)
    FROM market_positioning_reports
    GROUP BY manuscript_id
  )
) mpr ON m.id = mpr.manuscript_id;
