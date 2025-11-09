-- ============================================================================
-- MIGRATION 013: Amazon KDP Export System
-- Created: 2025-10-31
-- Purpose: Track KDP export packages for manuscripts
-- Ticket: MAN-15
-- ============================================================================

-- ============================================================================
-- KDP EXPORT PACKAGES TABLE
-- Stores generated KDP export packages for download
-- ============================================================================
CREATE TABLE IF NOT EXISTS kdp_export_packages (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Package details
  status TEXT DEFAULT 'generating',       -- 'generating', 'ready', 'downloaded', 'expired'
  package_type TEXT DEFAULT 'standard',   -- 'standard', 'premium' (future: with EPUB)

  -- Metadata snapshot (for audit trail)
  title TEXT NOT NULL,
  author_name TEXT,
  description TEXT,
  keywords TEXT,                          -- JSON array
  categories TEXT,                        -- JSON array

  -- Files included
  has_manuscript INTEGER DEFAULT 1,       -- Boolean: manuscript file included
  has_cover INTEGER DEFAULT 0,            -- Boolean: cover image included
  has_metadata INTEGER DEFAULT 1,         -- Boolean: metadata file included

  -- Download tracking
  download_count INTEGER DEFAULT 0,
  first_downloaded_at INTEGER,            -- Unix timestamp
  last_downloaded_at INTEGER,             -- Unix timestamp

  -- Lifecycle
  created_at INTEGER NOT NULL,            -- Unix timestamp
  expires_at INTEGER,                     -- Unix timestamp (30 days from creation)

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kdp_packages_manuscript ON kdp_export_packages(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_user ON kdp_export_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_status ON kdp_export_packages(status);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_created ON kdp_export_packages(created_at DESC);

-- ============================================================================
-- KDP EXPORT ANALYTICS VIEW
-- Summary of KDP export usage by user
-- ============================================================================
CREATE VIEW IF NOT EXISTS kdp_export_analytics AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  COUNT(DISTINCT kep.id) as total_packages_generated,
  COUNT(DISTINCT CASE WHEN kep.download_count > 0 THEN kep.id END) as packages_downloaded,
  SUM(kep.download_count) as total_downloads,
  MAX(kep.created_at) as last_export_at,
  AVG(kep.download_count) as avg_downloads_per_package
FROM users u
LEFT JOIN kdp_export_packages kep ON u.id = kep.user_id
GROUP BY u.id, u.email, u.subscription_tier;

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================
INSERT INTO schema_version (version, applied_at, description)
VALUES (13, strftime('%s', 'now'), 'Migration 013: Amazon KDP Export System (MAN-15)');

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration adds KDP (Kindle Direct Publishing) export functionality:
--
-- 1. kdp_export_packages: Track generated export packages
--    - Links to manuscripts and users
--    - Stores metadata snapshot for audit trail
--    - Tracks download counts and lifecycle
--    - 30-day expiration for generated packages
--
-- 2. kdp_export_analytics: Usage analytics view
--    - Export activity by user
--    - Download statistics
--    - Subscription tier correlation
--
-- Export Package Contents:
-- - Original manuscript file (DOCX/PDF/TXT)
-- - Cover image (PNG, KDP-compliant)
-- - Metadata file (pre-filled KDP information)
-- - README instructions
--
-- Workflow:
-- 1. User clicks "Export for KDP" on analyzed manuscript
-- 2. System generates package with all files
-- 3. Package stored for 30 days
-- 4. User downloads files individually or as ZIP
-- 5. User manually uploads to kdp.amazon.com
--
-- Business Value:
-- - Streamlines KDP publishing workflow
-- - Pre-fills KDP metadata from AI analysis
-- - Provides professional export package
-- - Reduces friction in self-publishing
-- - Competitive advantage over manual workflows
--
-- Future Enhancements:
-- 1. Full ZIP file generation (requires library)
-- 2. EPUB generation from DOCX
-- 3. Automatic cover image resizing to KDP specs
-- 4. ISBN integration
-- 5. Multi-territory pricing recommendations
-- 6. KDP category suggestion optimization
-- 7. A/B testing for book descriptions
-- ============================================================================
