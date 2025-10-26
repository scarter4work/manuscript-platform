-- Migration 005: Add full_name column to users table
-- Created: October 26, 2025
-- Purpose: Add full_name field for user profiles and personalized emails

-- Add full_name column to users table
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (5, strftime('%s', 'now'), 'Add full_name column to users table');
