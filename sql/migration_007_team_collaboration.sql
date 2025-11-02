-- Migration 007: Team Collaboration Features
-- Adds team management, member roles, invitations, and manuscript sharing
-- Created: October 29, 2025
-- Related: MAN-13

-- ============================================================================
-- TEAMS TABLE
-- Stores team/organization information
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,                    -- UUID
  owner_id TEXT NOT NULL,                 -- Foreign key to users (team creator)
  name TEXT NOT NULL,                     -- Team/organization name
  description TEXT,                       -- Optional team description
  max_members INTEGER DEFAULT 5,          -- Max team size (5 for Enterprise)
  created_at INTEGER NOT NULL,            -- Unix timestamp
  updated_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for team queries
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);

-- ============================================================================
-- TEAM_MEMBERS TABLE
-- Join table for users in teams with role-based permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,                    -- UUID
  team_id TEXT NOT NULL,                  -- Foreign key to teams
  user_id TEXT NOT NULL,                  -- Foreign key to users
  role TEXT NOT NULL,                     -- admin/editor/viewer
  invited_by TEXT,                        -- Foreign key to users (who invited)
  joined_at INTEGER NOT NULL,             -- Unix timestamp
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(team_id, user_id)                -- Each user can only be in a team once
);

-- Indexes for member queries
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================================================
-- TEAM_INVITATIONS TABLE
-- Pending invitations to join teams
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,                    -- UUID
  team_id TEXT NOT NULL,                  -- Foreign key to teams
  email TEXT NOT NULL,                    -- Invitee email address
  role TEXT NOT NULL,                     -- admin/editor/viewer (role if accepted)
  token TEXT NOT NULL UNIQUE,             -- Invitation token (for acceptance)
  invited_by TEXT NOT NULL,               -- Foreign key to users (who sent invite)
  created_at INTEGER NOT NULL,            -- Unix timestamp
  expires_at INTEGER NOT NULL,            -- Unix timestamp (7 days from creation)
  status TEXT DEFAULT 'pending',          -- pending/accepted/expired/cancelled
  accepted_at INTEGER,                    -- Unix timestamp when accepted
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for invitation queries
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- ============================================================================
-- MANUSCRIPT_PERMISSIONS TABLE
-- Controls which teams/users have access to manuscripts
-- ============================================================================
CREATE TABLE IF NOT EXISTS manuscript_permissions (
  id TEXT PRIMARY KEY,                    -- UUID
  manuscript_id TEXT NOT NULL,            -- Foreign key to manuscripts
  team_id TEXT,                           -- Foreign key to teams (null = individual user)
  user_id TEXT,                           -- Foreign key to users (null = team access)
  permission_level TEXT NOT NULL,         -- view/comment/edit
  granted_by TEXT NOT NULL,               -- Foreign key to users (who granted access)
  granted_at INTEGER NOT NULL,            -- Unix timestamp
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK ((team_id IS NOT NULL AND user_id IS NULL) OR (team_id IS NULL AND user_id IS NOT NULL))
);

-- Indexes for permission queries
CREATE INDEX IF NOT EXISTS idx_manuscript_permissions_manuscript ON manuscript_permissions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_permissions_team ON manuscript_permissions(team_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_permissions_user ON manuscript_permissions(user_id);

-- ============================================================================
-- TEAM_ACTIVITY TABLE
-- Activity feed for team actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_activity (
  id TEXT PRIMARY KEY,                    -- UUID
  team_id TEXT NOT NULL,                  -- Foreign key to teams
  user_id TEXT NOT NULL,                  -- Foreign key to users (who performed action)
  action TEXT NOT NULL,                   -- invited_member/removed_member/shared_manuscript/etc
  resource_type TEXT,                     -- manuscript/member/team
  resource_id TEXT,                       -- ID of affected resource
  metadata TEXT,                          -- JSON: additional context
  timestamp INTEGER NOT NULL,             -- Unix timestamp
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for activity feed
CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_timestamp ON team_activity(timestamp DESC);

-- ============================================================================
-- VIEWS: Team-related queries
-- ============================================================================

-- View: Team members with user details
CREATE VIEW IF NOT EXISTS team_members_details AS
SELECT
  tm.id,
  tm.team_id,
  tm.user_id,
  tm.role,
  tm.joined_at,
  u.email,
  u.full_name,
  u.role as user_role,
  t.name as team_name
FROM team_members tm
JOIN users u ON tm.user_id = u.id
JOIN teams t ON tm.team_id = t.id;

-- View: Team with member count
CREATE VIEW IF NOT EXISTS teams_with_stats AS
SELECT
  t.*,
  u.email as owner_email,
  u.full_name as owner_name,
  COUNT(DISTINCT tm.user_id) as member_count,
  COUNT(DISTINCT mp.manuscript_id) as shared_manuscripts_count
FROM teams t
JOIN users u ON t.owner_id = u.id
LEFT JOIN team_members tm ON t.id = tm.team_id
LEFT JOIN manuscript_permissions mp ON t.id = mp.team_id
GROUP BY t.id;

-- Note: user_accessible_manuscripts view removed because SQLite views cannot contain parameters
-- Applications should query manuscripts with permission checks directly using the
-- manuscript_permissions and team_members tables as needed

-- ============================================================================
-- ROLE DEFINITIONS
-- ============================================================================
-- Team Roles:
-- - admin: Can manage team, invite/remove members, share manuscripts with full permissions
-- - editor: Can view and edit shared manuscripts, cannot manage team
-- - viewer: Can only view shared manuscripts, cannot edit
--
-- Manuscript Permission Levels:
-- - view: Read-only access to manuscript and analysis results
-- - comment: Can view and add comments/annotations (future feature)
-- - edit: Can view, comment, and modify manuscript metadata (NOT the actual file)
-- ============================================================================

-- Schema version already set to 7
-- INSERT INTO schema_version (version, applied_at, description)
-- VALUES (7, strftime('%s', 'now'), 'Migration 007: Team collaboration features (MAN-13)');
