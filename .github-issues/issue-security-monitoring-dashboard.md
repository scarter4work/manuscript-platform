## 🔒 SECURITY: Implement Security Monitoring Dashboard

**Priority**: HIGH (Security)
**Type**: Feature / Security
**Effort**: 1-2 days

---

### Problem Description

Production site is receiving significant bot traffic and potential malicious activity. Currently, we have **zero visibility** into:
- Failed authentication attempts
- Rate limit violations
- Malicious IP activity
- API abuse patterns
- Security incident trends

**Evidence from production logs:**
- Multiple IPs attempting unauthorized access to `/auth/me`, `/manuscripts`, `/admin`
- Bot traffic from unknown sources (not just search engines)
- No dashboard to monitor or respond to threats
- Security incidents logged to database but not visible

---

### Solution

Create a **Security Monitoring Dashboard** for administrators to view real-time and historical security data.

---

### Features Required

#### 1. Real-Time Security Overview

**Dashboard Cards:**
- Active threats (last 5 minutes)
- Failed login attempts (last hour)
- Rate limited IPs (currently blocked)
- Suspicious activity score
- Virus scanner detections

#### 2. Authentication Monitoring

**Failed Login Attempts:**
- IP address
- Email attempted
- Timestamp
- Geographic location (optional)
- User agent
- Count by IP/email

**Filters:**
- Time range (last hour, day, week, month)
- By IP address
- By email
- By status (401, 429, etc.)

#### 3. Rate Limiting Dashboard

**Rate Limited Requests:**
- IP address
- Endpoint targeted
- Request count
- Block duration
- User agent
- Timestamp of first/last attempt

**Actions:**
- Manual IP blocking
- Whitelist IP
- Clear rate limit for IP

#### 4. Security Incidents Log

**Display data from `security_incidents` table:**
- Incident type (malware_upload_blocked, suspicious_activity, etc.)
- Severity level
- IP address
- User ID (if authenticated)
- Timestamp
- Resolution status
- Resolution notes

**Incident Types:**
- malware_upload_blocked
- rate_limit_violation
- authentication_failure
- unauthorized_access
- api_abuse
- suspicious_activity

#### 5. IP Activity Analysis

**Top Offending IPs:**
- IP address
- Total requests
- Failed attempts
- Rate limit hits
- Geographic location
- First/last seen
- Threat score

**Actions:**
- View all activity for IP
- Block IP permanently
- Add to whitelist

#### 6. API Abuse Detection

**Metrics:**
- Requests per minute by IP
- Endpoint hit frequency
- 404 pattern detection (scanning)
- User agent analysis
- Abnormal request patterns

---

### Database Schema

**Existing tables to use:**
```sql
-- Already exists (Issue #65)
security_incidents (id, type, details, ip_address, user_id, created_at, resolved, notes)
file_scan_results (id, file_key, scan_status, viruses_found, scanned_at, user_id)
scanner_health (id, scanner_name, status, checked_at)

-- Need to create
rate_limit_violations (
  id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  blocked_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

blocked_ips (
  id TEXT PRIMARY KEY,
  ip_address TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  blocked_by TEXT,  -- Admin user ID
  blocked_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,  -- NULL = permanent
  notes TEXT
);

ip_whitelist (
  id TEXT PRIMARY KEY,
  ip_address TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  added_by TEXT,
  added_at TIMESTAMP NOT NULL,
  notes TEXT
);
```

---

### API Endpoints

```
GET  /admin/security/overview                - Dashboard summary
GET  /admin/security/failed-logins           - Failed login attempts
GET  /admin/security/rate-limits             - Rate limited IPs
GET  /admin/security/incidents                - Security incidents
GET  /admin/security/ip-activity/:ip         - Activity for specific IP
POST /admin/security/block-ip                 - Block IP address
POST /admin/security/whitelist-ip             - Whitelist IP
DELETE /admin/security/unblock-ip/:ip         - Unblock IP
GET  /admin/security/threat-score/:ip        - Calculate threat score for IP
```

---

### Frontend UI

**Location**: `frontend/admin-security.html`

**Sections (Tabbed Interface):**
1. **Overview** - Real-time metrics and top threats
2. **Failed Logins** - Table with filters
3. **Rate Limits** - Active blocks with expiry times
4. **Incidents** - Security incident log
5. **IP Analysis** - Search and analyze specific IPs
6. **Blocked IPs** - Manage permanent/temporary blocks

**Features:**
- Real-time updates (WebSocket or polling)
- Export to CSV
- Date range filters
- Search by IP/email
- Click IP to see full activity
- One-click block/whitelist

---

### Threat Scoring Algorithm

Calculate threat score (0-100) for each IP based on:

```javascript
score = 0

// Failed logins (max 30 points)
score += Math.min(failed_logins * 5, 30)

// Rate limit violations (max 25 points)
score += Math.min(rate_limit_hits * 5, 25)

// 404 scanning behavior (max 20 points)
score += Math.min(not_found_requests * 2, 20)

// Security incidents (max 25 points)
score += security_incidents * 25

// Geographic risk (optional, max 10 points)
if (ip_country in HIGH_RISK_COUNTRIES) score += 10

return Math.min(score, 100)
```

**Threat Levels:**
- 0-25: Low (normal user/bot)
- 26-50: Medium (suspicious)
- 51-75: High (likely malicious)
- 76-100: Critical (active attack)

---

### Success Criteria

- [ ] Dashboard displays real-time security metrics
- [ ] Failed login attempts visible with IP/email/timestamp
- [ ] Rate limited IPs shown with block expiry
- [ ] Security incidents log accessible
- [ ] Can block/unblock IPs from dashboard
- [ ] Threat score calculated for suspicious IPs
- [ ] Export functionality works
- [ ] Updates in real-time (or near real-time)
- [ ] Admin-only access (role check)

---

### Testing Steps

1. Generate test data:
   - Make failed login attempts from different IPs
   - Trigger rate limits
   - Upload EICAR test file (malware detection)

2. Verify dashboard shows:
   - All failed logins
   - Rate limit blocks
   - Security incidents
   - Correct threat scores

3. Test IP blocking:
   - Block IP from dashboard
   - Verify IP can't access site
   - Unblock and verify access restored

4. Test export:
   - Export incidents to CSV
   - Verify data integrity

---

### Nice-to-Have Features

- Geographic map of threats (if budget allows)
- Email notifications for critical threats
- Auto-blocking based on threat score
- Integration with external threat intelligence feeds
- Historical trends chart
- Comparison with previous periods

---

### Integration Points

- Uses existing `security_incidents` table (Issue #65)
- Uses `audit_log` table for admin actions
- Integrates with rate limiter (`src/utils/rate-limiter.js`)
- Admin authentication required (`role = 'admin'`)

---

### Files to Create

- `migrations/migration_039_security_monitoring.sql` - New tables
- `src/handlers/security-monitoring-handlers.js` - API handlers
- `frontend/admin-security.html` - Dashboard UI
- `src/utils/threat-scoring.js` - Threat score calculator

---

### Security Considerations

- **Admin-only access**: Verify `role = 'admin'` on all endpoints
- **Rate limit admin endpoints**: Prevent admin panel abuse
- **Audit all actions**: Log all IP blocks/unblocks
- **Input validation**: Sanitize IP addresses, prevent injection
- **XSS protection**: Escape all displayed IPs/emails/user agents

---

**Estimated Effort**: 1-2 days
**Dependencies**: None (uses existing tables)
**Business Value**: Critical for security posture and compliance
