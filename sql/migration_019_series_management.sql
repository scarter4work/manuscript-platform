-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)

-- ==================================================
-- POSTGRESQL TRIGGER FUNCTIONS
-- ==================================================

-- Trigger function for update_series_timestamp_on_update
CREATE OR REPLACE FUNCTION update_series_timestamp_on_update_func()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE series SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.series_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for update_series_timestamp_on_insert
CREATE OR REPLACE FUNCTION update_series_timestamp_on_insert_func()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE series SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.series_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for update_series_timestamp_on_delete
CREATE OR REPLACE FUNCTION update_series_timestamp_on_delete_func()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE series SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = OLD.series_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for validate_book_number
CREATE OR REPLACE FUNCTION validate_book_number_func()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.book_number <= 0 THEN
    RAISE EXCEPTION 'Book number must be positive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for ensure_one_default_reading_order
CREATE OR REPLACE FUNCTION ensure_one_default_reading_order_func()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE series_reading_orders
  SET is_default = 0
  WHERE series_id = NEW.series_id AND is_default = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- TABLES AND TRIGGERS
-- ==================================================

-- Migration 019: Series Management System
-- Enables authors to organize manuscripts into series with proper ordering and cross-promotion

-- ============================================================================
-- SERIES TABLE
-- Represents a book series (e.g., "The Lord of the Rings", "Harry Potter")
-- ============================================================================

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  series_name TEXT NOT NULL,
  series_description TEXT,
  genre TEXT,
  series_status TEXT DEFAULT 'ongoing' CHECK (series_status IN ('ongoing', 'complete', 'hiatus', 'planned')),
  total_planned_books INTEGER,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  -- Marketing and metadata
  series_tagline TEXT,
  series_cover_image_key TEXT, -- Optional series-wide cover (for bundles)
  amazon_series_page_url TEXT,
  goodreads_series_url TEXT,
  bookbub_series_url TEXT,

  -- SEO and discoverability
  keywords TEXT, -- Comma-separated keywords for the series
  categories TEXT, -- BISAC categories for the series

  -- Analytics
  total_views INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_user ON series(user_id);
CREATE INDEX IF NOT EXISTS idx_series_status ON series(series_status);
CREATE INDEX IF NOT EXISTS idx_series_genre ON series(genre);
CREATE INDEX IF NOT EXISTS idx_series_created ON series(created_at);

-- ============================================================================
-- SERIES MANUSCRIPTS TABLE
-- Links manuscripts to series with ordering information
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_manuscripts (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  manuscript_id TEXT NOT NULL,
  book_number DOUBLE PRECISION NOT NULL, -- Use DOUBLE PRECISION to allow 1.5 for novellas between books
  book_type TEXT DEFAULT 'main' CHECK (book_type IN ('main', 'prequel', 'sequel', 'novella', 'short_story', 'companion')),
  reading_order_note TEXT, -- E.g., "Can be read standalone" or "Read after Book 3"

  -- Publication tracking
  publication_date INTEGER,
  is_published INTEGER DEFAULT 0,
  pre_order_date INTEGER,

  -- Cross-promotion flags
  include_in_backmatter INTEGER DEFAULT 1, -- Include in "Books in this series" section
  include_sample_chapter INTEGER DEFAULT 0, -- Include sample chapter in other books

  added_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,

  UNIQUE(series_id, manuscript_id),
  UNIQUE(series_id, book_number) -- Prevent duplicate book numbers
);

CREATE INDEX IF NOT EXISTS idx_series_manuscripts_series ON series_manuscripts(series_id);
CREATE INDEX IF NOT EXISTS idx_series_manuscripts_manuscript ON series_manuscripts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_series_manuscripts_order ON series_manuscripts(series_id, book_number);
CREATE INDEX IF NOT EXISTS idx_series_manuscripts_published ON series_manuscripts(is_published);

-- ============================================================================
-- SERIES BUNDLES TABLE
-- Track bundle offerings (e.g., "Books 1-3 Box Set")
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_bundles (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  bundle_name TEXT NOT NULL,
  bundle_description TEXT,
  bundle_type TEXT DEFAULT 'box_set' CHECK (bundle_type IN ('box_set', 'omnibus', 'collection', 'starter_pack')),

  -- Bundle contents
  included_book_numbers TEXT NOT NULL, -- JSON array of book numbers, e.g., "[1,2,3]"

  -- Pricing and marketing
  bundle_price_ebook DOUBLE PRECISION,
  bundle_price_paperback DOUBLE PRECISION,
  discount_percentage DOUBLE PRECISION, -- Discount compared to buying individually

  -- Publishing status
  is_published INTEGER DEFAULT 0,
  publication_date INTEGER,

  -- Platform links
  amazon_url TEXT,
  draft2digital_url TEXT,
  apple_books_url TEXT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_bundles_series ON series_bundles(series_id);
CREATE INDEX IF NOT EXISTS idx_series_bundles_published ON series_bundles(is_published);

-- ============================================================================
-- SERIES READING ORDER TABLE
-- Custom reading orders for complex series (e.g., chronological vs publication order)
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_reading_orders (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  order_name TEXT NOT NULL, -- E.g., "Publication Order", "Chronological Order", "Recommended for New Readers"
  order_description TEXT,
  is_default INTEGER DEFAULT 0,

  -- Ordered list of book numbers
  book_order TEXT NOT NULL, -- JSON array, e.g., "[1, 3, 2, 4]"

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_reading_orders_series ON series_reading_orders(series_id);
CREATE INDEX IF NOT EXISTS idx_series_reading_orders_default ON series_reading_orders(is_default);

-- ============================================================================
-- SERIES PROMOTION TABLE
-- Track cross-promotion opportunities between series books
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_promotions (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  promotion_type TEXT NOT NULL CHECK (promotion_type IN ('backmatter', 'sample_chapter', 'bonus_content', 'newsletter_signup')),
  source_book_number DOUBLE PRECISION, -- NULL means apply to all books
  target_book_number DOUBLE PRECISION, -- Which book to promote

  -- Content
  promotion_text TEXT, -- Custom text for the promotion
  cta_text TEXT, -- Call to action, e.g., "Read the next book now!"
  cta_link TEXT, -- Link to Amazon/etc

  -- Display settings
  position TEXT DEFAULT 'end' CHECK (position IN ('start', 'end', 'both')),
  is_active INTEGER DEFAULT 1,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_promotions_series ON series_promotions(series_id);
CREATE INDEX IF NOT EXISTS idx_series_promotions_active ON series_promotions(is_active);

-- ============================================================================
-- SERIES ANALYTICS TABLE
-- Track series-level performance metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS series_analytics (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  metric_date INTEGER NOT NULL, -- Unix timestamp (daily rollup)

  -- Engagement metrics
  series_page_views INTEGER DEFAULT 0,
  complete_series_purchases INTEGER DEFAULT 0,
  bundle_purchases INTEGER DEFAULT 0,

  -- Read-through metrics
  book_1_sales INTEGER DEFAULT 0,
  book_2_sales INTEGER DEFAULT 0,
  read_through_rate DOUBLE PRECISION, -- Percentage of Book 1 readers who buy Book 2

  -- Platform breakdown
  amazon_sales INTEGER DEFAULT 0,
  draft2digital_sales INTEGER DEFAULT 0,
  direct_sales INTEGER DEFAULT 0,

  -- Revenue
  total_revenue DOUBLE PRECISION DEFAULT 0,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,

  UNIQUE(series_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_series_analytics_series ON series_analytics(series_id);
CREATE INDEX IF NOT EXISTS idx_series_analytics_date ON series_analytics(metric_date);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Series overview with book counts
CREATE OR REPLACE VIEW series_overview AS
SELECT
  s.id,
  s.user_id,
  s.series_name,
  s.series_description,
  s.genre,
  s.series_status,
  s.total_planned_books,
  COUNT(DISTINCT sm.manuscript_id) AS total_books_written,
  SUM(CASE WHEN sm.is_published = 1 THEN 1 ELSE 0 END) AS total_books_published,
  MIN(sm.book_number) AS first_book_number,
  MAX(sm.book_number) AS latest_book_number,
  s.created_at,
  s.updated_at
FROM series s
LEFT JOIN series_manuscripts sm ON s.id = sm.series_id
GROUP BY s.id, user_id, series_name, series_description, genre, series_status, total_planned_books, created_at, updated_at;

-- View: Series reading order summary
CREATE OR REPLACE VIEW series_books_ordered AS
SELECT
  sm.series_id,
  s.series_name,
  sm.book_number,
  sm.book_type,
  m.id AS manuscript_id,
  m.title AS manuscript_title,
  m.author_name,
  sm.is_published,
  sm.publication_date,
  sm.reading_order_note
FROM series_manuscripts sm
JOIN series s ON sm.series_id = s.id
JOIN manuscripts m ON sm.manuscript_id = m.id
ORDER BY sm.series_id, sm.book_number;

-- View: Series performance summary
CREATE OR REPLACE VIEW series_performance AS
SELECT
  s.id AS series_id,
  s.series_name,
  s.user_id,
  COUNT(DISTINCT sm.manuscript_id) AS total_books,
  SUM(CASE WHEN sm.is_published = 1 THEN 1 ELSE 0 END) AS published_books,
  COALESCE(SUM(sa.total_revenue), 0) AS lifetime_revenue,
  COALESCE(AVG(sa.read_through_rate), 0) AS avg_read_through_rate,
  COUNT(DISTINCT sb.id) AS total_bundles,
  s.series_status
FROM series s
LEFT JOIN series_manuscripts sm ON s.id = sm.series_id
LEFT JOIN series_analytics sa ON s.id = sa.series_id
LEFT JOIN series_bundles sb ON s.id = sb.series_id
GROUP BY s.id, series_id, series_name, book_number, book_type, title, author_name, is_published, publication_date, reading_order_note;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update series.updated_at when manuscripts are added/removed
CREATE TRIGGER update_series_timestamp
AFTER INSERT ON series_manuscripts
FOR EACH ROW
EXECUTE FUNCTION update_series_timestamp_on_insert_func();

-- Custom trigger for series_manuscripts
CREATE TRIGGER update_series_timestamp_on_update
BEFORE UPDATE ON series_manuscripts
FOR EACH ROW
EXECUTE FUNCTION update_series_timestamp_on_update_func();

CREATE TRIGGER update_series_timestamp_on_delete
AFTER DELETE ON series_manuscripts
FOR EACH ROW
EXECUTE FUNCTION update_series_timestamp_on_delete_func();

-- Validate book numbers are sequential or intentionally skipped
CREATE TRIGGER validate_book_number
BEFORE INSERT ON series_manuscripts
FOR EACH ROW
EXECUTE FUNCTION validate_book_number_func();

-- Ensure only one default reading order per series
CREATE TRIGGER ensure_one_default_reading_order
BEFORE INSERT ON series_reading_orders
FOR EACH ROW
WHEN (NEW.is_default = 1)
EXECUTE FUNCTION ensure_one_default_reading_order_func();

-- ============================================================================
-- SAMPLE DATA (commented out for production)
-- ============================================================================

/*
-- Example: Create a fantasy trilogy
INSERT INTO series (id, user_id, series_name, series_description, genre, series_status, total_planned_books, series_tagline, keywords, categories)
VALUES (
  'series_example_001',
  1,
  'The Stormlight Chronicles',
  'An epic fantasy series following the journey of a young warrior in a world of magic and intrigue.',
  'fantasy',
  'ongoing',
  5,
  'Where honor meets destiny',
  'epic fantasy, magic, war, heroes, betrayal',
  'FIC009000 - FICTION / Fantasy / Epic, FIC009020 - FICTION / Fantasy / Action & Adventure'
);

-- Add books to the series
INSERT INTO series_manuscripts (id, series_id, manuscript_id, book_number, book_type, is_published, publication_date)
VALUES
  ('sm_001', 'series_example_001', 'manuscript_001', 1, 'main', 1, 1640995200),
  ('sm_002', 'series_example_001', 'manuscript_002', 2, 'main', 1, 1672531200),
  ('sm_003', 'series_example_001', 'manuscript_003', 1.5, 'novella', 1, 1656633600),
  ('sm_004', 'series_example_001', 'manuscript_004', 3, 'main', 0, NULL);

-- Create a bundle
INSERT INTO series_bundles (id, series_id, bundle_name, bundle_description, bundle_type, included_book_numbers, bundle_price_ebook, discount_percentage, is_published)
VALUES (
  'bundle_001',
  'series_example_001',
  'The Stormlight Chronicles: Books 1-2 Box Set',
  'The first two books in the epic Stormlight Chronicles series, plus bonus novella.',
  'box_set',
  '[1, 1.5, 2]',
  9.99,
  30,
  1
);

-- Create reading orders
INSERT INTO series_reading_orders (id, series_id, order_name, order_description, is_default, book_order)
VALUES
  ('ro_001', 'series_example_001', 'Publication Order', 'Read in the order they were published', 1, '[1, 1.5, 2, 3]'),
  ('ro_002', 'series_example_001', 'Chronological Order', 'Read in chronological story order', 0, '[1.5, 1, 2, 3]');
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/*
USAGE NOTES:

1. Book Numbering:
   - Use integers (1, 2, 3) for main series books
   - Use decimals (1.5, 2.5) for novellas/short stories between books
   - Use 0.x for prequels (0.5 = prequel to Book 1)
   - Use book_type to distinguish main books from companion content

2. Reading Orders:
   - Most series have one reading order (publication order)
   - Complex series (e.g., Brandon Sanderson's Cosmere) may have multiple
   - is_default = 1 for the recommended order

3. Bundles:
   - Track which books are bundled together
   - Calculate discount percentage vs individual prices
   - Useful for "Complete Series" or "First 3 Books" promotions

4. Cross-Promotion:
   - series_promotions table enables automated backmatter generation
   - "Read Book 2 now!" CTAs at the end of Book 1
   - Sample chapters of next book

5. Analytics:
   - Track read-through rate (critical metric for series success)
   - Book 1 → Book 2 conversion is most important
   - Series-level revenue aggregation

INTEGRATION NOTES:

- When generating export packages, check series_manuscripts to include "Books in this series" section
- When creating marketing materials, include series context
- Amazon series pages require linking via series metadata
- Read-through rate optimization is key to series profitability

*/
