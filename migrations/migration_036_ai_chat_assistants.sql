-- Migration 036: Platform-Specific AI Chat Assistants with Self-Updating Knowledge Base
-- Specialized AI agents for each publishing platform (KDP, Draft2Digital, IngramSpark, etc.)
-- with daily documentation crawling and automatic workflow updates

-- Drop existing tables if they exist (fresh start for AI chat system)
DROP TABLE IF EXISTS workflow_change_notifications;
DROP TABLE IF EXISTS doc_fetch_log;
DROP TABLE IF EXISTS agent_conversations;
DROP TABLE IF EXISTS user_workflows;
DROP TABLE IF EXISTS workflows;
DROP TABLE IF EXISTS agent_knowledge;
DROP TABLE IF EXISTS platform_docs;
DROP TABLE IF EXISTS agent_config;

-- Platform Documentation Table (Versioned)
-- Stores fetched documentation from platform help pages
CREATE TABLE IF NOT EXISTS platform_docs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp',              -- Amazon KDP
    'draft2digital',    -- Draft2Digital
    'ingramspark',      -- IngramSpark
    'apple_books',      -- Apple Books
    'barnes_noble',     -- Barnes & Noble Press
    'kobo',             -- Kobo Writing Life
    'google_play'       -- Google Play Books
  )),

  -- Documentation Details
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'account_setup',
    'book_details',
    'content_upload',
    'pricing_rights',
    'preview_publish',
    'troubleshooting',
    'faq',
    'api_reference',
    'general'
  )),

  source_url TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL, -- Full HTML/markdown content

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id TEXT, -- Link to previous version

  -- Change Detection
  content_hash TEXT NOT NULL, -- SHA-256 hash for change detection
  change_detected INTEGER DEFAULT 0, -- Boolean: was change detected?
  change_significance TEXT CHECK (change_significance IN (
    'critical',   -- Breaking changes, new requirements
    'important',  -- Feature changes, updated processes
    'minor',      -- Typos, clarifications, formatting
    'none'        -- No meaningful changes
  )),
  change_summary TEXT, -- Claude-generated summary of changes

  -- Metadata
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  analyzed_at INTEGER, -- When Claude analyzed changes

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (previous_version_id) REFERENCES platform_docs(id) ON DELETE SET NULL
);

-- Agent Knowledge Base
-- Extracted knowledge for each platform agent
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  -- Knowledge Entry
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
    'requirement',       -- Platform requirements
    'procedure',         -- Step-by-step procedures
    'error_solution',    -- Error messages and solutions
    'terminology',       -- Platform-specific terms
    'best_practice',     -- Recommended approaches
    'limitation',        -- Platform limitations
    'pricing_strategy',  -- Pricing recommendations
    'recent_change'      -- Recent platform updates
  )),

  topic TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Source Tracking
  source_doc_id TEXT, -- Link to platform_docs
  confidence_score REAL DEFAULT 1.0, -- 0.0-1.0 confidence

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT, -- Previous knowledge entry this replaces

  is_current INTEGER DEFAULT 1, -- Boolean: is this the current version?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (source_doc_id) REFERENCES platform_docs(id) ON DELETE SET NULL,
  FOREIGN KEY (supersedes_id) REFERENCES agent_knowledge(id) ON DELETE SET NULL
);

-- Workflow Definitions (JSON-based)
-- Step-by-step publishing processes for each platform
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  workflow_name TEXT NOT NULL,
  workflow_description TEXT,

  -- Workflow Definition (JSON)
  steps TEXT NOT NULL, -- JSON array of workflow steps
  -- Step structure:
  -- [{
  --   "stepId": "account-setup",
  --   "stepName": "Account Setup",
  --   "description": "Create and verify your KDP account",
  --   "estimatedMinutes": 15,
  --   "substeps": [...],
  --   "requirements": [...],
  --   "dependencies": ["previous-step-id"],
  --   "troubleshooting": {...}
  -- }]

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id TEXT,

  -- Status
  is_active INTEGER DEFAULT 1, -- Boolean: is this the current workflow?

  -- Change Tracking
  changelog TEXT, -- Description of changes from previous version
  auto_generated INTEGER DEFAULT 0, -- Boolean: auto-generated from doc changes?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (previous_version_id) REFERENCES workflows(id) ON DELETE SET NULL
);

-- User Workflow Progress
-- Track user progress through publishing workflows
CREATE TABLE IF NOT EXISTS user_workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT, -- Optional: link to specific manuscript

  workflow_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Progress Tracking
  current_step_id TEXT, -- Current step in workflow
  steps_completed TEXT, -- JSON array of completed step IDs

  -- Status
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'not_started',
    'in_progress',
    'completed',
    'abandoned',
    'blocked'
  )),

  -- Metrics
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  last_activity_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Blocking Issues
  blocked_reason TEXT, -- Why workflow is blocked

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Agent Conversations
-- Chat history between user and platform agents
CREATE TABLE IF NOT EXISTS agent_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  user_workflow_id TEXT, -- Link to workflow if in context

  -- Message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,

  -- Context
  current_step_id TEXT, -- Step user is on when asking
  context_metadata TEXT, -- JSON: additional context (manuscript_id, etc.)

  -- Agent Response Metadata
  response_type TEXT CHECK (response_type IN (
    'guidance',          -- Step-by-step guidance
    'troubleshooting',   -- Error resolution
    'clarification',     -- Answering questions
    'celebration',       -- Celebrating progress
    'alert'              -- Recent platform changes
  )),

  -- AI Metadata
  model_used TEXT, -- Claude model version
  tokens_used INTEGER,
  cost REAL,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_workflow_id) REFERENCES user_workflows(id) ON DELETE SET NULL
);

-- Documentation Fetch Log
-- Track daily documentation fetches
CREATE TABLE IF NOT EXISTS doc_fetch_log (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,

  fetch_status TEXT NOT NULL CHECK (fetch_status IN (
    'success',
    'failed',
    'partial',
    'skipped'
  )),

  urls_fetched INTEGER DEFAULT 0,
  urls_failed INTEGER DEFAULT 0,

  changes_detected INTEGER DEFAULT 0, -- Count of docs with changes
  new_docs_added INTEGER DEFAULT 0,

  error_message TEXT,

  fetch_started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  fetch_completed_at INTEGER,
  duration_seconds REAL,

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Platform Agent Configuration
-- Configuration for each platform agent
CREATE TABLE IF NOT EXISTS agent_config (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE CHECK (platform IN (
    'kdp', 'draft2digital', 'ingramspark', 'apple_books',
    'barnes_noble', 'kobo', 'google_play'
  )),

  agent_name TEXT NOT NULL,
  agent_description TEXT,

  -- System Prompt
  system_prompt TEXT NOT NULL, -- Base system prompt for agent

  -- Documentation Sources
  doc_sources TEXT NOT NULL, -- JSON array of URLs to crawl
  -- [{"url": "https://kdp.amazon.com/help", "type": "account_setup"}]

  -- Agent Personality
  tone TEXT DEFAULT 'professional', -- professional, friendly, enthusiastic
  expertise_level TEXT DEFAULT 'expert', -- beginner, intermediate, expert

  -- Crawl Settings
  crawl_enabled INTEGER DEFAULT 1, -- Boolean: enable daily crawls
  crawl_frequency_hours INTEGER DEFAULT 24, -- How often to crawl
  last_crawl_at INTEGER,
  next_crawl_at INTEGER,

  is_active INTEGER DEFAULT 1, -- Boolean: is agent active?

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- User Notifications for Workflow Changes
-- Notify users when workflows change due to platform updates
CREATE TABLE IF NOT EXISTS workflow_change_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Change Details
  change_type TEXT NOT NULL CHECK (change_type IN (
    'requirement_added',
    'requirement_removed',
    'step_added',
    'step_removed',
    'step_modified',
    'order_changed'
  )),

  change_description TEXT NOT NULL,
  change_significance TEXT CHECK (change_significance IN ('critical', 'important', 'minor')),

  -- Notification Status
  notification_sent INTEGER DEFAULT 0, -- Boolean: has notification been sent?
  notification_sent_at INTEGER,

  user_acknowledged INTEGER DEFAULT 0, -- Boolean: has user seen it?
  user_acknowledged_at INTEGER,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Insert Default Agent Configurations
INSERT INTO agent_config (
  id, platform, agent_name, agent_description, system_prompt, doc_sources, tone
) VALUES
  (
    'agent-kdp',
    'kdp',
    'KDP Publishing Assistant',
    'Expert in Amazon Kindle Direct Publishing workflows, requirements, and best practices.',
    'You are an expert Amazon KDP (Kindle Direct Publishing) specialist. You guide authors through the entire KDP publishing process with patience and precision. You stay up-to-date with KDP requirements and help troubleshoot common issues. You reference exact field names, button labels, and platform terminology. You celebrate user progress and provide actionable, step-by-step guidance.',
    '[{"url":"https://kdp.amazon.com/en_US/help","type":"general"},{"url":"https://kdp.amazon.com/en_US/help/topic/G200634390","type":"account_setup"},{"url":"https://kdp.amazon.com/en_US/help/topic/G200635650","type":"content_upload"},{"url":"https://kdp.amazon.com/en_US/help/topic/G200634560","type":"pricing_rights"}]',
    'professional'
  ),
  (
    'agent-d2d',
    'draft2digital',
    'Draft2Digital Assistant',
    'Expert in Draft2Digital multi-retailer publishing.',
    'You are an expert Draft2Digital specialist. You help authors publish to multiple retailers simultaneously through D2D. You understand retailer-specific requirements and help optimize distribution settings. You provide clear, actionable guidance for the D2D platform.',
    '[{"url":"https://help.draft2digital.com/","type":"general"}]',
    'friendly'
  ),
  (
    'agent-ingramspark',
    'ingramspark',
    'IngramSpark Assistant',
    'Expert in IngramSpark print and wholesale distribution.',
    'You are an expert IngramSpark specialist. You guide authors through print book setup, ISBN assignment, and wholesale distribution. You understand print specifications, trim sizes, and distribution channels. You provide detailed technical guidance for print publishing.',
    '[{"url":"https://www.ingramspark.com/support","type":"general"}]',
    'professional'
  ),
  (
    'agent-apple',
    'apple_books',
    'Apple Books Assistant',
    'Expert in Apple Books publishing.',
    'You are an expert Apple Books specialist. You guide authors through Apple Books publishing requirements, metadata optimization, and Apple-specific features. You help with Apple Books Author app and iTunes Producer workflows.',
    '[{"url":"https://authors.apple.com/support","type":"general"}]',
    'friendly'
  ),
  (
    'agent-bn',
    'barnes_noble',
    'Barnes & Noble Press Assistant',
    'Expert in Barnes & Noble Press publishing.',
    'You are an expert Barnes & Noble Press specialist. You help authors publish to B&N both in print and ebook formats. You understand B&N-specific requirements and help optimize book listings for the B&N marketplace.',
    '[{"url":"https://press.barnesandnoble.com/support","type":"general"}]',
    'professional'
  ),
  (
    'agent-kobo',
    'kobo',
    'Kobo Writing Life Assistant',
    'Expert in Kobo Writing Life publishing.',
    'You are an expert Kobo Writing Life specialist. You guide authors through Kobo-specific publishing requirements and help optimize for international markets where Kobo has strong presence. You understand Kobo promotional tools.',
    '[{"url":"https://www.kobo.com/us/en/p/writinglife","type":"general"}]',
    'friendly'
  ),
  (
    'agent-google',
    'google_play',
    'Google Play Books Assistant',
    'Expert in Google Play Books publishing.',
    'You are an expert Google Play Books specialist. You help authors publish through Google Play Books Partner Center. You understand Google-specific requirements and help optimize for Android ecosystem.',
    '[{"url":"https://support.google.com/books/partner","type":"general"}]',
    'professional'
  );

-- Insert KDP Workflow (Example - Full workflow)
INSERT INTO workflows (
  id, platform, workflow_name, workflow_description, steps, version, is_active
) VALUES (
  'workflow-kdp-ebook-v1',
  'kdp',
  'KDP Ebook Publishing',
  'Complete workflow for publishing an ebook on Amazon KDP',
  '[
    {
      "stepId": "account-setup",
      "stepName": "Account Setup",
      "description": "Create and verify your Amazon KDP account",
      "estimatedMinutes": 15,
      "substeps": [
        "Go to kdp.amazon.com",
        "Sign in with Amazon account or create new",
        "Complete tax interview (W-9 or W-8BEN)",
        "Add banking information for royalty payments",
        "Verify email address"
      ],
      "requirements": [
        "Valid email address",
        "Tax identification number (SSN or EIN)",
        "Bank account for payments"
      ],
      "troubleshooting": {
        "Tax interview stuck": "Complete all required fields. For non-US authors, use W-8BEN form.",
        "Bank verification failed": "Ensure bank account is in your name and routing number is correct."
      }
    },
    {
      "stepId": "book-details",
      "stepName": "Enter Book Details",
      "description": "Add title, author, description, and metadata",
      "estimatedMinutes": 20,
      "dependencies": ["account-setup"],
      "substeps": [
        "Click ''+ Create'' > ''Paperback'' or ''Kindle eBook''",
        "Enter book title and subtitle",
        "Add author name",
        "Write book description (up to 4000 characters)",
        "Select up to 10 keywords",
        "Choose 2 BISAC categories",
        "Set age range and grade level (if applicable)",
        "Upload cover image (recommended 2560 x 1600 pixels)"
      ],
      "requirements": [
        "Book title (required)",
        "Author name (required)",
        "Description 200-4000 characters",
        "Cover image: JPG/PNG, 1000px minimum height",
        "ISBN (optional for ebook, KDP provides free ASIN)"
      ],
      "troubleshooting": {
        "Cover upload failed": "Ensure image is JPG or PNG, at least 1000px tall, under 50MB.",
        "Categories not saving": "Select categories from Browse dropdown, not free-text entry."
      }
    },
    {
      "stepId": "content-upload",
      "stepName": "Upload Manuscript",
      "description": "Upload formatted ebook file",
      "estimatedMinutes": 10,
      "dependencies": ["book-details"],
      "substeps": [
        "Prepare manuscript in EPUB, MOBI, DOC, or DOCX format",
        "Click ''Upload eBook manuscript''",
        "Select file from computer",
        "Wait for file processing (1-5 minutes)",
        "Enable/disable DRM",
        "Preview book with online previewer"
      ],
      "requirements": [
        "Formatted manuscript file (EPUB recommended)",
        "File size under 650MB",
        "Proper formatting with chapter breaks",
        "Embedded fonts (if using custom fonts)"
      ],
      "troubleshooting": {
        "File upload timeout": "Try smaller file size or convert to EPUB format.",
        "Formatting issues in preview": "Use KDP Kindle Create tool to reformat manuscript.",
        "Images not displaying": "Ensure images are under 5MB each and in JPG format."
      }
    },
    {
      "stepId": "pricing-rights",
      "stepName": "Set Pricing & Rights",
      "description": "Choose territories, pricing, and royalty options",
      "estimatedMinutes": 15,
      "dependencies": ["content-upload"],
      "substeps": [
        "Select territories (worldwide or specific countries)",
        "Choose royalty option: 35% or 70%",
        "Set list price in USD (70% royalty: $2.99-$9.99 required)",
        "Enable/disable Kindle Unlimited and KDP Select",
        "Set prices for other marketplaces (UK, DE, etc.)",
        "Choose pre-order options (optional)"
      ],
      "requirements": [
        "Price between $0.99 - $200",
        "For 70% royalty: $2.99 - $9.99 in US",
        "For 70% royalty: file size under 3MB (or delivery fees apply)"
      ],
      "troubleshooting": {
        "70% royalty not available": "Ensure price is $2.99-$9.99 and book meets file size requirements.",
        "KDP Select greyed out": "Ensure book is not published elsewhere (must be exclusive to Amazon)."
      }
    },
    {
      "stepId": "preview-publish",
      "stepName": "Preview & Publish",
      "description": "Final review and publish book",
      "estimatedMinutes": 10,
      "dependencies": ["pricing-rights"],
      "substeps": [
        "Click ''Preview book'' to review final version",
        "Check cover, formatting, front matter, back matter",
        "Review all metadata one final time",
        "Agree to KDP Terms and Conditions",
        "Click ''Publish your Kindle eBook''",
        "Wait for review (typically 24-72 hours)"
      ],
      "requirements": [
        "All required fields completed",
        "Content passes automated quality checks",
        "Agreement to KDP Terms"
      ],
      "troubleshooting": {
        "Publish button disabled": "Check for red error messages in any section. All required fields must be completed.",
        "Book rejected after submission": "Review rejection email for specific issues (usually content quality or metadata)."
      }
    }
  ]',
  1,
  1
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_platform_docs_platform ON platform_docs(platform);
CREATE INDEX IF NOT EXISTS idx_platform_docs_type ON platform_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_platform_docs_version ON platform_docs(version DESC);
CREATE INDEX IF NOT EXISTS idx_platform_docs_hash ON platform_docs(content_hash);
CREATE INDEX IF NOT EXISTS idx_platform_docs_change ON platform_docs(change_detected);
CREATE INDEX IF NOT EXISTS idx_platform_docs_fetched ON platform_docs(fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_platform ON agent_knowledge(platform);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_type ON agent_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_current ON agent_knowledge(is_current);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_topic ON agent_knowledge(topic);

CREATE INDEX IF NOT EXISTS idx_workflows_platform ON workflows(platform);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_version ON workflows(version DESC);

CREATE INDEX IF NOT EXISTS idx_user_workflows_user ON user_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workflows_manuscript ON user_workflows(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_user_workflows_platform ON user_workflows(platform);
CREATE INDEX IF NOT EXISTS idx_user_workflows_status ON user_workflows(status);
CREATE INDEX IF NOT EXISTS idx_user_workflows_activity ON user_workflows(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_platform ON agent_conversations(platform);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_workflow ON agent_conversations(user_workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_created ON agent_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_fetch_log_platform ON doc_fetch_log(platform);
CREATE INDEX IF NOT EXISTS idx_doc_fetch_log_status ON doc_fetch_log(fetch_status);
CREATE INDEX IF NOT EXISTS idx_doc_fetch_log_started ON doc_fetch_log(fetch_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_notifications_user ON workflow_change_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_platform ON workflow_change_notifications(platform);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_sent ON workflow_change_notifications(notification_sent);
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_ack ON workflow_change_notifications(user_acknowledged);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS platform_docs_updated
AFTER UPDATE ON platform_docs
FOR EACH ROW
BEGIN
  UPDATE platform_docs SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_knowledge_updated
AFTER UPDATE ON agent_knowledge
FOR EACH ROW
BEGIN
  UPDATE agent_knowledge SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS workflows_updated
AFTER UPDATE ON workflows
FOR EACH ROW
BEGIN
  UPDATE workflows SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS user_workflows_updated
AFTER UPDATE ON user_workflows
FOR EACH ROW
BEGIN
  UPDATE user_workflows SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_config_updated
AFTER UPDATE ON agent_config
FOR EACH ROW
BEGIN
  UPDATE agent_config SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Views for Analytics

-- Active User Workflows Summary
CREATE VIEW IF NOT EXISTS active_workflows_summary AS
SELECT
  uw.platform,
  uw.status,
  COUNT(*) as workflow_count,
  AVG((unixepoch() - uw.started_at) / 86400.0) as avg_days_in_progress
FROM user_workflows uw
WHERE uw.status = 'in_progress'
GROUP BY uw.platform, uw.status;

-- Documentation Change Activity
CREATE VIEW IF NOT EXISTS doc_change_activity AS
SELECT
  pd.platform,
  pd.change_significance,
  COUNT(*) as change_count,
  MAX(pd.fetched_at) as last_change_detected
FROM platform_docs pd
WHERE pd.change_detected = 1
  AND pd.fetched_at >= unixepoch() - (30 * 86400) -- Last 30 days
GROUP BY pd.platform, pd.change_significance;

-- Agent Conversation Stats
CREATE VIEW IF NOT EXISTS agent_conversation_stats AS
SELECT
  ac.platform,
  ac.user_id,
  COUNT(*) as total_messages,
  COUNT(CASE WHEN ac.role = 'user' THEN 1 END) as user_messages,
  COUNT(CASE WHEN ac.role = 'assistant' THEN 1 END) as assistant_messages,
  SUM(ac.tokens_used) as total_tokens,
  SUM(ac.cost) as total_cost,
  MIN(ac.created_at) as first_interaction,
  MAX(ac.created_at) as last_interaction
FROM agent_conversations ac
GROUP BY ac.platform, ac.user_id;

-- Workflow Completion Rates
CREATE VIEW IF NOT EXISTS workflow_completion_rates AS
SELECT
  uw.platform,
  w.workflow_name,
  COUNT(*) as total_started,
  COUNT(CASE WHEN uw.status = 'completed' THEN 1 END) as completed_count,
  ROUND(
    CAST(COUNT(CASE WHEN uw.status = 'completed' THEN 1 END) AS REAL) / COUNT(*) * 100,
    2
  ) as completion_rate_percent,
  AVG(CASE WHEN uw.completed_at IS NOT NULL
    THEN (uw.completed_at - uw.started_at) / 86400.0
  END) as avg_days_to_complete
FROM user_workflows uw
JOIN workflows w ON uw.workflow_id = w.id
GROUP BY uw.platform, w.workflow_name;
