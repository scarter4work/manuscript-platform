-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- Migration 035: Rights Management System
-- Track publishing rights, territorial restrictions, and rights status for manuscripts

-- Manuscript Rights Table
-- Tracks individual rights grants for manuscripts
CREATE TABLE IF NOT EXISTS manuscript_rights (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Rights Type
  rights_type TEXT NOT NULL CHECK (rights_type IN (
    'first_serial',          -- First publication in magazine/journal
    'north_american',        -- US and Canada only
    'world_english',         -- All English-speaking territories
    'world',                 -- All territories, all languages
    'translation',           -- Non-English publications
    'audio',                 -- Audiobook production
    'film_tv',               -- Screen adaptations (film, TV, streaming)
    'electronic',            -- Ebook publication
    'print',                 -- Physical book publication
    'dramatic',              -- Stage performance
    'merchandising',         -- Character merchandising
    'anthology',             -- Inclusion in anthology/collection
    'excerpt'                -- Publication of excerpts
  )),

  -- Rights Status
  rights_status TEXT NOT NULL DEFAULT 'available' CHECK (rights_status IN (
    'available',    -- Rights are available for offer
    'offered',      -- Rights have been offered to publisher
    'granted',      -- Rights have been granted/sold
    'expired',      -- Rights grant has expired
    'reverted',     -- Rights have reverted to author
    'reserved'      -- Author is reserving these rights
  )),

  -- Grant Details
  granted_to_publisher_id TEXT, -- Publisher who holds the rights
  granted_to_publisher_name TEXT, -- Publisher name (if not in our system)

  -- Exclusivity
  exclusive INTEGER DEFAULT 0, -- Boolean: 1 = exclusive, 0 = non-exclusive

  -- Time Period
  grant_start_date INTEGER, -- Unix timestamp when rights grant begins
  grant_end_date INTEGER, -- Unix timestamp when rights grant expires
  grant_duration_years INTEGER, -- Duration in years (e.g., 5 years)

  -- Reversion
  reversion_clause TEXT, -- Text description of reversion conditions
  auto_reversion INTEGER DEFAULT 0, -- Boolean: auto-revert when contract ends
  reversion_date INTEGER, -- Actual date rights reverted

  -- Territory Restrictions
  territories TEXT, -- JSON array of country codes (e.g., ["US", "CA", "UK"])
  territory_restrictions TEXT, -- Description of territorial restrictions

  -- Language Restrictions
  languages TEXT, -- JSON array of language codes (e.g., ["en", "es", "fr"])

  -- Financial Terms
  advance DOUBLE PRECISION, -- Advance payment for rights
  royalty_rate DOUBLE PRECISION, -- Royalty percentage (e.g., 0.10 for 10%)
  royalty_escalation TEXT, -- Description of royalty escalation clauses

  -- Contract Details
  contract_file_key TEXT, -- R2 key for contract document
  contract_signed_date INTEGER,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Previously Published Tracking
-- Track if manuscript was previously published and rights status
CREATE TABLE IF NOT EXISTS publication_history (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Publication Details
  publication_type TEXT NOT NULL CHECK (publication_type IN (
    'magazine',
    'journal',
    'anthology',
    'self_published',
    'traditional_publisher',
    'online',
    'contest',
    'other'
  )),

  publication_name TEXT NOT NULL, -- Name of magazine, journal, publisher, etc.
  publication_date INTEGER, -- Unix timestamp
  publication_url TEXT, -- URL if published online

  -- Rights Sold
  rights_sold TEXT, -- JSON array of rights types sold (e.g., ["first_serial", "electronic"])

  -- Rights Status
  rights_currently_held TEXT NOT NULL DEFAULT 'author', -- 'author', 'publisher', 'public_domain'
  rights_reversion_date INTEGER, -- When rights reverted to author
  rights_reversion_documentation TEXT, -- Description of reversion documentation

  -- Details
  isbn TEXT, -- ISBN if applicable
  circulation INTEGER, -- Circulation/distribution count
  payment_received DOUBLE PRECISION, -- Payment received for publication

  notes TEXT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rights Offers Table
-- Track rights offers made to publishers
CREATE TABLE IF NOT EXISTS rights_offers (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  submission_id TEXT, -- Link to submission if applicable

  -- Publisher
  publisher_id TEXT,
  publisher_name TEXT NOT NULL,

  -- Rights Offered
  rights_offered TEXT NOT NULL, -- JSON array of rights types offered

  -- Offer Details
  offer_date BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  response_deadline INTEGER, -- Deadline for publisher response

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Awaiting response
    'accepted',    -- Publisher accepted
    'rejected',    -- Publisher rejected
    'countered',   -- Publisher made counter-offer
    'withdrawn',   -- Author withdrew offer
    'expired'      -- Deadline passed
  )),

  -- Response
  response_date INTEGER,
  response_notes TEXT,

  -- Terms Proposed
  proposed_advance DOUBLE PRECISION,
  proposed_royalty_rate DOUBLE PRECISION,
  proposed_duration_years INTEGER,
  proposed_exclusive INTEGER DEFAULT 0,

  notes TEXT,

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES manuscripts(id) ON DELETE SET NULL
);

-- Rights Conflicts Table
-- Track potential conflicts when same rights are offered/granted to multiple publishers
CREATE TABLE IF NOT EXISTS rights_conflicts (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  rights_type TEXT NOT NULL,

  -- Conflicting Rights
  rights_id_1 TEXT NOT NULL, -- First rights record
  rights_id_2 TEXT NOT NULL, -- Second rights record (conflicting)

  -- Conflict Details
  conflict_type TEXT NOT NULL CHECK (conflict_type IN (
    'territorial_overlap',  -- Same territory granted to multiple publishers
    'time_overlap',         -- Overlapping time periods
    'exclusive_violation',  -- Non-exclusive grant conflicts with exclusive
    'reversion_dispute'     -- Dispute over reversion status
  )),

  conflict_detected_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  -- Resolution
  resolved INTEGER DEFAULT 0, -- Boolean
  resolved_at INTEGER,
  resolution_notes TEXT,

  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (rights_id_1) REFERENCES manuscript_rights(id) ON DELETE CASCADE,
  FOREIGN KEY (rights_id_2) REFERENCES manuscript_rights(id) ON DELETE CASCADE
);

-- Rights Templates Table
-- Pre-configured rights packages for common scenarios
CREATE TABLE IF NOT EXISTS rights_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- NULL for system templates

  -- Template Details
  template_name TEXT NOT NULL,
  template_description TEXT,

  -- Rights Included
  rights_types TEXT NOT NULL, -- JSON array of rights types

  -- Default Terms
  default_exclusive INTEGER DEFAULT 0,
  default_duration_years INTEGER,
  default_territories TEXT, -- JSON array
  default_languages TEXT, -- JSON array

  -- Template Type
  template_type TEXT CHECK (template_type IN (
    'system',      -- System-provided template
    'custom'       -- User-created template
  )) DEFAULT 'custom',

  is_active INTEGER DEFAULT 1, -- Boolean

  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert System Templates
INSERT INTO rights_templates (
  id, user_id, template_name, template_description, rights_types,
  default_exclusive, default_duration_years, template_type
) VALUES
  (
    'template-full-world',
    NULL,
    'Full World Rights',
    'All rights, all territories, all languages',
    '["world", "electronic", "print", "audio", "film_tv", "translation", "merchandising"]',
    1,
    NULL,
    'system'
  ),
  (
    'template-north-american',
    NULL,
    'North American Print & Electronic',
    'Print and electronic rights for North America only',
    '["north_american", "electronic", "print"]',
    1,
    5,
    'system'
  ),
  (
    'template-world-english',
    NULL,
    'World English Rights',
    'English-language rights worldwide',
    '["world_english", "electronic", "print"]',
    1,
    7,
    'system'
  ),
  (
    'template-first-serial',
    NULL,
    'First Serial Rights Only',
    'First publication rights (magazine/journal)',
    '["first_serial"]',
    0,
    NULL,
    'system'
  ),
  (
    'template-audio-only',
    NULL,
    'Audio Rights Only',
    'Audiobook production rights',
    '["audio"]',
    0,
    5,
    'system'
  ),
  (
    'template-film-tv',
    NULL,
    'Film & TV Rights',
    'Screen adaptation rights',
    '["film_tv", "dramatic", "merchandising"]',
    1,
    10,
    'system'
  );

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_manuscript ON manuscript_rights(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_user ON manuscript_rights(user_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_type ON manuscript_rights(rights_type);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_status ON manuscript_rights(rights_status);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_publisher ON manuscript_rights(granted_to_publisher_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_exclusive ON manuscript_rights(exclusive);
CREATE INDEX IF NOT EXISTS idx_manuscript_rights_dates ON manuscript_rights(grant_start_date, grant_end_date);

CREATE INDEX IF NOT EXISTS idx_publication_history_manuscript ON publication_history(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_publication_history_user ON publication_history(user_id);
CREATE INDEX IF NOT EXISTS idx_publication_history_type ON publication_history(publication_type);
CREATE INDEX IF NOT EXISTS idx_publication_history_date ON publication_history(publication_date DESC);

CREATE INDEX IF NOT EXISTS idx_rights_offers_manuscript ON rights_offers(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_rights_offers_user ON rights_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_rights_offers_submission ON rights_offers(submission_id);
CREATE INDEX IF NOT EXISTS idx_rights_offers_status ON rights_offers(status);
CREATE INDEX IF NOT EXISTS idx_rights_offers_date ON rights_offers(offer_date DESC);

CREATE INDEX IF NOT EXISTS idx_rights_conflicts_manuscript ON rights_conflicts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_rights_conflicts_type ON rights_conflicts(rights_type);
CREATE INDEX IF NOT EXISTS idx_rights_conflicts_resolved ON rights_conflicts(resolved);

CREATE INDEX IF NOT EXISTS idx_rights_templates_user ON rights_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_rights_templates_type ON rights_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_rights_templates_active ON rights_templates(is_active);

-- Triggers for Auto-Update Timestamps
-- Update trigger for manuscript_rights
CREATE TRIGGER manuscript_rights_updated
BEFORE UPDATE ON manuscript_rights
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Update trigger for publication_history
CREATE TRIGGER publication_history_updated
BEFORE UPDATE ON publication_history
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Update trigger for rights_offers
CREATE TRIGGER rights_offers_updated
BEFORE UPDATE ON rights_offers
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Update trigger for rights_templates
CREATE TRIGGER rights_templates_updated
BEFORE UPDATE ON rights_templates
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Views for Analytics

-- Rights Summary by Manuscript
CREATE OR REPLACE VIEW rights_summary AS
SELECT
  mr.manuscript_id,
  m.title as manuscript_title,
  mr.user_id,
  COUNT(DISTINCT mr.id) as total_rights_grants,
  COUNT(DISTINCT CASE WHEN mr.rights_status = 'granted' THEN mr.id END) as active_grants,
  COUNT(DISTINCT CASE WHEN mr.exclusive = 1 THEN mr.id END) as exclusive_grants,
  GROUP_CONCAT(DISTINCT mr.rights_type) as rights_types_granted,
  SUM(mr.advance) as total_advances,
  MAX(mr.grant_end_date) as latest_expiration
FROM manuscript_rights mr
JOIN manuscripts m ON mr.manuscript_id = m.id
GROUP BY mr.manuscript_id, m.title, mr.user_id;

-- Available Rights by Manuscript
CREATE OR REPLACE VIEW available_rights AS
SELECT
  m.id as manuscript_id,
  m.title as manuscript_title,
  m.user_id,
  -- List rights that are NOT granted or offered
  CASE WHEN mr_granted.rights_type IS NULL THEN 'first_serial' ELSE NULL END as first_serial_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'north_american' ELSE NULL END as north_american_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'world_english' ELSE NULL END as world_english_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'translation' ELSE NULL END as translation_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'audio' ELSE NULL END as audio_available,
  CASE WHEN mr_granted.rights_type IS NULL THEN 'film_tv' ELSE NULL END as film_tv_available
FROM manuscripts m
LEFT JOIN manuscript_rights mr_granted ON m.id = mr_granted.manuscript_id
  AND mr_granted.rights_status IN ('granted', 'offered')
WHERE mr_granted.id IS NULL;

-- Rights Expiring Soon (next 90 days)
CREATE OR REPLACE VIEW rights_expiring_soon AS
SELECT
  mr.id,
  mr.manuscript_id,
  m.title as manuscript_title,
  mr.user_id,
  mr.rights_type,
  mr.granted_to_publisher_name,
  mr.grant_end_date,
  (mr.grant_end_date - EXTRACT(EPOCH FROM NOW())::BIGINT) / 86400 as days_until_expiration
FROM manuscript_rights mr
JOIN manuscripts m ON mr.manuscript_id = m.id
WHERE mr.rights_status = 'granted'
  AND mr.grant_end_date IS NOT NULL
  AND mr.grant_end_date <= EXTRACT(EPOCH FROM NOW())::BIGINT + (90 * 86400)
  AND mr.grant_end_date > EXTRACT(EPOCH FROM NOW())::BIGINT
ORDER BY mr.grant_end_date ASC;

-- Publication History Summary
CREATE OR REPLACE VIEW publication_history_summary AS
SELECT
  ph.manuscript_id,
  m.title as manuscript_title,
  ph.user_id,
  COUNT(*) as publication_count,
  GROUP_CONCAT(DISTINCT ph.publication_type) as publication_types,
  MIN(ph.publication_date) as first_publication,
  MAX(ph.publication_date) as latest_publication,
  SUM(ph.payment_received) as total_payments_received
FROM publication_history ph
JOIN manuscripts m ON ph.manuscript_id = m.id
GROUP BY ph.manuscript_id, m.title, ph.user_id, -- List rights that are NOT granted or offered
  CASE WHEN mr_granted.rights_type IS NULL THEN 'first_serial' ELSE NULL END as first_serial_available;
