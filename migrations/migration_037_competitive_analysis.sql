-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- WARNING: SQLite triggers detected - requires manual conversion to PostgreSQL function + trigger syntax
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- Migration 037: Competitive Analysis & Market Positioning
-- Comp title analysis, author platform tracking, and marketing hooks generation

-- Drop existing tables and views if they exist (fresh start)
DROP VIEW IF EXISTS market_positioning_overview;
DROP VIEW IF EXISTS marketing_hooks_by_manuscript;
DROP VIEW IF EXISTS author_platform_summary;
DROP VIEW IF EXISTS comp_title_summary;

DROP TRIGGER IF EXISTS platform_scores_updated;
DROP TRIGGER IF EXISTS market_reports_updated;
DROP TRIGGER IF EXISTS bookstore_positioning_updated;
DROP TRIGGER IF EXISTS marketing_hooks_updated;
DROP TRIGGER IF EXISTS author_platform_updated;
DROP TRIGGER IF EXISTS comp_titles_updated;

DROP TABLE IF EXISTS author_platform_scores;
DROP TABLE IF EXISTS market_positioning_reports;
DROP TABLE IF EXISTS bookstore_positioning;
DROP TABLE IF EXISTS marketing_hooks;
DROP TABLE IF EXISTS author_platform;
DROP TABLE IF EXISTS comp_titles;

-- Comparable Titles Table
-- Track comp titles identified for each manuscript
CREATE TABLE IF NOT EXISTS comp_titles (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Comp Title Details
  comp_title TEXT NOT NULL,
  comp_author TEXT NOT NULL,
  comp_asin TEXT, -- Amazon ASIN
  comp_isbn TEXT,

  -- Similarity Analysis
  similarity_score DOUBLE PRECISION, -- 0.0-1.0 how similar to manuscript
  why_comparable TEXT, -- AI-generated explanation

  -- Market Data
  amazon_sales_rank INTEGER,
  amazon_category_rank INTEGER,
  amazon_category TEXT,
  price DOUBLE PRECISION,
  publication_date INTEGER, -- Unix timestamp
  page_count INTEGER,
  format TEXT, -- 'ebook', 'paperback', 'hardcover', 'audiobook'

  -- Review Data
  avg_rating DOUBLE PRECISION, -- 0.0-5.0
  review_count INTEGER,

  -- Marketing Analysis
  cover_style TEXT, -- AI analysis of cover design
  blurb_style TEXT, -- AI analysis of book description
  marketing_approach TEXT, -- How the book is marketed

  -- Data Source
  data_source TEXT DEFAULT 'manual' CHECK (data_source IN (
    'manual',       -- Manually added by user
    'ai_suggested', -- Suggested by Market Analysis Agent
    'amazon_api',   -- Fetched from Amazon API
    'goodreads'     -- Fetched from Goodreads
  )),

  -- Tracking
  last_updated BIGINT, -- Last time data was refreshed
  is_active INTEGER DEFAULT 1, -- Boolean: still tracking this comp?

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Author Platform Tracking
-- Track author's social media and platform presence
CREATE TABLE IF NOT EXISTS author_platform (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Platform Type
  platform_type TEXT NOT NULL CHECK (platform_type IN (
    'twitter',
    'facebook',
    'instagram',
    'tiktok',
    'youtube',
    'goodreads',
    'amazon_author_central',
    'website',
    'email_list',
    'podcast',
    'blog',
    'linkedin',
    'pinterest',
    'other'
  )),

  -- Platform Details
  platform_name TEXT, -- Custom name (e.g., "My Author Newsletter")
  url TEXT,
  username TEXT,

  -- Metrics
  follower_count INTEGER,
  subscriber_count INTEGER, -- For email lists, YouTube, podcasts
  engagement_rate DOUBLE PRECISION, -- Percentage (e.g., 0.05 for 5%)

  -- Verification
  verified INTEGER DEFAULT 0, -- Boolean: verified account?

  -- Activity
  post_frequency TEXT, -- 'daily', 'weekly', 'monthly', 'sporadic'
  last_post_date INTEGER,

  -- Monetization
  monetized INTEGER DEFAULT 0, -- Boolean: earning from this platform?
  monthly_revenue DOUBLE PRECISION,

  -- Status
  is_active INTEGER DEFAULT 1, -- Boolean: still using this platform?

  -- Tracking
  last_updated BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Marketing Hooks
-- AI-generated marketing hooks for manuscripts
CREATE TABLE IF NOT EXISTS marketing_hooks (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Hook Type
  hook_type TEXT NOT NULL CHECK (hook_type IN (
    'elevator_pitch',    -- 30-second pitch
    'logline',          -- One-sentence summary
    'tagline',          -- Short catchy phrase
    'unique_selling_proposition', -- What makes it unique
    'comparable_titles', -- "For fans of X meets Y"
    'hook_sentence',    -- Opening hook
    'back_cover_copy',  -- Back cover description
    'social_media_bio', -- Author bio for social media
    'press_release',    -- Media pitch angle
    'reader_promise'    -- What readers will get
  )),

  -- Hook Content
  hook_text TEXT NOT NULL,

  -- Effectiveness Metrics
  effectiveness_score DOUBLE PRECISION, -- 0.0-1.0 AI-predicted effectiveness
  target_audience TEXT, -- Who this hook targets

  -- Variations
  variation_number INTEGER DEFAULT 1, -- Multiple versions of same hook type

  -- Testing
  user_rating INTEGER, -- 1-5 stars, how much user likes it
  used_in_marketing INTEGER DEFAULT 0, -- Boolean: actually used?

  -- AI Metadata
  model_used TEXT,
  generated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Target Bookstore Shelf Analysis
-- AI analysis of where book would be shelved
CREATE TABLE IF NOT EXISTS bookstore_positioning (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Primary Shelf
  primary_category TEXT NOT NULL, -- Main genre/category
  primary_section TEXT, -- Physical section (e.g., "Fiction", "Mystery", "Thriller")

  -- Secondary Categories
  secondary_categories TEXT, -- JSON array of additional categories

  -- Shelf Placement
  placement_type TEXT CHECK (placement_type IN (
    'face_out',    -- Cover facing outward (premium placement)
    'spine_out',   -- Spine only visible (standard)
    'endcap',      -- End of aisle display
    'table',       -- Featured table
    'window'       -- Window display
  )),
  placement_probability DOUBLE PRECISION, -- 0.0-1.0 likelihood of face-out placement

  -- Physical Book Design Recommendations
  cover_design_notes TEXT, -- AI recommendations for physical cover
  trim_size_recommendation TEXT, -- Recommended book size
  spine_width_estimate DOUBLE PRECISION, -- Estimated spine width in inches

  -- Positioning Strategy
  positioning_strategy TEXT, -- How to position the book in market
  target_reader_profile TEXT, -- Who the ideal reader is

  -- Competitive Positioning
  differentiation_points TEXT, -- What makes it stand out on shelf

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Market Positioning Reports
-- Comprehensive market analysis reports
CREATE TABLE IF NOT EXISTS market_positioning_reports (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Report Metadata
  report_date BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  report_version INTEGER DEFAULT 1,

  -- Market Analysis
  genre_trends TEXT, -- Current trends in the genre
  market_saturation TEXT, -- How saturated is this market
  pricing_analysis TEXT, -- Pricing recommendations

  -- Competitive Landscape
  top_competitors TEXT, -- JSON array of top comp title IDs
  market_gap_analysis TEXT, -- Where there's opportunity

  -- Positioning Recommendations
  unique_angle TEXT, -- Recommended unique positioning
  target_demographics TEXT, -- JSON: age, gender, interests, etc.
  marketing_channels TEXT, -- Recommended marketing channels

  -- Platform Strategy
  platform_priorities TEXT, -- Which platforms to focus on
  launch_strategy TEXT, -- Recommended launch approach

  -- Financial Projections
  estimated_sales_rank INTEGER, -- Predicted Amazon rank
  estimated_monthly_sales INTEGER,
  estimated_monthly_revenue DOUBLE PRECISION,

  -- AI Metadata
  model_used TEXT,
  confidence_score DOUBLE PRECISION, -- 0.0-1.0 how confident the analysis is

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Author Platform Score
-- Aggregate score of author's platform strength
CREATE TABLE IF NOT EXISTS author_platform_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Overall Score
  overall_score INTEGER, -- 0-100 platform strength

  -- Category Scores
  social_media_score INTEGER, -- 0-100
  email_list_score INTEGER, -- 0-100
  website_traffic_score INTEGER, -- 0-100
  engagement_score INTEGER, -- 0-100
  authority_score INTEGER, -- 0-100 (media, speaking, etc.)

  -- Detailed Metrics
  total_followers INTEGER,
  total_subscribers INTEGER,
  avg_engagement_rate DOUBLE PRECISION,

  -- Monetization
  estimated_monthly_reach INTEGER,
  monetization_potential DOUBLE PRECISION, -- 0.0-1.0

  -- Recommendations
  improvement_areas TEXT, -- JSON array of areas to improve
  next_steps TEXT, -- Recommended actions

  -- Tracking
  score_date INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_comp_titles_manuscript ON comp_titles(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_comp_titles_user ON comp_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_titles_active ON comp_titles(is_active);
CREATE INDEX IF NOT EXISTS idx_comp_titles_similarity ON comp_titles(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_comp_titles_source ON comp_titles(data_source);

CREATE INDEX IF NOT EXISTS idx_author_platform_user ON author_platform(user_id);
CREATE INDEX IF NOT EXISTS idx_author_platform_type ON author_platform(platform_type);
CREATE INDEX IF NOT EXISTS idx_author_platform_active ON author_platform(is_active);
CREATE INDEX IF NOT EXISTS idx_author_platform_followers ON author_platform(follower_count DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_hooks_manuscript ON marketing_hooks(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_user ON marketing_hooks(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_type ON marketing_hooks(hook_type);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_effectiveness ON marketing_hooks(effectiveness_score DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_hooks_used ON marketing_hooks(used_in_marketing);

CREATE INDEX IF NOT EXISTS idx_bookstore_positioning_manuscript ON bookstore_positioning(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_bookstore_positioning_user ON bookstore_positioning(user_id);
CREATE INDEX IF NOT EXISTS idx_bookstore_positioning_category ON bookstore_positioning(primary_category);

CREATE INDEX IF NOT EXISTS idx_market_reports_manuscript ON market_positioning_reports(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_market_reports_user ON market_positioning_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_market_reports_date ON market_positioning_reports(report_date DESC);

CREATE INDEX IF NOT EXISTS idx_platform_scores_user ON author_platform_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_scores_overall ON author_platform_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_platform_scores_date ON author_platform_scores(score_date DESC);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS comp_titles_updated
AFTER UPDATE ON comp_titles
FOR EACH ROW
BEGIN
  UPDATE comp_titles SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS author_platform_updated
AFTER UPDATE ON author_platform
FOR EACH ROW
BEGIN
  UPDATE author_platform SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS marketing_hooks_updated
AFTER UPDATE ON marketing_hooks
FOR EACH ROW
BEGIN
  UPDATE marketing_hooks SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS bookstore_positioning_updated
AFTER UPDATE ON bookstore_positioning
FOR EACH ROW
BEGIN
  UPDATE bookstore_positioning SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS market_reports_updated
AFTER UPDATE ON market_positioning_reports
FOR EACH ROW
BEGIN
  UPDATE market_positioning_reports SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS platform_scores_updated
AFTER UPDATE ON author_platform_scores
FOR EACH ROW
BEGIN
  UPDATE author_platform_scores SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Views for Analytics

-- Comp Title Summary
CREATE OR REPLACE VIEW comp_title_summary AS
SELECT
  ct.manuscript_id,
  m.title as manuscript_title,
  COUNT(*) as total_comp_titles,
  AVG(ct.similarity_score) as avg_similarity,
  AVG(ct.price) as avg_comp_price,
  AVG(ct.avg_rating) as avg_comp_rating,
  MIN(ct.amazon_sales_rank) as best_comp_sales_rank,
  MAX(ct.review_count) as max_comp_reviews
FROM comp_titles ct
JOIN manuscripts m ON ct.manuscript_id = m.id
WHERE ct.is_active = 1
GROUP BY ct.manuscript_id, m.title;

-- Author Platform Summary
CREATE OR REPLACE VIEW author_platform_summary AS
SELECT
  ap.user_id,
  COUNT(*) as total_platforms,
  SUM(ap.follower_count) as total_followers,
  SUM(ap.subscriber_count) as total_subscribers,
  AVG(ap.engagement_rate) as avg_engagement,
  COUNT(CASE WHEN ap.verified = 1 THEN 1 END) as verified_platforms,
  COUNT(CASE WHEN ap.is_active = 1 THEN 1 END) as active_platforms
FROM author_platform ap
GROUP BY ap.user_id;

-- Marketing Hooks by Manuscript
CREATE OR REPLACE VIEW marketing_hooks_by_manuscript AS
SELECT
  mh.manuscript_id,
  m.title as manuscript_title,
  mh.hook_type,
  COUNT(*) as variation_count,
  AVG(mh.effectiveness_score) as avg_effectiveness,
  COUNT(CASE WHEN mh.used_in_marketing = 1 THEN 1 END) as used_count
FROM marketing_hooks mh
JOIN manuscripts m ON mh.manuscript_id = m.id
GROUP BY mh.manuscript_id, m.title, mh.hook_type;

-- Market Positioning Overview
CREATE OR REPLACE VIEW market_positioning_overview AS
SELECT
  m.id as manuscript_id,
  m.title,
  m.genre,
  ct_summary.total_comp_titles,
  ct_summary.avg_comp_price,
  bp.primary_category,
  bp.placement_probability,
  mpr.estimated_monthly_sales,
  mpr.confidence_score
FROM manuscripts m
LEFT JOIN comp_title_summary ct_summary ON m.id = ct_summary.manuscript_id
LEFT JOIN bookstore_positioning bp ON m.id = bp.manuscript_id
LEFT JOIN (
  SELECT manuscript_id, estimated_monthly_sales, confidence_score
  FROM market_positioning_reports
  WHERE (manuscript_id, report_date) IN (
    SELECT manuscript_id, MAX(report_date)
    FROM market_positioning_reports
    GROUP BY manuscript_id
  )
) mpr ON m.id = mpr.manuscript_id;
