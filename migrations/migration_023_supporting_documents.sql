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
