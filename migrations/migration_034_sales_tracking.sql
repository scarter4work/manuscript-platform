-- Migration 034: Sales & Royalty Tracking Dashboard
-- Comprehensive sales analytics, royalty tracking, and performance metrics

-- Sales Data Table
-- Stores individual sales transactions from all platforms
CREATE TABLE IF NOT EXISTS sales_data (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Sale Details
  sale_date INTEGER NOT NULL, -- Unix timestamp
  platform TEXT NOT NULL, -- 'kdp', 'draft2digital', 'ingramspark', 'apple_books', 'google_play', 'kobo'
  format TEXT NOT NULL, -- 'ebook', 'paperback', 'hardcover', 'audiobook'

  -- Financial Data
  units_sold INTEGER DEFAULT 0,
  list_price REAL, -- Original list price
  revenue REAL DEFAULT 0, -- Gross revenue (before platform cut)
  royalty_earned REAL DEFAULT 0, -- Author's royalty
  royalty_rate REAL, -- Percentage (e.g., 0.70 for 70%)
  currency TEXT DEFAULT 'USD',

  -- Geographic Data
  country_code TEXT, -- ISO country code (US, UK, CA, etc.)
  marketplace TEXT, -- 'amazon.com', 'amazon.co.uk', etc.

  -- Marketing Attribution
  promotion_id TEXT, -- Link to marketing campaign if applicable
  source TEXT, -- 'organic', 'paid_ad', 'promotion', 'free_promo'

  -- Kindle Unlimited (KDP specific)
  kenp_pages_read INTEGER DEFAULT 0, -- Kindle Unlimited pages read
  kenp_revenue REAL DEFAULT 0, -- Revenue from KENP

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Royalty Payments Table
-- Tracks actual payments received from platforms
CREATE TABLE IF NOT EXISTS royalty_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,

  -- Payment Details
  payment_period_start INTEGER NOT NULL, -- Start of payment period
  payment_period_end INTEGER NOT NULL, -- End of payment period
  payment_date INTEGER, -- Actual payment date (null if pending)
  expected_payment_date INTEGER, -- Expected payment date

  -- Financial Data
  amount REAL NOT NULL, -- Payment amount
  currency TEXT DEFAULT 'USD',
  exchange_rate REAL, -- If converted from foreign currency

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending', 'processing', 'paid', 'reconciled', 'disputed')),

  -- Tax Data
  tax_withheld REAL DEFAULT 0, -- Tax withholding (if applicable)
  tax_country TEXT, -- Country where tax was withheld

  -- Reconciliation
  sales_count INTEGER, -- Number of sales in this payment
  expected_amount REAL, -- Expected amount based on sales data
  discrepancy REAL, -- Difference between expected and actual
  reconciliation_notes TEXT,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bestseller Rank Tracking
-- Tracks Amazon BSR and category ranks over time
CREATE TABLE IF NOT EXISTS bestseller_ranks (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,

  -- Platform & Category
  platform TEXT NOT NULL DEFAULT 'kdp', -- Currently focused on Amazon
  category TEXT NOT NULL, -- Amazon category path

  -- Rank Data
  overall_rank INTEGER, -- Overall store rank (Amazon BSR)
  category_rank INTEGER, -- Rank within specific category

  -- Snapshot Metadata
  tracked_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Sales Aggregations Table
-- Pre-computed aggregations for fast dashboard queries
CREATE TABLE IF NOT EXISTS sales_aggregations (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Aggregation Period
  period_type TEXT NOT NULL CHECK (period_type IN
    ('daily', 'weekly', 'monthly', 'yearly')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,

  -- Platform Breakdown
  platform TEXT NOT NULL,

  -- Aggregated Metrics
  total_units_sold INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_royalties REAL DEFAULT 0,

  -- Format Breakdown
  ebook_units INTEGER DEFAULT 0,
  paperback_units INTEGER DEFAULT 0,
  hardcover_units INTEGER DEFAULT 0,
  audiobook_units INTEGER DEFAULT 0,

  ebook_revenue REAL DEFAULT 0,
  paperback_revenue REAL DEFAULT 0,
  hardcover_revenue REAL DEFAULT 0,
  audiobook_revenue REAL DEFAULT 0,

  -- Kindle Unlimited
  kenp_pages_read INTEGER DEFAULT 0,
  kenp_revenue REAL DEFAULT 0,

  -- Geographic Breakdown (top 5 countries JSON)
  top_countries TEXT, -- JSON: [{"country": "US", "units": 100}, ...]

  -- Computed at
  computed_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(manuscript_id, period_type, period_start, platform)
);

-- Platform Connections Table
-- Stores API credentials and connection status for publishing platforms
CREATE TABLE IF NOT EXISTS platform_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'kdp', 'draft2digital', 'ingramspark', etc.

  -- Connection Status
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN
    ('connected', 'disconnected', 'error', 'expired')),

  -- Credentials (encrypted)
  api_key_encrypted TEXT, -- Encrypted API key
  api_secret_encrypted TEXT, -- Encrypted API secret
  access_token_encrypted TEXT, -- OAuth access token
  refresh_token_encrypted TEXT, -- OAuth refresh token
  token_expires_at INTEGER, -- Token expiration timestamp

  -- Platform-specific metadata
  platform_user_id TEXT, -- User ID on the platform
  platform_username TEXT,

  -- Sync Status
  last_sync_at INTEGER, -- Last successful data sync
  last_sync_status TEXT, -- 'success', 'failed', 'partial'
  last_sync_error TEXT,
  next_sync_at INTEGER, -- Next scheduled sync

  -- Metadata
  connected_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, platform)
);

-- Sales Goals Table
-- Track author sales goals and milestones
CREATE TABLE IF NOT EXISTS sales_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT, -- Null for user-wide goals

  -- Goal Details
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN
    ('units', 'revenue', 'royalties', 'reviews', 'rank')),

  target_value REAL NOT NULL, -- Target number (e.g., 1000 units, $5000 revenue)
  current_value REAL DEFAULT 0, -- Current progress

  -- Time Frame
  start_date INTEGER NOT NULL,
  end_date INTEGER, -- Null for ongoing goals

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN
    ('active', 'completed', 'abandoned')),
  completed_at INTEGER,

  -- Notifications
  notify_on_milestone INTEGER DEFAULT 1, -- Boolean: notify at 25%, 50%, 75%, 100%
  last_notification_at INTEGER,

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Marketing Campaigns Table
-- Track marketing campaigns for sales attribution
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,

  -- Campaign Details
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL, -- 'bookbub', 'amazon_ads', 'facebook_ads', 'free_promo', 'price_drop', 'newsletter'

  -- Campaign Period
  start_date INTEGER NOT NULL,
  end_date INTEGER,

  -- Budget & Spend
  budget REAL,
  spend REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',

  -- Target Metrics
  target_metric TEXT, -- 'sales', 'downloads', 'page_reads', 'reviews'
  target_value REAL,

  -- Campaign Settings (JSON)
  settings TEXT, -- JSON: platform-specific settings

  -- Results (computed)
  units_sold INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  roi REAL, -- Return on investment

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft', 'scheduled', 'active', 'completed', 'cancelled')),

  -- Metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);

-- Series Sales Table
-- Aggregated series-level sales analytics
CREATE TABLE IF NOT EXISTS series_sales (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Aggregation Period
  period_type TEXT NOT NULL CHECK (period_type IN
    ('daily', 'weekly', 'monthly', 'yearly', 'all_time')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,

  -- Series Metrics
  total_units_sold INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_royalties REAL DEFAULT 0,

  -- Read-through Analysis
  book_1_sales INTEGER DEFAULT 0,
  book_2_sales INTEGER DEFAULT 0,
  book_3_sales INTEGER DEFAULT 0,
  book_4_sales INTEGER DEFAULT 0,
  book_5_sales INTEGER DEFAULT 0,

  read_through_rate_1_to_2 REAL, -- Percentage of Book 1 readers who buy Book 2
  read_through_rate_2_to_3 REAL,
  read_through_rate_3_to_4 REAL,

  -- Bundle Sales
  bundle_units_sold INTEGER DEFAULT 0,
  bundle_revenue REAL DEFAULT 0,

  -- Computed at
  computed_at INTEGER NOT NULL DEFAULT (unixepoch()),

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(series_id, period_type, period_start)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_sales_data_manuscript ON sales_data(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_user ON sales_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_platform ON sales_data(platform);
CREATE INDEX IF NOT EXISTS idx_sales_data_format ON sales_data(format);
CREATE INDEX IF NOT EXISTS idx_sales_data_country ON sales_data(country_code);

CREATE INDEX IF NOT EXISTS idx_royalty_payments_user ON royalty_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_platform ON royalty_payments(platform);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_date ON royalty_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_status ON royalty_payments(status);
CREATE INDEX IF NOT EXISTS idx_royalty_payments_period ON royalty_payments(payment_period_start DESC);

CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_manuscript ON bestseller_ranks(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_tracked ON bestseller_ranks(tracked_at DESC);
CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_category ON bestseller_ranks(category);
CREATE INDEX IF NOT EXISTS idx_bestseller_ranks_overall ON bestseller_ranks(overall_rank);

CREATE INDEX IF NOT EXISTS idx_sales_agg_manuscript ON sales_aggregations(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sales_agg_user ON sales_aggregations(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_agg_period ON sales_aggregations(period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sales_agg_platform ON sales_aggregations(platform);

CREATE INDEX IF NOT EXISTS idx_platform_conn_user ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_conn_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_conn_status ON platform_connections(status);
CREATE INDEX IF NOT EXISTS idx_platform_conn_sync ON platform_connections(last_sync_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_goals_user ON sales_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_manuscript ON sales_goals(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_sales_goals_status ON sales_goals(status);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_user ON marketing_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_manuscript ON marketing_campaigns(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_dates ON marketing_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_series_sales_series ON series_sales(series_id);
CREATE INDEX IF NOT EXISTS idx_series_sales_user ON series_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_series_sales_period ON series_sales(period_type, period_start DESC);

-- Triggers for Auto-Update Timestamps
CREATE TRIGGER IF NOT EXISTS sales_data_updated
AFTER UPDATE ON sales_data
FOR EACH ROW
BEGIN
  UPDATE sales_data SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS royalty_payments_updated
AFTER UPDATE ON royalty_payments
FOR EACH ROW
BEGIN
  UPDATE royalty_payments SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS platform_connections_updated
AFTER UPDATE ON platform_connections
FOR EACH ROW
BEGIN
  UPDATE platform_connections SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS sales_goals_updated
AFTER UPDATE ON sales_goals
FOR EACH ROW
BEGIN
  UPDATE sales_goals SET updated_at = unixepoch() WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS marketing_campaigns_updated
AFTER UPDATE ON marketing_campaigns
FOR EACH ROW
BEGIN
  UPDATE marketing_campaigns SET updated_at = unixepoch() WHERE id = NEW.id;
END;

-- Views for Analytics

-- Sales Overview View
CREATE VIEW IF NOT EXISTS sales_overview AS
SELECT
  sd.manuscript_id,
  sd.user_id,
  m.title as manuscript_title,
  COUNT(sd.id) as total_transactions,
  SUM(sd.units_sold) as total_units_sold,
  SUM(sd.revenue) as total_revenue,
  SUM(sd.royalty_earned) as total_royalties,
  SUM(sd.kenp_pages_read) as total_kenp_pages,
  SUM(sd.kenp_revenue) as total_kenp_revenue,
  AVG(sd.royalty_rate) as avg_royalty_rate,
  MIN(sd.sale_date) as first_sale_date,
  MAX(sd.sale_date) as last_sale_date
FROM sales_data sd
JOIN manuscripts m ON sd.manuscript_id = m.id
GROUP BY sd.manuscript_id, sd.user_id, m.title;

-- Platform Performance View
CREATE VIEW IF NOT EXISTS platform_performance AS
SELECT
  sd.platform,
  sd.user_id,
  COUNT(DISTINCT sd.manuscript_id) as books_count,
  SUM(sd.units_sold) as total_units,
  SUM(sd.revenue) as total_revenue,
  SUM(sd.royalty_earned) as total_royalties,
  AVG(sd.royalty_rate) as avg_royalty_rate
FROM sales_data sd
GROUP BY sd.platform, sd.user_id;

-- Recent Sales Activity View (Last 30 Days)
CREATE VIEW IF NOT EXISTS recent_sales_activity AS
SELECT
  sd.manuscript_id,
  sd.user_id,
  m.title as manuscript_title,
  sd.platform,
  sd.format,
  SUM(sd.units_sold) as units_sold_30d,
  SUM(sd.revenue) as revenue_30d,
  SUM(sd.royalty_earned) as royalties_30d
FROM sales_data sd
JOIN manuscripts m ON sd.manuscript_id = m.id
WHERE sd.sale_date >= unixepoch('now', '-30 days')
GROUP BY sd.manuscript_id, sd.user_id, m.title, sd.platform, sd.format;

-- Royalty Payment Summary View
CREATE VIEW IF NOT EXISTS royalty_payment_summary AS
SELECT
  rp.user_id,
  rp.platform,
  COUNT(*) as payment_count,
  SUM(rp.amount) as total_paid,
  SUM(CASE WHEN rp.status = 'pending' THEN rp.amount ELSE 0 END) as pending_amount,
  SUM(CASE WHEN rp.status = 'paid' THEN rp.amount ELSE 0 END) as paid_amount,
  AVG(rp.amount) as avg_payment,
  MAX(rp.payment_date) as last_payment_date
FROM royalty_payments rp
GROUP BY rp.user_id, rp.platform;

-- Sales Goals Progress View
CREATE VIEW IF NOT EXISTS sales_goals_progress AS
SELECT
  sg.id,
  sg.user_id,
  sg.manuscript_id,
  m.title as manuscript_title,
  sg.goal_name,
  sg.goal_type,
  sg.target_value,
  sg.current_value,
  ROUND((sg.current_value * 100.0 / sg.target_value), 2) as progress_percentage,
  sg.status,
  sg.start_date,
  sg.end_date
FROM sales_goals sg
LEFT JOIN manuscripts m ON sg.manuscript_id = m.id;
