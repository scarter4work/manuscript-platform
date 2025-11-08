## 🚨 SECURITY: Implement Automated Security Alerts

**Priority**: HIGH (Security)
**Type**: Feature / Security / Automation
**Effort**: 1 day

---

### Problem Description

Currently, security incidents occur in production with **zero alerting**:
- Malware uploads detected → No notification
- Multiple failed login attempts → No alert
- Rate limit violations → Silent
- API abuse → Undetected until logs reviewed
- DDoS attempts → No early warning

**Administrators have no way to know about security events in real-time.**

---

### Solution

Implement **automated email alerts** for critical security events with configurable thresholds and escalation.

---

### Alert Types & Triggers

#### 1. Authentication Alerts

**Trigger**: Multiple failed login attempts
- **Threshold**: 5+ failed attempts from same IP in 5 minutes
- **Alert Level**: MEDIUM
- **Email To**: Admin email
- **Subject**: `⚠️ Multiple Failed Login Attempts Detected`

**Trigger**: Brute force attack detected
- **Threshold**: 20+ failed attempts from same IP in 15 minutes
- **Alert Level**: HIGH
- **Email To**: Admin email + SMS (if configured)
- **Subject**: `🚨 CRITICAL: Brute Force Attack Detected`

#### 2. Rate Limiting Alerts

**Trigger**: Same IP rate limited multiple times
- **Threshold**: 3+ rate limit violations in 1 hour
- **Alert Level**: MEDIUM
- **Email To**: Admin email
- **Subject**: `⚠️ Repeated Rate Limit Violations`

**Trigger**: DDoS pattern detected
- **Threshold**: 50+ requests from same IP in 1 minute
- **Alert Level**: CRITICAL
- **Email To**: Admin email + SMS
- **Subject**: `🚨 CRITICAL: Potential DDoS Attack`

#### 3. Malware Detection Alerts

**Trigger**: Malware upload blocked
- **Threshold**: Any malware detection
- **Alert Level**: HIGH
- **Email To**: Admin email
- **Subject**: `🦠 SECURITY: Malware Upload Blocked`

**Trigger**: Multiple malware attempts
- **Threshold**: 3+ malware uploads from same user/IP
- **Alert Level**: CRITICAL
- **Email To**: Admin email + Security team
- **Subject**: `🚨 CRITICAL: Repeated Malware Upload Attempts`

#### 4. Suspicious Activity Alerts

**Trigger**: Unauthorized admin access attempt
- **Threshold**: Any attempt to access `/admin/*` without admin role
- **Alert Level**: HIGH
- **Email To**: Admin email
- **Subject**: `🔒 SECURITY: Unauthorized Admin Access Attempt`

**Trigger**: API abuse detected
- **Threshold**: 100+ 404 errors from same IP in 10 minutes (scanning)
- **Alert Level**: MEDIUM
- **Email To**: Admin email
- **Subject**: `⚠️ Potential Vulnerability Scanning Detected`

#### 5. System Health Alerts

**Trigger**: Virus scanner offline
- **Threshold**: ClamAV unhealthy for 5+ minutes
- **Alert Level**: HIGH
- **Email To**: Admin email + DevOps
- **Subject**: `🚨 CRITICAL: Virus Scanner Offline`

**Trigger**: Database errors spiking
- **Threshold**: 10+ database errors in 1 minute
- **Alert Level**: CRITICAL
- **Email To**: Admin email + DevOps
- **Subject**: `🚨 CRITICAL: Database Error Spike`

---

### Alert Configuration

**Database Table**: `security_alert_config`

```sql
CREATE TABLE security_alert_config (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,          -- 'failed_login', 'malware', 'rate_limit', etc.
  enabled BOOLEAN DEFAULT TRUE,
  threshold INTEGER NOT NULL,
  time_window_minutes INTEGER NOT NULL,
  alert_level TEXT NOT NULL,         -- 'low', 'medium', 'high', 'critical'
  email_recipients TEXT NOT NULL,    -- JSON array of emails
  sms_recipients TEXT,               -- JSON array of phone numbers (optional)
  cooldown_minutes INTEGER DEFAULT 60,  -- Min time between repeat alerts
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Database Table**: `security_alert_history`

```sql
CREATE TABLE security_alert_history (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,
  alert_level TEXT NOT NULL,
  triggered_by TEXT NOT NULL,        -- IP address or user ID
  details TEXT,                      -- JSON details
  triggered_at TIMESTAMP NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP,
  email_recipients TEXT,             -- Who was notified
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP,
  notes TEXT
);
```

---

### Email Templates

#### Template: Failed Login Attempts

```
Subject: ⚠️ Multiple Failed Login Attempts Detected

Security Alert - ManuscriptHub

Alert Level: MEDIUM
Triggered: 2025-11-08 23:15:32 UTC

Details:
- IP Address: 205.169.39.29
- Failed Attempts: 6
- Time Window: 5 minutes
- Email Attempted: scarter4work@yahoo.com
- User Agent: Mozilla/5.0 (Windows NT 10.0)
- Geographic Location: United States

Actions Taken:
- IP rate limited for 15 minutes
- Account lockout: No (not yet implemented)

Recommended Actions:
1. Review IP activity in security dashboard
2. Check if legitimate user forgot password
3. Consider blocking IP if pattern continues

View Details: https://selfpubhub.co/admin-security.html?ip=205.169.39.29

--
ManuscriptHub Security Team
This is an automated alert. Do not reply to this email.
```

#### Template: Malware Detection

```
Subject: 🦠 SECURITY: Malware Upload Blocked

Security Alert - ManuscriptHub

Alert Level: HIGH
Triggered: 2025-11-08 23:20:15 UTC

Details:
- User: john.doe@example.com (ID: user_abc123)
- File: suspicious_document.pdf
- Virus Detected: Eicar-Test-Signature
- Scanner: ClamAV
- Upload Blocked: YES

User Details:
- Account Created: 2025-11-01
- Previous Uploads: 3
- Subscription: Free

Actions Taken:
- File upload blocked
- Security incident logged
- User account flagged for review

Recommended Actions:
1. Review user's previous uploads
2. Contact user if false positive suspected
3. Consider account suspension if malicious

View Incident: https://selfpubhub.co/admin-security.html?incident=inc_xyz789

--
ManuscriptHub Security Team
This is an automated alert. Do not reply to this email.
```

---

### Alert Aggregation

To avoid alert spam, implement **alert aggregation**:

**Cooldown Period**: Don't send duplicate alerts within cooldown (default: 60 minutes)

**Daily Digest**: Low-priority alerts sent as daily summary email

**Batching**: If 5+ similar alerts trigger within 10 minutes, send one aggregated email

**Example Aggregated Alert**:
```
Subject: ⚠️ Security Alert Digest (5 incidents)

5 security incidents in the last 10 minutes:

1. Failed Login Attempts (3 incidents)
   - IPs: 205.169.39.29, 102.129.152.18, 185.253.162.25

2. Rate Limit Violations (2 incidents)
   - IPs: 212.102.39.201, 95.108.213.82

View All Incidents: https://selfpubhub.co/admin-security.html
```

---

### API Endpoints

```
GET  /admin/security/alerts/config           - Get alert configuration
PUT  /admin/security/alerts/config/:type     - Update alert config
GET  /admin/security/alerts/history          - Alert history
POST /admin/security/alerts/test             - Send test alert
PATCH /admin/security/alerts/:id/acknowledge - Mark alert as acknowledged
POST /admin/security/alerts/silence          - Silence alerts for period
```

---

### Implementation

#### 1. Alert Checker Service

**File**: `src/services/security-alert-checker.js`

```javascript
// Background job that runs every minute
async function checkSecurityAlerts(env) {
  const alerts = await getActiveAlertConfigs(env);

  for (const alert of alerts) {
    const triggered = await checkAlertCondition(alert, env);

    if (triggered && !isInCooldown(alert)) {
      await sendAlert(alert, env);
      await logAlertHistory(alert, env);
    }
  }
}
```

#### 2. Alert Sender

**File**: `src/services/alert-sender.js`

```javascript
async function sendAlert(alert, env) {
  const template = getEmailTemplate(alert.alert_type);
  const recipients = JSON.parse(alert.email_recipients);

  await sendEmail({
    to: recipients,
    subject: template.subject,
    html: template.render(alert.details)
  });

  // Optional: Send SMS for critical alerts
  if (alert.alert_level === 'critical' && alert.sms_recipients) {
    await sendSMS(alert.sms_recipients, template.smsText);
  }
}
```

---

### Deployment

**Option 1: Scheduled Job (Render Cron)**
- Configure cron job on Render to run every 1-5 minutes
- Calls alert checker endpoint
- Simple but requires paid plan

**Option 2: Background Worker**
- Run alert checker as separate background service
- Uses setInterval to check continuously
- More reliable but uses more resources

**Option 3: Event-Driven (Recommended)**
- Trigger alerts when events happen (e.g., after failed login)
- More efficient, real-time alerts
- Requires code changes in handlers

---

### Success Criteria

- [ ] Alert configuration stored in database
- [ ] All 6 alert types implemented
- [ ] Email templates created and tested
- [ ] Alert aggregation working (no spam)
- [ ] Cooldown period enforced
- [ ] Alert history logged
- [ ] Test alerts can be triggered manually
- [ ] Acknowledged alerts marked in database
- [ ] Admin can enable/disable alerts
- [ ] Admin can configure thresholds

---

### Testing

1. **Test Failed Login Alerts**:
   - Make 6 failed login attempts
   - Verify email sent to admin
   - Check alert logged in history

2. **Test Malware Alert**:
   - Upload EICAR test file
   - Verify HIGH alert sent
   - Check user details in email

3. **Test Alert Aggregation**:
   - Trigger 5+ similar alerts in 10 minutes
   - Verify single aggregated email sent

4. **Test Cooldown**:
   - Trigger alert
   - Trigger same alert 5 minutes later
   - Verify second alert NOT sent (cooldown)

5. **Test Configuration**:
   - Disable alert type
   - Trigger condition
   - Verify NO email sent

---

### Configuration UI

**Location**: `frontend/admin-security.html` (new tab)

**Alert Configuration Tab:**
- List of all alert types
- Enable/disable toggle
- Threshold input
- Time window input
- Alert level dropdown
- Email recipients (comma-separated)
- Cooldown period
- Test button (sends test alert)

---

### Integration Points

- Uses Resend API for email delivery (already configured)
- Integrates with `security_incidents` table
- Uses `audit_log` for alert acknowledgment
- Connects to rate limiter for DDoS detection
- Uses virus scanner health status

---

### Files to Create

- `migrations/migration_040_security_alerts.sql` - Alert tables
- `src/services/security-alert-checker.js` - Alert checker service
- `src/services/alert-sender.js` - Email/SMS sender
- `src/handlers/security-alert-handlers.js` - API endpoints
- `src/templates/alert-emails.js` - Email templates
- Frontend: Add "Alerts" tab to `admin-security.html`

---

### Cost Estimate

**Email Sending (Resend):**
- Free tier: 3,000 emails/month
- After free tier: $0.10 per 1,000 emails
- **Estimated cost**: $0-2/month (assuming <30 alerts/day)

**SMS (Optional - Twilio):**
- $0.0075 per SMS
- **Estimated cost**: $0-5/month (critical alerts only)

**Infrastructure:**
- No additional cost (runs on existing Render service)

**Total**: $0-7/month

---

**Estimated Effort**: 1 day
**Dependencies**: Resend email service (already configured)
**Business Value**: Critical for security incident response
