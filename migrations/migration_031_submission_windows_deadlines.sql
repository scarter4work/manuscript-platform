-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
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
  acceptance_rate DOUBLE PRECISION, -- % of submissions accepted (0.0 - 1.0)

  -- Metadata
  genres_accepted TEXT, -- JSON array of genres
  accepts_simultaneous INTEGER DEFAULT 1, -- Boolean
  requires_exclusive INTEGER DEFAULT 0, -- Boolean
  notes TEXT,

  is_active INTEGER DEFAULT 1, -- Boolean: still accepting submissions
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_publishers_type ON publishers(publisher_type);
CREATE INDEX IF NOT EXISTS idx_publishers_active ON publishers(is_active);
CREATE INDEX IF NOT EXISTS idx_publishers_name ON publishers(name);

-- Auto-update trigger
-- Update trigger for publishers
CREATE TRIGGER update_publishers_timestamp
BEFORE UPDATE ON publishers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

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

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_windows_publisher ON publisher_submission_windows(publisher_id);
CREATE INDEX IF NOT EXISTS idx_windows_is_open ON publisher_submission_windows(is_open);
CREATE INDEX IF NOT EXISTS idx_windows_opens ON publisher_submission_windows(opens_at);
CREATE INDEX IF NOT EXISTS idx_windows_closes ON publisher_submission_windows(closes_at DESC);
CREATE INDEX IF NOT EXISTS idx_windows_type ON publisher_submission_windows(window_type);

-- Auto-update trigger
-- Update trigger for publisher_submission_windows
CREATE TRIGGER update_submission_windows_timestamp
BEFORE UPDATE ON publisher_submission_windows
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Submission deadlines (per-submission tracking)
CREATE TABLE IF NOT EXISTS submission_deadlines (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,

  -- Deadline type
  deadline_type TEXT NOT NULL CHECK (deadline_type IN
    ('response_expected', 'revise_resubmit', 'contract_expires', 'contest', 'window_closes', 'other')),

  -- Timing
  deadline_date BIGINT NOT NULL, -- Unix timestamp
  reminder_days_before INTEGER DEFAULT 7, -- Send reminder N days before

  -- Reminders
  reminder_sent INTEGER DEFAULT 0, -- Boolean
  reminder_sent_at BIGINT,

  -- Metadata
  deadline_name TEXT, -- "R&R Deadline for Novel Submission"
  description TEXT,
  notes TEXT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deadlines_submission ON submission_deadlines(submission_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON submission_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_type ON submission_deadlines(deadline_type);
CREATE INDEX IF NOT EXISTS idx_deadlines_reminder_sent ON submission_deadlines(reminder_sent);

-- Auto-update trigger
-- Update trigger for submission_deadlines
CREATE TRIGGER update_submission_deadlines_timestamp
BEFORE UPDATE ON submission_deadlines
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

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

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE,
  UNIQUE(user_id, publisher_id)
);

CREATE INDEX IF NOT EXISTS idx_window_alerts_user ON window_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_window_alerts_publisher ON window_alerts(publisher_id);

-- Auto-update trigger
-- Update trigger for window_alerts
CREATE TRIGGER update_window_alerts_timestamp
BEFORE UPDATE ON window_alerts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- View: Currently open windows
CREATE OR REPLACE VIEW open_submission_windows AS
SELECT
  psw.*,
  p.name as publisher_name,
  p.publisher_type,
  p.website,
  p.avg_response_time_days,

  -- Calculate days until close
  CASE
    WHEN psw.closes_at IS NOT NULL
    THEN CAST((psw.closes_at - EXTRACT(EPOCH FROM NOW())::BIGINT) / 86400.0 AS INTEGER)
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
  AND (psw.closes_at IS NULL OR psw.closes_at > EXTRACT(EPOCH FROM NOW())::BIGINT)
  AND (psw.capacity_limit IS NULL OR psw.current_submissions < psw.capacity_limit);

-- View: Opening soon (next 30 days)
CREATE OR REPLACE VIEW windows_opening_soon AS
SELECT
  psw.*,
  p.name as publisher_name,
  p.publisher_type,
  p.website,

  -- Days until open
  CAST((psw.opens_at - EXTRACT(EPOCH FROM NOW())::BIGINT) / 86400.0 AS INTEGER) as days_until_open

FROM publisher_submission_windows psw
JOIN publishers p ON psw.publisher_id = p.id
WHERE psw.is_open = 0
  AND psw.opens_at IS NOT NULL
  AND psw.opens_at > EXTRACT(EPOCH FROM NOW())::BIGINT
  AND psw.opens_at <= (EXTRACT(EPOCH FROM NOW())::BIGINT + 2592000) -- 30 days
ORDER BY psw.opens_at ASC;

-- View: Upcoming deadlines
CREATE OR REPLACE VIEW upcoming_deadlines AS
SELECT
  sd.*,
  m.title as manuscript_title,
  m.author,
  m.genre,

  -- Days until deadline
  CAST((sd.deadline_date - EXTRACT(EPOCH FROM NOW())::BIGINT) / 86400.0 AS INTEGER) as days_until_deadline,

  -- Overdue flag
  CASE WHEN sd.deadline_date < EXTRACT(EPOCH FROM NOW())::BIGINT THEN 1 ELSE 0 END as is_overdue

FROM submission_deadlines sd
JOIN manuscripts m ON sd.submission_id = m.id
WHERE sd.deadline_date > (EXTRACT(EPOCH FROM NOW())::BIGINT - 604800) -- Show 7 days past due
ORDER BY sd.deadline_date ASC;
