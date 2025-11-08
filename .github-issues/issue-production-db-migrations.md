## 🚨 CRITICAL: Apply Database Migrations to Production

**Priority**: P0 - CRITICAL
**Type**: Bug / Deployment
**Status**: Production site is DOWN

---

### Problem Description

Production database schema is out of sync with code, causing **complete site failure**. Multiple database queries fail due to missing columns that the application code expects.

**Production URL**: https://selfpubhub.co (currently non-functional)

---

### Critical Errors Identified

#### 1. Missing `role` column in `users` table
```
error: column "role" does not exist
Query: SELECT id, email, full_name, role, subscription_tier, created_at, last_login FROM users WHERE id = $1
```

#### 2. Missing `uploaded_at` column in `manuscripts` table
```
error: column "uploaded_at" does not exist
Query: SELECT * FROM manuscripts WHERE user_id = $1 ORDER BY uploaded_at DESC
```

#### 3. Missing `word_count` column in `manuscripts` table
```
error: column "word_count" does not exist
Query: SELECT SUM(word_count) as total FROM manuscripts WHERE user_id = $1
```

#### 4. Redis cache not initialized
```
Cache get error: TypeError: Cannot read properties of undefined (reading 'get')
at CacheManager.get (file:///opt/render/project/src/src/utils/db-cache.js:62:35)
```

#### 5. `origin` variable undefined in auth-handlers.js
```
ReferenceError: origin is not defined
at Object.handleGetMe [as getMe] (file:///opt/render/project/src/src/handlers/auth-handlers.js:403:56)
```

---

### Root Cause

Production PostgreSQL database does not have all migrations applied. Code expects columns that were added in recent migrations but never applied to production database.

**Development environment**: All migrations applied ✅
**Production environment**: Migrations NOT applied ❌

---

### Solution

Apply all database migrations to production PostgreSQL database on Render.

### Steps to Fix

#### Option A: Apply combined-schema.sql (cleanest)
```bash
# Download current schema
psql $DATABASE_URL -c "\d users" > current-schema.txt
psql $DATABASE_URL -c "\d manuscripts" > current-schema.txt

# Apply combined schema (all migrations)
psql $DATABASE_URL < combined-schema.sql
```

#### Option B: Apply individual migrations in order
```bash
# Apply each migration file in order
for migration in migrations/migration_*.sql; do
  echo "Applying $migration..."
  psql $DATABASE_URL < "$migration"
done
```

#### Option C: Manual column additions (quick fix)
```sql
-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'author';

-- Add missing columns to manuscripts table
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT NOW();
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS word_count INTEGER;
```

---

### Additional Fixes Required

#### Fix 1: Redis Cache Initialization
**File**: `server.js:79-94`

Ensure Redis client is properly passed to env object and initialized before use:
```javascript
// Verify Redis client is connected before creating env
if (!redisClient || !redisClient.isReady) {
  console.warn('Redis client not ready');
}
```

#### Fix 2: Origin Variable Error
**File**: `src/handlers/auth-handlers.js:403`

Add origin variable declaration:
```javascript
const origin = request.headers.get('origin') || process.env.FRONTEND_URL;
```

---

### Testing Steps

After applying migrations:

1. **Test database queries**:
   ```bash
   psql $DATABASE_URL -c "SELECT id, email, full_name, role FROM users LIMIT 1;"
   psql $DATABASE_URL -c "SELECT id, title, uploaded_at, word_count FROM manuscripts LIMIT 1;"
   ```

2. **Test production API**:
   ```bash
   curl https://selfpubhub.co/auth/me -H "Authorization: Bearer $TOKEN"
   ```

3. **Test dashboard load**:
   - Visit https://selfpubhub.co/dashboard.html
   - Verify no database errors in console
   - Verify manuscript list loads

4. **Test Redis cache**:
   - Check server logs for "Cache get error"
   - Should see cache hits/misses without errors

---

### Acceptance Criteria

- [ ] All database migrations applied to production database
- [ ] No "column does not exist" errors in production logs
- [ ] Dashboard loads successfully at https://selfpubhub.co/dashboard.html
- [ ] User authentication works (`GET /auth/me` succeeds)
- [ ] Manuscript list displays correctly
- [ ] Redis cache operates without errors
- [ ] No critical errors in production logs
- [ ] Health check endpoint returns 200 OK

---

### Rollback Plan

If migrations cause issues:

1. **Database snapshot**: Render creates automatic backups
2. **Restore from backup**:
   - Render Dashboard → Database → Backups
   - Restore to point before migration
3. **Redeploy previous worker version**

---

### Impact

**Current state**: Site is completely non-functional
**User impact**: Authors cannot access dashboard, upload manuscripts, or use any features
**Business impact**: No revenue generation possible until fixed

**Estimated downtime**: 15-30 minutes (time to apply migrations + verify)

---

### Files to Check

- `combined-schema.sql` - Complete schema with all migrations
- `migrations/` - Individual migration files
- `server.js:79-94` - Redis client initialization
- `src/handlers/auth-handlers.js:403` - Origin variable error
- `src/utils/db-cache.js:62` - Redis cache usage

---

### Notes

- **Virus scanner**: ClamAV Background Worker deployed and running successfully ✅
- **Environment variables**: CLAMAV_HOST and CLAMAV_PORT still need to be added to Web Service (separate task)
- **Database**: PostgreSQL on Render (connection string in environment)
- **Redis**: Redis on Render (connection string in environment)

---

### Related Issues

- Issue #65: File Virus Scanning for Uploads (ClamAV deployed, environment variables pending)

---

**Estimated Effort**: 30 minutes
**Assignee**: @scarter4work
**Labels**: bug, critical, production, database, p0
