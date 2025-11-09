-- Migration 033: Market Analysis & Amazon Comp Title Research
-- Enables data-driven publishing decisions through Amazon marketplace analysis

-- Comp Titles Table
-- Stores Amazon comparable titles for analysis
CREATE TABLE IF NOT EXISTS comp_titles (
  id TEXT PRIMARY KEY,
  asin TEXT NOT NULL UNIQUE, -- Amazon Standard Identification Number

  -- Book Information
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  publication_date INTEGER, -- Unix timestamp

  -- Market Data
  price_usd REAL,
  price_currency TEXT DEFAULT 'USD',
  bestseller_rank INTEGER, -- Overall Amazon rank
  category_ranks TEXT, -- JSON array: [{category, rank}]

  -- Review Data
  review_count INTEGER DEFAULT 0,
  average_rating REAL, -- 1.0 to 5.0
  rating_distribution TEXT, -- JSON: {5: count, 4: count, ...}

  -- Metadata
  genre TEXT,
  categories TEXT, -- JSON array of Amazon categories
  keywords TEXT, -- JSON array of keywords (extracted or inferred)
  page_count INTEGER,
  format TEXT, -- 'Kindle Edition', 'Paperback', 'Hardcover', 'Audiobook'

  -- KDP Data (if available)
  kdp_select INTEGER DEFAULT 0,
  lending_enabled INTEGER DEFAULT 0,

  -- Scraping Metadata
  amazon_url TEXT,
  last_scraped_at INTEGER,
  scrape_source TEXT, -- 'manual', 'api', 'web_scrape'

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Market Analysis Reports Table
-- Stores generated market analysis reports for manuscripts
CREATE TABLE IF NOT EXISTS market_analysis_reports (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Analysis Parameters
  genre TEXT NOT NULL,
  search_keywords TEXT, -- JSON array of keywords used for search
  comp_titles_count INTEGER DEFAULT 0, -- Number of comp titles analyzed

  -- Pricing Analysis
  recommended_price_usd REAL,
  price_range_min REAL,
  price_range_max REAL,
  price_confidence_score REAL, -- 0.0 to 1.0
  price_reasoning TEXT,

  -- Category Recommendations
  recommended_categories TEXT, -- JSON array of up to 10 categories
  category_confidence_scores TEXT, -- JSON object: {category: score}

  -- Keyword Recommendations
  recommended_keywords TEXT, -- JSON array of 7 keyword phrases
  keyword_search_volumes TEXT, -- JSON object: {keyword: estimated_volume}
  keyword_competition_scores TEXT, -- JSON object: {keyword: competition_level}

  -- Market Positioning
  positioning_strategy TEXT, -- Strategic positioning recommendation
  target_audience_profile TEXT,
  competitive_advantages TEXT, -- JSON array of identified advantages
  market_gaps TEXT, -- JSON array of identified opportunities

  -- Market Trends
  market_saturation_level TEXT, -- 'low', 'medium', 'high'
  trend_direction TEXT, -- 'growing', 'stable', 'declining'
  seasonal_patterns TEXT, -- JSON object describing seasonal trends

  -- Report Metadata
  report_text TEXT, -- Full markdown report
  report_summary TEXT, -- Executive summary
  ai_cost REAL, -- Cost of Claude API calls

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'analyzing', 'completed', 'failed')),
  error_message TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Market Analysis Comp Titles Link Table
-- Links specific comp titles to analysis reports
CREATE TABLE IF NOT EXISTS analysis_comp_titles (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  comp_title_id TEXT NOT NULL,
  relevance_score REAL, -- 0.0 to 1.0, how relevant this comp is
  similarity_reasons TEXT, -- JSON array of why this comp was selected
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (analysis_id) REFERENCES market_analysis_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (comp_title_id) REFERENCES comp_titles(id) ON DELETE CASCADE,
  UNIQUE(analysis_id, comp_title_id)
);

-- Amazon Search Queries Table
-- Tracks search queries for comp title discovery
CREATE TABLE IF NOT EXISTS amazon_search_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  manuscript_id TEXT,

  -- Query Details
  query_text TEXT NOT NULL,
  genre TEXT,
  filters TEXT, -- JSON object: {format, price_range, rating_min, etc.}

  -- Results
  results_count INTEGER DEFAULT 0,
  comp_titles_found TEXT, -- JSON array of ASINs

  -- Metadata
  search_timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  search_source TEXT, -- 'manual', 'automatic', 'scheduled'

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Pricing Analysis Table
-- Stores detailed pricing analysis across genres
CREATE TABLE IF NOT EXISTS pricing_analysis (
  id TEXT PRIMARY KEY,
  genre TEXT NOT NULL,

  -- Price Distribution
  sample_size INTEGER NOT NULL, -- Number of books analyzed
  min_price REAL,
  max_price REAL,
  avg_price REAL,
  median_price REAL,
  mode_price REAL, -- Most common price point

  -- Price Ranges (percentiles)
  price_p25 REAL, -- 25th percentile
  price_p50 REAL, -- 50th percentile (median)
  price_p75 REAL, -- 75th percentile
  price_p90 REAL, -- 90th percentile

  -- Sweet Spots
  bestseller_avg_price REAL, -- Average price of top 100 bestsellers
  high_rated_avg_price REAL, -- Average price of 4.5+ rated books

  -- Format Breakdown
  kindle_avg_price REAL,
  paperback_avg_price REAL,
  hardcover_avg_price REAL,

  -- Metadata
  analyzed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  data_freshness TEXT, -- 'fresh' (< 7 days), 'stale' (> 7 days)

  UNIQUE(genre, analyzed_at)
);

-- Market Trends Table
-- Tracks market trends over time
CREATE TABLE IF NOT EXISTS market_trends (
  id TEXT PRIMARY KEY,
  genre TEXT NOT NULL,

  -- Trend Metrics
  trend_period TEXT, -- 'daily', 'weekly', 'monthly'
  period_start INTEGER NOT NULL, -- Unix timestamp
  period_end INTEGER NOT NULL,

  -- Volume Metrics
  new_releases_count INTEGER,
  bestseller_turnover_rate REAL, -- How often top 100 changes
  avg_review_velocity REAL, -- Reviews per day for recent releases

  -- Saturation Indicators
  competition_level TEXT, -- 'low', 'medium', 'high', 'saturated'
  barrier_to_entry TEXT, -- 'low', 'medium', 'high'

  -- Pricing Trends
  avg_price_change_pct REAL, -- % change from previous period

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comp_titles_asin ON comp_titles(asin);
CREATE INDEX IF NOT EXISTS idx_comp_titles_genre ON comp_titles(genre);
CREATE INDEX IF NOT EXISTS idx_comp_titles_rank ON comp_titles(bestseller_rank);
CREATE INDEX IF NOT EXISTS idx_comp_titles_price ON comp_titles(price_usd);
CREATE INDEX IF NOT EXISTS idx_comp_titles_rating ON comp_titles(average_rating);
CREATE INDEX IF NOT EXISTS idx_comp_titles_scraped ON comp_titles(last_scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_reports_manuscript ON market_analysis_reports(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_user ON market_analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_genre ON market_analysis_reports(genre);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_status ON market_analysis_reports(status);
CREATE INDEX IF NOT EXISTS idx_analysis_reports_created ON market_analysis_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_comp_analysis ON analysis_comp_titles(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_comp_title ON analysis_comp_titles(comp_title_id);
CREATE INDEX IF NOT EXISTS idx_analysis_comp_relevance ON analysis_comp_titles(relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_search_queries_user ON amazon_search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_manuscript ON amazon_search_queries(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_genre ON amazon_search_queries(genre);
CREATE INDEX IF NOT EXISTS idx_search_queries_timestamp ON amazon_search_queries(search_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_analysis_genre ON pricing_analysis(genre);
CREATE INDEX IF NOT EXISTS idx_pricing_analysis_analyzed ON pricing_analysis(analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_trends_genre ON market_trends(genre);
CREATE INDEX IF NOT EXISTS idx_market_trends_period ON market_trends(period_start DESC);

-- Triggers for auto-update timestamps
CREATE TRIGGER IF NOT EXISTS comp_titles_updated
AFTER UPDATE ON comp_titles
FOR EACH ROW
BEGIN
  UPDATE comp_titles SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS market_analysis_reports_updated
AFTER UPDATE ON market_analysis_reports
FOR EACH ROW
BEGIN
  UPDATE market_analysis_reports SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- View: Market Analysis Statistics
CREATE VIEW IF NOT EXISTS market_analysis_stats AS
SELECT
  COUNT(DISTINCT mar.id) as total_analyses,
  COUNT(DISTINCT mar.manuscript_id) as manuscripts_analyzed,
  COUNT(DISTINCT ct.id) as total_comp_titles,
  AVG(mar.comp_titles_count) as avg_comp_titles_per_analysis,
  AVG(mar.price_confidence_score) as avg_price_confidence,
  SUM(mar.ai_cost) as total_ai_cost,
  COUNT(DISTINCT CASE WHEN mar.status = 'completed' THEN mar.id END) as completed_analyses,
  COUNT(DISTINCT CASE WHEN mar.status = 'failed' THEN mar.id END) as failed_analyses
FROM market_analysis_reports mar
LEFT JOIN analysis_comp_titles act ON mar.id = act.analysis_id
LEFT JOIN comp_titles ct ON act.comp_title_id = ct.id;

-- View: Genre Pricing Summary
CREATE VIEW IF NOT EXISTS genre_pricing_summary AS
SELECT
  genre,
  COUNT(*) as book_count,
  MIN(price_usd) as min_price,
  MAX(price_usd) as max_price,
  AVG(price_usd) as avg_price,
  AVG(CASE WHEN bestseller_rank <= 100 THEN price_usd END) as bestseller_avg_price,
  AVG(CASE WHEN average_rating >= 4.5 THEN price_usd END) as high_rated_avg_price
FROM comp_titles
WHERE price_usd IS NOT NULL
GROUP BY genre;
