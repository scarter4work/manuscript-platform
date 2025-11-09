# 🔴 CRITICAL: Convert All SQLite Migration Files to PostgreSQL

## Summary
Comprehensive SQL file audit revealed **49 SQL files** still using **SQLite-specific syntax** despite the 2025-11-05 migration to Render with PostgreSQL. This creates a critical mismatch between migration files and the production database.

**Impact:** 🚨 **PRODUCTION-BREAKING** - Migration files cannot be applied to PostgreSQL database

**Scope:** 40+ migration files with 500+ SQLite-specific function calls

---

## 🔴 CRITICAL Issues Found

### 1. SQLite `unixepoch()` Function (500+ occurrences)

**Files Affected:** 21 files

**Most Critical:**
- `combined-schema.sql` - **438 occurrences** of `unixepoch()`
- `migrations/migration_020_author_bios.sql` - 6 occurrences
- `migrations/migration_021_cover_design_briefs.sql` - Multiple
- `migrations/migration_022_enhanced_metadata_fixed.sql` - Multiple
- `migrations/migration_023_supporting_documents.sql` - Multiple
- ... and 16 more migration files (020-037)

**SQLite Pattern:**
```sql
created_at INTEGER NOT NULL DEFAULT (unixepoch()),
updated_at INTEGER NOT NULL DEFAULT (unixepoch())

-- In triggers:
UPDATE author_bios SET updated_at = unixepoch() WHERE id = NEW.id;

-- In WHERE clauses:
WHERE deadline_date > (unixepoch() - 604800)

-- In calculations:
CAST((deadline_date - unixepoch()) / 86400.0 AS INTEGER) as days_until_deadline
```

**PostgreSQL Conversion:**
```sql
-- For column defaults (unix timestamp as BIGINT):
created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT

-- OR use native PostgreSQL timestamps:
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- In triggers:
UPDATE author_bios SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
-- OR:
UPDATE author_bios SET updated_at = NOW() WHERE id = NEW.id;

-- In WHERE clauses:
WHERE deadline_date > EXTRACT(EPOCH FROM NOW())::BIGINT - 604800

-- In calculations:
CAST((deadline_date - EXTRACT(EPOCH FROM NOW())::BIGINT) / 86400.0 AS INTEGER) as days_until_deadline
```

**Why Critical:**
- `unixepoch()` is SQLite-only - PostgreSQL doesn't recognize it
- Migration files will fail immediately on `CREATE TABLE` statements
- All triggers with `unixepoch()` will fail
- All views with date calculations will fail

---

### 2. SQLite `AUTOINCREMENT` Keyword (7 occurrences)

**File:** `sql/migration_020_doc_monitoring.sql`

**Lines:**
```
Line 10:  id INTEGER PRIMARY KEY AUTOINCREMENT,
Line 32:  id INTEGER PRIMARY KEY AUTOINCREMENT,
Line 61:  id INTEGER PRIMARY KEY AUTOINCREMENT,
Line 80:  id INTEGER PRIMARY KEY AUTOINCREMENT,
Line 107: id INTEGER PRIMARY KEY AUTOINCREMENT,
Line 131: id INTEGER PRIMARY KEY AUTOINCREMENT,
Line 157: id INTEGER PRIMARY KEY AUTOINCREMENT,
```

**SQLite Pattern:**
```sql
CREATE TABLE platform_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  ...
);
```

**PostgreSQL Conversion:**
```sql
CREATE TABLE platform_docs (
  id BIGSERIAL PRIMARY KEY,
  -- OR:
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  platform TEXT NOT NULL,
  ...
);
```

**Why Critical:**
- `AUTOINCREMENT` keyword doesn't exist in PostgreSQL
- `INTEGER PRIMARY KEY AUTOINCREMENT` is SQLite's special auto-increment syntax
- PostgreSQL uses `SERIAL`, `BIGSERIAL`, or `GENERATED ALWAYS AS IDENTITY`

---

### 3. SQLite Date/Time Functions (14 files)

**Files with `datetime()`, `strftime()`, `date()` functions:**
```
sql/migration_002_dmca_fields.sql
sql/migration_003_payment_tables.sql
sql/migration_004_cost_tracking.sql
sql/migration_005_add_full_name.sql
sql/migration_006_password_reset_tokens.sql
sql/migration_007_team_collaboration.sql
sql/migration_008_email_system.sql
sql/migration_009_audiobook_tables.sql
sql/migration_010_review_system.sql
sql/migration_011_publishing_system.sql
sql/migration_012_public_api.sql
sql/migration_013_kdp_export.sql
migrations/migration_038_security_incidents.sql
sql/schema.sql
```

**SQLite Pattern:**
```sql
SELECT datetime('now');
SELECT strftime('%Y-%m-%d', created_at, 'unixepoch');
SELECT date('now', '+7 days');
```

**PostgreSQL Conversion:**
```sql
SELECT NOW();
SELECT TO_CHAR(TO_TIMESTAMP(created_at), 'YYYY-MM-DD');
SELECT CURRENT_DATE + INTERVAL '7 days';
```

**Why Critical:**
- These functions don't exist in PostgreSQL
- Common in older migrations for timestamp formatting
- Need manual review of each usage

---

### 4. SQLite Triggers Syntax (20+ files)

**SQLite Pattern:**
```sql
CREATE TRIGGER IF NOT EXISTS update_author_bios_timestamp
AFTER UPDATE ON author_bios
FOR EACH ROW
BEGIN
  UPDATE author_bios SET updated_at = unixepoch() WHERE id = NEW.id;
END;
```

**PostgreSQL Conversion:**
```sql
-- First, create a function:
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Then create the trigger:
CREATE TRIGGER update_author_bios_timestamp
BEFORE UPDATE ON author_bios
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

**Why Critical:**
- PostgreSQL trigger syntax is completely different
- Requires function creation (PostgreSQL has no inline trigger bodies)
- `IF NOT EXISTS` works differently
- All 20+ migration files with triggers need conversion

---

## 🟡 MEDIUM Priority Issues

### 5. SQLite `INTEGER` for Timestamps (Should be `BIGINT`)

**Issue:**
```sql
-- SQLite pattern (works but not optimal):
created_at INTEGER NOT NULL DEFAULT (unixepoch())

-- PostgreSQL best practice:
created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT

-- OR even better, use native timestamp:
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**Why Medium:**
- `INTEGER` in PostgreSQL is only 32-bit (max value: 2,147,483,647)
- Unix timestamp exceeds this in 2038 (Y2038 problem)
- `BIGINT` is 64-bit and safe
- SQLite's `INTEGER` is actually 64-bit, but PostgreSQL's is not!

---

### 6. SQLite `REAL` Data Type (20 files)

**Files:**
```
combined-schema.sql
migrations/migration_026_human_editor.sql
migrations/migration_027_marketing_content.sql
migrations/migration_028_manuscript_formatting.sql
... (17 more files)
```

**SQLite Pattern:**
```sql
similarity_score REAL,
price REAL,
percentage REAL
```

**PostgreSQL Conversion:**
```sql
similarity_score DOUBLE PRECISION,
price NUMERIC(10,2),  -- For money
percentage DOUBLE PRECISION
```

**Why Medium:**
- `REAL` works in PostgreSQL but is only 32-bit (6 decimal digits precision)
- `DOUBLE PRECISION` is 64-bit (15 decimal digits precision)
- For money, use `NUMERIC` to avoid floating-point errors

---

### 7. SQLite `TEXT` Type (Should be `VARCHAR` or `TEXT`)

**Issue:**
```sql
-- SQLite pattern (works in both):
platform TEXT NOT NULL,
genre TEXT NOT NULL

-- PostgreSQL best practice:
platform VARCHAR(255) NOT NULL,
genre VARCHAR(100) NOT NULL

-- OR for unlimited length:
description TEXT NOT NULL
```

**Why Medium:**
- `TEXT` works in both but PostgreSQL prefers `VARCHAR(n)` for constrained fields
- Better query optimization with known lengths
- Prevents accidental data bloat

---

## 📊 File Breakdown

### SQL Files by Location

**`sql/` folder (18 files - older migrations):**
```
migration_002_dmca_fields.sql
migration_003_payment_tables.sql
migration_004_cost_tracking.sql
migration_004_rate_limiting.sql
migration_005_add_full_name.sql
migration_006_password_reset_tokens.sql
migration_007_team_collaboration.sql
migration_008_email_system.sql
migration_009_audiobook_tables.sql
migration_010_review_system.sql
migration_011_publishing_system.sql
migration_012_public_api.sql
migration_013_kdp_export.sql
migration_019_series_management.sql
migration_020_doc_monitoring.sql  ⚠️ HAS AUTOINCREMENT
migration_021_multi_platform_exports.sql
migration_022_progress_tracking.sql
schema.sql
```

**`migrations/` folder (24 files - newer migrations):**
```
003-password-reset-tokens.sql
migration_020_author_bios.sql
migration_020_author_bios_fixed.sql
migration_021_cover_design_briefs.sql
migration_022_enhanced_metadata.sql
migration_022_enhanced_metadata_fixed.sql
migration_022_seed_data.sql
migration_023_supporting_documents.sql
migration_024_submission_packages.sql
migration_025_submission_responses.sql
migration_026_human_editor.sql
migration_027_marketing_content.sql
migration_028_manuscript_formatting.sql
migration_029_communication_system.sql
migration_030_slush_pile_management.sql
migration_031_submission_windows_deadlines.sql
migration_032_kdp_integration.sql
migration_033_market_analysis.sql
migration_034_sales_tracking.sql
migration_035_rights_management.sql
migration_036_ai_chat_assistants.sql
migration_037_competitive_analysis.sql
migration_038_security_incidents.sql
```

**Root folder (7 files - schema dumps/fixes):**
```
database/schema.sql
d1-export.sql
d1-export-remote.sql
combined-schema.sql         ⚠️ 438 unixepoch() calls!
postgres-schema.sql
create-audit-log.sql
auth-test-schema.sql
fix-group-by-views.sql
fix-remaining-migrations.sql
create-missing-tables.sql
```

**Total: 49 SQL files**

---

## 🎯 Conversion Strategy

### Phase 1: Create Conversion Scripts (Week 1)

**1.1 Create `convert-sqlite-to-postgres.js` utility** (4 hours)
```javascript
// Automated conversion patterns:
// - unixepoch() → EXTRACT(EPOCH FROM NOW())::BIGINT
// - AUTOINCREMENT → BIGSERIAL
// - INTEGER PRIMARY KEY AUTOINCREMENT → BIGSERIAL PRIMARY KEY
// - INTEGER (for timestamps) → BIGINT
// - REAL → DOUBLE PRECISION
// - datetime() → NOW()
// - strftime() → TO_CHAR()
// - SQLite triggers → PostgreSQL functions + triggers
```

**1.2 Create `validate-migrations.js` utility** (2 hours)
```javascript
// Check for:
// - Remaining SQLite keywords
// - Syntax errors
// - Missing semicolons
// - Trigger syntax
```

### Phase 2: Convert Migration Files (Week 1-2)

**2.1 Convert `sql/migration_020_doc_monitoring.sql`** (HIGH PRIORITY)
- Replace 7 `AUTOINCREMENT` → `BIGSERIAL`
- Replace all `unixepoch()` → `EXTRACT(EPOCH FROM NOW())::BIGINT`
- Convert triggers to PostgreSQL functions

**2.2 Batch convert migrations 020-038** (20 files)
- Run automated conversion script
- Manual review for complex queries
- Test each migration on local PostgreSQL

**2.3 Convert older migrations (002-019)** (18 files)
- Lower priority (may already be applied to prod)
- Convert for consistency
- Update documentation

**2.4 Fix combined schemas** (3 files)
- `combined-schema.sql` - 438 `unixepoch()` calls
- `postgres-schema.sql` - Should be PostgreSQL-native
- `d1-export.sql` - Can be archived (D1 deprecated)

### Phase 3: Testing & Validation (Week 2)

**3.1 Local PostgreSQL Testing**
```bash
# Apply all migrations to fresh PostgreSQL database
psql -U postgres -d test_db -f migrations/migration_020_author_bios.sql
psql -U postgres -d test_db -f migrations/migration_021_cover_design_briefs.sql
# ... repeat for all migrations

# Check for errors
psql -U postgres -d test_db -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

**3.2 Trigger Testing**
```sql
-- Test all triggers fire correctly:
INSERT INTO author_bios (...) VALUES (...);
UPDATE author_bios SET author_name = 'Test' WHERE id = 'test-1';
SELECT updated_at FROM author_bios WHERE id = 'test-1'; -- Should be recent timestamp
```

**3.3 View Testing**
```sql
-- Test all views render correctly:
SELECT * FROM author_bio_stats;
SELECT * FROM submission_deadline_alerts;
SELECT * FROM rights_expiring_soon;
```

### Phase 4: Production Rollout (Week 3)

**4.1 Backup Production Database**
```bash
pg_dump -U $DB_USER -h $DB_HOST -d $DB_NAME > backup-pre-migration.sql
```

**4.2 Apply Missing Migrations**
```bash
# Apply only new migrations that weren't applied yet
node apply-all-migrations.js
```

**4.3 Verify Production**
```bash
# Check table counts, trigger functionality, view queries
```

---

## 📋 Conversion Checklist

### For Each Migration File:

```markdown
### File: `migrations/migration_XXX.sql`
- [ ] Replace `AUTOINCREMENT` with `BIGSERIAL`
- [ ] Replace `INTEGER PRIMARY KEY AUTOINCREMENT` with `BIGSERIAL PRIMARY KEY`
- [ ] Replace `unixepoch()` with `EXTRACT(EPOCH FROM NOW())::BIGINT`
- [ ] Replace `datetime()` with `NOW()` or equivalent
- [ ] Replace `strftime()` with `TO_CHAR()` or equivalent
- [ ] Replace `date()` with `CURRENT_DATE` or equivalent
- [ ] Replace `REAL` with `DOUBLE PRECISION` (or `NUMERIC` for money)
- [ ] Replace `INTEGER` (for timestamps) with `BIGINT`
- [ ] Convert SQLite triggers to PostgreSQL function + trigger
- [ ] Replace `IF NOT EXISTS` in triggers (PostgreSQL syntax different)
- [ ] Update `CREATE TRIGGER` syntax (use `EXECUTE FUNCTION`)
- [ ] Test migration on local PostgreSQL
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Verify all triggers fire
- [ ] Verify all views query correctly
- [ ] Code review
```

---

## ✅ Acceptance Criteria

### Critical (Must Complete)
- [ ] All 49 SQL files converted to PostgreSQL syntax
- [ ] Zero `unixepoch()` function calls
- [ ] Zero `AUTOINCREMENT` keywords
- [ ] All triggers use PostgreSQL function syntax
- [ ] All migrations apply successfully to local PostgreSQL
- [ ] All migrations apply successfully to production PostgreSQL
- [ ] All tables, indexes, triggers, views created correctly
- [ ] Timestamp columns use `BIGINT` or `TIMESTAMPTZ` (not `INTEGER`)

### High Priority (Should Complete)
- [ ] `REAL` data type replaced with `DOUBLE PRECISION` or `NUMERIC`
- [ ] Date/time functions (`datetime()`, `strftime()`) converted
- [ ] `TEXT` columns use `VARCHAR(n)` where appropriate
- [ ] All views tested and returning correct results
- [ ] All triggers tested and firing correctly

### Medium Priority (Nice to Have)
- [ ] Automated conversion script created
- [ ] Validation script created
- [ ] Migration testing documented
- [ ] Rollback plan documented

---

## 🧪 Testing Commands

### Test Conversion Script
```bash
# Convert a single file
node scripts/convert-sqlite-to-postgres.js sql/migration_020_doc_monitoring.sql

# Convert all files
node scripts/convert-sqlite-to-postgres.js sql/*.sql migrations/*.sql
```

### Test Migration on Local PostgreSQL
```bash
# Create test database
createdb manuscript_test

# Apply migrations
psql -U postgres -d manuscript_test -f migrations/migration_020_author_bios.sql
psql -U postgres -d manuscript_test -f migrations/migration_021_cover_design_briefs.sql

# Verify tables
psql -U postgres -d manuscript_test -c "\dt"

# Verify triggers
psql -U postgres -d manuscript_test -c "SELECT tgname FROM pg_trigger;"

# Test trigger
psql -U postgres -d manuscript_test -c "INSERT INTO author_bios (...) VALUES (...);"
psql -U postgres -d manuscript_test -c "UPDATE author_bios SET author_name = 'Test' WHERE id = 'test-1';"
psql -U postgres -d manuscript_test -c "SELECT updated_at FROM author_bios WHERE id = 'test-1';"
```

---

## 🚨 Critical Migration Map

**Files That MUST Be Converted First:**

1. **`sql/migration_020_doc_monitoring.sql`** - Has AUTOINCREMENT (blocks all later migrations)
2. **`migrations/migration_020_author_bios.sql`** - Has unixepoch() triggers
3. **`migrations/migration_022_enhanced_metadata_fixed.sql`** - Has genre seed data
4. **`migrations/migration_029_communication_system.sql`** - Has message threading
5. **`combined-schema.sql`** - 438 unixepoch() calls (used for schema generation)

---

## 🔗 Related Issues

- #69 🆕 Cloudflare Cleanup (220+ files) - Related infrastructure migration
- #62 ✅ COMPLETE - Rate Limiter Redis Migration
- #63 ⏳ Email Service Migration

---

## 📚 PostgreSQL Conversion Reference

### Function Mapping

| SQLite Function | PostgreSQL Equivalent |
|----------------|----------------------|
| `unixepoch()` | `EXTRACT(EPOCH FROM NOW())::BIGINT` |
| `datetime('now')` | `NOW()` |
| `date('now')` | `CURRENT_DATE` |
| `strftime('%Y-%m-%d', ts, 'unixepoch')` | `TO_CHAR(TO_TIMESTAMP(ts), 'YYYY-MM-DD')` |
| `julianday('now')` | `EXTRACT(JULIAN FROM NOW())` |

### Data Type Mapping

| SQLite Type | PostgreSQL Type | Notes |
|------------|----------------|-------|
| `INTEGER` (for IDs) | `BIGINT` | PostgreSQL INTEGER is 32-bit only |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` | Or `BIGINT GENERATED ALWAYS AS IDENTITY` |
| `REAL` | `DOUBLE PRECISION` | Or `NUMERIC(p,s)` for money |
| `TEXT` | `VARCHAR(n)` or `TEXT` | Use VARCHAR for constrained fields |
| `BLOB` | `BYTEA` | Not found in our SQL files |

### Trigger Syntax

**SQLite:**
```sql
CREATE TRIGGER update_timestamp
AFTER UPDATE ON table_name
FOR EACH ROW
BEGIN
  UPDATE table_name SET updated_at = unixepoch() WHERE id = NEW.id;
END;
```

**PostgreSQL:**
```sql
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_timestamp
BEFORE UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

---

**Assignee:** @scarter4work
**Labels:** `critical`, `database`, `migration`, `postgresql`, `breaking-change`
**Milestone:** Database Migration Complete
**Estimated Effort:** 40-60 hours (2-3 weeks, 1 developer)
**Priority:** 🔴 **P0 - PRODUCTION BLOCKING**
