-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
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
  submission_date BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  response_date INTEGER,
  status TEXT DEFAULT 'pending', -- Legacy field for backwards compatibility
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
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
  UPDATE submissions SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
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
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission ON submission_feedback(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_type ON submission_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_submission_feedback_addressed ON submission_feedback(addressed);

-- Auto-update trigger for submission_feedback
CREATE TRIGGER IF NOT EXISTS update_submission_feedback_timestamp
AFTER UPDATE ON submission_feedback
BEGIN
  UPDATE submission_feedback SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Submission statistics view
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
  COUNT(DISTINCT sf.id) as feedback_count,
  SUM(CASE WHEN sf.addressed = 1 THEN 1 ELSE 0 END) as feedback_addressed_count
FROM submissions s
LEFT JOIN manuscripts m ON s.manuscript_id = m.id
LEFT JOIN submission_feedback sf ON s.id = sf.submission_id
GROUP BY s.id;
