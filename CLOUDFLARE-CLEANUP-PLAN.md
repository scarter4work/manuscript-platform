# Cloudflare Dependency Cleanup Plan (Issue #73)

## Progress Tracking

### Phase 1: Critical Fixes ✅ COMPLETE

#### ✅ Phase 1.1: Frontend URLs (COMPLETE)
**Status:** 7/7 files fixed
**Time:** ~30 minutes

**Files Fixed:**
- frontend/ai-publishing-assistant.html
- frontend/communication.html
- frontend/author-bio.html
- frontend/formatting.html
- frontend/market-positioning.html
- frontend/marketing-kit.html
- frontend/rights-management.html

**Change:** Replaced `const API_BASE = 'https://manuscript-upload-api.scarter4work.workers.dev'` with:
```javascript
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : window.location.origin;
```

---

#### ✅ Phase 1.2: R2 Storage Audit (COMPLETE)
**Status:** Audited 50 files with direct R2 calls
**Time:** ~1 hour

#### ✅ Phase 1.3: R2 Storage Migration (COMPLETE)
**Status:** 61/61 files migrated (100%)
**Time:** ~3 hours (automated: 59 files, manual: 2 files)

**Current Architecture:**
```javascript
// server.js creates env object with BOTH patterns:
const env = {
  // Pattern 1: Direct bucket access (looks like R2, actually uses B2)
  MANUSCRIPTS_RAW: storage.getBucket('manuscripts_raw'),
  MANUSCRIPTS_PROCESSED: storage.getBucket('manuscripts_processed'),
  MARKETING_ASSETS: storage.getBucket('marketing_assets'),
  BACKUPS: storage.getBucket('backups'),

  // Pattern 2: Direct storage adapter access
  R2: storage,  // Full storage adapter
};
```

**Migration Strategy:**

**Option A (RECOMMENDED): Standardize on env.R2**
```javascript
// BEFORE (misleading - looks like Cloudflare R2)
const manuscript = await env.MANUSCRIPTS_RAW.get(key);
await env.MANUSCRIPTS_PROCESSED.put(key, value);

// AFTER (clear it's using storage adapter)
const rawBucket = env.R2.getBucket('manuscripts_raw');
const manuscript = await rawBucket.get(key);

const processedBucket = env.R2.getBucket('manuscripts_processed');
await processedBucket.put(key, value);
```

**Option B: Rename for clarity (less work)**
```javascript
// Rename in server.js:
MANUSCRIPTS_RAW_B2: storage.getBucket('manuscripts_raw'),
MANUSCRIPTS_PROCESSED_B2: storage.getBucket('manuscripts_processed'),
// ... etc

// Code change:
await env.MANUSCRIPTS_RAW_B2.get(key);
```

**Recommendation:** Use Option A (env.R2) for:
1. **Clarity**: Makes it obvious we're using an adapter, not Cloudflare
2. **Flexibility**: Easy to add new buckets without changing env
3. **Consistency**: Matches database adapter pattern (env.DB)

**Files to Migrate (50 files):**

**Handlers (26 files):**
- src/handlers/admin-handlers.js
- src/handlers/analysis-handlers.js
- src/handlers/asset-handlers.js
- src/handlers/audiobook-generation-handlers.js
- src/handlers/audiobook-handlers.js
- src/handlers/cover-handlers.js
- src/handlers/export-handler.js
- src/handlers/formatting-handlers.js
- src/handlers/kdp-export-handler.js
- src/handlers/legacy-analysis-handlers.js
- src/handlers/legacy-asset-handlers.js
- src/handlers/legacy-format-handlers.js
- src/handlers/legacy-market-handlers.js
- src/handlers/legacy-social-handlers.js
- src/handlers/manuscript-handlers.js
- src/handlers/public-api-handlers.js
- src/handlers/results-handlers.js
- src/handlers/review-handlers.js
- src/handlers/submission-package-handlers.js

**Agents (19 files):**
- src/agents/audiobook-metadata-agent.js
- src/agents/audiobook-narration-agent.js
- src/agents/audiobook-pronunciation-agent.js
- src/agents/audiobook-sample-agent.js
- src/agents/audiobook-timing-agent.js
- src/agents/author-bio-agent.js
- src/agents/back-matter-agent.js
- src/agents/book-description-agent.js
- src/agents/category-agent.js
- src/agents/copy-editing-agent.js
- src/agents/cover-design-agent.js
- src/agents/cover-generation-agent.js
- src/agents/developmental-agent.js
- src/agents/distribution-agent.js
- src/agents/format-conversion-agent.js
- src/agents/keyword-agent.js
- src/agents/line-editing-agent.js
- src/agents/platform-metadata-agent.js
- src/agents/review-monitoring-agent.js
- src/agents/review-response-agent.js
- src/agents/review-sentiment-agent.js
- src/agents/review-trend-agent.js
- src/agents/series-description-agent.js

**Other (5 files):**
- src/generators/kdp-package-generator.js
- src/managers/package-manager.js
- src/router/router.js
- src/utils/db-cache.js
- src/workers/asset-generation-consumer.js
- src/workers/backup-worker.js
- src/workers/queue-consumer.js

---

#### ✅ Phase 1.4-1.5: D1 Database Migration (COMPLETE - NO CHANGES NEEDED!)
**Status:** Already complete via database adapter
**Time:** 0 hours (verified adapter integration)

**Files Affected:** 67 files (all handlers + agents + workers)

**Discovery:** `env.DB` is already using the PostgreSQL adapter! No code changes needed.

**Current Implementation (server.js:67):**
```javascript
const db = createDatabaseAdapter({ ...process.env, DATABASE_URL: dbUrl });
env = { DB: db, ... }
```

**Database Adapter Features (database-adapter.js):**
- ✅ `prepare(query)` - Auto-converts `?` → `$1, $2, $3`
- ✅ `bind(...params)` - Parameter binding
- ✅ `first(colName)` - Returns first row
- ✅ `all()` - Returns all rows with D1-compatible response
- ✅ `run()` - Execute without returning rows
- ✅ `batch(statements)` - Transaction support

**No Migration Required:** All 67 files already work with PostgreSQL!
- Issue #74 (SQLite → PostgreSQL migration) already converted SQL syntax
- Database adapter provides full D1 API compatibility
- All handlers use `env.DB.prepare().bind().first/all/run()` pattern

---

### Phase 2: High Priority

#### ⏳ Phase 2.1: Queue Bindings (PENDING)
**Status:** Not started
**Estimated:** 4-6 hours

**Files Affected:** 13 files
- src/handlers/legacy-manuscript-handlers.js
- src/handlers/manuscript-handlers.js
- src/handlers/public-api-handlers.js
- src/handlers/analysis-handlers.js
- src/handlers/audiobook-handlers.js
- src/workers/queue-consumer.js
- src/workers/asset-generation-consumer.js

**Current Pattern:**
```javascript
await env.ANALYSIS_QUEUE.send({
  manuscriptId: manuscriptId,
  userId: userId
});
```

**Decision Required:**
- **Option A:** BullMQ with Redis (full queue system)
- **Option B:** Direct processing (remove queue, process immediately)
- **Option C:** Simple Redis list (lightweight queue)

**Recommendation:** Option B (Direct Processing) for MVP, migrate to BullMQ later if needed.

---

#### ⏳ Phase 2.2: KV Cache (PENDING)
**Status:** Not started
**Estimated:** 2-3 hours

**Files Affected:** 7 files
- server.js (env setup)
- src/utils/db-cache.js

**Current Pattern:**
```javascript
const cached = await env.CACHE_KV.get(key);
await env.CACHE_KV.put(key, value, { expirationTtl: ttl });
```

**Required Pattern:**
```javascript
// env.CACHE_KV is already the Redis cache adapter!
// Should work as-is, verify it exists in server.js
```

---

### Phase 3: Cleanup

#### ⏳ Phase 3: Archive Deprecated Files (PENDING)
**Status:** Not started
**Estimated:** 30 minutes

**Files to Archive:**
1. `wrangler.toml` → Move to `archive/deprecated/`
2. `src/router/worker-router.js` → Move to `archive/deprecated/`
3. `dist/worker.js` → Delete (build artifact)

**Actions:**
```bash
mkdir -p archive/deprecated
git mv wrangler.toml archive/deprecated/
git mv src/router/worker-router.js archive/deprecated/
rm -rf dist/
echo "dist/" >> .gitignore
```

---

### Phase 4: Documentation

#### ⏳ Phase 4: Update Documentation (PENDING)
**Status:** Not started
**Estimated:** 3-4 hours

**Files to Update:**
- CLAUDE.md - Update "Deprecated Infrastructure" section
- Create docs/migration-history.md
- Update architecture docs

---

## Testing Checklist

### After Each Phase:
- [ ] All affected files compile without errors
- [ ] Local development works (localhost:8787)
- [ ] Production deployment succeeds
- [ ] Manual testing of affected features
- [ ] No Cloudflare-specific errors in logs

### Final Integration Tests:
- [ ] Manuscript upload flow
- [ ] AI analysis flow
- [ ] Asset generation flow
- [ ] Frontend→API communication
- [ ] Storage operations (upload/download/delete)
- [ ] Database operations (CRUD)
- [ ] Cache operations

---

## Risk Mitigation

### Before Starting:
- [x] Create feature branch: `feat/cloudflare-cleanup`
- [ ] Backup production database
- [ ] Document rollback procedure

### During Migration:
- [ ] Test each phase before moving to next
- [ ] Commit after each completed phase
- [ ] Deploy to staging before production

### Rollback Plan:
```bash
# If Phase 1.3 breaks storage:
git revert HEAD~1  # Revert last commit
npm run deploy:staging  # Test rollback

# If Phase 1.5 breaks database:
git revert HEAD~2  # Revert last 2 commits
npm run deploy:staging
```

---

## Current Status Summary

| Phase | Status | Files | Hours | Priority |
|-------|--------|-------|-------|----------|
| 1.1 Frontend URLs | ✅ Complete | 7 | 0.5 | 🔴 Critical |
| 1.2 Audit R2 | ✅ Complete | 50 | 1 | 🔴 Critical |
| 1.3 Migrate R2 | ✅ Complete | 61 | 3 | 🔴 Critical |
| 1.3b Clean up server.js | ✅ Complete | 1 | 0.5 | 🔴 Critical |
| 1.4-1.5 Database (D1→PG) | ✅ Complete (No changes needed) | 67 | 0 | 🔴 Critical |
| 2.1 Queues | ⏳ Next | 13 | 4-6 | 🟡 High |
| 2.2 Cache | ⏳ Pending | 7 | 2-3 | 🟡 High |
| 3 Archive | ⏳ Pending | 3 | 0.5 | 🟢 Medium |
| 4 Docs | ⏳ Pending | Multiple | 3-4 | 🟢 Medium |
| **TOTAL** | **50%** | **220+** | **15-18** | - |

**Next Action:** Phase 2.1 - Replace Cloudflare Queue bindings

---

**Last Updated:** 2025-11-09
**Issue:** #73
