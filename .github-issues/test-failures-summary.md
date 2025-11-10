# Test Failures Summary - PostgreSQL Migration Issues

**Date:** 2025-11-10
**Test Suite:** 278 total tests | 172 passing | 106 failing
**Failed Test Files:** 4 of 10

---

## Overview

After completing the Cloudflare → Render migration (Issue #73, #74), the test suite has 106 failing tests due to SQLite → PostgreSQL compatibility issues. All failures stem from **5 distinct root causes**, each documented as a separate GitHub issue.

---

## Test Results

```
Test Files:  4 failed | 6 passed (10)
Tests:       106 failed | 172 passed (278)
Duration:    707.05s
```

### Passing Test Files ✅
1. tests/genre-validation.test.js
2. tests/publishing-package-handler.test.js
3. tests/publishing-package-validator.test.js
4. tests/metadata-validator.test.js
5. tests/content-warning-validator.test.js
6. tests/review-handlers.test.js

### Failing Test Files ❌
1. tests/document-generation.test.js (2 failures)
2. tests/integration/infrastructure.test.js (multiple failures)
3. tests/integration/handlers/auth-handlers.test.js (multiple failures)
4. tests/integration/handlers/payment-handlers.test.js (multiple failures)

---

## Issues Created

### Issue #75: PostgreSQL Boolean/Integer Type Compatibility ⚠️ HIGH PRIORITY
**Impact:** 59 test failures
**Root Cause:** PostgreSQL rejects JavaScript `true`/`false` in INTEGER columns
**Error:** `invalid input syntax for type integer: "true"`

**Solution:** Modify `insertTestRecord()` to convert booleans → integers (0/1)

**Affected Files:**
- tests/integration/handlers/auth-handlers.test.js
- tests/integration/handlers/payment-handlers.test.js
- tests/integration/infrastructure.test.js

---

### Issue #76: Missing doc_fetch_log Table 📋 MEDIUM PRIORITY
**Impact:** 2 test failures
**Root Cause:** Test cleanup tries to truncate non-existent table
**Error:** `relation "doc_fetch_log" does not exist`

**Solution:** Either create the table or remove from truncate list

**Affected Files:**
- tests/document-generation.test.js

---

### Issue #77: PostgreSQL Deadlock During Cleanup 🔒 MEDIUM PRIORITY
**Impact:** Unknown (intermittent)
**Root Cause:** Concurrent test cleanup causes lock conflicts
**Error:** `deadlock detected`

**Solution:** Serialize test cleanup or fix transaction handling

**Affected Files:**
- tests/document-generation.test.js

---

### Issue #78: TypeError - Cannot Read Properties of Undefined 🚨 MEDIUM PRIORITY
**Impact:** 8 test failures
**Root Cause:** Adapter or env object undefined during test execution
**Error:** `Cannot read properties of undefined (reading 'get')`

**Solution:** Fix test setup to ensure all adapters initialized

**Affected Files:**
- tests/integration/handlers/auth-handlers.test.js (registration tests)

---

### Issue #79: Missing DATABASE_URL Environment Variable ⚙️ HIGH PRIORITY
**Impact:** 4 test failures
**Root Cause:** Test environment missing required environment variables
**Error:** `DATABASE_URL environment variable is required`

**Solution:** Set DATABASE_URL in test setup or vitest.config.js

**Affected Files:**
- Multiple test files during initialization

---

## Priority Order for Fixing

1. **Issue #75** (Boolean/Integer) - Blocks 59 tests, single-line fix
2. **Issue #79** (DATABASE_URL) - Blocks 4 tests, test setup issue
3. **Issue #78** (TypeError) - Blocks 8 tests, adapter initialization
4. **Issue #76** (Missing Table) - Blocks 2 tests, schema/cleanup issue
5. **Issue #77** (Deadlock) - Intermittent, may resolve with #75/#76

**Estimated Fix Time:** 2-4 hours total
**Expected Result:** 106 → 0 failing tests (278 passing)

---

## SQLite → PostgreSQL Migration Lessons

### Key Differences Encountered

| Issue | SQLite Behavior | PostgreSQL Behavior |
|-------|----------------|---------------------|
| Boolean types | Auto-converts `true`→1, `false`→0 | Strict type checking, throws error |
| Missing tables | Silently ignores in some contexts | Throws "relation does not exist" |
| Concurrent access | Single-writer, simpler locking | Multi-writer, complex MVCC, detects deadlocks |
| Type coercion | Very permissive | Strict typed system |

### Test Infrastructure Changes Needed

1. **Type Conversion Layer** - Convert JS types → PostgreSQL types
2. **Graceful Cleanup** - Handle missing tables in test reset
3. **Transaction Management** - Proper cleanup before test reset
4. **Environment Setup** - Reliable env var loading for tests

---

## Next Steps

1. Fix Issue #75 (boolean conversion) - **Start here, biggest impact**
2. Fix Issue #79 (DATABASE_URL) - Quick win
3. Run test suite, reassess remaining failures
4. Fix Issues #76, #77, #78 based on remaining errors
5. Update CLAUDE.md with test suite status

---

## Related Work

- **Issue #73:** Cloudflare → Render migration (complete)
- **Issue #74:** SQLite → PostgreSQL migration (complete)
- **Issues #75-79:** Test suite PostgreSQL compatibility (this document)

---

**Status:** All issues documented and prioritized
**Next Action:** Begin implementing fixes starting with Issue #75
