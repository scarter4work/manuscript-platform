-- ============================================================================
-- MIGRATION 010: Review Monitoring & Management System
-- Created: 2025-10-31
-- Purpose: Add tables for review monitoring, sentiment analysis, and response management
-- Ticket: MAN-19
-- ============================================================================

-- ============================================================================
-- REVIEW MONITORING CONFIGURATION TABLE
-- Tracks automated review monitoring settings for each book
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_monitoring (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Book identification
  book_identifier TEXT NOT NULL,          -- ASIN, ISBN, or other platform identifier

  -- Monitoring configuration
  platforms TEXT NOT NULL,                -- JSON array: ["amazon", "goodreads", "bookbub"]
  check_frequency TEXT DEFAULT 'daily',   -- daily, weekly, monthly
  is_active INTEGER DEFAULT 1,            -- Boolean: monitoring enabled

  -- Alert settings
  alert_on_new_review INTEGER DEFAULT 1,      -- Boolean: alert when new review appears
  alert_on_negative_review INTEGER DEFAULT 1, -- Boolean: alert for negative reviews
  minimum_rating_for_alert INTEGER DEFAULT 3, -- Alert if rating <= this value

  -- Scheduling
  last_checked INTEGER,                   -- Unix timestamp of last review fetch
  next_check_scheduled INTEGER,           -- Unix timestamp for next scheduled check

  -- Metadata
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_monitoring_manuscript ON review_monitoring(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_review_monitoring_user ON review_monitoring(user_id);
CREATE INDEX IF NOT EXISTS idx_review_monitoring_next_check ON review_monitoring(next_check_scheduled);
CREATE INDEX IF NOT EXISTS idx_review_monitoring_active ON review_monitoring(is_active);

-- ============================================================================
-- REVIEWS TABLE
-- Stores individual reviews fetched from various platforms
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,                    -- UUID or platform-specific review ID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users (manuscript owner)

  -- Platform information
  platform TEXT NOT NULL,                 -- amazon, goodreads, bookbub
  platform_review_id TEXT,                -- Original review ID from platform
  review_url TEXT,                        -- URL to the review

  -- Reviewer information
  reviewer_name TEXT,                     -- Reviewer's name
  reviewer_verified INTEGER DEFAULT 0,    -- Boolean: verified reviewer on platform
  verified_purchase INTEGER DEFAULT 0,    -- Boolean: verified purchase (Amazon)

  -- Review content
  rating INTEGER NOT NULL,                -- Star rating (1-5)
  review_title TEXT,                      -- Review headline/title
  review_text TEXT NOT NULL,              -- Full review text
  review_date INTEGER NOT NULL,           -- Unix timestamp when review was posted

  -- Engagement metrics
  helpful_votes INTEGER DEFAULT 0,        -- Number of "helpful" votes
  total_votes INTEGER DEFAULT 0,          -- Total votes (helpful + not helpful)

  -- Sentiment analysis (filled by ReviewSentimentAgent)
  sentiment TEXT,                         -- positive, negative, neutral, mixed
  sentiment_score REAL,                   -- -1 to +1 sentiment score
  themes TEXT,                            -- JSON array of themes mentioned
  praises TEXT,                           -- JSON array of specific praises
  criticisms TEXT,                        -- JSON array of specific criticisms

  -- Response management
  needs_attention INTEGER DEFAULT 0,      -- Boolean: flagged for author attention
  needs_response INTEGER DEFAULT 0,       -- Boolean: should consider responding
  response_priority TEXT,                 -- none, low, medium, high
  reason_for_attention TEXT,              -- Why this review needs attention
  suspicious_fake INTEGER DEFAULT 0,      -- Boolean: flagged as potentially fake
  quotable_excerpts TEXT,                 -- JSON array of quotable positive excerpts

  -- Response tracking
  responded INTEGER DEFAULT 0,            -- Boolean: author has responded
  response_text TEXT,                     -- Author's response text
  responded_at INTEGER,                   -- Unix timestamp when response was posted

  -- Images and media
  images TEXT,                            -- JSON array of image URLs (if any)

  -- Metadata
  fetched_at INTEGER NOT NULL,            -- Unix timestamp when review was fetched
  updated_at INTEGER NOT NULL,            -- Unix timestamp of last update

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_manuscript ON reviews(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX IF NOT EXISTS idx_reviews_needs_response ON reviews(needs_response);
CREATE INDEX IF NOT EXISTS idx_reviews_needs_attention ON reviews(needs_attention);
CREATE INDEX IF NOT EXISTS idx_reviews_platform_id ON reviews(platform_review_id);

-- ============================================================================
-- REVIEW SENTIMENT ANALYSES TABLE
-- Stores aggregate sentiment analysis results
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_sentiment_analyses (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Analysis metadata
  total_reviews_analyzed INTEGER NOT NULL,
  analyzed_at INTEGER NOT NULL,           -- Unix timestamp

  -- Sentiment metrics
  average_sentiment_score REAL,           -- Average sentiment score (-1 to +1)
  sentiment_distribution TEXT NOT NULL,   -- JSON: { positive: N, neutral: N, negative: N, mixed: N }

  -- Theme analysis
  common_themes TEXT,                     -- JSON: { praises: [...], criticisms: [...] }

  -- Action items
  reviews_needing_attention TEXT,         -- JSON array of review IDs
  reviews_needing_response TEXT,          -- JSON array of { reviewId, priority, reason }
  promotional_quotes TEXT,                -- JSON array of quotable excerpts
  improvement_opportunities TEXT,         -- JSON array of improvement suggestions
  red_flags TEXT,                         -- JSON array of concerning patterns
  suspicious_reviews TEXT,                -- JSON array of review IDs flagged as fake

  -- R2 storage reference
  r2_storage_key TEXT,                    -- Key in R2 where full analysis is stored

  -- Cost tracking
  analysis_cost_usd REAL DEFAULT 0,       -- Cost of Claude API calls

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_manuscript ON review_sentiment_analyses(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_user ON review_sentiment_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_date ON review_sentiment_analyses(analyzed_at DESC);

-- ============================================================================
-- REVIEW TREND ANALYSES TABLE
-- Stores temporal trend analysis results
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_trend_analyses (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Analysis metadata
  total_reviews_analyzed INTEGER NOT NULL,
  date_range_start INTEGER,               -- Unix timestamp of earliest review
  date_range_end INTEGER,                 -- Unix timestamp of latest review
  analyzed_at INTEGER NOT NULL,           -- Unix timestamp

  -- Trend metrics
  overall_trend TEXT,                     -- improving, stable, declining
  sentiment_trajectory TEXT,              -- Description of sentiment changes
  rating_trend TEXT,                      -- ratings trending up/down/stable
  review_velocity TEXT,                   -- Reviews per week/month

  -- Anomaly detection
  anomaly_risk_level TEXT DEFAULT 'low',  -- low, medium, high
  suspicious_patterns TEXT,               -- JSON array of detected patterns
  review_bombing_detected INTEGER DEFAULT 0, -- Boolean

  -- Platform comparison
  platform_comparison TEXT,               -- JSON: comparison across platforms

  -- Predictions
  predicted_trajectory TEXT,              -- Future sentiment prediction
  confidence_level TEXT,                  -- low, medium, high

  -- R2 storage reference
  r2_storage_key TEXT,                    -- Key in R2 where full analysis is stored

  -- Cost tracking
  analysis_cost_usd REAL DEFAULT 0,       -- Cost of Claude API calls

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trend_analyses_manuscript ON review_trend_analyses(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_trend_analyses_user ON review_trend_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_trend_analyses_date ON review_trend_analyses(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_analyses_risk ON review_trend_analyses(anomaly_risk_level);

-- ============================================================================
-- REVIEW RESPONSES TABLE
-- Stores AI-generated response suggestions
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_responses (
  id TEXT PRIMARY KEY,                    -- UUID
  review_id TEXT NOT NULL,                -- Foreign key to reviews
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Response recommendation
  should_respond INTEGER,                 -- Boolean: whether to respond
  response_recommendation TEXT,           -- respond, skip, monitor
  rationale TEXT,                         -- Why responding/not responding
  risk_level TEXT,                        -- low, medium, high
  risk_factors TEXT,                      -- JSON array of risks

  -- Response suggestions
  response_suggestions TEXT NOT NULL,     -- JSON array of suggested responses
  do_not_say TEXT,                        -- JSON array of things to avoid
  key_points_to_address TEXT,             -- JSON array of key points

  -- Timing
  timing_recommendation TEXT,             -- When to post response
  timing_reasoning TEXT,                  -- Why this timing

  -- Alternative actions
  alternative_actions TEXT,               -- JSON array of alternative approaches

  -- Usage tracking
  response_used INTEGER DEFAULT 0,        -- Boolean: did author use a suggestion
  which_suggestion_index INTEGER,         -- Which suggestion was used (0-based)
  modified_before_use INTEGER DEFAULT 0,  -- Boolean: did author modify it

  -- R2 storage reference
  r2_storage_key TEXT,                    -- Key in R2 where full response data is stored

  -- Metadata
  generated_at INTEGER NOT NULL,          -- Unix timestamp
  used_at INTEGER,                        -- Unix timestamp when response was posted

  -- Cost tracking
  generation_cost_usd REAL DEFAULT 0,     -- Cost of Claude API call

  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_manuscript ON review_responses(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_user ON review_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_generated ON review_responses(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_responses_used ON review_responses(response_used);

-- ============================================================================
-- REVIEW MONITORING JOBS TABLE
-- Tracks background jobs for review fetching
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_monitoring_jobs (
  id TEXT PRIMARY KEY,                    -- Job ID (UUID)
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  user_id TEXT NOT NULL,                  -- Foreign key to users

  -- Job configuration
  job_type TEXT NOT NULL,                 -- fetch_reviews, analyze_sentiment, analyze_trends, generate_responses
  platforms TEXT,                         -- JSON array of platforms to fetch from
  book_identifier TEXT,                   -- ASIN/ISBN

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, complete, failed
  started_at INTEGER,                     -- Unix timestamp
  completed_at INTEGER,                   -- Unix timestamp
  created_at INTEGER NOT NULL,            -- Unix timestamp

  -- Results
  reviews_fetched INTEGER DEFAULT 0,      -- Number of reviews fetched
  new_reviews_count INTEGER DEFAULT 0,    -- Number of NEW reviews (not duplicates)
  error_message TEXT,                     -- Error if failed

  -- Cost tracking
  total_cost_usd REAL DEFAULT 0,          -- Total cost of job

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_manuscript ON review_monitoring_jobs(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_user ON review_monitoring_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_status ON review_monitoring_jobs(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_created ON review_monitoring_jobs(created_at DESC);

-- ============================================================================
-- REVIEW ANALYTICS VIEWS
-- Pre-computed views for review analytics
-- ============================================================================

-- View: Review statistics by manuscript
CREATE VIEW IF NOT EXISTS review_statistics_by_manuscript AS
SELECT
  m.id as manuscript_id,
  m.title,
  m.user_id,
  u.email as user_email,
  COUNT(r.id) as total_reviews,
  AVG(r.rating) as average_rating,
  SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) as five_star_count,
  SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) as four_star_count,
  SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) as three_star_count,
  SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) as two_star_count,
  SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) as one_star_count,
  SUM(CASE WHEN r.sentiment = 'positive' THEN 1 ELSE 0 END) as positive_reviews,
  SUM(CASE WHEN r.sentiment = 'negative' THEN 1 ELSE 0 END) as negative_reviews,
  SUM(CASE WHEN r.sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral_reviews,
  SUM(CASE WHEN r.needs_response = 1 THEN 1 ELSE 0 END) as reviews_needing_response,
  SUM(CASE WHEN r.needs_attention = 1 THEN 1 ELSE 0 END) as reviews_needing_attention,
  MAX(r.review_date) as latest_review_date,
  MIN(r.review_date) as earliest_review_date
FROM manuscripts m
JOIN users u ON m.user_id = u.id
LEFT JOIN reviews r ON m.id = r.manuscript_id
GROUP BY m.id, m.title, m.user_id, u.email;

-- View: Review monitoring health
CREATE VIEW IF NOT EXISTS review_monitoring_health AS
SELECT
  rm.manuscript_id,
  m.title,
  rm.user_id,
  rm.book_identifier,
  rm.is_active,
  rm.check_frequency,
  rm.last_checked,
  rm.next_check_scheduled,
  (rm.next_check_scheduled < strftime('%s', 'now')) as overdue,
  COUNT(r.id) as total_reviews,
  COUNT(CASE WHEN r.fetched_at > rm.last_checked THEN 1 END) as new_reviews_since_last_check
FROM review_monitoring rm
JOIN manuscripts m ON rm.manuscript_id = m.id
LEFT JOIN reviews r ON rm.manuscript_id = r.manuscript_id
GROUP BY rm.manuscript_id, m.title, rm.user_id, rm.book_identifier,
         rm.is_active, rm.check_frequency, rm.last_checked, rm.next_check_scheduled;

-- View: Monthly review monitoring costs
CREATE VIEW IF NOT EXISTS review_monitoring_costs_monthly AS
SELECT
  DATE(rsa.analyzed_at, 'unixepoch') as analysis_date,
  COUNT(DISTINCT rsa.manuscript_id) as manuscripts_analyzed,
  COUNT(*) as total_sentiment_analyses,
  SUM(rsa.analysis_cost_usd) as sentiment_analysis_costs,
  (SELECT SUM(rta.analysis_cost_usd)
   FROM review_trend_analyses rta
   WHERE DATE(rta.analyzed_at, 'unixepoch') = DATE(rsa.analyzed_at, 'unixepoch')) as trend_analysis_costs,
  (SELECT SUM(rr.generation_cost_usd)
   FROM review_responses rr
   WHERE DATE(rr.generated_at, 'unixepoch') = DATE(rsa.analyzed_at, 'unixepoch')) as response_generation_costs,
  (SUM(rsa.analysis_cost_usd) +
   COALESCE((SELECT SUM(rta.analysis_cost_usd) FROM review_trend_analyses rta
             WHERE DATE(rta.analyzed_at, 'unixepoch') = DATE(rsa.analyzed_at, 'unixepoch')), 0) +
   COALESCE((SELECT SUM(rr.generation_cost_usd) FROM review_responses rr
             WHERE DATE(rr.generated_at, 'unixepoch') = DATE(rsa.analyzed_at, 'unixepoch')), 0)) as total_costs
FROM review_sentiment_analyses rsa
WHERE strftime('%Y-%m', rsa.analyzed_at, 'unixepoch') = strftime('%Y-%m', 'now')
GROUP BY DATE(rsa.analyzed_at, 'unixepoch')
ORDER BY analysis_date DESC;

-- ============================================================================
-- ADD REVIEW MONITORING FEATURE TO COST TRACKING
-- ============================================================================
-- Note: No schema changes needed to cost_tracking table.
-- Review monitoring costs will use feature_name = 'review_monitoring'
-- and operations like 'analyze_sentiment', 'generate_response', 'analyze_trends', 'fetch_reviews'

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================
INSERT INTO schema_version (version, applied_at, description)
VALUES (10, strftime('%s', 'now'), 'Migration 010: Review Monitoring & Management System (MAN-19)');

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration adds review monitoring and management capabilities:
--
-- 1. review_monitoring: Configuration for automated review checking
--    - Tracks book identifiers (ASIN/ISBN) for each manuscript
--    - Configures check frequency and alert preferences
--    - Schedules automated review fetching
--
-- 2. reviews: Individual reviews from Amazon, Goodreads, BookBub
--    - Stores full review content and metadata
--    - Includes sentiment analysis results from ReviewSentimentAgent
--    - Tracks response status and author interactions
--    - Flags suspicious/fake reviews
--
-- 3. review_sentiment_analyses: Aggregate sentiment analysis
--    - Analyzes sentiment across multiple reviews
--    - Identifies common themes, praises, and criticisms
--    - Flags reviews needing attention or response
--    - Links to full analysis in R2 storage
--
-- 4. review_trend_analyses: Temporal trend detection
--    - Tracks sentiment changes over time
--    - Detects anomalies and suspicious patterns
--    - Predicts future sentiment trajectory
--    - Identifies review bombing or coordinated activity
--
-- 5. review_responses: AI-generated response suggestions
--    - Provides multiple response options with different tones
--    - Includes timing recommendations
--    - Tracks which suggestions were used
--    - Cost tracking per response generation
--
-- 6. review_monitoring_jobs: Background job tracking
--    - Tracks asynchronous review fetching jobs
--    - Links to review monitoring consumer queue
--    - Provides status and progress updates
--
-- 7. Views: Pre-computed analytics
--    - Review statistics by manuscript
--    - Monitoring health and schedule adherence
--    - Monthly cost analysis
--
-- Integration Points:
-- - Reviews stored in D1 database (not R2 for queryability)
-- - Full analysis results stored in R2 (detailed JSON)
-- - Cost tracking uses existing cost_tracking table
-- - Queue-based review fetching (REVIEW_QUEUE)
-- - Links to manuscripts and users tables
--
-- Business Value:
-- - Automated review monitoring across platforms
-- - AI-powered sentiment analysis and insights
-- - Professional response suggestions
-- - Trend detection and anomaly alerts
-- - Protects author reputation with timely responses
-- - Identifies marketing opportunities from positive reviews
-- - Flags concerning patterns (review bombing, fake reviews)
--
-- Next Steps:
-- 1. Implement review-monitoring-consumer.js queue worker
-- 2. Integrate with Amazon Product Advertising API (requires approval)
-- 3. Build review monitoring dashboard UI
-- 4. Add email alerts for negative reviews or monitoring issues
-- 5. Implement direct posting of responses to platforms (future)
-- ============================================================================
