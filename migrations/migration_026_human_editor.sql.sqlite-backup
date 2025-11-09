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
