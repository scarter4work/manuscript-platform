-- Migration 021: Multi-Platform Export Packages (MAN-40, MAN-41, MAN-42)
-- Draft2Digital, IngramSpark, and Apple Books export package generation

-- =============================================================================
-- DRAFT2DIGITAL EXPORT PACKAGES (MAN-40)
-- =============================================================================

CREATE TABLE IF NOT EXISTS d2d_export_packages (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'generating' CHECK(status IN ('generating', 'ready', 'failed', 'expired')),

  -- Book metadata
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  keywords TEXT, -- JSON array
  categories TEXT, -- JSON array (BISAC)
  series_name TEXT,
  series_number INTEGER,

  -- File information
  has_manuscript INTEGER DEFAULT 0,
  has_cover INTEGER DEFAULT 0,
  manuscript_format TEXT, -- docx, epub
  cover_format TEXT, -- jpg

  -- Pricing by territory
  pricing_data TEXT, -- JSON object with territory-specific pricing

  -- Generation options
  format_options TEXT, -- JSON object

  -- Tracking
  download_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  generated_at INTEGER,
  expires_at INTEGER, -- 30 days after generation
  last_downloaded_at INTEGER,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_d2d_export_packages_manuscript ON d2d_export_packages(manuscript_id);
CREATE INDEX idx_d2d_export_packages_user ON d2d_export_packages(user_id);
CREATE INDEX idx_d2d_export_packages_status ON d2d_export_packages(status);
CREATE INDEX idx_d2d_export_packages_expires ON d2d_export_packages(expires_at);

-- =============================================================================
-- INGRAMSPARK EXPORT PACKAGES (MAN-41)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ingramspark_export_packages (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'generating' CHECK(status IN ('generating', 'ready', 'failed', 'expired')),

  -- Book metadata
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  keywords TEXT, -- JSON array
  categories TEXT, -- JSON array (BISAC)
  isbn TEXT,

  -- Print specifications
  trim_size TEXT NOT NULL, -- 6x9, 5.5x8.5, etc.
  page_count INTEGER NOT NULL,
  paper_type TEXT NOT NULL DEFAULT 'cream_60', -- white_60, cream_60, etc.
  binding_type TEXT DEFAULT 'paperback', -- paperback, hardcover
  color_interior INTEGER DEFAULT 0, -- 0 = black & white, 1 = color

  -- File information
  has_interior_pdf INTEGER DEFAULT 0,
  has_cover_pdf INTEGER DEFAULT 0,
  has_ebook_epub INTEGER DEFAULT 0,

  -- Distribution settings
  returnable INTEGER DEFAULT 0,
  discount_percentage INTEGER DEFAULT 55, -- Wholesale discount
  distribution_territories TEXT, -- JSON array of territory codes

  -- Spine calculation
  spine_width_inches REAL,
  spine_calculation_data TEXT, -- JSON with full calculation details

  -- Generation options
  format_options TEXT, -- JSON object

  -- Tracking
  download_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  generated_at INTEGER,
  expires_at INTEGER, -- 30 days after generation
  last_downloaded_at INTEGER,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_is_export_packages_manuscript ON ingramspark_export_packages(manuscript_id);
CREATE INDEX idx_is_export_packages_user ON ingramspark_export_packages(user_id);
CREATE INDEX idx_is_export_packages_status ON ingramspark_export_packages(status);
CREATE INDEX idx_is_export_packages_expires ON ingramspark_export_packages(expires_at);

-- =============================================================================
-- APPLE BOOKS EXPORT PACKAGES (MAN-42)
-- =============================================================================

CREATE TABLE IF NOT EXISTS apple_books_export_packages (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'generating' CHECK(status IN ('generating', 'ready', 'failed', 'expired')),

  -- Book metadata
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  keywords TEXT, -- JSON array
  categories TEXT, -- JSON array (Apple Books categories)
  series_name TEXT,
  series_number INTEGER,
  language TEXT DEFAULT 'en',

  -- File information
  has_epub INTEGER DEFAULT 0,
  has_cover INTEGER DEFAULT 0,
  epub_version TEXT DEFAULT '3.0', -- 2.0 or 3.0
  validation_status TEXT, -- passed, failed, not_validated
  validation_errors TEXT, -- JSON array of validation errors

  -- Apple-specific metadata
  age_rating TEXT,
  explicit_content INTEGER DEFAULT 0,

  -- Generation options
  format_options TEXT, -- JSON object

  -- Tracking
  download_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  generated_at INTEGER,
  expires_at INTEGER, -- 30 days after generation
  last_downloaded_at INTEGER,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_apple_export_packages_manuscript ON apple_books_export_packages(manuscript_id);
CREATE INDEX idx_apple_export_packages_user ON apple_books_export_packages(user_id);
CREATE INDEX idx_apple_export_packages_status ON apple_books_export_packages(status);
CREATE INDEX idx_apple_export_packages_expires ON apple_books_export_packages(expires_at);

-- =============================================================================
-- ANALYTICS VIEWS
-- =============================================================================

-- View: All export packages across platforms
CREATE VIEW IF NOT EXISTS v_all_export_packages AS
SELECT
  'draft2digital' as platform,
  id,
  manuscript_id,
  user_id,
  status,
  title,
  author,
  download_count,
  created_at,
  expires_at
FROM d2d_export_packages
UNION ALL
SELECT
  'ingramspark' as platform,
  id,
  manuscript_id,
  user_id,
  status,
  title,
  author,
  download_count,
  created_at,
  expires_at
FROM ingramspark_export_packages
UNION ALL
SELECT
  'apple_books' as platform,
  id,
  manuscript_id,
  user_id,
  status,
  title,
  author,
  download_count,
  created_at,
  expires_at
FROM apple_books_export_packages
UNION ALL
SELECT
  'kdp' as platform,
  id,
  manuscript_id,
  user_id,
  status,
  title,
  author,
  download_count,
  created_at,
  expires_at
FROM kdp_export_packages;

-- View: Export package statistics by platform
CREATE VIEW IF NOT EXISTS v_export_package_stats AS
SELECT
  platform,
  COUNT(*) as total_packages,
  SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_packages,
  SUM(CASE WHEN status = 'generating' THEN 1 ELSE 0 END) as generating_packages,
  SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_packages,
  SUM(download_count) as total_downloads,
  AVG(download_count) as avg_downloads_per_package
FROM v_all_export_packages
GROUP BY platform;

-- View: User export activity
CREATE VIEW IF NOT EXISTS v_user_export_activity AS
SELECT
  user_id,
  platform,
  COUNT(*) as packages_created,
  SUM(download_count) as total_downloads,
  MAX(created_at) as last_export_created
FROM v_all_export_packages
GROUP BY user_id, platform;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

INSERT INTO schema_version (version, description, applied_at)
VALUES (21, 'Multi-Platform Export Packages (Draft2Digital, IngramSpark, Apple Books)', unixepoch());
