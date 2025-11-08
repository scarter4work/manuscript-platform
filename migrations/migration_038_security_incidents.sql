-- ============================================================================
-- Migration 038: Security Incidents & File Virus Scanning
-- ============================================================================
-- Purpose: Track security incidents including malware upload attempts
-- Created: 2025-11-08
-- Issue: #65 - Implement File Virus Scanning for Uploads
-- ============================================================================

-- ============================================================================
-- SECURITY INCIDENTS TABLE
-- Track all security-related incidents for monitoring and compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_incidents (
  id TEXT PRIMARY KEY,                    -- UUID
  type TEXT NOT NULL,                     -- Incident type
  details TEXT,                           -- JSON details
  ip_address TEXT,                        -- Source IP
  user_id TEXT,                           -- User involved (if authenticated)
  created_at INTEGER NOT NULL,            -- Unix timestamp
  resolved INTEGER DEFAULT 0,             -- Resolution status
  resolved_at INTEGER,                    -- When resolved
  resolved_by TEXT,                       -- Admin user who resolved
  notes TEXT,                             -- Resolution notes
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for security incident queries
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON security_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_user ON security_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_resolved ON security_incidents(resolved);
CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON security_incidents(ip_address);

-- ============================================================================
-- SECURITY INCIDENT TYPES (Reference)
-- ============================================================================
-- Common incident types:
-- - malware_upload_blocked: File upload blocked by virus scanner
-- - suspicious_activity: Rate limit violations, unusual patterns
-- - authentication_failure: Multiple failed login attempts
-- - unauthorized_access: Access to resources without permission
-- - data_breach_attempt: Attempted SQL injection, XSS, etc.
-- - api_abuse: Excessive API calls, scraping attempts

-- ============================================================================
-- FILE SCAN RESULTS TABLE
-- Track all file scans for audit purposes
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_scan_results (
  id TEXT PRIMARY KEY,                    -- UUID
  file_key TEXT NOT NULL,                 -- Storage key
  file_name TEXT NOT NULL,                -- Original filename
  file_size INTEGER NOT NULL,             -- Bytes
  scan_status TEXT NOT NULL,              -- clean, infected, error, skipped
  scanner_name TEXT NOT NULL,             -- clamav, virustotal, etc.
  viruses_found TEXT,                     -- JSON array of virus names
  scan_duration_ms INTEGER,               -- Scan time in milliseconds
  scanned_at INTEGER NOT NULL,            -- Unix timestamp
  user_id TEXT,                           -- User who uploaded
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for scan result queries
CREATE INDEX IF NOT EXISTS idx_file_scan_results_status ON file_scan_results(scan_status);
CREATE INDEX IF NOT EXISTS idx_file_scan_results_scanned ON file_scan_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_scan_results_user ON file_scan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_file_scan_results_file_key ON file_scan_results(file_key);

-- ============================================================================
-- SCANNER HEALTH TABLE
-- Monitor virus scanner service health
-- ============================================================================
CREATE TABLE IF NOT EXISTS scanner_health (
  id TEXT PRIMARY KEY,                    -- UUID
  scanner_name TEXT NOT NULL,             -- clamav, virustotal, etc.
  status TEXT NOT NULL,                   -- online, offline, degraded
  last_successful_scan INTEGER,           -- Unix timestamp
  virus_definitions_version TEXT,         -- Version/date of virus DB
  last_definition_update INTEGER,         -- Unix timestamp
  error_message TEXT,                     -- Last error if offline
  checked_at INTEGER NOT NULL,            -- Unix timestamp
  response_time_ms INTEGER                -- Avg response time
);

-- Index for scanner health queries
CREATE INDEX IF NOT EXISTS idx_scanner_health_scanner ON scanner_health(scanner_name);
CREATE INDEX IF NOT EXISTS idx_scanner_health_checked ON scanner_health(checked_at DESC);

-- ============================================================================
-- SECURITY INCIDENTS ANALYTICS VIEW
-- Summary of security incidents for dashboard
-- ============================================================================
CREATE VIEW IF NOT EXISTS security_incidents_summary AS
SELECT
  type,
  COUNT(*) as total_incidents,
  COUNT(CASE WHEN resolved = 1 THEN 1 END) as resolved_count,
  COUNT(CASE WHEN resolved = 0 THEN 1 END) as unresolved_count,
  MAX(created_at) as last_incident_at,
  COUNT(DISTINCT user_id) as affected_users,
  COUNT(DISTINCT ip_address) as unique_ips
FROM security_incidents
GROUP BY type
ORDER BY total_incidents DESC;

-- ============================================================================
-- FILE SCAN STATISTICS VIEW
-- Summary of file scanning activity
-- ============================================================================
CREATE VIEW IF NOT EXISTS file_scan_statistics AS
SELECT
  DATE(scanned_at, 'unixepoch') as scan_date,
  scan_status,
  COUNT(*) as total_scans,
  AVG(scan_duration_ms) as avg_scan_time_ms,
  SUM(file_size) as total_bytes_scanned,
  COUNT(DISTINCT user_id) as unique_users
FROM file_scan_results
GROUP BY scan_date, scan_status
ORDER BY scan_date DESC, scan_status;

-- ============================================================================
-- MALWARE UPLOADS VIEW
-- Track all detected malware uploads
-- ============================================================================
CREATE VIEW IF NOT EXISTS malware_uploads AS
SELECT
  fsr.id,
  fsr.file_name,
  fsr.file_size,
  fsr.viruses_found,
  fsr.scanned_at,
  fsr.user_id,
  u.email as user_email,
  si.ip_address,
  si.details as incident_details
FROM file_scan_results fsr
LEFT JOIN users u ON fsr.user_id = u.id
LEFT JOIN security_incidents si ON si.details LIKE '%' || fsr.file_name || '%'
  AND si.type = 'malware_upload_blocked'
WHERE fsr.scan_status = 'infected'
ORDER BY fsr.scanned_at DESC;

-- ============================================================================
-- SCANNER HEALTH MONITORING VIEW
-- Current status of all virus scanners
-- ============================================================================
CREATE VIEW IF NOT EXISTS scanner_status AS
SELECT
  scanner_name,
  status,
  virus_definitions_version,
  DATETIME(last_definition_update, 'unixepoch') as last_updated,
  DATETIME(checked_at, 'unixepoch') as last_checked,
  response_time_ms,
  error_message
FROM scanner_health
WHERE id IN (
  SELECT id FROM scanner_health sh2
  WHERE sh2.scanner_name = scanner_health.scanner_name
  ORDER BY checked_at DESC
  LIMIT 1
);

-- ============================================================================
-- SEED DATA: Initial scanner health record
-- ============================================================================
INSERT OR IGNORE INTO scanner_health (
  id,
  scanner_name,
  status,
  virus_definitions_version,
  checked_at
) VALUES (
  'initial-clamav-health',
  'clamav',
  'offline',
  'unknown',
  strftime('%s', 'now')
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Implement virus-scanner.js service
-- 2. Update upload handlers with scanning
-- 3. Set up ClamAV Docker container
-- 4. Configure environment variables
-- 5. Test with EICAR test file
-- ============================================================================
