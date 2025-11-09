-- Fix GROUP BY clauses in views for PostgreSQL strict mode
-- PostgreSQL requires all non-aggregated SELECT columns in GROUP BY

-- migration_022: Fix genre_usage_stats view
DROP VIEW IF EXISTS genre_usage_stats CASCADE;
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
WHERE g.is_active = TRUE
GROUP BY g.id, g.name, g.parent_genre_id;

-- migration_024: Fix package_stats view
DROP VIEW IF EXISTS package_stats CASCADE;
CREATE OR REPLACE VIEW package_stats AS
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
GROUP BY sp.id, sp.package_name, sp.package_type, sp.created_at, m.title;

-- migration_025: Fix submission_stats view
DROP VIEW IF EXISTS submission_stats CASCADE;
CREATE OR REPLACE VIEW submission_stats AS
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
  COUNT(sf.id) as feedback_count
FROM submissions s
LEFT JOIN manuscripts m ON s.manuscript_id = m.id
LEFT JOIN submission_feedback sf ON s.id = sf.submission_id
GROUP BY s.id, s.manuscript_id, s.publisher_name, s.publisher_type,
         s.submission_date, s.response_date, s.response_type,
         s.is_resubmission, m.title;

-- migration_026: Fix human_edit_stats view
DROP VIEW IF EXISTS human_edit_stats CASCADE;
CREATE OR REPLACE VIEW human_edit_stats AS
SELECT
  h.manuscript_id,
  h.user_id,
  m.title as manuscript_title,
  COUNT(DISTINCT h.id) as total_annotations,
  COUNT(DISTINCT h.chapter_number) as chapters_edited,
  COUNT(DISTINCT CASE WHEN h.edit_type = 'plot' THEN h.id END) as plot_notes,
  COUNT(DISTINCT CASE WHEN h.edit_type = 'character' THEN h.id END) as character_notes,
  COUNT(DISTINCT CASE WHEN h.edit_type = 'pacing' THEN h.id END) as pacing_notes,
  COUNT(DISTINCT CASE WHEN h.edit_type = 'dialogue' THEN h.id END) as dialogue_notes,
  COUNT(DISTINCT CASE WHEN h.addressed = TRUE THEN h.id END) as addressed_count
FROM human_style_edits h
LEFT JOIN manuscripts m ON h.manuscript_id = m.id
GROUP BY h.manuscript_id, h.user_id, m.title;

-- migration_027: Fix marketing_kit_stats view
DROP VIEW IF EXISTS marketing_kit_stats CASCADE;
CREATE OR REPLACE VIEW marketing_kit_stats AS
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
  COUNT(DISTINCT CASE WHEN p.used = TRUE THEN p.id END) as posts_used
FROM marketing_kits k
LEFT JOIN manuscripts m ON k.manuscript_id = m.id
LEFT JOIN social_media_posts p ON k.id = p.kit_id
GROUP BY k.id, k.manuscript_id, k.user_id, k.kit_name, k.genre, m.title;

-- migration_028: Fix formatting_stats view
DROP VIEW IF EXISTS formatting_stats CASCADE;
CREATE OR REPLACE VIEW formatting_stats AS
SELECT
  f.manuscript_id,
  f.user_id,
  m.title as manuscript_title,
  COUNT(DISTINCT f.id) as total_formats,
  COUNT(DISTINCT CASE WHEN f.format_type = 'epub' THEN f.id END) as epub_count,
  COUNT(DISTINCT CASE WHEN f.format_type = 'mobi' THEN f.id END) as mobi_count,
  COUNT(DISTINCT CASE WHEN f.format_type = 'pdf' THEN f.id END) as pdf_count,
  COUNT(DISTINCT CASE WHEN f.status = 'completed' THEN f.id END) as completed_count
FROM formatted_manuscripts f
LEFT JOIN manuscripts m ON f.manuscript_id = m.id
GROUP BY f.manuscript_id, f.user_id, m.title;
