-- Create global trigger functions used across all migrations
-- These are reusable PostgreSQL functions for common trigger patterns

-- Generic timestamp update function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
