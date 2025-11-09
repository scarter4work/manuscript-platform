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
