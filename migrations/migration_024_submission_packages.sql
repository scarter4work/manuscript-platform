-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
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
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
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
  UPDATE submission_packages SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Package statistics view
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
GROUP BY sp.id, package_name, package_type, created_at, title;
