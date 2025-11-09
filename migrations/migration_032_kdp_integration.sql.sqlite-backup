-- Migration 032: Amazon KDP Integration System
-- Enables semi-automated Amazon KDP publishing with pre-filled metadata and validation

-- KDP Packages Table
-- Tracks generated KDP submission packages (ZIP files)
CREATE TABLE IF NOT EXISTS kdp_packages (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  package_status TEXT NOT NULL DEFAULT 'pending' CHECK (package_status IN
    ('pending', 'generating', 'ready', 'failed', 'expired')),
  package_key TEXT, -- R2 key for the ZIP file
  package_size INTEGER,
  epub_key TEXT, -- R2 key for EPUB file
  cover_key TEXT, -- R2 key for cover image
  metadata_key TEXT, -- R2 key for metadata.txt
  instructions_key TEXT, -- R2 key for instructions.pdf
  validation_passed INTEGER DEFAULT 0,
  expiration_date INTEGER, -- Expires after 30 days
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- KDP Metadata Table
-- Stores Amazon KDP-specific metadata for each package
CREATE TABLE IF NOT EXISTS kdp_metadata (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,

  -- Book Details
  title TEXT NOT NULL,
  subtitle TEXT,
  series_name TEXT,
  series_number INTEGER,
  edition_number INTEGER DEFAULT 1,

  -- Author Information
  author_name TEXT NOT NULL,
  contributors TEXT, -- JSON array: [{name, role}]

  -- Description & Marketing
  description TEXT NOT NULL, -- Max 4000 characters
  description_length INTEGER,
  author_bio TEXT, -- Max 2500 characters

  -- Categories & Keywords
  primary_category TEXT,
  secondary_category TEXT,
  bisac_codes TEXT, -- JSON array of BISAC codes
  keywords TEXT NOT NULL, -- JSON array of 7 keyword phrases
  age_range_min INTEGER,
  age_range_max INTEGER,
  grade_level TEXT,

  -- Publishing Rights
  publishing_rights TEXT NOT NULL CHECK (publishing_rights IN
    ('worldwide', 'territories_included', 'territories_excluded')),
  territories TEXT, -- JSON array of territory codes
  isbn_type TEXT CHECK (isbn_type IN ('amazon_free', 'author_owned', 'none')),
  isbn TEXT,

  -- Publication Date
  publication_date INTEGER, -- Unix timestamp (or NULL for "publish immediately")

  -- Pricing & Distribution
  price_usd REAL,
  price_gbp REAL,
  price_eur REAL,
  price_cad REAL,
  price_aud REAL,
  royalty_option TEXT CHECK (royalty_option IN ('35', '70')),
  kdp_select_enrolled INTEGER DEFAULT 0, -- Exclusive to Amazon for 90 days
  enable_lending INTEGER DEFAULT 1,

  -- Format Information
  format_type TEXT CHECK (format_type IN ('ebook', 'paperback', 'hardcover')),
  trim_size TEXT, -- For print (e.g., "6x9")
  bleed_settings TEXT CHECK (bleed_settings IN ('no_bleed', 'bleed')),
  paper_color TEXT CHECK (paper_color IN ('white', 'cream')),

  -- Content Flags
  adult_content INTEGER DEFAULT 0,
  public_domain INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- KDP Validation Results Table
-- Tracks validation results for KDP packages
CREATE TABLE IF NOT EXISTS kdp_validation_results (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  validation_type TEXT NOT NULL CHECK (validation_type IN
    ('file_format', 'cover_specs', 'metadata', 'content', 'full_package')),
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
  issues TEXT, -- JSON array of validation issues
  recommendations TEXT, -- JSON array of recommendations
  validated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE
);

-- KDP Publishing Status Table
-- Tracks publishing attempts and status (for future automation)
CREATE TABLE IF NOT EXISTS kdp_publishing_status (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  publishing_method TEXT CHECK (publishing_method IN
    ('manual_guided', 'semi_automated', 'fully_automated')),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN
    ('preparing', 'uploading', 'in_review', 'live', 'failed', 'cancelled')),
  kdp_asin TEXT, -- Amazon Standard Identification Number (when live)
  kdp_url TEXT, -- URL to live book page
  error_message TEXT,
  published_at INTEGER, -- When it went live
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- KDP Royalty Calculations Table
-- Stores royalty estimates based on pricing
CREATE TABLE IF NOT EXISTS kdp_royalty_calculations (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  price_usd REAL NOT NULL,
  royalty_option TEXT NOT NULL CHECK (royalty_option IN ('35', '70')),

  -- Calculated Royalties
  royalty_per_sale_usd REAL,
  delivery_cost_usd REAL, -- For 70% royalty (based on file size)
  net_royalty_usd REAL,

  -- File size (affects delivery cost)
  file_size_mb REAL,

  -- Minimum price requirements
  minimum_price_35 REAL,
  maximum_price_35 REAL,
  minimum_price_70 REAL,
  maximum_price_70 REAL,

  -- Recommendation
  recommended_royalty TEXT,
  recommendation_reason TEXT,

  calculated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (package_id) REFERENCES kdp_packages(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kdp_packages_manuscript ON kdp_packages(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_user ON kdp_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_status ON kdp_packages(package_status);
CREATE INDEX IF NOT EXISTS idx_kdp_packages_created ON kdp_packages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdp_metadata_package ON kdp_metadata(package_id);
CREATE INDEX IF NOT EXISTS idx_kdp_metadata_manuscript ON kdp_metadata(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_kdp_metadata_isbn ON kdp_metadata(isbn);

CREATE INDEX IF NOT EXISTS idx_kdp_validation_package ON kdp_validation_results(package_id);
CREATE INDEX IF NOT EXISTS idx_kdp_validation_type ON kdp_validation_results(validation_type);

CREATE INDEX IF NOT EXISTS idx_kdp_publishing_package ON kdp_publishing_status(package_id);
CREATE INDEX IF NOT EXISTS idx_kdp_publishing_user ON kdp_publishing_status(user_id);
CREATE INDEX IF NOT EXISTS idx_kdp_publishing_status ON kdp_publishing_status(status);
CREATE INDEX IF NOT EXISTS idx_kdp_publishing_asin ON kdp_publishing_status(kdp_asin);

CREATE INDEX IF NOT EXISTS idx_kdp_royalty_package ON kdp_royalty_calculations(package_id);

-- Triggers for auto-update timestamps
CREATE TRIGGER IF NOT EXISTS kdp_packages_updated
AFTER UPDATE ON kdp_packages
FOR EACH ROW
BEGIN
  UPDATE kdp_packages SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS kdp_metadata_updated
AFTER UPDATE ON kdp_metadata
FOR EACH ROW
BEGIN
  UPDATE kdp_metadata SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS kdp_publishing_status_updated
AFTER UPDATE ON kdp_publishing_status
FOR EACH ROW
BEGIN
  UPDATE kdp_publishing_status SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- View: KDP Package Statistics
CREATE VIEW IF NOT EXISTS kdp_stats AS
SELECT
  COUNT(DISTINCT kp.id) as total_packages,
  COUNT(DISTINCT CASE WHEN kp.package_status = 'ready' THEN kp.id END) as ready_packages,
  COUNT(DISTINCT CASE WHEN kp.validation_passed = 1 THEN kp.id END) as validated_packages,
  COUNT(DISTINCT kps.id) as total_publishing_attempts,
  COUNT(DISTINCT CASE WHEN kps.status = 'live' THEN kps.id END) as live_books,
  AVG(CASE WHEN krc.royalty_option = '70' THEN krc.net_royalty_usd END) as avg_royalty_70,
  AVG(CASE WHEN krc.royalty_option = '35' THEN krc.net_royalty_usd END) as avg_royalty_35
FROM kdp_packages kp
LEFT JOIN kdp_publishing_status kps ON kp.id = kps.package_id
LEFT JOIN kdp_royalty_calculations krc ON kp.id = krc.package_id;
