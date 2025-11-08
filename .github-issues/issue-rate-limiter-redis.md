# 🚨 CRITICAL: Migrate Rate Limiter from Cloudflare KV to Redis

## Priority: CRITICAL
**Impact**: ALL rate-limited endpoints will fail on Render
**Effort**: 2-3 hours
**Risk**: Production-breaking

## Problem

The rate limiter at `src/utils/rate-limiter.js` still uses Cloudflare KV (`env.SESSIONS`) instead of Redis. This causes ALL rate-limited endpoints to fail on Render.

**Affected Endpoints** (5+):
- `POST /auth/login` - Login rate limiting
- `POST /auth/register` - Registration abuse prevention
- `POST /auth/password-reset-request` - Password reset throttling
- `POST /upload/manuscript` - Upload abuse prevention
- All public API endpoints with rate limits

## Current Code (BROKEN)

```javascript
// src/utils/rate-limiter.js:115
async function isRateLimited(identifier, env) {
  const key = getRateLimitKey(identifier);
  const data = await env.SESSIONS.get(key);  // ❌ Uses Cloudflare KV
  // ...
}

// src/utils/rate-limiter.js:156
async function recordAttempt(identifier, env) {
  // ...
  await env.SESSIONS.put(key, JSON.stringify(data), {  // ❌ Uses Cloudflare KV
    expirationTtl: RATE_LIMIT_WINDOW
  });
}

// src/utils/rate-limiter.js:179
async function clearRateLimit(identifier, env) {
  const key = getRateLimitKey(identifier);
  await env.SESSIONS.delete(key);  // ❌ Uses Cloudflare KV
}
```

## Required Changes

### 1. Update isRateLimited() (Line 115)

```javascript
// BEFORE
const data = await env.SESSIONS.get(key);

// AFTER
const data = await env.REDIS.get(key);
const parsed = data ? JSON.parse(data) : null;
```

### 2. Update recordAttempt() (Line 156)

```javascript
// BEFORE
await env.SESSIONS.put(key, JSON.stringify(data), {
  expirationTtl: RATE_LIMIT_WINDOW
});

// AFTER
await env.REDIS.setEx(key, RATE_LIMIT_WINDOW, JSON.stringify(data));
```

### 3. Update clearRateLimit() (Line 179)

```javascript
// BEFORE
await env.SESSIONS.delete(key);

// AFTER
await env.REDIS.del(key);
```

### 4. Update per-endpoint rate limiters (Lines 385, 419)

Same pattern: Replace `env.SESSIONS` with `env.REDIS` using proper Redis commands.

## Testing Checklist

- [ ] Test login rate limiting (5 failed attempts)
- [ ] Test registration rate limiting
- [ ] Test password reset rate limiting
- [ ] Test rate limit expiration (after 5 minutes)
- [ ] Test rate limit clearing on successful login
- [ ] Test concurrent requests from same IP
- [ ] Verify Redis keys use correct TTL

## Redis API Reference

**Cloudflare KV** → **Redis** mapping:
- `KV.get(key)` → `REDIS.get(key)` (returns string, need JSON.parse)
- `KV.put(key, val, {expirationTtl})` → `REDIS.setEx(key, ttl, val)`
- `KV.delete(key)` → `REDIS.del(key)`

## Files to Modify

1. `src/utils/rate-limiter.js` (5 locations)
2. Update tests: `tests/rate-limiting.test.js` (if exists)

## Acceptance Criteria

- [ ] All rate-limited endpoints return 429 after threshold
- [ ] Redis TTL correctly expires rate limit windows
- [ ] Rate limits clear on successful authentication
- [ ] No references to `env.SESSIONS` remain for rate limiting
- [ ] Tests pass with Redis mock

## Related Issues

- Part of Render migration (see CLOUDFLARE-MIGRATION-AUDIT.md)
- Blocks production deployment
- Related to #[auth-handlers recent changes]

## References

- Audit report: `CLOUDFLARE-MIGRATION-AUDIT.md` (Issue #1)
- Redis adapter: `src/adapters/session-adapter.js`
- Rate limiter: `src/utils/rate-limiter.js`