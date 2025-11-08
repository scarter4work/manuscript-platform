# Production Operations Runbook

**Environment:** Production (api.selfpubhub.co)
**Last Updated:** October 25, 2025
**On-Call:** scarter4work@yahoo.com

---

## Quick Reference

### Emergency Contacts
- **Primary:** scarter4work@yahoo.com
- **Cloudflare Account:** scarter4work@yahoo.com
- **Stripe Support:** https://support.stripe.com

### Critical URLs
- **API:** https://api.selfpubhub.co
- **Frontend:** https://selfpubhub.co
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
curl -X POST https://api.selfpubhub.co/auth/login \
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
curl -X POST https://api.selfpubhub.co/auth/password-reset-request \
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
time curl https://api.selfpubhub.co/manuscripts

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

### 🟡 Issue 7: Stripe Webhooks Failing

**Symptoms:**
- Stripe webhook deliveries show failures in Stripe Dashboard
- Payments successful but subscriptions not activated
- 400 "Invalid signature" errors in logs

**Diagnosis:**
```bash
# Check webhook secret is set
npx wrangler secret list | grep STRIPE_WEBHOOK_SECRET

# Monitor webhook attempts
npx wrangler tail --format pretty | grep "\[Webhook\]"

# Check Stripe Dashboard
# Developers → Webhooks → View endpoint → Recent deliveries
```

**Common Causes:**
1. **Wrong webhook secret** → Misconfigured STRIPE_WEBHOOK_SECRET
2. **Body parsing issue** → Code modification broke signature verification
3. **Endpoint timeout** → Worker taking too long to respond
4. **Disabled endpoint** → Webhook endpoint turned off in Stripe

**Resolution:**
```bash
# Step 1: Verify webhook secret matches Stripe Dashboard
# Stripe Dashboard → Developers → Webhooks → Endpoint → Signing secret

# Step 2: Update secret in Cloudflare
echo "whsec_CORRECT_SECRET" | npx wrangler secret put STRIPE_WEBHOOK_SECRET

# Step 3: Test webhook from Stripe Dashboard
# Send test webhook: checkout.session.completed
# Should return 200 OK with {"received":true}

# Step 4: If still failing, check logs
npx wrangler tail --format pretty
# Look for error details
```

**Impact:** 🟡 High - Subscriptions not activating, users charged but no access

**Prevention:**
- Document webhook secret during initial setup
- Test webhooks after every deployment
- Monitor webhook delivery success rate in Stripe Dashboard

---

### 🔵 Issue 8: Payment Successful but Subscription Not Created

**Symptoms:**
- Payment shows as successful in Stripe
- User charged but has no active subscription
- No subscription record in database
- Webhook delivered successfully (200 OK)

**Diagnosis:**
```bash
# Check if webhook was received
npx wrangler tail --format pretty | grep "\[Webhook\]"

# Check for subscription in database
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM subscriptions WHERE stripe_customer_id='cus_xxxxx'"

# Check Stripe Dashboard for subscription status
# Customers → Find customer → Subscriptions tab
```

**Common Causes:**
1. **Missing metadata** → Stripe session missing `user_id` in metadata
2. **Database error** → Subscription insert failed silently
3. **User doesn't exist** → user_id in metadata points to non-existent user
4. **Webhook timing** → Webhook arrived before checkout page loaded

**Resolution:**
```bash
# Step 1: Find Stripe subscription ID
# Stripe Dashboard → Customers → Find customer → Copy subscription ID

# Step 2: Manually create subscription record
npx wrangler d1 execute manuscript-platform --remote --command \
  "INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_customer_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at) \
   VALUES ('sub_' || hex(randomblob(16)), 'USER_ID_HERE', 'sub_xxxxx', 'cus_xxxxx', 'basic', 'active', unixepoch(), unixepoch() + 2592000, 0, unixepoch(), unixepoch())"

# Step 3: Verify user now has access
curl -H "Authorization: Bearer USER_TOKEN" \
  https://api.selfpubhub.co/subscription/status
```

**Impact:** 🔵 Low - Rare occurrence, manually fixable

**Prevention:**
- Always include `metadata: {user_id: userId}` in Stripe checkout sessions
- Add database transaction logging
- Monitor subscription creation success rate

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
curl https://api.selfpubhub.co/manuscripts
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

## Stripe Operations

### Viewing Subscriptions

**Check all active subscriptions:**
```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT s.id, s.stripe_subscription_id, u.email, s.plan_id, s.status, \
   datetime(s.current_period_end, 'unixepoch') as period_ends \
   FROM subscriptions s \
   JOIN users u ON s.user_id = u.id \
   WHERE s.status = 'active' \
   ORDER BY s.created_at DESC"
```

**Check specific user's subscription:**
```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM subscriptions WHERE user_id='USER_ID_HERE'"
```

### Refunding Payments

**Process:**
1. Go to Stripe Dashboard → Payments
2. Find the payment intent
3. Click **Refund** → Full or Partial
4. Add reason (shows on customer statement)
5. Confirm refund

**Or via API (if needed):**
```bash
# Use Stripe CLI (requires installation)
stripe refunds create --payment-intent=pi_xxxxx --amount=1000
```

### Canceling Subscriptions

**User-initiated (normal flow):**
- User cancels via dashboard
- Subscription marked `cancel_at_period_end = 1`
- Access continues until period ends
- Stripe webhook updates database

**Admin-initiated (support request):**
```bash
# Option 1: Cancel immediately (via Stripe Dashboard)
# Customers → Find customer → Subscriptions → Cancel subscription → Cancel immediately

# Option 2: Cancel at period end (via Stripe Dashboard)
# Customers → Find customer → Subscriptions → Cancel subscription → At period end

# Update database to match
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE subscriptions SET cancel_at_period_end=1, updated_at=unixepoch() \
   WHERE stripe_subscription_id='sub_xxxxx'"
```

### Webhook Monitoring

**Check recent webhook deliveries:**
1. Stripe Dashboard → Developers → Webhooks
2. Click on production endpoint
3. View **Recent deliveries** tab
4. Look for failures (red)

**Common webhook events to monitor:**
- `checkout.session.completed` - New subscriptions
- `invoice.payment_succeeded` - Successful renewals
- `invoice.payment_failed` - Failed payments (card expired, insufficient funds)
- `customer.subscription.deleted` - Canceled subscriptions

**Resend failed webhook:**
1. Click on failed event
2. Click **Resend event**
3. Monitor worker logs

### Handling Failed Payments

**When invoice.payment_failed webhook received:**

1. **Check Stripe Dashboard:**
   - Customers → Find customer
   - View subscription status (past_due, unpaid)
   - Check payment method (expired card?)

2. **Notify user:**
   - Email sent automatically by Stripe (if configured)
   - Check email logs in Stripe Dashboard

3. **Grace period:**
   - Subscription remains active for 3 days
   - Stripe retries payment automatically
   - After 3 failed attempts → subscription canceled

4. **Manual intervention (if needed):**
   ```bash
   # Check subscription status
   npx wrangler d1 execute manuscript-platform --remote --command \
     "SELECT status FROM subscriptions WHERE stripe_subscription_id='sub_xxxxx'"

   # If user updated card, manually retry invoice
   # Stripe Dashboard → Invoices → Find invoice → Retry payment
   ```

### Testing Stripe Integration

**Test webhook locally:**
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local dev server
stripe listen --forward-to localhost:8787/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

**Test in production (carefully):**
```bash
# Send test webhook from Stripe Dashboard
# Developers → Webhooks → Endpoint → Send test webhook

# Monitor logs
npx wrangler tail --format pretty | grep "\[Webhook\]"
```

---

## Backup & Disaster Recovery Operations

### Checking Backup Status

**Daily backup verification:**
```bash
# Check last backup in database log
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT * FROM backup_logs WHERE status='success' ORDER BY created_at DESC LIMIT 1"

# Expected: Backup from within last 24 hours (runs at 3 AM UTC)
```

**List recent backups:**
```bash
# List last 10 backups
npx wrangler r2 object list manuscript-platform-backups --limit 10

# Check total backup count (should be ~30-40 with retention policy)
npx wrangler r2 object list manuscript-platform-backups | wc -l
```

### Manual Backup Trigger

While backups run automatically daily at 3 AM UTC, you may need to create a manual backup before risky operations:

```bash
# Method: Temporarily adjust CRON schedule and deploy
# 1. Edit wrangler.toml, change cron to run in next few minutes
# 2. Deploy: npx wrangler deploy
# 3. Wait for execution
# 4. Revert wrangler.toml and redeploy

# Alternative: Export database manually
npx wrangler d1 export manuscript-platform --remote --output backup-manual.sql
gzip backup-manual.sql
# Then upload to R2 manually if needed
```

### Restoring from Backup

⚠️ **WARNING: This will overwrite the current database!**

**When to restore:**
- Database corruption detected
- Accidental data deletion
- Need to recover to previous state

**Procedure:**

1. **Identify backup to restore:**
   ```bash
   # List backups with dates
   npx wrangler r2 object list manuscript-platform-backups --limit 10
   ```

2. **Download backup:**
   ```bash
   npx wrangler r2 object get manuscript-platform-backups/backup-YYYY-MM-DD-timestamp.sql.gz \
     --file restore.sql.gz
   ```

3. **Decompress:**
   ```bash
   gunzip restore.sql.gz
   ```

4. **Preview (optional):**
   ```bash
   head -n 100 restore.sql
   # Verify this is the correct backup
   ```

5. **Execute restore:**
   ```bash
   # ⚠️ FINAL WARNING: This overwrites production database!
   npx wrangler d1 execute manuscript-platform --remote --file=restore.sql
   ```

6. **Verify restoration:**
   ```bash
   # Check record counts
   npx wrangler d1 execute manuscript-platform --remote --command \
     "SELECT 'users' as tbl, COUNT(*) as cnt FROM users
      UNION ALL SELECT 'manuscripts', COUNT(*) FROM manuscripts
      UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions"

   # Test API
   curl https://api.selfpubhub.co/manuscripts
   # Should return 401 (API working)
   ```

7. **Assess data loss:**
   - Backup time: `YYYY-MM-DD 03:00 UTC`
   - Current time: `YYYY-MM-DD HH:MM UTC`
   - Lost data: Everything between backup and restore time
   - Notify affected users if significant data loss

### R2 Object Recovery (Manuscripts)

**If a manuscript file is accidentally deleted:**

```bash
# Check if versioning can recover
npx wrangler r2 object list manuscripts-raw --include-versions --prefix MANUSCRIPT_ID

# Restore from specific version
npx wrangler r2 object get manuscripts-raw/MANUSCRIPT_ID --version-id VERSION_ID \
  --file restored-manuscript.pdf

# Re-upload restored version
npx wrangler r2 object put manuscripts-raw/MANUSCRIPT_ID --file restored-manuscript.pdf
```

### Backup Monitoring

**What to monitor:**
- Backup success/failure (daily check)
- Backup file size trends (weekly)
- Backup completion time (should be < 5 minutes)
- Backup retention (should have 30-40 total backups)

**Alerts to configure:**
- ⚠️ **Critical:** Backup failed (check next day at 4 AM UTC)
- ⚠️ **Critical:** No backup in 36 hours
- ℹ️ **Info:** Backup size > 2x previous average
- ℹ️ **Info:** Backup took > 10 minutes

### Monthly Backup Verification Test

**Procedure (first Monday of each month):**

1. Download backup from one week ago (not latest)
2. Restore to local/staging D1 instance (NOT production!)
3. Run integrity checks:
   ```sql
   -- Check referential integrity
   SELECT COUNT(*) FROM manuscripts WHERE author_id NOT IN (SELECT id FROM users);
   -- Should return 0

   -- Check NULL primary keys
   SELECT COUNT(*) FROM users WHERE id IS NULL;
   -- Should return 0
   ```
4. Document results in backup test log
5. If issues found, investigate immediately

### Disaster Recovery Scenarios

For detailed disaster recovery procedures, see `DISASTER-RECOVERY-PLAN.md`.

**Quick reference:**
- **Database corruption:** Restore from last backup (~1-2 hours RTO)
- **Accidental deletion:** Restore from backup or R2 versioning (~30 min - 2 hours)
- **Complete platform failure:** Rollback deployment or wait for Cloudflare (1-4 hours)
- **R2 data loss:** Contact Cloudflare support, use versioning (4-24 hours)
- **Security breach:** Rotate secrets, restore pre-breach backup (4-8 hours)

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
