-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- ============================================================================
-- MIGRATION 011: Multi-Platform Publishing Support
-- Created: 2025-10-31
-- Purpose: Add tables for multi-platform publishing tracking and metadata management
-- Ticket: MAN-20
-- ============================================================================

-- ============================================================================
-- PUBLISHING PROJECTS TABLE
-- Tracks publishing projects across multiple platforms
-- ============================================================================
CREATE TABLE IF NOT EXISTS publishing_projects (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Project metadata
  project_name TEXT NOT NULL,             -- E.g., "The Lost Key - Multi-Platform Launch"
  project_type TEXT NOT NULL,             -- wide_distribution, kdp_select, print_digital, international
  status TEXT DEFAULT 'planning',         -- planning, preparing, publishing, published, archived

  -- Target platforms (JSON array)
  target_platforms TEXT NOT NULL,         -- ["kdp", "draft2digital", "ingramspark", "google_play", "apple_books", "kobo"]

  -- Publishing timeline
  planned_launch_date INTEGER,            -- Unix timestamp
  actual_launch_date INTEGER,             -- Unix timestamp
  pre_order_start_date INTEGER,           -- Unix timestamp

  -- Metadata generation tracking
  platform_metadata_generated INTEGER DEFAULT 0,   -- Boolean
  format_preparation_completed INTEGER DEFAULT 0,  -- Boolean
  distribution_strategy_completed INTEGER DEFAULT 0, -- Boolean

  -- R2 storage references
  platform_metadata_r2_key TEXT,          -- Key for platform metadata in R2
  format_preparation_r2_key TEXT,         -- Key for format prep data in R2
  distribution_strategy_r2_key TEXT,      -- Key for distribution strategy in R2

  -- Cost tracking
  total_generation_cost_usd DOUBLE PRECISION DEFAULT 0,
  metadata_generation_cost_usd DOUBLE PRECISION DEFAULT 0,
  format_preparation_cost_usd DOUBLE PRECISION DEFAULT 0,
  strategy_generation_cost_usd DOUBLE PRECISION DEFAULT 0,

  -- Timestamps
  created_at BIGINT NOT NULL,            -- Unix timestamp
  updated_at BIGINT NOT NULL,            -- Unix timestamp

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publishing_projects_manuscript ON publishing_projects(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_publishing_projects_user ON publishing_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_projects_status ON publishing_projects(status);
CREATE INDEX IF NOT EXISTS idx_publishing_projects_launch_date ON publishing_projects(planned_launch_date);

-- ============================================================================
-- PLATFORM PUBLICATIONS TABLE
-- Tracks individual platform publications (Amazon, Google Play, Apple Books, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_publications (
  id TEXT PRIMARY KEY,                    -- UUID
  publishing_project_id TEXT NOT NULL,    -- Foreign key to publishing_projects
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Platform information
  platform TEXT NOT NULL,                 -- kdp, ingramspark, draft2digital, google_play, apple_books, kobo
  platform_identifier TEXT,               -- ASIN, ISBN, SKU, or platform-specific ID
  platform_url TEXT,                      -- Direct link to book on platform

  -- Publication status
  status TEXT DEFAULT 'pending',          -- pending, submitted, review, published, rejected, removed
  submitted_at INTEGER,                   -- Unix timestamp
  published_at INTEGER,                   -- Unix timestamp
  rejected_at INTEGER,                    -- Unix timestamp
  rejection_reason TEXT,                  -- Reason if rejected

  -- Platform-specific metadata (JSON)
  platform_metadata TEXT,                 -- Platform-specific metadata (categories, keywords, etc.)

  -- Pricing
  price_usd DOUBLE PRECISION,                         -- Price in USD
  royalty_rate DOUBLE PRECISION,                      -- Royalty percentage (0.35, 0.70, etc.)

  -- Performance tracking (updated separately)
  total_sales INTEGER DEFAULT 0,          -- Total units sold
  total_revenue_usd DOUBLE PRECISION DEFAULT 0,       -- Total revenue from this platform
  last_sale_date INTEGER,                 -- Unix timestamp of last sale

  -- Metadata
  created_at BIGINT NOT NULL,            -- Unix timestamp
  updated_at BIGINT NOT NULL,            -- Unix timestamp

  FOREIGN KEY (publishing_project_id) REFERENCES publishing_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_platform_publications_project ON platform_publications(publishing_project_id);
CREATE INDEX IF NOT EXISTS idx_platform_publications_manuscript ON platform_publications(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_platform_publications_user ON platform_publications(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_publications_platform ON platform_publications(platform);
CREATE INDEX IF NOT EXISTS idx_platform_publications_status ON platform_publications(status);
CREATE INDEX IF NOT EXISTS idx_platform_publications_identifier ON platform_publications(platform_identifier);

-- ============================================================================
-- FORMAT PREPARATIONS TABLE
-- Tracks format conversion and preparation (EPUB, MOBI, PDF, print)
-- ============================================================================
CREATE TABLE IF NOT EXISTS format_preparations (
  id TEXT PRIMARY KEY,                    -- UUID
  publishing_project_id TEXT NOT NULL,    -- Foreign key to publishing_projects
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Format information
  format_type TEXT NOT NULL,              -- epub, mobi, pdf, print
  status TEXT DEFAULT 'pending',          -- pending, preparing, ready, error

  -- Preparation details
  structure_analyzed INTEGER DEFAULT 0,   -- Boolean: structure analysis completed
  issues_detected TEXT,                   -- JSON array of issues found
  recommendations TEXT,                   -- JSON array of recommendations

  -- File information
  source_file_r2_key TEXT,                -- Original manuscript in R2
  prepared_file_r2_key TEXT,              -- Prepared file in R2 (if applicable)
  file_size_bytes INTEGER,                -- File size
  prepared_at INTEGER,                    -- Unix timestamp when prep completed

  -- Validation
  validation_passed INTEGER DEFAULT 0,    -- Boolean: passed validation checks
  validation_errors TEXT,                 -- JSON array of validation errors

  -- Cost tracking
  preparation_cost_usd DOUBLE PRECISION DEFAULT 0,    -- Cost of AI-assisted preparation

  -- Metadata
  created_at BIGINT NOT NULL,            -- Unix timestamp
  updated_at BIGINT NOT NULL,            -- Unix timestamp

  FOREIGN KEY (publishing_project_id) REFERENCES publishing_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_format_preparations_project ON format_preparations(publishing_project_id);
CREATE INDEX IF NOT EXISTS idx_format_preparations_manuscript ON format_preparations(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_format_preparations_format ON format_preparations(format_type);
CREATE INDEX IF NOT EXISTS idx_format_preparations_status ON format_preparations(status);

-- ============================================================================
-- DISTRIBUTION STRATEGIES TABLE
-- Stores generated distribution strategies
-- ============================================================================
CREATE TABLE IF NOT EXISTS distribution_strategies (
  id TEXT PRIMARY KEY,                    -- UUID
  publishing_project_id TEXT NOT NULL,    -- Foreign key to publishing_projects
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Strategy details
  strategy_type TEXT NOT NULL,            -- wide, kdp_select, hybrid, international
  distribution_approach TEXT NOT NULL,    -- Recommended approach (JSON)
  platform_recommendations TEXT NOT NULL, -- Platform strategy (JSON array)
  pricing_strategy TEXT NOT NULL,         -- Pricing recommendations (JSON)
  release_strategy TEXT NOT NULL,         -- Release and launch strategy (JSON)

  -- Projections
  conservative_projection TEXT,           -- Conservative revenue projection (JSON)
  moderate_projection TEXT,               -- Moderate revenue projection (JSON)
  optimistic_projection TEXT,             -- Optimistic revenue projection (JSON)

  -- Implementation
  action_plan TEXT,                       -- Step-by-step action plan (JSON)
  tools_recommended TEXT,                 -- Recommended tools and services (JSON)
  estimated_setup_cost_usd DOUBLE PRECISION,          -- Estimated cost to implement

  -- R2 storage
  r2_storage_key TEXT,                    -- Full strategy document in R2

  -- Cost tracking
  generation_cost_usd DOUBLE PRECISION DEFAULT 0,     -- Cost of AI generation

  -- Metadata
  generated_at BIGINT NOT NULL,          -- Unix timestamp
  implemented INTEGER DEFAULT 0,          -- Boolean: strategy has been implemented

  FOREIGN KEY (publishing_project_id) REFERENCES publishing_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_distribution_strategies_project ON distribution_strategies(publishing_project_id);
CREATE INDEX IF NOT EXISTS idx_distribution_strategies_manuscript ON distribution_strategies(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_distribution_strategies_user ON distribution_strategies(user_id);

-- ============================================================================
-- PUBLISHING ANALYTICS VIEWS
-- Pre-computed views for publishing analytics
-- ============================================================================

-- View: Publishing projects summary
CREATE OR REPLACE VIEW publishing_projects_summary AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT pp.id) as total_projects,
  COUNT(DISTINCT CASE WHEN pp.status = 'published' THEN pp.id END) as published_projects,
  COUNT(DISTINCT CASE WHEN pp.status = 'planning' THEN pp.id END) as planning_projects,
  COUNT(DISTINCT plat.id) as total_platform_publications,
  COUNT(DISTINCT CASE WHEN plat.status = 'published' THEN plat.id END) as published_platforms,
  SUM(pp.total_generation_cost_usd) as total_publishing_costs,
  SUM(plat.total_revenue_usd) as total_publishing_revenue
FROM users u
LEFT JOIN publishing_projects pp ON u.id = pp.user_id
LEFT JOIN platform_publications plat ON pp.id = plat.publishing_project_id
GROUP BY u.id, u.email, u.subscription_tier;

-- View: Platform performance comparison
CREATE OR REPLACE VIEW platform_performance AS
SELECT
  platform,
  COUNT(*) as total_publications,
  COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
  AVG(price_usd) as avg_price,
  AVG(royalty_rate) as avg_royalty_rate,
  SUM(total_sales) as total_sales,
  SUM(total_revenue_usd) as total_revenue,
  AVG(total_sales) as avg_sales_per_book
FROM platform_publications
WHERE status = 'published'
GROUP BY platform
ORDER BY total_revenue DESC;

-- View: Recent publishing activity
CREATE OR REPLACE VIEW recent_publishing_activity AS
SELECT
  pp.id as project_id,
  pp.project_name,
  m.title as manuscript_title,
  u.email as user_email,
  pp.project_type,
  pp.status as project_status,
  pp.planned_launch_date,
  COUNT(plat.id) as platform_count,
  COUNT(CASE WHEN plat.status = 'published' THEN 1 END) as published_platform_count,
  pp.created_at
FROM publishing_projects pp
JOIN manuscripts m ON pp.manuscript_id = m.id
JOIN users u ON pp.user_id = u.id
LEFT JOIN platform_publications plat ON pp.id = plat.publishing_project_id
GROUP BY pp.id, pp.project_name, m.title, u.email, pp.project_type, pp.status, pp.planned_launch_date, pp.created_at
ORDER BY pp.created_at DESC
LIMIT 100;

-- ============================================================================
-- ADD PUBLISHING FEATURE TO COST TRACKING
-- ============================================================================
-- Note: No schema changes needed to cost_tracking table.
-- Publishing costs will use feature_name = 'publishing'
-- and operations like 'generate_platform_metadata', 'prepare_formats', 'generate_strategy'

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================
INSERT INTO schema_version (version, applied_at, description)
VALUES (11, strftime('%s', 'now'), 'Migration 011: Multi-Platform Publishing Support (MAN-20)');

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration adds multi-platform publishing support:
--
-- 1. publishing_projects: Tracks overall publishing projects
--    - Multi-platform launch coordination
--    - Tracks metadata generation, format prep, strategy
--    - Links to R2 storage for detailed assets
--    - Cost tracking per project component
--
-- 2. platform_publications: Individual platform publications
--    - Amazon KDP, IngramSpark, Draft2Digital, etc.
--    - Platform-specific metadata and identifiers
--    - Status tracking (pending → published)
--    - Revenue and sales tracking per platform
--
-- 3. format_preparations: Format conversion tracking
--    - EPUB, MOBI, PDF, print preparation
--    - Structure analysis and issue detection
--    - Validation and quality checks
--    - Prepared files stored in R2
--
-- 4. distribution_strategies: AI-generated strategies
--    - Platform selection recommendations
--    - Pricing and launch strategies
--    - Revenue projections
--    - Implementation action plans
--
-- 5. Views: Pre-computed analytics
--    - Publishing projects summary by user
--    - Platform performance comparison
--    - Recent publishing activity feed
--
-- Integration Points:
-- - Links to manuscripts and users tables
-- - Uses existing cost_tracking table
-- - R2 storage for detailed documents
-- - Platform-specific metadata in JSON fields
--
-- Business Value:
-- - Streamlines multi-platform publishing
-- - AI-powered metadata generation per platform
-- - Comprehensive distribution strategies
-- - Revenue tracking across platforms
-- - Format preparation and validation
-- - Launch coordination and timeline management
--
-- Future Enhancements:
-- 1. Direct API integration with platforms
-- 2. Automated metadata upload to platforms
-- 3. DOUBLE PRECISION-time sales data synchronization
-- 4. Advanced revenue analytics and reporting
-- 5. Collaborative publishing for team members
-- 6. ISBN management and tracking
-- 7. Print-on-demand integration
-- 8. Translation and international rights management
-- ============================================================================
