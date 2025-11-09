-- Migration 029: Communication & Feedback System (Issue #55)
-- Publisher-author messaging, form letters, notifications, revision requests

-- Notification preferences for users
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Email notification toggles
  email_on_submission_received INTEGER DEFAULT 1, -- Publisher: new submission
  email_on_status_change INTEGER DEFAULT 1,       -- Author: submission status changed
  email_on_decision INTEGER DEFAULT 1,            -- Author: final decision made
  email_on_message INTEGER DEFAULT 1,             -- Both: new message received
  email_on_revision_request INTEGER DEFAULT 1,    -- Author: R&R received
  email_on_revision_submitted INTEGER DEFAULT 1,  -- Publisher: revision submitted

  -- Notification frequency
  digest_frequency TEXT DEFAULT 'immediate' CHECK (digest_frequency IN
    ('immediate', 'daily', 'weekly', 'none')),

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_notification_preferences_timestamp
AFTER UPDATE ON notification_preferences
BEGIN
  UPDATE notification_preferences SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Message templates for publishers (form letters)
CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  publisher_id TEXT, -- NULL for system templates
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN
    ('rejection', 'request_and_revise', 'request_full', 'offer', 'acknowledgment', 'custom')),
  is_system_template INTEGER DEFAULT 0, -- Boolean: built-in template

  -- Template content
  subject_line TEXT NOT NULL,
  body_text TEXT NOT NULL,

  -- Available merge fields (JSON array)
  merge_fields TEXT, -- ["{{author_name}}", "{{manuscript_title}}", "{{submission_date}}", etc.]

  -- Usage tracking
  times_used INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_templates_publisher ON message_templates(publisher_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_message_templates_system ON message_templates(is_system_template);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_message_templates_timestamp
AFTER UPDATE ON message_templates
BEGIN
  UPDATE message_templates SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Messages on submissions (threaded conversations)
CREATE TABLE IF NOT EXISTS submission_messages (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,

  -- Message metadata
  message_type TEXT NOT NULL CHECK (message_type IN
    ('status_update', 'feedback', 'revision_request', 'general', 'system')),
  subject TEXT,
  body TEXT NOT NULL,

  -- Attachments (JSON array of R2 keys)
  attachments TEXT,

  -- Read tracking
  is_read INTEGER DEFAULT 0,
  read_at INTEGER,

  -- Reply threading
  parent_message_id TEXT, -- For threaded replies

  sent_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES submission_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_messages_submission ON submission_messages(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_sender ON submission_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_recipient ON submission_messages(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_submission_messages_read ON submission_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_submission_messages_sent ON submission_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_messages_parent ON submission_messages(parent_message_id);

-- Revision requests (Request & Revise workflow)
CREATE TABLE IF NOT EXISTS revision_requests (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL, -- Publisher ID

  -- Revision details
  requested_changes TEXT NOT NULL, -- Detailed feedback
  revision_type TEXT CHECK (revision_type IN
    ('minor', 'moderate', 'major', 'substantial')),
  deadline INTEGER, -- Unix timestamp

  -- Author response
  author_response TEXT, -- Author's response/questions
  author_response_at INTEGER,

  -- Resubmission tracking
  resubmission_manuscript_id TEXT, -- New manuscript version
  resubmitted_at INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'accepted', 'declined', 'resubmitted', 'expired')),

  -- Decision
  decision TEXT, -- Publisher's decision after revision
  decision_at INTEGER,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (resubmission_manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_revision_requests_submission ON revision_requests(submission_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_requester ON revision_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_status ON revision_requests(status);
CREATE INDEX IF NOT EXISTS idx_revision_requests_deadline ON revision_requests(deadline);
CREATE INDEX IF NOT EXISTS idx_revision_requests_created ON revision_requests(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_revision_requests_timestamp
AFTER UPDATE ON revision_requests
BEGIN
  UPDATE revision_requests SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Notification queue (for email sending)
CREATE TABLE IF NOT EXISTS notification_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN
    ('submission_received', 'status_change', 'decision', 'message', 'revision_request', 'revision_submitted')),

  -- Email content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Related entities
  submission_id TEXT,
  message_id TEXT,
  revision_request_id TEXT,

  -- Send tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'sent', 'failed')),
  sent_at INTEGER,
  error_message TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES submission_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (revision_request_id) REFERENCES revision_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created ON notification_queue(created_at);

-- Statistics view
CREATE VIEW IF NOT EXISTS communication_stats AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(DISTINCT CASE WHEN sm.sender_user_id = u.id THEN sm.id END) as messages_sent,
  COUNT(DISTINCT CASE WHEN sm.recipient_user_id = u.id THEN sm.id END) as messages_received,
  COUNT(DISTINCT CASE WHEN sm.recipient_user_id = u.id AND sm.is_read = 0 THEN sm.id END) as unread_messages,
  COUNT(DISTINCT CASE WHEN rr.requested_by_user_id = u.id THEN rr.id END) as revision_requests_sent,
  COUNT(DISTINCT mt.id) as templates_created,
  MAX(sm.sent_at) as last_message_at
FROM users u
LEFT JOIN submission_messages sm ON u.id = sm.sender_user_id OR u.id = sm.recipient_user_id
LEFT JOIN revision_requests rr ON u.id = rr.requested_by_user_id
LEFT JOIN message_templates mt ON u.id = mt.publisher_id
GROUP BY u.id;
