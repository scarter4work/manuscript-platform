-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- Migration 002: Add DMCA Attestation and Additional Fields
-- Adds required DMCA compliance fields to dmca_requests table
-- Created: October 12, 2025

-- Add missing columns to dmca_requests table
ALTER TABLE dmca_requests ADD COLUMN original_work_url TEXT;
ALTER TABLE dmca_requests ADD COLUMN good_faith_attestation INTEGER DEFAULT 0;
ALTER TABLE dmca_requests ADD COLUMN accuracy_attestation INTEGER DEFAULT 0;
ALTER TABLE dmca_requests ADD COLUMN digital_signature TEXT;

-- Update schema version
INSERT INTO schema_version (version, applied_at, description)
VALUES (2, strftime('%s', 'now'), 'Migration 002: Add DMCA attestation fields');
