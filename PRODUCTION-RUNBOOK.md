# Production Operations Runbook

**Environment:** Production (api.scarter4workmanuscripthub.com)
**Last Updated:** October 25, 2025
**On-Call:** scarter4work@yahoo.com

---

## Quick Reference

### Emergency Contacts
- **Primary:** scarter4work@yahoo.com
- **Cloudflare Account:** scarter4work@yahoo.com
- **Stripe Support:** https://support.stripe.com

### Critical URLs
- **API:** https://api.scarter4workmanuscripthub.com
- **Frontend:** https://scarter4workmanuscripthub.com
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **GitHub Repo:** https://github.com/scarter4work/manuscript-platform

### Quick Commands
```bash
# View live logs
npx wrangler tail --format pretty

# Check deployment status
npx wrangler deployments list --name manuscript-upload-api

# Rollback to previous version
npx wrangler rollback --message "Rollback due to issue"

# Query production database
npx wrangler d1 execute manuscript-platform --remote --command "SQL_HERE"
```

---

## Common Issues & Solutions

### 🔴 Issue 1: API Completely Down (5xx Errors)

**Symptoms:**
- UptimeRobot alerts: API down
- All requests return 500 errors
- `wrangler tail` shows errors

**Diagnosis:**
```bash
# Check worker status
npx wrangler deployments list

# Check live errors
npx wrangler tail --format pretty
```

**Common Causes:**
1. **Bad deployment** → Rollback
2. **Database connection issue** → Check D1 status
3. **Missing environment variable** → Check secrets
4. **Cloudflare outage** → Check https://www.cloudflarestatus.com

**Resolution:**
```bash
# Option 1: Rollback immediately
npx wrangler rollback

# Option 2: Check recent deployment
npx wrangler deployments list
# Find last known-good version
# Manually rollback in dashboard

# Option 3: Check database
npx wrangler d1 execute manuscript-platform --remote --command "SELECT 1"
```

**Prevention:**
- Always test in local before deploying
- Keep changelog of deployments
- Use staging environment (MAN-32 - CI/CD)

---

### 🔴 Issue 2: Authentication Broken

**Symptoms:**
- Users can't log in
- "Unauthorized" errors on all authenticated endpoints
- Session validation failing

**Diagnosis:**
```bash
# Check if JWT_SECRET is set
npx wrangler secret list | grep JWT_SECRET

# Test login endpoint
curl -X POST https://api.scarter4workmanuscripthub.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123@"}'
```

**Common Causes:**
1. **JWT_SECRET missing/corrupted** → Regenerate
2. **KV namespace issue** → Check sessions KV
3. **CORS misconfiguration** → Check headers

**Resolution:**
```bash
# Check KV namespace
npx wrangler kv namespace list

# Regenerate JWT_SECRET if needed
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET

# Clear old sessions (if corrupted)
# Manual cleanup in KV dashboard
```

**Impact:** 🔴 Critical - No users can access platform

---

### 🟡 Issue 3: Password Reset Not Working

**Symptoms:**
- Users report not receiving password reset emails
- 500 errors on `/auth/password-reset-request`

**Diagnosis:**
```bash
# Check recent logs
npx wrangler tail --format pretty

# Test password reset
curl -X POST https://api.scarter4workmanuscripthub.com/auth/password-reset-request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Common Causes:**
1. **MailChannels not configured** → Check DNS/domain verification
2. **Email environment variables missing** → Check wrangler.toml
3. **Database schema issue** → Check verification_tokens table

**Resolution:**
```bash
# Check email environment variables
cat wrangler.toml | grep EMAIL

# Check verification_tokens table
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT COUNT(*) FROM verification_tokens WHERE token_type='password_reset'"

# Test email sending manually
# Use MailChannels API test: https://api.mailchannels.net/tx/v1/send
```

**Workaround:**
- Manually reset password via database:
```bash
# Generate new password hash (PBKDF2)
# Update user password_hash in database
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE users SET password_hash='NEW_HASH' WHERE email='user@example.com'"
```

**Impact:** 🟡 High - Users locked out if they forget password

---

### 🟡 Issue 4: High Error Rate (5-10%)

**Symptoms:**
- Cloudflare Analytics shows 5-10% error rate
- Some requests fail, others succeed
- No complete outage

**Diagnosis:**
```bash
# Monitor live requests
npx wrangler tail --format pretty

# Check error patterns in Cloudflare Analytics
# Dashboard → Workers → Metrics → Filter by 5xx
```

**Common Causes:**
1. **Specific endpoint broken** → Check recent code changes
2. **Database timeouts** → Check D1 query performance
3. **R2 throttling** → Check R2 request rate
4. **Invalid input causing errors** → Add input validation

**Resolution:**
1. Identify which endpoint has high error rate
2. Check recent deployments (did error rate spike after deploy?)
3. Review error logs for patterns
4. Consider rollback if errors started after deployment

**Example Investigation:**
```bash
# Get last 100 log entries
npx wrangler tail --format pretty > logs.txt

# Search for errors
grep "error" logs.txt | head -20

# Identify common pattern
# Fix and deploy
```

**Impact:** 🟡 Medium - Partial service degradation

---

### 🟡 Issue 5: Slow Response Times

**Symptoms:**
- P95 response time > 3 seconds
- Users report slow page loads
- No errors, just slow

**Diagnosis:**
```bash
# Check Cloudflare Analytics
# Dashboard → Workers → Metrics → Duration tab

# Test specific endpoint
time curl https://api.scarter4workmanuscripthub.com/manuscripts

# Check database query performance
# Dashboard → D1 → manuscript-platform → Metrics
```

**Common Causes:**
1. **Slow database queries** → Add indexes
2. **Large file operations** → Optimize R2 access
3. **External API delays** (Anthropic, Stripe) → Add timeouts
4. **Cold start** (first request after inactivity) → Normal

**Resolution:**
```sql
-- Add database indexes for slow queries
CREATE INDEX IF NOT EXISTS idx_manuscripts_user_id ON manuscripts(author_id);
CREATE INDEX IF NOT EXISTS idx_manuscripts_created ON manuscripts(created_at);

-- Check query performance
EXPLAIN QUERY PLAN
SELECT * FROM manuscripts WHERE author_id = 'user_id' ORDER BY created_at DESC;
```

**Quick Fix:**
- Enable caching for frequently accessed data (use KV)
- Reduce payload size (pagination)
- Optimize database queries

**Impact:** 🟡 Medium - Poor user experience

---

### 🔵 Issue 6: Queue Processing Delays

**Symptoms:**
- Queue depth increasing
- Analysis jobs not completing
- Users waiting for results

**Diagnosis:**
```bash
# Check queue status
npx wrangler queues list

# Check queue consumers
npx wrangler queues consumer list manuscript-analysis-queue

# Check dead letter queue
npx wrangler queues consumer list manuscript-analysis-dlq
```

**Common Causes:**
1. **Consumer not running** → Redeploy worker
2. **Jobs failing and retrying** → Check error logs
3. **High volume** → Normal, will catch up
4. **Anthropic API rate limits** → Add backoff

**Resolution:**
```bash
# If consumer stopped, redeploy
npx wrangler deploy

# If jobs failing, check DLQ
# Review failed jobs for patterns

# If rate limited, messages will retry automatically
# Monitor queue depth - should decrease over time
```

**Impact:** 🔵 Low - Analysis delayed but not broken

---

## Deployment Procedures

### Standard Deployment

```bash
# 1. Test locally
npm run dev
# Run tests

# 2. Commit changes
git add .
git commit -m "Description of changes"
git push origin main

# 3. Deploy to production
npx wrangler deploy

# 4. Verify deployment
curl https://api.scarter4workmanuscripthub.com/manuscripts
# Should return 401 (API is up)

# 5. Monitor for 15 minutes
npx wrangler tail --format pretty
# Watch for errors
```

### Emergency Rollback

```bash
# Option 1: Quick rollback command
npx wrangler rollback --message "Emergency rollback"

# Option 2: Deploy specific version
# 1. Find last known-good deployment
npx wrangler deployments list

# 2. Get commit hash from that time
git log --oneline

# 3. Checkout that commit
git checkout <commit-hash>

# 4. Deploy
npx wrangler deploy

# 5. Return to main
git checkout main
```

---

## Database Operations

### Safe Query Practices

```bash
# ALWAYS test queries with SELECT first
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM users WHERE email='test@example.com' LIMIT 1"

# Then run UPDATE/DELETE
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE users SET email_verified=1 WHERE email='test@example.com'"

# NEVER run DELETE without WHERE clause
# NEVER run UPDATE without WHERE clause
```

### Common Database Tasks

**Add Test User:**
```sql
-- Already have: prodtest3@example.com (from production tests)
-- Use this for testing
```

**Check User Count:**
```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT COUNT(*) as total, SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as admins FROM users"
```

**View Recent Registrations:**
```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT email, role, created_at, email_verified FROM users ORDER BY created_at DESC LIMIT 10"
```

**Clean Up Test Data:**
```bash
# BE CAREFUL - verify user first
npx wrangler d1 execute manuscript-platform --remote --command \
  "DELETE FROM users WHERE email LIKE 'prodtest%@example.com'"
```

---

## Monitoring Checklist

### Daily Checks (5 minutes)

- [ ] Check UptimeRobot - all green?
- [ ] Review Cloudflare Analytics - error rate < 1%?
- [ ] Check Sentry - any new critical errors?
- [ ] Review email alerts - any warnings?

### Weekly Checks (15 minutes)

- [ ] Database size - growing normally?
- [ ] R2 storage - within budget?
- [ ] Queue depth - processing smoothly?
- [ ] Cost tracking - Anthropic/Cloudflare bills
- [ ] User growth - registrations increasing?

### Monthly Checks (30 minutes)

- [ ] Security audit - any vulnerabilities?
- [ ] Dependency updates - npm audit
- [ ] Performance review - response times acceptable?
- [ ] Cost analysis - optimize spending
- [ ] Backup verification - test restore

---

## Escalation Matrix

### Self-Service (5-30 minutes)

**Try First:**
1. Check this runbook
2. Review recent logs (`wrangler tail`)
3. Check Cloudflare status
4. Review recent deployments
5. Test with curl commands

### Development Escalation (30m - 2h)

**Contact:** scarter4work@yahoo.com

**When:**
- Issue not in runbook
- Rollback doesn't fix
- Data corruption suspected
- Custom code changes needed

### Infrastructure Escalation (2h+)

**Contact:** Cloudflare Support

**When:**
- Cloudflare platform issue
- D1/R2/KV unavailable
- Multiple services down
- Billing/account issues

**Support:** https://dash.cloudflare.com → Support → Create Ticket

---

## Maintenance Windows

### Scheduled Maintenance

**Timing:** Sundays 2-4 AM UTC (lowest traffic)

**Notification:**
- Update status page 48h before
- Email users 24h before
- Display banner on site during window

**Tasks:**
- Database maintenance (vacuum, reindex)
- Dependency updates
- Security patches
- Performance optimization

### Emergency Maintenance

**When:**
- Critical security vulnerability
- Data corruption risk
- Complete service failure

**Process:**
1. Update status page immediately
2. Take action (rollback, patch, etc.)
3. Post-mortem within 24h
4. Update runbook with learnings

---

## Post-Incident Process

### Immediate (Within 1 hour)

1. Resolve the incident
2. Verify service restored
3. Document timeline
4. Notify users if impacted

### Short-term (Within 24 hours)

1. Write incident report
2. Identify root cause
3. Implement immediate fix
4. Update monitoring/alerts

### Long-term (Within 1 week)

1. Conduct post-mortem meeting
2. Identify systemic issues
3. Create prevention tasks
4. Update runbook/playbooks
5. Improve monitoring

### Incident Report Template

```markdown
# Incident Report: [Issue Name]

**Date:** YYYY-MM-DD
**Duration:** X hours Y minutes
**Severity:** Critical/High/Medium/Low
**Affected Users:** X users (Y%)

## Summary
Brief description of what happened

## Timeline
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored
- HH:MM - Incident closed

## Root Cause
Technical explanation of what went wrong

## Resolution
What was done to fix it

## Impact
- Number of affected users
- Duration of impact
- Revenue impact (if any)
- Data loss (if any)

## Action Items
- [ ] Immediate fix (done)
- [ ] Add monitoring alert
- [ ] Update runbook
- [ ] Improve testing
- [ ] Code review process change
```

---

## Contact Information

**Primary On-Call:** scarter4work@yahoo.com

**External Services:**
- Cloudflare Support: https://dash.cloudflare.com
- Stripe Support: https://support.stripe.com
- GitHub Support: https://support.github.com

**Documentation:**
- Production Status: `PRODUCTION-ENVIRONMENT-STATUS.md`
- Test Results: `PRODUCTION-TEST-RESULTS.md`
- Monitoring Guide: `MONITORING-IMPLEMENTATION-GUIDE.md`
- Security Audit: `SECURITY-AUDIT-REPORT.md`

---

**Last Updated:** October 25, 2025
**Next Review:** After first production incident
