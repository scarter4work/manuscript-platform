-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
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
  generation_cost DOUBLE PRECISION, -- API/processing cost
  processing_time_ms INTEGER,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

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
  UPDATE formatted_manuscripts SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
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
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_formatting_templates_user ON formatting_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_formatting_templates_type ON formatting_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_formatting_templates_system ON formatting_templates(is_system_template);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_formatting_templates_timestamp
AFTER UPDATE ON formatting_templates
BEGIN
  UPDATE formatting_templates SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
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
  started_at BIGINT,
  completed_at INTEGER,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (formatted_manuscript_id) REFERENCES formatted_manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_formatting_jobs_status ON formatting_jobs(status);
CREATE INDEX IF NOT EXISTS idx_formatting_jobs_priority ON formatting_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_formatting_jobs_created ON formatting_jobs(created_at);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_formatting_jobs_timestamp
AFTER UPDATE ON formatting_jobs
BEGIN
  UPDATE formatting_jobs SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Statistics view
CREATE OR REPLACE VIEW formatting_stats AS
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
