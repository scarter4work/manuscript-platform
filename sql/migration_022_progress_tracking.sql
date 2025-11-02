-- Migration 022: Progress Tracking Dashboard
-- Tracks publication progress across multiple platforms with per-platform checklists

-- Platform-specific progress tracking for each manuscript
CREATE TABLE IF NOT EXISTS manuscript_publishing_progress (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'kdp', 'draft2digital', 'ingramspark', 'apple_books'
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, uploaded, live
  overall_completion_percentage INTEGER DEFAULT 0, -- 0-100
  estimated_time_to_completion INTEGER, -- minutes
  next_action_recommendation TEXT,
  started_at INTEGER, -- Unix timestamp
  uploaded_at INTEGER, -- Unix timestamp when files uploaded to platform
  published_at INTEGER, -- Unix timestamp when went live
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  UNIQUE(manuscript_id, platform)
);

-- Individual checklist items per platform
CREATE TABLE IF NOT EXISTS progress_checklist_items (
  id TEXT PRIMARY KEY,
  progress_id TEXT NOT NULL, -- Links to manuscript_publishing_progress.id
  item_key TEXT NOT NULL, -- e.g., 'account_created', 'tax_info_submitted', 'book_details_title'
  item_label TEXT NOT NULL, -- Display label: "Account created", "Tax information submitted"
  item_category TEXT, -- Optional grouping: 'setup', 'book_details', 'files', 'publishing'
  is_completed INTEGER DEFAULT 0, -- 0 or 1
  completed_at INTEGER, -- Unix timestamp
  completion_notes TEXT, -- Optional notes when item is completed
  sort_order INTEGER DEFAULT 0, -- For displaying in correct order
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (progress_id) REFERENCES manuscript_publishing_progress(id) ON DELETE CASCADE,
  UNIQUE(progress_id, item_key)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_progress_manuscript ON manuscript_publishing_progress(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_progress_platform ON manuscript_publishing_progress(platform);
CREATE INDEX IF NOT EXISTS idx_progress_status ON manuscript_publishing_progress(status);
CREATE INDEX IF NOT EXISTS idx_checklist_progress ON progress_checklist_items(progress_id);
CREATE INDEX IF NOT EXISTS idx_checklist_completed ON progress_checklist_items(is_completed);

-- Sample checklist items structure (to be populated by backend)
-- Checklist items will be initialized when a manuscript starts publishing to a platform:
--
-- Setup:
--   - account_created: "Account created"
--   - tax_info_submitted: "Tax information submitted"
--   - payment_method_added: "Payment method added"
--
-- Book Details:
--   - book_details_title: "Title & subtitle"
--   - book_details_author: "Author name"
--   - book_details_description: "Description"
--   - book_details_categories: "Categories selected"
--   - book_details_keywords: "Keywords entered"
--
-- Files:
--   - files_manuscript: "Manuscript uploaded"
--   - files_cover: "Cover image uploaded"
--
-- Publishing:
--   - pricing_set: "Pricing set"
--   - rights_territories: "Rights & territories confirmed"
--   - preview_reviewed: "Preview reviewed"
--   - published: "Published!"
