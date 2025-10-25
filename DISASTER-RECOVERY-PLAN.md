# Disaster Recovery Plan

**Last Updated:** October 25, 2025
**Issue:** MAN-29
**Status:** Active
**Owner:** scarter4work@yahoo.com

---

## Executive Summary

This document outlines the disaster recovery procedures for the Manuscript Publishing Platform. It defines recovery time objectives (RTO), recovery point objectives (RPO), and step-by-step recovery procedures for various disaster scenarios.

### Key Metrics

- **Recovery Time Objective (RTO):** < 4 hours for critical systems, < 24 hours for full platform
- **Recovery Point Objective (RPO):** < 24 hours for database, < 1 hour for manuscripts
- **Backup Frequency:** Daily automated backups at 3 AM UTC
- **Backup Retention:** 30 daily, 12 monthly, 7 yearly
- **Last Successful Backup:** Check dashboard or run `npx wrangler r2 object list manuscript-platform-backups`

---

## Table of Contents

1. [Automated Backup System](#automated-backup-system)
2. [Disaster Scenarios & Recovery Procedures](#disaster-scenarios--recovery-procedures)
3. [Recovery Procedures](#recovery-procedures)
4. [Testing & Verification](#testing--verification)
5. [Roles & Responsibilities](#roles--responsibilities)
6. [Communication Plan](#communication-plan)

---

## Automated Backup System

### D1 Database Backups

**Schedule:** Daily at 3 AM UTC (CRON: `0 3 * * *`)

**What's Backed Up:**
- All user accounts and profiles
- Manuscript metadata
- Subscription data
- Transaction history
- Analysis results metadata
- DMCA requests
- Backup logs

**Backup Process:**
1. Export D1 database to SQL format
2. Compress using gzip (typical 70-80% size reduction)
3. Upload to R2 bucket: `manuscript-platform-backups`
4. Retention policy automatically manages old backups
5. Log backup success/failure in `backup_logs` table

**Backup Storage:**
- **Location:** R2 bucket `manuscript-platform-backups`
- **Format:** `.sql.gz` (gzipped SQL dump)
- **Naming:** `backup-YYYY-MM-DD-timestamp.sql.gz`
- **Encryption:** Encrypted at rest by Cloudflare R2
- **Versioning:** R2 object versioning enabled (30-day retention)

**Retention Policy:**
- **Daily backups:** Keep 30 most recent
- **Monthly backups:** Keep 12 (one per month for the last year)
- **Yearly backups:** Keep 7 (one per year for the last 7 years)

### R2 Storage (Manuscripts & Assets)

**Protection Strategy:**
- **Versioning:** Enabled on all R2 buckets
- **Soft Delete:** 30-day grace period before permanent deletion
- **Lifecycle Policies:** Archive old versions after 90 days

**Buckets:**
1. `manuscripts-raw` - Original uploaded files
2. `manuscripts-processed` - Processed/analyzed files
3. `marketing-assets` - Generated marketing materials
4. `manuscript-platform-backups` - Database backups

---

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:**
- SQL errors on all requests
- Data integrity violations
- Cannot read/write to database
- Worker logs show D1 errors

**Impact:** 🔴 **Critical** - Platform completely unusable

**Recovery Steps:**

1. **Verify Corruption** (5 minutes)
   ```bash
   # Try to query database
   npx wrangler d1 execute manuscript-platform --remote --command "SELECT COUNT(*) FROM users"

   # If this fails with SQLITE_CORRUPT or similar, proceed with restore
   ```

2. **Identify Latest Good Backup** (5 minutes)
   ```bash
   # List recent backups
   npx wrangler r2 object list manuscript-platform-backups --limit 10

   # Check backup logs in database (if accessible)
   npx wrangler d1 execute manuscript-platform --remote --command \
     "SELECT * FROM backup_logs WHERE status='success' ORDER BY created_at DESC LIMIT 5"
   ```

3. **Download Backup** (5 minutes)
   ```bash
   # Download the latest successful backup
   npx wrangler r2 object get manuscript-platform-backups/backup-YYYY-MM-DD-timestamp.sql.gz \
     --file ./restore-backup.sql.gz

   # Decompress
   gunzip restore-backup.sql.gz
   ```

4. **Restore Database** (15-30 minutes)
   ```bash
   # WARNING: This will overwrite the current database!

   # Execute SQL dump
   # Note: Large files may need to be split into smaller chunks
   npx wrangler d1 execute manuscript-platform --remote --file=./restore-backup.sql
   ```

5. **Verify Restoration** (10 minutes)
   ```bash
   # Check record counts
   npx wrangler d1 execute manuscript-platform --remote --command \
     "SELECT 'users' as table_name, COUNT(*) as count FROM users
      UNION ALL SELECT 'manuscripts', COUNT(*) FROM manuscripts
      UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions"

   # Test API endpoints
   curl https://api.scarter4workmanuscripthub.com/manuscripts
   # Should return 401 (API working)
   ```

6. **Assess Data Loss** (15 minutes)
   - Identify time range of lost data (backup time → corruption time)
   - Notify affected users if necessary
   - Document incident

**Total RTO:** ~1-2 hours

---

### Scenario 2: Accidental Data Deletion

**Symptoms:**
- User reports missing manuscripts
- Admin accidentally deleted records
- Bulk deletion error

**Impact:** 🟡 **High** - Data loss but platform functional

**Recovery Steps:**

1. **Assess Scope** (5 minutes)
   ```bash
   # Check when deletion occurred
   # Review recent activity in logs
   npx wrangler tail --format pretty | grep "DELETE"

   # Check backup_logs for last backup before deletion
   npx wrangler d1 execute manuscript-platform --remote --command \
     "SELECT * FROM backup_logs WHERE timestamp < 'DELETION_TIME' ORDER BY created_at DESC LIMIT 1"
   ```

2. **For Database Records:**
   - Use point-in-time restore from backup (see Scenario 1)
   - Restore only affected tables to minimize disruption

3. **For R2 Objects (Manuscripts):**
   ```bash
   # Check if versioning can recover
   npx wrangler r2 object get manuscripts-raw/OBJECT_KEY --version-id VERSION_ID

   # List versions of an object
   npx wrangler r2 object list manuscripts-raw --prefix OBJECT_KEY --include-versions

   # Restore specific version
   npx wrangler r2 object put manuscripts-raw/OBJECT_KEY --file ./restored-file
   ```

4. **Verify Recovery**
   - Test restored data
   - Notify affected users
   - Document incident

**Total RTO:** 30 minutes - 2 hours depending on scope

---

### Scenario 3: Complete Platform Failure

**Symptoms:**
- Cloudflare Workers offline
- All API requests fail
- Database unreachable
- R2 storage unreachable

**Impact:** 🔴 **Critical** - Complete outage

**Recovery Steps:**

1. **Diagnose Root Cause** (10 minutes)
   ```bash
   # Check Cloudflare status
   curl https://www.cloudflarestatus.com/api/v2/status.json

   # Check worker status
   npx wrangler deployments list

   # Check logs
   npx wrangler tail --format pretty
   ```

2. **If Cloudflare Regional Outage:**
   - Wait for Cloudflare resolution (check status page)
   - Data is safe (multi-region replication)
   - Estimated resolution: 1-4 hours

3. **If Worker Deployment Issue:**
   ```bash
   # Rollback to previous working version
   npx wrangler rollback --message "Emergency rollback"

   # Or redeploy from known-good commit
   git checkout <known-good-commit>
   npx wrangler deploy
   git checkout main
   ```

4. **If Database or R2 Failure:**
   - Contact Cloudflare support immediately
   - Escalate to emergency support
   - Provide account ID and service details

5. **Notify Users**
   - Update status page
   - Send email to all active users
   - Post on social media
   - Provide ETA for restoration

**Total RTO:** 1-4 hours (Cloudflare outage), 30 minutes (deployment issue)

---

### Scenario 4: R2 Data Loss (Manuscripts)

**Symptoms:**
- Manuscripts cannot be retrieved
- 404 errors on manuscript downloads
- R2 bucket appears empty

**Impact:** 🔴 **Critical** - User content loss

**Recovery Steps:**

1. **Verify Data Loss** (5 minutes)
   ```bash
   # List R2 objects
   npx wrangler r2 object list manuscripts-raw

   # Try to retrieve specific object
   npx wrangler r2 object get manuscripts-raw/MANUSCRIPT_ID
   ```

2. **Check R2 Versioning** (10 minutes)
   ```bash
   # List all versions of affected objects
   npx wrangler r2 object list manuscripts-raw --include-versions

   # Restore from version history if available
   ```

3. **Contact Cloudflare Support** (immediate)
   - R2 data loss is extremely rare
   - Cloudflare has multi-region redundancy
   - May be able to restore from internal backups

4. **Fallback: User Backups**
   - Some users may have local copies
   - Request affected users to re-upload
   - Offer compensation for inconvenience

**Total RTO:** 4-24 hours depending on Cloudflare support response

---

### Scenario 5: Security Breach / Data Compromise

**Symptoms:**
- Unauthorized access detected
- Suspicious database modifications
- API keys leaked
- Admin account compromised

**Impact:** 🔴 **Critical** - Security incident

**Recovery Steps:**

1. **Immediate Actions** (15 minutes)
   ```bash
   # Rotate all secrets immediately
   openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
   # Repeat for all secrets (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, etc.)

   # Revoke all active sessions
   npx wrangler kv:key list --namespace-id SESSIONS_ID
   # Delete all session keys
   ```

2. **Assess Damage** (30-60 minutes)
   - Review logs for unauthorized access
   - Identify compromised accounts
   - Check for data exfiltration
   - Document incident timeline

3. **Restore from Pre-Breach Backup** (1-2 hours)
   - Identify backup from before breach
   - Restore database (see Scenario 1)
   - Verify integrity of restored data

4. **Secure Platform** (1-2 hours)
   - Patch security vulnerability
   - Update authentication mechanisms
   - Enable additional security measures
   - Force password resets for affected users

5. **Notify Stakeholders** (immediate)
   - Notify affected users
   - Report to authorities if required (GDPR, etc.)
   - Document incident for post-mortem

6. **Post-Incident**
   - Conduct full security audit
   - Implement additional safeguards
   - Update incident response plan

**Total RTO:** 4-8 hours for restoration, ongoing security hardening

---

## Recovery Procedures

### Manual Backup Trigger

If you need to create a backup outside the scheduled time:

```bash
# Option 1: Trigger via wrangler CRON (simulates scheduled event)
# Not directly supported - use Option 2

# Option 2: Run backup script locally (requires D1 local access)
# This requires extending backup-worker.js to support CLI execution

# Option 3: Temporarily adjust CRON schedule
# Edit wrangler.toml, deploy, wait for execution, revert
```

### Manual Restore Process

```bash
# 1. Download backup
npx wrangler r2 object get manuscript-platform-backups/backup-2025-10-25-xxxxxx.sql.gz \
  --file ./restore.sql.gz

# 2. Decompress
gunzip restore.sql.gz

# 3. Preview SQL (optional)
head -n 100 restore.sql

# 4. Execute restore
npx wrangler d1 execute manuscript-platform --remote --file=./restore.sql

# 5. Verify
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM manuscripts;"
```

### Backup Verification

**Monthly Verification Process:**

1. Download latest backup
2. Restore to local D1 instance (not production!)
3. Run integrity checks:
   ```bash
   # Check referential integrity
   SELECT COUNT(*) FROM manuscripts WHERE author_id NOT IN (SELECT id FROM users);
   # Should return 0

   # Check for NULL primary keys
   SELECT COUNT(*) FROM users WHERE id IS NULL;
   # Should return 0
   ```
4. Document verification results
5. Update backup log

---

## Testing & Verification

### Monthly Backup Test (Required)

**Schedule:** First Monday of each month

**Procedure:**
1. Select a recent backup (not latest - test one week old)
2. Restore to local/staging environment
3. Run automated tests against restored data
4. Verify user count, manuscript count match backup metadata
5. Document results in backup test log

**Expected Duration:** 30 minutes

### Disaster Recovery Drill (Quarterly)

**Schedule:** Once per quarter

**Procedure:**
1. Simulate disaster scenario (choose from list above)
2. Execute recovery procedures without looking at documentation
3. Time the recovery process
4. Document gaps and issues
5. Update procedures based on learnings

**Expected Duration:** 2-4 hours

---

## Roles & Responsibilities

| Role | Person | Responsibilities | Contact |
|------|--------|------------------|---------|
| **Incident Commander** | scarter4work@yahoo.com | Overall incident management, decision-making | scarter4work@yahoo.com |
| **Technical Lead** | scarter4work@yahoo.com | Execute recovery procedures | scarter4work@yahoo.com |
| **Communications Lead** | scarter4work@yahoo.com | User communication, status updates | scarter4work@yahoo.com |
| **Cloudflare Support** | Cloudflare | Infrastructure support | https://dash.cloudflare.com |

---

## Communication Plan

### Internal Communication

- **Primary:** Email (scarter4work@yahoo.com)
- **Secondary:** Cloudflare Dashboard notifications
- **Logs:** Centralized in worker logs (`wrangler tail`)

### User Communication

**During Incident:**
- Status page update (if available)
- Email to all active users
- Social media post
- Banner on platform

**Post-Incident:**
- Detailed incident report
- Root cause analysis
- Steps taken to prevent recurrence
- Compensation (if applicable)

### Escalation Path

1. **Level 1:** Self-service recovery (<  hours)
2. **Level 2:** Cloudflare standard support (< 4 hours)
3. **Level 3:** Cloudflare emergency support (< 1 hour response)
4. **Level 4:** External consultants (if needed)

---

## Backup System Configuration

### Creating the Backup Bucket

```bash
# Create R2 backup bucket
npx wrangler r2 bucket create manuscript-platform-backups

# Enable versioning (via dashboard or API)
# Cloudflare Dashboard → R2 → manuscript-platform-backups → Settings → Object Versioning: Enabled

# Set lifecycle policy (via dashboard)
# Archive versions older than 90 days
```

### Monitoring Backup Health

**Daily Checks:**
```bash
# Check if backup ran last night
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 1"

# Expected: Backup from within last 24 hours with status='success'
```

**Weekly Checks:**
```bash
# Check backup size trends
npx wrangler r2 object list manuscript-platform-backups --limit 7

# Verify retention policy working
# Should have roughly 30-40 backups total
npx wrangler r2 object list manuscript-platform-backups | wc -l
```

### Alerts & Notifications

**Critical Alerts (implement with monitoring):**
- Backup failure (send email immediately)
- Backup size anomaly (>50% change)
- No backup in 36 hours
- Backup bucket unreachable

---

## Compliance & Audit

### GDPR Compliance

- **Right to be Forgotten:** Backups must be purged when user requests deletion
- **Data Retention:** 7-year retention policy documented
- **Breach Notification:** 72-hour notification window for data breaches

### SOC 2 Requirements

- Monthly backup verification tests
- Documented recovery procedures
- Quarterly disaster recovery drills
- Audit trail for all recovery operations

---

## Appendix: Backup File Analysis

### Inspecting Backup Contents

```bash
# Download and decompress
npx wrangler r2 object get manuscript-platform-backups/backup-2025-10-25-xxx.sql.gz \
  --file backup.sql.gz
gunzip backup.sql.gz

# View backup metadata (in compressed file header)
zcat backup.sql.gz | head -n 10

# Count tables in backup
grep "CREATE TABLE" backup.sql | wc -l

# Count INSERT statements (row count)
grep "INSERT INTO" backup.sql | wc -l
```

### Backup File Structure

```sql
-- Database Backup
-- Generated: 2025-10-25T03:00:00.000Z
-- Platform: Manuscript Publishing Platform

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Table: users
DROP TABLE IF EXISTS users;
CREATE TABLE users (...);
INSERT INTO users (...) VALUES (...);

-- (more tables)

-- Indexes
CREATE INDEX idx_manuscripts_user_id ON manuscripts(author_id);

COMMIT;
PRAGMA foreign_keys=ON;
```

---

## Contact Information

**Primary:** scarter4work@yahoo.com
**Cloudflare Support:** https://dash.cloudflare.com → Support
**Emergency Escalation:** Cloudflare Enterprise Support (if subscribed)

---

## Document Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-25 | 1.0 | Initial disaster recovery plan | Claude Code |

---

**Last Updated:** October 25, 2025
**Next Review:** After first backup restore or Q1 2026
**Related Documents:**
- `PRODUCTION-RUNBOOK.md` - Daily operations
- `MONITORING-IMPLEMENTATION-GUIDE.md` - Monitoring setup
- `SECURITY-AUDIT-REPORT.md` - Security procedures
