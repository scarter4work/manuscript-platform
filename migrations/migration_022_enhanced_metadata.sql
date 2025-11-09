-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- WARNING: SQLite triggers detected - requires manual conversion to PostgreSQL function + trigger syntax
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
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
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
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
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
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
  changed_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
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
  UPDATE genres SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
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
('true-crime', 'True Crime', 'nonfiction', 'DOUBLE PRECISION criminal cases and investigations', 60000, 80000, 6);

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
