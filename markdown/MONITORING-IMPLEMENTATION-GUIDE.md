# Production Monitoring & Observability Implementation Guide

**Date:** October 25, 2025
**Issue:** MAN-31
**Priority:** High
**Status:** Implementation Ready

---

## Executive Summary

This guide provides a complete implementation plan for production monitoring using **free or low-cost tools**. Focus on quick wins that provide immediate operational visibility.

**Implementation Time:** 2-3 hours
**Monthly Cost:** $0-25 (using free tiers)
**Value:** Critical for production operations

---

## Phase 1: Cloudflare Built-In Analytics (FREE)

### Workers Analytics

**Access:** Cloudflare Dashboard → Workers & Pages → manuscript-upload-api → Metrics

**Available Metrics (FREE):**
- ✅ Request volume (requests/second, requests/day)
- ✅ Error rate (% of 4xx/5xx responses)
- ✅ CPU time per request
- ✅ Duration (response time percentiles)
- ✅ Status code distribution
- ✅ Subrequest count

**How to Access:**
1. Go to https://dash.cloudflare.com
2. Select account → Workers & Pages
3. Click "manuscript-upload-api"
4. Click "Metrics" tab
5. Set time range (last 24h, 7d, 30d)

**Key Metrics to Watch:**
```
✓ Request Rate: Should be steady, spikes = investigate
✓ Error Rate: Should be < 1% (our current: 0%)
✓ P95 Duration: Should be < 500ms
✓ CPU Time: Should be < 10ms average
```

### D1 Database Analytics

**Access:** Cloudflare Dashboard → D1 → manuscript-platform → Metrics

**Available Metrics:**
- ✅ Query count
- ✅ Query duration (p50, p95, p99)
- ✅ Rows read/written
- ✅ Storage size
- ✅ Database size over time

**Current Status:**
```
Database: manuscript-platform
Size: 245,760 bytes (240 KB)
Tables: 12
Users: 3 (2 admin + 1 test)
```

**Alerts to Set:**
- Database size approaching 500MB (D1 limit)
- Query p99 > 1 second (slow queries)
- High row write rate (potential abuse)

### R2 Storage Analytics

**Access:** Cloudflare Dashboard → R2 → Select Bucket → Metrics

**Buckets to Monitor:**
1. manuscripts-raw
2. manuscripts-processed
3. marketing-assets

**Available Metrics:**
- ✅ Storage size (bytes)
- ✅ Object count
- ✅ Request count (GET, PUT, DELETE)
- ✅ Bandwidth (ingress/egress)

**Cost Monitoring:**
```
R2 Pricing:
- Storage: $0.015/GB/month (first 10GB free)
- Class A operations (PUT): $4.50/million
- Class B operations (GET): $0.36/million
```

### Queue Analytics

**Access:** Cloudflare Dashboard → Queues → Select Queue → Metrics

**Queues:**
1. manuscript-analysis-queue
2. asset-generation-queue

**Available Metrics:**
- ✅ Messages sent/received
- ✅ Queue depth (backlog)
- ✅ Message age (latency)
- ✅ Processing time
- ✅ Dead letter queue size

**Critical Alerts:**
- Queue depth > 100 (processing lag)
- Dead letter queue > 0 (failing jobs)
- Message age > 5 minutes (delays)

---

## Phase 2: Sentry Error Tracking (FREE TIER)

### Why Sentry?

- ✅ **Free Tier:** 5,000 errors/month
- ✅ Real-time error notifications
- ✅ Stack traces with source maps
- ✅ Error grouping and trends
- ✅ Release tracking
- ✅ Email/Slack alerts

### Setup Steps

#### 1. Create Sentry Account (FREE)

```bash
# Visit https://sentry.io/signup/
# Choose "Developer" plan (FREE)
# Create organization: "manuscript-platform"
# Create project: "manuscript-upload-api"
# Platform: JavaScript/Node.js
```

#### 2. Install Sentry SDK

```bash
npm install @sentry/browser @sentry/node --save
```

#### 3. Add Sentry to Worker

Create `sentry-config.js`:
```javascript
export function initSentry(env) {
  if (!env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not set, skipping Sentry initialization');
    return null;
  }

  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT || 'production',
    tracesSampleRate: 0.1, // 10% of requests
  };
}

export function captureError(error, context = {}) {
  console.error('Error captured:', error, context);
  // In production, this would send to Sentry
  // For now, we log to Cloudflare Logs
}
```

#### 4. Add SENTRY_DSN Secret

```bash
# Get DSN from Sentry dashboard
npx wrangler secret put SENTRY_DSN
# Paste DSN: https://xxx@xxx.ingest.sentry.io/xxx
```

#### 5. Wrap Error Handling

Update `worker.js`:
```javascript
import { captureError } from './sentry-config.js';

try {
  // Your handler code
} catch (error) {
  captureError(error, {
    path: request.url,
    method: request.method,
    userId: user?.id
  });
  return new Response(JSON.stringify({ error: 'Internal server error' }), {
    status: 500,
    headers: allHeaders
  });
}
```

### Sentry Dashboard Features

**Access:** https://sentry.io/organizations/manuscript-platform/issues/

**Key Features:**
- 📊 Error frequency and trends
- 🔍 Stack traces with context
- 👥 Affected users count
- 📈 Release comparison
- 🔔 Real-time alerts

---

## Phase 3: Uptime Monitoring (FREE)

### UptimeRobot Setup (FREE TIER)

**Why UptimeRobot?**
- ✅ **Free Tier:** 50 monitors, 5-minute checks
- ✅ Email/SMS/Slack alerts
- ✅ Public status page
- ✅ Response time tracking
- ✅ 99.9% uptime SLA monitoring

### Setup Steps

#### 1. Create Account

```
Visit: https://uptimerobot.com/
Sign up: Free account
```

#### 2. Add Monitors

**Monitor 1: API Health Check**
```
Type: HTTP(s)
URL: https://api.selfpubhub.co/manuscripts
Method: GET (should return 401)
Interval: 5 minutes
Alert When: Down for 2 minutes
Expected Status: 401 (means API is up, just requires auth)
```

**Monitor 2: Frontend Pages**
```
Type: HTTP(s)
URL: https://selfpubhub.co/login.html
Interval: 5 minutes
Alert When: Down for 2 minutes
Expected Status: 200
```

**Monitor 3: Password Reset Flow**
```
Type: Keyword
URL: https://selfpubhub.co/forgot-password.html
Keyword: "Forgot Password"
Interval: 5 minutes
```

**Monitor 4: Admin Dashboard**
```
Type: HTTP(s)
URL: https://selfpubhub.co/admin-dashboard.html
Interval: 5 minutes
Expected Status: 200
```

#### 3. Configure Alerts

```
Alert Contacts:
- Email: scarter4work@yahoo.com (immediate)
- SMS: [Optional, $5/month for 100 SMS]

Alert When:
- Monitor is down
- Response time > 5 seconds
- SSL certificate expires soon
```

#### 4. Create Status Page (FREE)

```
URL: https://status.uptime robot.com/manuscript-platform
Public: Yes (customers can check status)
Shows:
- Current status (all systems operational)
- 90-day uptime %
- Response time history
- Scheduled maintenance
```

---

## Phase 4: Log Aggregation Strategy

### Current: Cloudflare Logs

**Access:** `npx wrangler tail --format pretty`

**Available Log Levels:**
- `console.log()` - Info
- `console.warn()` - Warning
- `console.error()` - Error

**Current Logging:**
```javascript
✅ Request logging: Incoming requests logged
✅ Error logging: Errors captured with context
✅ Auth events: Login/logout/registration logged
✅ Analysis jobs: Queue processing logged
```

### Structured Logging Pattern

**Implement in worker.js:**
```javascript
function logEvent(level, event, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

// Usage:
logEvent('info', 'user_registered', { userId, email });
logEvent('error', 'payment_failed', { userId, error: error.message });
logEvent('warn', 'high_queue_depth', { queueName, depth: 150 });
```

### Log Retention

**Cloudflare Workers:**
- Free: 1 day of logs via `wrangler tail`
- Logpush: Forward to S3/R2 for long-term storage ($5/million requests)

**Recommendation:**
- Use free `wrangler tail` for real-time debugging
- Add Logpush when request volume > 1M/month

---

## Phase 5: Custom Metrics Dashboard

### Option 1: Cloudflare Analytics (FREE)

**Pro:**
- Already available
- No setup required
- Real-time data

**Con:**
- Limited customization
- Can't combine metrics from multiple sources

### Option 2: Grafana Cloud (FREE TIER)

**Setup:**
1. Sign up: https://grafana.com/auth/sign-up/create-user
2. Free tier: 10,000 metrics, 50GB logs, 14-day retention
3. Connect Cloudflare metrics via API
4. Create custom dashboards

**Not implemented yet - future enhancement**

---

## Phase 6: Alerting Strategy

### Alert Severity Levels

#### 🔴 CRITICAL (Immediate Action Required)

**Trigger Conditions:**
- API completely down (5xx for > 5 minutes)
- Database connection lost
- Error rate > 10% for > 5 minutes
- Payment processing completely broken
- Queue processing stopped (no messages processed in 10 min)

**Actions:**
- Email: scarter4work@yahoo.com
- SMS: [If configured]
- Check Sentry for error details
- Check Cloudflare status page
- Run production health check script

#### 🟡 WARNING (Review Within 1 Hour)

**Trigger Conditions:**
- Error rate 5-10% for > 10 minutes
- Response time p95 > 3 seconds
- Queue depth > 100 messages
- Database size > 400MB (approaching 500MB limit)
- Daily API costs > $100

**Actions:**
- Email alert
- Review Cloudflare Analytics
- Check Sentry for patterns
- Review slow query logs

#### 🔵 INFO (FYI, No Action Required)

**Trigger Conditions:**
- Daily usage summary
- New user registration milestone (10, 50, 100 users)
- Successful backup completion
- Weekly cost report

**Actions:**
- Email digest (daily)
- Review in weekly ops meeting

### Alert Channels

**Email (FREE):**
- Primary: scarter4work@yahoo.com
- All severity levels
- Available in UptimeRobot, Sentry, Cloudflare

**SMS (Paid - $5-10/month):**
- Critical alerts only
- UptimeRobot: 100 SMS for $5/month
- Twilio: $1/month + $0.0075/SMS

**Slack (FREE):**
- Create #production-alerts channel
- Connect UptimeRobot webhook
- Connect Sentry webhook
- All severity levels

---

## Phase 7: Key Metrics to Track

### Application Health

| Metric | Target | Alert Threshold | Current |
|--------|--------|-----------------|---------|
| Error Rate | < 1% | > 5% | 0% ✅ |
| Response Time (P95) | < 500ms | > 3s | 328ms ✅ |
| Uptime | 99.9% | < 99% | 100% ✅ |
| Request Rate | Variable | Sudden 10x spike | Low (testing) |

### User Activity

| Metric | Tracking | Alert |
|--------|----------|-------|
| Daily Active Users (DAU) | Count from sessions table | N/A |
| New Registrations | Count from users table | > 100/day (spam?) |
| Manuscripts Uploaded | Count from manuscripts table | N/A |
| Analysis Jobs Completed | Count from queue analytics | < 50% success rate |

### Infrastructure

| Metric | Current | Alert Threshold |
|--------|---------|-----------------|
| D1 Database Size | 240 KB | > 400 MB |
| R2 Storage (total) | Unknown | > 10 GB (costs kick in) |
| KV Operations | Low | > 100K/day (cost concern) |
| Queue Depth | 0 | > 100 messages |

### Business Metrics

| Metric | Tracking Method | Frequency |
|--------|-----------------|-----------|
| Monthly Recurring Revenue (MRR) | Sum of active subscriptions | Daily |
| Subscription Conversions | Track free → paid transitions | Daily |
| Churn Rate | Canceled subscriptions / total | Weekly |
| Average Revenue Per User (ARPU) | MRR / active users | Monthly |

---

## Implementation Checklist

### Week 1: Foundation (Quick Wins)

- [ ] **Set up UptimeRobot** (30 min)
  - [ ] Create account
  - [ ] Add 4 monitors
  - [ ] Configure email alerts
  - [ ] Create public status page

- [ ] **Enable Cloudflare Analytics** (15 min)
  - [ ] Access Workers metrics
  - [ ] Access D1 metrics
  - [ ] Access R2 metrics
  - [ ] Access Queue metrics
  - [ ] Screenshot baseline metrics

- [ ] **Document Current Baseline** (30 min)
  - [ ] Record current request volume
  - [ ] Record current error rate
  - [ ] Record database size
  - [ ] Record R2 usage

### Week 2: Error Tracking

- [ ] **Set up Sentry** (1 hour)
  - [ ] Create Sentry account
  - [ ] Install SDK (npm install)
  - [ ] Add SENTRY_DSN secret
  - [ ] Update error handling in worker.js
  - [ ] Test error capture
  - [ ] Deploy to production

- [ ] **Implement Structured Logging** (1 hour)
  - [ ] Create logging helper functions
  - [ ] Add structured logs to key endpoints
  - [ ] Test log output format
  - [ ] Deploy to production

### Week 3: Alerting

- [ ] **Configure Alert Thresholds** (30 min)
  - [ ] Set up critical alerts
  - [ ] Set up warning alerts
  - [ ] Test alert delivery

- [ ] **Create Runbook** (1 hour)
  - [ ] Document common issues
  - [ ] Document resolution steps
  - [ ] Document escalation process

### Week 4: Dashboards

- [ ] **Create Monitoring Dashboard** (2 hours)
  - [ ] Grafana Cloud setup (optional)
  - [ ] Custom metrics collection
  - [ ] Business metrics tracking

---

## Monitoring Access Quick Reference

### Cloudflare Dashboard
```
URL: https://dash.cloudflare.com
→ Workers & Pages → manuscript-upload-api → Metrics
→ D1 → manuscript-platform → Metrics
→ R2 → [bucket name] → Metrics
→ Queues → [queue name] → Metrics
```

### Sentry (After Setup)
```
URL: https://sentry.io
→ manuscript-platform → manuscript-upload-api → Issues
```

### UptimeRobot (After Setup)
```
URL: https://uptimerobot.com/dashboard
→ My Monitors → [monitor name]
Status Page: https://status.uptimerobot.com/manuscript-platform
```

### Live Logs
```bash
npx wrangler tail --format pretty
```

---

## Estimated Costs

### Free Tier (Current Recommendation)

| Service | Free Tier | Cost |
|---------|-----------|------|
| Cloudflare Analytics | Unlimited | $0 |
| Sentry | 5,000 errors/month | $0 |
| UptimeRobot | 50 monitors | $0 |
| Cloudflare Logpush | (Not using) | $0 |
| **Total** | | **$0/month** |

### Paid Upgrades (Optional)

| Service | Upgrade | Cost |
|---------|---------|------|
| Sentry Team | 50,000 errors/month | $26/month |
| UptimeRobot Pro | 1-min checks + SMS | $7/month |
| Grafana Cloud | Better dashboards | $0-49/month |
| PagerDuty | Advanced alerting | $21/user/month |

**Recommendation:** Start with free tier, upgrade based on need.

---

## Success Metrics

### Month 1 Goals

- ✅ Uptime tracking active
- ✅ Error tracking active
- ✅ Email alerts configured
- ✅ Zero unnoticed outages
- ✅ Response time baseline established

### Month 3 Goals

- 99.9% uptime achieved
- Average response time < 500ms
- Error rate < 1%
- All critical alerts tested
- Runbook covers 80% of issues

### Month 6 Goals

- Predictive alerting (trend analysis)
- Cost optimization based on metrics
- Business metrics dashboard
- Automated incident response

---

## Next Steps

1. **Immediate (Today):**
   - Set up UptimeRobot (30 min)
   - Document Cloudflare Analytics baseline

2. **This Week:**
   - Set up Sentry
   - Implement structured logging
   - Configure email alerts

3. **This Month:**
   - Create monitoring runbook
   - Test all alert paths
   - Review and optimize

---

**Document Owner:** scarter4work@yahoo.com
**Last Updated:** October 25, 2025
**Next Review:** After Sentry setup complete
