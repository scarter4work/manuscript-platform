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
