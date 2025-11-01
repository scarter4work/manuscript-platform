-- Migration 020: Platform Documentation Monitoring & AI Agent System (MAN-50)
-- Auto-updating knowledge base for platform-specific AI agents

-- =============================================================================
-- PLATFORM DOCUMENTATION TRACKING
-- =============================================================================

-- Store versioned snapshots of platform documentation
CREATE TABLE IF NOT EXISTS platform_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  analyzed_at INTEGER NOT NULL,
  changes_summary TEXT,
  criticality TEXT CHECK(criticality IN ('CRITICAL', 'IMPORTANT', 'MINOR', NULL)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(platform, version)
);

CREATE INDEX idx_platform_docs_platform ON platform_docs(platform);
CREATE INDEX idx_platform_docs_analyzed_at ON platform_docs(analyzed_at DESC);
CREATE INDEX idx_platform_docs_criticality ON platform_docs(criticality) WHERE criticality IS NOT NULL;

-- =============================================================================
-- AGENT KNOWLEDGE BASE
-- =============================================================================

-- Store structured knowledge extracted from platform documentation
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN (
    'file_format',
    'account_setup',
    'pricing',
    'workflow',
    'error_handling',
    'general'
  )),
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  last_updated INTEGER NOT NULL,
  source_url TEXT,
  doc_version INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (platform, doc_version) REFERENCES platform_docs(platform, version)
);

CREATE INDEX idx_agent_knowledge_platform ON agent_knowledge(platform);
CREATE INDEX idx_agent_knowledge_category ON agent_knowledge(platform, category);
CREATE INDEX idx_agent_knowledge_updated ON agent_knowledge(last_updated DESC);

-- =============================================================================
-- WORKFLOW DEFINITIONS (VERSIONED)
-- =============================================================================

-- Store versioned workflow definitions as JSON
CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  version INTEGER NOT NULL,
  workflow_json TEXT NOT NULL, -- JSON structure with steps, substeps, validation
  estimated_duration_minutes INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  deprecated_at INTEGER,
  UNIQUE(platform, version)
);

CREATE INDEX idx_workflows_platform ON workflows(platform);
CREATE INDEX idx_workflows_active ON workflows(platform, deprecated_at) WHERE deprecated_at IS NULL;

-- =============================================================================
-- USER WORKFLOW PROGRESS TRACKING
-- =============================================================================

-- Track user progress through platform-specific workflows
CREATE TABLE IF NOT EXISTS user_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  workflow_version INTEGER NOT NULL,
  current_step_id TEXT,
  completed_steps TEXT NOT NULL DEFAULT '[]', -- JSON array of step IDs
  state_data TEXT NOT NULL DEFAULT '{}', -- JSON object with step-specific data
  last_updated INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (platform, workflow_version) REFERENCES workflows(platform, version),
  UNIQUE(user_id, manuscript_id, platform)
);

CREATE INDEX idx_user_workflows_user ON user_workflows(user_id);
CREATE INDEX idx_user_workflows_manuscript ON user_workflows(manuscript_id);
CREATE INDEX idx_user_workflows_platform ON user_workflows(platform);
CREATE INDEX idx_user_workflows_updated ON user_workflows(last_updated DESC);

-- =============================================================================
-- AI AGENT CONVERSATIONS
-- =============================================================================

-- Store conversation history with platform-specific AI agents
CREATE TABLE IF NOT EXISTS agent_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  messages TEXT NOT NULL DEFAULT '[]', -- JSON array of {role, content, timestamp}
  context_snapshot TEXT, -- JSON snapshot of user's workflow state at start
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (user_id, manuscript_id, platform) REFERENCES user_workflows(user_id, manuscript_id, platform)
);

CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX idx_agent_conversations_manuscript ON agent_conversations(manuscript_id);
CREATE INDEX idx_agent_conversations_platform ON agent_conversations(platform);
CREATE INDEX idx_agent_conversations_updated ON agent_conversations(updated_at DESC);

-- =============================================================================
-- DOCUMENTATION CHANGE NOTIFICATIONS
-- =============================================================================

-- Track notifications sent to users about platform changes
CREATE TABLE IF NOT EXISTS platform_change_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  manuscript_id TEXT,
  platform TEXT NOT NULL,
  doc_version INTEGER NOT NULL,
  criticality TEXT NOT NULL CHECK(criticality IN ('CRITICAL', 'IMPORTANT', 'MINOR')),
  notification_type TEXT NOT NULL CHECK(notification_type IN ('email', 'dashboard', 'in_app')),
  message TEXT NOT NULL,
  sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
  read_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (platform, doc_version) REFERENCES platform_docs(platform, version)
);

CREATE INDEX idx_notifications_user ON platform_change_notifications(user_id);
CREATE INDEX idx_notifications_platform ON platform_change_notifications(platform);
CREATE INDEX idx_notifications_unread ON platform_change_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_sent ON platform_change_notifications(sent_at DESC);

-- =============================================================================
-- DOCUMENTATION FETCH LOGS
-- =============================================================================

-- Log documentation fetch attempts for monitoring and debugging
CREATE TABLE IF NOT EXISTS doc_fetch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  source_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'partial')),
  http_status INTEGER,
  error_message TEXT,
  content_length INTEGER,
  fetch_duration_ms INTEGER,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_doc_fetch_logs_platform ON doc_fetch_logs(platform);
CREATE INDEX idx_doc_fetch_logs_fetched ON doc_fetch_logs(fetched_at DESC);
CREATE INDEX idx_doc_fetch_logs_status ON doc_fetch_logs(status);

-- =============================================================================
-- PLATFORM DEFINITIONS
-- =============================================================================

-- Master list of platforms we monitor
CREATE TABLE IF NOT EXISTS monitored_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  documentation_urls TEXT NOT NULL, -- JSON array of URLs to monitor
  crawler_enabled INTEGER NOT NULL DEFAULT 1,
  last_crawled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Insert initial platforms
INSERT OR IGNORE INTO monitored_platforms (id, name, documentation_urls) VALUES
  ('kdp', 'Amazon KDP', '["https://kdp.amazon.com/help", "https://kdpcommunity.com/s/"]'),
  ('d2d', 'Draft2Digital', '["https://draft2digital.com/knowledge-base/", "https://draft2digital.com/faq/"]'),
  ('ingramspark', 'IngramSpark', '["https://www.ingramspark.com/hub/support", "https://www.ingramspark.com/hub/create-a-book"]'),
  ('apple_books', 'Apple Books', '["https://books.apple.com/us/author/"]');

-- =============================================================================
-- ANALYTICS VIEWS
-- =============================================================================

-- View: Latest documentation version per platform
CREATE VIEW IF NOT EXISTS v_latest_platform_docs AS
SELECT
  p.platform,
  p.version,
  p.analyzed_at,
  p.criticality,
  p.changes_summary,
  m.name AS platform_name
FROM platform_docs p
INNER JOIN (
  SELECT platform, MAX(version) AS max_version
  FROM platform_docs
  GROUP BY platform
) latest ON p.platform = latest.platform AND p.version = latest.max_version
INNER JOIN monitored_platforms m ON p.platform = m.id;

-- View: Active workflows per platform
CREATE VIEW IF NOT EXISTS v_active_workflows AS
SELECT
  w.platform,
  w.version,
  w.estimated_duration_minutes,
  COUNT(DISTINCT uw.user_id) AS active_users,
  COUNT(DISTINCT uw.manuscript_id) AS active_manuscripts,
  m.name AS platform_name
FROM workflows w
INNER JOIN monitored_platforms m ON w.platform = m.id
LEFT JOIN user_workflows uw ON w.platform = uw.platform AND w.version = uw.workflow_version
WHERE w.deprecated_at IS NULL
GROUP BY w.platform, w.version;

-- View: User workflow completion stats
CREATE VIEW IF NOT EXISTS v_workflow_completion_stats AS
SELECT
  uw.platform,
  uw.user_id,
  uw.manuscript_id,
  uw.current_step_id,
  json_array_length(uw.completed_steps) AS completed_steps_count,
  uw.last_updated,
  m.name AS platform_name
FROM user_workflows uw
INNER JOIN monitored_platforms m ON uw.platform = m.id;

-- View: Recent platform changes
CREATE VIEW IF NOT EXISTS v_recent_platform_changes AS
SELECT
  p.platform,
  p.version,
  p.criticality,
  p.changes_summary,
  p.analyzed_at,
  m.name AS platform_name,
  COUNT(n.id) AS notifications_sent
FROM platform_docs p
INNER JOIN monitored_platforms m ON p.platform = m.id
LEFT JOIN platform_change_notifications n ON p.platform = n.platform AND p.version = n.doc_version
WHERE p.analyzed_at > unixepoch() - (7 * 24 * 60 * 60) -- Last 7 days
GROUP BY p.platform, p.version
ORDER BY p.analyzed_at DESC;

-- View: Documentation fetch health
CREATE VIEW IF NOT EXISTS v_doc_fetch_health AS
SELECT
  l.platform,
  m.name AS platform_name,
  COUNT(*) AS total_fetches,
  SUM(CASE WHEN l.status = 'success' THEN 1 ELSE 0 END) AS successful_fetches,
  SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) AS failed_fetches,
  AVG(l.fetch_duration_ms) AS avg_fetch_duration_ms,
  MAX(l.fetched_at) AS last_fetch_at
FROM doc_fetch_logs l
INNER JOIN monitored_platforms m ON l.platform = m.id
WHERE l.fetched_at > unixepoch() - (7 * 24 * 60 * 60) -- Last 7 days
GROUP BY l.platform;

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert initial KDP workflow (simplified for MVP)
INSERT OR IGNORE INTO workflows (platform, version, workflow_json, estimated_duration_minutes) VALUES (
  'kdp',
  1,
  '{
    "platform": "kdp",
    "version": 1,
    "last_updated": "2025-10-31T00:00:00Z",
    "steps": [
      {
        "id": "account_setup",
        "title": "Account Setup",
        "description": "Create and configure your KDP account",
        "required": true,
        "estimated_time_minutes": 15
      },
      {
        "id": "book_details",
        "title": "Book Details",
        "description": "Enter metadata about your book",
        "required": true,
        "estimated_time_minutes": 20
      },
      {
        "id": "content_upload",
        "title": "Upload Content",
        "description": "Upload your manuscript and cover files",
        "required": true,
        "estimated_time_minutes": 10
      },
      {
        "id": "pricing_rights",
        "title": "Rights & Pricing",
        "description": "Set publishing rights and book price",
        "required": true,
        "estimated_time_minutes": 10
      },
      {
        "id": "preview_publish",
        "title": "Preview & Publish",
        "description": "Review your book and submit for publishing",
        "required": true,
        "estimated_time_minutes": 15
      }
    ]
  }',
  70
);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Version tracking
INSERT INTO schema_version (version, description, applied_at)
VALUES (20, 'Platform Documentation Monitoring & AI Agent System', unixepoch());
