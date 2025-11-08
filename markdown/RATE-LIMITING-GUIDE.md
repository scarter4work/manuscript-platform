# Rate Limiting & API Protection Guide

**Last Updated:** October 25, 2025
**Issue:** MAN-25
**Status:** Active

---

## Overview

The Manuscript Publishing Platform implements comprehensive rate limiting to:
- Protect against API abuse and DDoS attacks
- Prevent excessive Claude API costs
- Ensure fair resource allocation across users
- Maintain platform stability and performance

---

## Rate Limiting Strategy

Rate limiting is applied at three levels:

1. **Per-IP Limits:** Protect against abuse from single IP addresses
2. **Per-User Limits:** Tier-based limits (FREE, PRO, ENTERPRISE, ADMIN)
3. **Per-Endpoint Limits:** Endpoint-specific protection for sensitive operations

All rate limits use a **sliding window algorithm** stored in Cloudflare Workers KV for distributed rate limiting across edge locations.

---

## Rate Limit Configuration

### Per-IP Limits

Protects against abuse from a single IP address:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 requests | 15 minutes |
| `/auth/register` | 3 requests | 1 hour |
| `/auth/password-reset-request` | 3 requests | 1 hour |
| `/manuscripts/upload` | 10 requests | 1 hour |
| General API | 100 requests | 1 minute |

**Purpose:** Prevent brute force attacks, registration spam, and API flooding

### Per-User Limits (Subscription Tiers)

Enforces subscription tier limits:

#### FREE Tier
- **Manuscripts per month:** 1
- **Analysis per day:** 1
- **API calls per day:** 10
- **Uploads per day:** 1

#### PRO Tier
- **Manuscripts per month:** 10
- **Analysis per day:** 10
- **API calls per day:** 1,000
- **Uploads per day:** 10

#### ENTERPRISE Tier
- **Manuscripts per month:** Unlimited
- **Analysis per day:** Unlimited
- **API calls per day:** 10,000
- **Uploads per day:** Unlimited

#### ADMIN Role
- **All limits:** Unlimited (bypasses rate limiting)

**Purpose:** Enforce subscription tier benefits and prevent abuse

### Per-Endpoint Limits

Additional protection for sensitive endpoints:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/*` | 5 requests | 15 minutes |
| `/manuscripts/upload` | 10 requests | 1 hour |
| `/manuscripts/analyze` | 5 requests | 1 hour |
| `/admin/*` | 1,000 requests | 1 minute |

**Purpose:** Protect expensive operations (Claude API calls, file uploads)

---

## Rate Limit Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 100          # Maximum requests allowed
X-RateLimit-Remaining: 95       # Requests remaining in window
X-RateLimit-Reset: <timestamp>  # When the limit resets
Retry-After: 60                 # Seconds until retry (on 429 only)
```

### Example Response (Normal)

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: Fri, 25 Oct 2025 15:30:00 GMT
Content-Type: application/json

{"data": "..."}
```

### Example Response (Rate Limited)

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: Fri, 25 Oct 2025 15:30:00 GMT
Retry-After: 45
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. IP rate limit exceeded.",
  "limit": 100,
  "remaining": 0,
  "resetAt": "2025-10-25T15:30:00.000Z",
  "retryAfter": "45 seconds"
}
```

---

## Implementation Details

### Architecture

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  Get User Info (if auth'd)  │
│  - User ID                  │
│  - Subscription Tier        │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   Apply Rate Limiting       │
│  1. Check IP limit          │
│  2. Check User limit        │
│  3. Check Endpoint limit    │
└──────┬──────────────────────┘
       │
       ├─ Limited ──► 429 Response
       │
       └─ Allowed ──► Route to Handler
```

### Storage

Rate limit counters are stored in Cloudflare Workers KV:

**Key Format:** `rate_limit:{type}:{identifier}:{endpoint}`

Examples:
- `rate_limit:ip:192.168.1.1:_auth_login`
- `rate_limit:user:user_abc123:_manuscripts_upload`
- `rate_limit:endpoint:192.168.1.1:_admin_users`

**Value Format:**
```json
{
  "count": 5,
  "reset": 1698249600000
}
```

**TTL:** Set to match the rate limit window (auto-expires)

---

## Admin Operations

### Viewing Rate Limit Stats

Check rate limits for a specific IP or user:

```bash
# Via wrangler CLI (requires custom script)
# Check IP rate limits
npx wrangler kv:key list --namespace-id SESSIONS_ID --prefix "rate_limit:ip:192.168.1.1"

# Check user rate limits
npx wrangler kv:key list --namespace-id SESSIONS_ID --prefix "rate_limit:user:user_abc123"
```

### Clearing Rate Limits

If a user or IP is legitimately hitting limits (e.g., testing), admins can clear rate limits:

**Option 1: Via Dashboard (Admin Panel)**
- Navigate to Admin → Rate Limits
- Search for IP or User ID
- Click "Clear Limits"

**Option 2: Via API (Admin only)**
```bash
curl -X POST https://api.selfpubhub.co/admin/rate-limits/clear \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "ip", "identifier": "192.168.1.1"}'
```

**Option 3: Direct KV Manipulation**
```bash
# Delete all rate limit keys for an IP
npx wrangler kv:key delete "rate_limit:ip:192.168.1.1:_auth_login" --namespace-id SESSIONS_ID
npx wrangler kv:key delete "rate_limit:ip:192.168.1.1:general" --namespace-id SESSIONS_ID
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **429 Response Rate:** Should be < 1% of total requests
2. **Top Rate-Limited IPs:** Identify potential attackers
3. **User Tier Limit Hits:** Users consistently hitting limits may need upgrade prompts
4. **Endpoint-Specific Rates:** High upload/analysis rates indicate usage patterns

### Recommended Alerts

**Critical:**
- 429 response rate > 10% for 5 minutes (potential attack)
- Single IP making > 1000 requests/minute

**Warning:**
- 429 response rate > 5% for 10 minutes
- User hitting daily manuscript limit repeatedly

**Info:**
- High number of FREE tier users hitting limits (upgrade opportunity)

---

## Troubleshooting

### Issue: Legitimate User Being Rate Limited

**Symptoms:**
- User reports 429 errors
- User is performing normal operations

**Diagnosis:**
```bash
# Check user's rate limit status
# Get user info from database
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT id, email, subscription_tier FROM users WHERE email='user@example.com'"

# Check KV for rate limits
npx wrangler kv:key list --namespace-id SESSIONS_ID --prefix "rate_limit:user:USER_ID"
```

**Resolution:**
```bash
# Option 1: Clear user's rate limits
# (Use admin API or KV deletion)

# Option 2: Upgrade user's tier
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE users SET subscription_tier='PRO' WHERE id='USER_ID'"

# Option 3: Temporarily increase limits (code change required)
```

### Issue: Bot/Scraper Hitting Rate Limits

**Symptoms:**
- High 429 rate from specific IPs
- Suspicious user agents
- Automated access patterns

**Diagnosis:**
```bash
# Check worker logs for IP
npx wrangler tail --format pretty | grep "192.168.1.1"

# Look for patterns:
# - Rapid sequential requests
# - No valid session
# - Generic user agent
```

**Resolution:**
1. **Let rate limiting work** - It's protecting your API
2. **Block IP via Cloudflare WAF** (if persistent attacker):
   - Dashboard → Security → WAF → Custom Rules
   - Create rule to block specific IP
3. **Add bot detection** - Cloudflare Bot Management (paid feature)

### Issue: Rate Limiting Not Working

**Symptoms:**
- Users can exceed limits
- No 429 responses being returned

**Diagnosis:**
```bash
# Check if rate-limiter.js is imported
grep "rate-limiter" worker.js

# Check if middleware is applied
grep "applyRateLimit" worker.js

# Test manually
curl -I https://api.selfpubhub.co/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# Repeat 6 times - should get 429 on 6th attempt
```

**Resolution:**
1. Verify rate-limiter.js is deployed
2. Check KV namespace is bound correctly
3. Review worker logs for errors
4. Ensure migration_004 was applied (subscription_tier column exists)

---

## Best Practices

### For Developers

1. **Test rate limits in development:**
   ```bash
   # Set aggressive limits for testing
   # In rate-limiter.js, temporarily set low limits
   ```

2. **Handle 429 responses gracefully:**
   ```javascript
   async function makeRequest() {
     const response = await fetch(url);
     if (response.status === 429) {
       const retryAfter = response.headers.get('Retry-After');
       await sleep(retryAfter * 1000);
       return makeRequest(); // Retry
     }
     return response;
   }
   ```

3. **Show rate limit info to users:**
   ```javascript
   const remaining = response.headers.get('X-RateLimit-Remaining');
   if (remaining < 10) {
     alert(`You have ${remaining} requests remaining`);
   }
   ```

### For Users

1. **Check your tier limits** - Understand your subscription limits
2. **Batch operations** - Don't upload manuscripts one-by-one
3. **Use efficient API patterns** - Avoid polling, use webhooks
4. **Upgrade if needed** - If consistently hitting limits, upgrade tier

### For Admins

1. **Monitor 429 rates daily** - High rates indicate problems
2. **Review top rate-limited users** - May need support or upgrades
3. **Adjust limits based on usage** - Review quarterly
4. **Block malicious IPs** - Don't let bots waste resources

---

## Rate Limit Bypass (Admin Only)

Admins automatically bypass all rate limits. This is determined by:

```javascript
// In worker.js
if (user.role === 'admin') {
  userTier = 'ADMIN';  // ADMIN tier has Infinity limits
}
```

**To grant admin status:**
```bash
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE users SET role='admin' WHERE email='admin@example.com'"
```

---

## Performance Considerations

### KV Read/Write Costs

Rate limiting adds:
- **2-3 KV reads per request** (check IP, user, endpoint limits)
- **1 KV write per request** (increment counter)

**Monthly KV Operations (estimated):**
- 10,000 requests/day = 60,000 KV operations/day
- 1.8M operations/month
- Cloudflare Workers: 10M free KV operations/month

**Conclusion:** Rate limiting KV costs are negligible

### Performance Impact

- **Latency:** +5-10ms per request (KV lookups)
- **Edge performance:** KV is globally distributed (low latency)
- **Scalability:** KV scales automatically

---

## Security Considerations

### Rate Limiting is NOT a Complete Security Solution

Rate limiting protects against:
- ✅ Brute force attacks
- ✅ API flooding
- ✅ Resource exhaustion
- ✅ Cost overruns

Rate limiting does NOT protect against:
- ❌ DDoS attacks from distributed IPs (use Cloudflare DDoS protection)
- ❌ SQL injection (use parameterized queries)
- ❌ XSS attacks (use CSP headers)
- ❌ Authentication bypass (use strong auth)

### Additional Security Layers

1. **Cloudflare DDoS Protection:** Enabled by default
2. **WAF Rules:** Block suspicious patterns
3. **Bot Management:** Detect and block bots (paid feature)
4. **IP Reputation:** Block known bad actors
5. **CAPTCHA:** For sensitive operations (future enhancement)

---

## Future Enhancements

Potential improvements to rate limiting:

- [ ] **Adaptive Rate Limiting:** Automatically adjust limits based on attack patterns
- [ ] **User Reputation Scoring:** Lower limits for suspicious users
- [ ] **Geographic Rate Limiting:** Different limits per region
- [ ] **Burst Allowances:** Allow short bursts above limit
- [ ] **Rate Limit Dashboard:** Real-time monitoring UI
- [ ] **Webhook Notifications:** Alert on rate limit violations
- [ ] **Machine Learning Detection:** Identify abnormal patterns

---

## Related Documentation

- **Production Runbook:** `PRODUCTION-RUNBOOK.md` - Operations manual
- **Security Audit:** `SECURITY-AUDIT-REPORT.md` - Security practices
- **Monitoring Guide:** `MONITORING-IMPLEMENTATION-GUIDE.md` - Observability
- **API Documentation:** (to be created) - API usage guidelines

---

## Compliance & Legal

### Terms of Service

Rate limits should be documented in ToS:

> "API usage is subject to rate limits based on your subscription tier. Excessive use may result in temporary throttling. See our Rate Limiting Policy for details."

### Fair Use Policy

> "Users must not abuse the API through automated scripts, bots, or excessive requests. We reserve the right to suspend accounts that violate fair use."

### GDPR Considerations

- **Data Retention:** Rate limit data (IP addresses) stored for 24 hours max
- **Right to Erasure:** Rate limit data automatically expires
- **Transparency:** Users can view their rate limit status

---

## Testing Rate Limits

### Manual Testing

```bash
# Test login rate limit (5 per 15 minutes)
for i in {1..6}; do
  echo "Attempt $i:"
  curl -i -X POST https://api.selfpubhub.co/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "\n---\n"
done

# 6th attempt should return 429
```

### Automated Testing

```javascript
// rate-limit.test.js
describe('Rate Limiting', () => {
  it('should rate limit login attempts', async () => {
    // Make 5 requests (should all succeed)
    for (let i = 0; i < 5; i++) {
      const response = await fetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      });
      expect(response.status).not.toBe(429);
    }

    // 6th request should be rate limited
    const response = await fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeDefined();
  });
});
```

---

## Migration Guide

### Applying the Migration

```bash
# Apply migration to local database
npx wrangler d1 execute manuscript-platform --local --file=./migration_004_rate_limiting.sql

# Apply migration to production database
npx wrangler d1 execute manuscript-platform --remote --file=./migration_004_rate_limiting.sql

# Verify migration
npx wrangler d1 execute manuscript-platform --remote --command \
  "SELECT subscription_tier, COUNT(*) FROM users GROUP BY subscription_tier"

# Expected output:
# subscription_tier | COUNT(*)
# FREE             | 5
```

### Updating Existing Users

All existing users default to FREE tier. To upgrade users:

```bash
# Upgrade user to PRO
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE users SET subscription_tier='PRO' WHERE id='USER_ID'"

# Bulk upgrade based on active subscriptions
npx wrangler d1 execute manuscript-platform --remote --command \
  "UPDATE users SET subscription_tier='PRO'
   WHERE id IN (
     SELECT user_id FROM subscriptions WHERE status='active' AND plan_id='pro'
   )"
```

---

## FAQ

**Q: What happens if I hit the rate limit?**
A: You'll receive a 429 response with a `Retry-After` header indicating when you can retry.

**Q: Do rate limits reset immediately after the window?**
A: Yes, rate limits use a sliding window that resets automatically.

**Q: Can I get my rate limit increased?**
A: Upgrade to a higher tier (PRO or ENTERPRISE) for higher limits. Contact support for custom limits.

**Q: Are WebSocket connections rate limited?**
A: No, WebSockets are not currently rate limited (not implemented yet).

**Q: Do rate limits apply to admin users?**
A: No, users with `role='admin'` bypass all rate limits.

**Q: Can I see my current rate limit status?**
A: Yes, check the `X-RateLimit-*` headers in any API response.

**Q: What if I'm rate limited by mistake?**
A: Contact support with your IP address or user ID, and we can clear your rate limits.

**Q: Do rate limits apply per device or per account?**
A: Both - IP-based limits apply per device, user-based limits apply per account.

---

## Support & Contact

**Rate Limit Issues:** scarter4work@yahoo.com
**Upgrade Requests:** scarter4work@yahoo.com
**Technical Support:** https://github.com/scarter4work/manuscript-platform/issues

---

**Last Updated:** October 25, 2025
**Next Review:** Q1 2026 or after first month of production data
