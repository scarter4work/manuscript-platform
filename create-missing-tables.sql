-- Create missing feature tables that failed to create during migrations

-- Migration 026: human_editors and editorial_assignments
CREATE TABLE IF NOT EXISTS human_editors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  editor_name TEXT NOT NULL,
  specialization TEXT[],
  years_experience INTEGER,
  rate_per_word NUMERIC(10, 4),
  rate_per_hour NUMERIC(10, 2),
  availability_status TEXT DEFAULT 'available',
  sample_work_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_editors_user ON human_editors(user_id);
CREATE INDEX IF NOT EXISTS idx_human_editors_status ON human_editors(availability_status);

CREATE TABLE IF NOT EXISTS editorial_assignments (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  editor_id TEXT NOT NULL,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('developmental', 'line', 'copy', 'proofread')),
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  deadline TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_editorial_assignments_manuscript ON editorial_assignments(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_editorial_assignments_editor ON editorial_assignments(editor_id);
CREATE INDEX IF NOT EXISTS idx_editorial_assignments_status ON editorial_assignments(status);

-- Migration 027: social_posts (social_media_posts was created, but table name might be wrong)
-- Check if we need social_posts vs social_media_posts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_posts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_media_posts') THEN
      CREATE VIEW social_posts AS SELECT * FROM social_media_posts;
    END IF;
  END IF;
END $$;

-- Migration 028: formatting_outputs (formatted_manuscripts might exist instead)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'formatting_outputs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'formatted_manuscripts') THEN
      CREATE VIEW formatting_outputs AS SELECT * FROM formatted_manuscripts;
    END IF;
  END IF;
END $$;

-- Migration 030: slush_pile_decisions (might be submission_decisions or similar)
CREATE TABLE IF NOT EXISTS slush_pile_decisions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('accept', 'reject', 'request_revisions', 'hold')),
  decided_by TEXT NOT NULL,
  decided_at TIMESTAMP DEFAULT NOW(),
  decision_notes TEXT,
  feedback_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slush_pile_decisions_submission ON slush_pile_decisions(submission_id);
CREATE INDEX IF NOT EXISTS idx_slush_pile_decisions_type ON slush_pile_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_slush_pile_decisions_decided_by ON slush_pile_decisions(decided_by);

-- Migration 031: submission_windows (publisher_submission_windows might exist instead)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'submission_windows') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'publisher_submission_windows') THEN
      CREATE VIEW submission_windows AS SELECT * FROM publisher_submission_windows;
    END IF;
  END IF;
END $$;

-- Migration 035: rights_licenses
CREATE TABLE IF NOT EXISTS rights_licenses (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  license_type TEXT NOT NULL CHECK (license_type IN ('exclusive', 'non_exclusive', 'first_rights', 'reprint', 'foreign', 'translation', 'audio', 'dramatic', 'anthology')),
  licensee_name TEXT NOT NULL,
  territory TEXT,
  language TEXT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  payment_terms TEXT,
  advance_amount NUMERIC(10, 2),
  royalty_rate NUMERIC(5, 2),
  rights_granted TEXT[],
  contract_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'terminated', 'renewed')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rights_licenses_manuscript ON rights_licenses(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_rights_licenses_user ON rights_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_rights_licenses_type ON rights_licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_rights_licenses_status ON rights_licenses(status);

-- Migration 036: ai_chat_sessions (agent_conversations might exist instead)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_chat_sessions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_conversations') THEN
      CREATE VIEW ai_chat_sessions AS SELECT * FROM agent_conversations;
    END IF;
  END IF;
END $$;
