-- ============================================================================
-- MIGRATION 009: Audiobook Production Support
-- Created: 2025-10-31
-- Purpose: Add tables for tracking audiobook asset generation and production
-- Ticket: MAN-18
-- ============================================================================

-- ============================================================================
-- AUDIOBOOK GENERATION JOBS TABLE
-- Tracks audiobook asset generation jobs (narration, pronunciation, timing, samples, metadata)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiobook_generations (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users (for cost tracking)
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, complete, failed
  asset_types TEXT NOT NULL,              -- JSON array: ["narration", "pronunciation", "timing", "samples", "metadata"] or ["all"]

  -- Generation metadata
  report_id TEXT,                         -- Short ID for status tracking (links to R2 status)
  r2_key_prefix TEXT NOT NULL,            -- R2 key prefix for manuscript (userId/manuscriptId/filename)

  -- Timing
  started_at INTEGER,                     -- Unix timestamp when generation started
  completed_at INTEGER,                   -- Unix timestamp when generation completed
  created_at INTEGER NOT NULL,            -- Unix timestamp when job was created

  -- Results summary
  narration_generated INTEGER DEFAULT 0,       -- Boolean: narration brief generated
  pronunciation_generated INTEGER DEFAULT 0,   -- Boolean: pronunciation guide generated
  timing_generated INTEGER DEFAULT 0,          -- Boolean: timing analysis generated
  samples_generated INTEGER DEFAULT 0,         -- Boolean: sample selections generated
  metadata_generated INTEGER DEFAULT 0,        -- Boolean: ACX metadata generated

  -- Cost tracking
  total_cost_usd REAL DEFAULT 0,          -- Total cost of this generation job
  narration_cost_usd REAL DEFAULT 0,      -- Cost of narration agent
  pronunciation_cost_usd REAL DEFAULT 0,  -- Cost of pronunciation agent
  timing_cost_usd REAL DEFAULT 0,         -- Cost of timing agent
  samples_cost_usd REAL DEFAULT 0,        -- Cost of samples agent
  metadata_cost_usd REAL DEFAULT 0,       -- Cost of metadata agent

  -- Error handling
  error_message TEXT,                     -- Error message if failed
  retry_count INTEGER DEFAULT 0,          -- Number of retries

  -- Audiobook metadata (extracted from results)
  estimated_runtime_minutes INTEGER,      -- Total audiobook runtime in minutes
  estimated_studio_hours REAL,            -- Estimated studio production time
  estimated_production_cost_usd REAL,     -- Estimated narrator/studio cost
  narrator_difficulty TEXT,               -- easy, moderate, challenging, expert

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for audiobook generation queries
CREATE INDEX IF NOT EXISTS idx_audiobook_gen_manuscript ON audiobook_generations(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_audiobook_gen_user ON audiobook_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_audiobook_gen_status ON audiobook_generations(status);
CREATE INDEX IF NOT EXISTS idx_audiobook_gen_created ON audiobook_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audiobook_gen_report ON audiobook_generations(report_id);

-- ============================================================================
-- AUDIOBOOK PRODUCTION TRACKING TABLE
-- Optional: Track actual audiobook production status (narrator, ACX submission, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audiobook_productions (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users
  generation_id TEXT,                     -- Foreign key to audiobook_generations

  -- Production status
  production_status TEXT DEFAULT 'planning', -- planning, in_production, mastering, submitted, published, archived

  -- Narrator information
  narrator_name TEXT,                     -- Name of narrator
  narrator_email TEXT,                    -- Contact for narrator
  narrator_cost_usd REAL,                 -- Actual cost paid to narrator
  narrator_contract_type TEXT,            -- PFH (per finished hour), flat rate, royalty share

  -- Production timeline
  production_started_at INTEGER,          -- Unix timestamp when production started
  production_completed_at INTEGER,        -- Unix timestamp when production completed
  acx_submitted_at INTEGER,               -- Unix timestamp when submitted to ACX
  acx_approved_at INTEGER,                -- Unix timestamp when approved by ACX
  published_at INTEGER,                   -- Unix timestamp when published

  -- ACX/Audible metadata
  acx_asin TEXT,                          -- Amazon ASIN for audiobook
  acx_status TEXT,                        -- submitted, in_review, approved, rejected, published
  acx_rejection_reason TEXT,              -- Reason if rejected
  distribution_exclusive INTEGER DEFAULT 1, -- Boolean: exclusive to Audible/ACX

  -- Audio files
  audio_file_r2_key TEXT,                 -- R2 key for final audio file
  audio_duration_seconds INTEGER,         -- Actual duration of audio
  audio_file_size_bytes INTEGER,          -- File size
  audio_format TEXT,                      -- MP3, M4B, etc.
  audio_bitrate TEXT,                     -- 192kbps, etc.

  -- Retail information
  retail_price_usd REAL,                  -- Retail price
  royalty_rate REAL,                      -- Royalty percentage (35% or 40% for ACX exclusive)
  units_sold INTEGER DEFAULT 0,           -- Number of audiobooks sold
  total_revenue_usd REAL DEFAULT 0,       -- Total revenue from sales

  -- Production notes
  production_notes TEXT,                  -- General production notes
  narrator_notes TEXT,                    -- Notes specific to narrator
  technical_notes TEXT,                   -- Technical audio notes

  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (generation_id) REFERENCES audiobook_generations(id) ON DELETE SET NULL
);

-- Indexes for audiobook production queries
CREATE INDEX IF NOT EXISTS idx_audiobook_prod_manuscript ON audiobook_productions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_audiobook_prod_user ON audiobook_productions(user_id);
CREATE INDEX IF NOT EXISTS idx_audiobook_prod_status ON audiobook_productions(production_status);
CREATE INDEX IF NOT EXISTS idx_audiobook_prod_acx_status ON audiobook_productions(acx_status);
CREATE INDEX IF NOT EXISTS idx_audiobook_prod_created ON audiobook_productions(created_at DESC);

-- ============================================================================
-- AUDIOBOOK ANALYSIS VIEWS
-- Pre-computed views for audiobook analytics
-- ============================================================================

-- View: Audiobook generation summary
CREATE VIEW IF NOT EXISTS audiobook_generation_summary AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT ag.manuscript_id) as manuscripts_with_audiobook,
  COUNT(*) as total_generations,
  SUM(CASE WHEN ag.status = 'complete' THEN 1 ELSE 0 END) as successful_generations,
  SUM(CASE WHEN ag.status = 'failed' THEN 1 ELSE 0 END) as failed_generations,
  SUM(ag.total_cost_usd) as total_audiobook_cost_usd,
  AVG(ag.estimated_runtime_minutes) as avg_audiobook_minutes,
  SUM(ag.estimated_runtime_minutes) as total_audiobook_minutes
FROM users u
LEFT JOIN audiobook_generations ag ON u.id = ag.user_id
WHERE ag.id IS NOT NULL
GROUP BY u.id, u.email, u.subscription_tier;

-- View: Audiobook production pipeline
CREATE VIEW IF NOT EXISTS audiobook_production_pipeline AS
SELECT
  m.id as manuscript_id,
  m.title,
  m.user_id,
  u.email as user_email,
  ag.status as generation_status,
  ag.estimated_runtime_minutes,
  ag.narrator_difficulty,
  ap.production_status,
  ap.narrator_name,
  ap.acx_status,
  ap.published_at,
  ap.units_sold,
  ap.total_revenue_usd,
  ag.created_at as generation_created_at,
  ap.production_started_at,
  ap.acx_submitted_at
FROM manuscripts m
JOIN audiobook_generations ag ON m.id = ag.manuscript_id
LEFT JOIN audiobook_productions ap ON m.id = ap.manuscript_id
JOIN users u ON m.user_id = u.id
WHERE ag.status = 'complete'
ORDER BY ag.created_at DESC;

-- View: Audiobook cost analysis (current month)
CREATE VIEW IF NOT EXISTS audiobook_costs_monthly AS
SELECT
  DATE(ag.created_at, 'unixepoch') as generation_date,
  COUNT(*) as generations_count,
  SUM(ag.narration_cost_usd) as narration_costs,
  SUM(ag.pronunciation_cost_usd) as pronunciation_costs,
  SUM(ag.timing_cost_usd) as timing_costs,
  SUM(ag.samples_cost_usd) as samples_costs,
  SUM(ag.metadata_cost_usd) as metadata_costs,
  SUM(ag.total_cost_usd) as total_costs,
  AVG(ag.total_cost_usd) as avg_cost_per_generation
FROM audiobook_generations ag
WHERE strftime('%Y-%m', ag.created_at, 'unixepoch') = strftime('%Y-%m', 'now')
  AND ag.status = 'complete'
GROUP BY DATE(ag.created_at, 'unixepoch')
ORDER BY generation_date DESC;

-- ============================================================================
-- ADD AUDIOBOOK FEATURE TO COST TRACKING
-- ============================================================================
-- Note: No schema changes needed to cost_tracking table.
-- Audiobook costs will use feature_name = 'audiobook_generation'
-- and operations like 'generate_narration_brief', 'generate_pronunciation_guide', etc.
-- This is already supported by the existing cost_tracking table structure.

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================
INSERT INTO schema_version (version, applied_at, description)
VALUES (9, strftime('%s', 'now'), 'Migration 009: Audiobook Production Support (MAN-18)');

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration adds audiobook production tracking capabilities:
--
-- 1. audiobook_generations: Tracks AI-generated audiobook assets
--    - Narration briefs, pronunciation guides, timing estimates
--    - Sample selections, ACX metadata
--    - Cost tracking per agent
--    - Links to R2 storage via r2_key_prefix
--
-- 2. audiobook_productions: Tracks actual audiobook production
--    - Narrator information and contracts
--    - Production timeline (planning → published)
--    - ACX/Audible submission and approval
--    - Sales and revenue tracking
--    - Audio file storage in R2
--
-- 3. Views: Pre-computed audiobook analytics
--    - Generation summary by user
--    - Production pipeline status
--    - Monthly cost analysis
--
-- Integration Points:
-- - Audiobook assets stored in R2 (not database)
-- - Cost tracking uses existing cost_tracking table
-- - Links to manuscripts and users tables
-- - Status tracking via report_id (stored in R2)
--
-- Business Value:
-- - Track audiobook feature adoption
-- - Monitor production pipeline from generation to publication
-- - Analyze costs and ROI for audiobook production
-- - Support narrator management and ACX submissions
-- - Revenue tracking for published audiobooks
--
-- Next Steps:
-- 1. Implement audiobook generation tracking in asset-generation-consumer.js
-- 2. Build audiobook production dashboard
-- 3. Add narrator portal for managing audiobook projects
-- 4. Implement ACX direct submission workflow (future enhancement)
-- ============================================================================
