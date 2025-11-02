# Database Schema & Data Models (MAN-10)

## Overview

The Manuscript Platform uses **Cloudflare D1** (SQLite) for all relational data storage. The database schema is designed for:
- Multi-user manuscript management
- Subscription billing & payments
- AI analysis cost tracking
- DMCA compliance
- Audit logging & security

**Total Tables**: 13 core tables + 4 optimized views

---

## Entity Relationship Diagram

```
users (1) ──────< (N) manuscripts
   │                      │
   │ (1)                  │ (N)
   │                      │
   ├──< subscriptions (1) │
   │                      │
   │ (1)                  │ (1)
   │                      │
   ├──< payment_history   ├──< submissions
   │                      │
   │ (1)                  │ (1)
   │                      │
   ├──< usage_tracking    ├──< dmca_requests
   │                      │
   │ (1)                  └──< (N) analysis results (R2)
   │
   └──< audit_log (N)
```

---

## Core Tables

### 1. Users Table

**Purpose**: Store user accounts (authors, publishers, admins)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- UUID
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,            -- bcrypt hashed
  full_name TEXT,
  role TEXT DEFAULT 'author',             -- author/publisher/admin
  subscription_tier TEXT DEFAULT 'free',  -- free/pro/enterprise
  created_at INTEGER NOT NULL,            -- Unix timestamp
  last_login INTEGER,
  email_verified INTEGER DEFAULT 0        -- Boolean
);
```

**Indexes**:
- `idx_users_email`: Fast email lookup for login

**Roles**:
- `author`: Can upload manuscripts, view own data
- `publisher`: Can review submissions (future feature)
- `admin`: Full platform access

**Password Security**: bcrypt with cost factor 12

---

### 2. Manuscripts Table

**Purpose**: Track all uploaded manuscripts with metadata

```sql
CREATE TABLE manuscripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                  -- FK to users
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL,                   -- R2 storage path
  file_hash TEXT NOT NULL,                -- SHA-256 for deduplication
  status TEXT DEFAULT 'pending',          -- pending/analyzing/complete/failed
  genre TEXT,                             -- thriller/romance/fantasy
  word_count INTEGER,
  file_type TEXT,                         -- .txt/.pdf/.docx
  metadata TEXT,                          -- JSON: additional data
  uploaded_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  flagged_for_review INTEGER DEFAULT 0,   -- Boolean: DMCA/content flags
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_manuscripts_user`: User's manuscripts
- `idx_manuscripts_hash`: Duplicate detection
- `idx_manuscripts_status`: Filter by processing status
- `idx_manuscripts_created`: Sort by upload date

**Composite Indexes** (from migration 007):
- `idx_manuscripts_user_status_date`: User filtering with status and date
- `idx_manuscripts_user_genre_date`: Genre-based queries

**Status Values**:
- `pending`: Uploaded, awaiting analysis
- `analyzing`: Currently being processed
- `complete`: Analysis finished
- `failed`: Analysis error

---

### 3. Subscriptions Table

**Purpose**: Track user subscriptions and billing periods

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                  -- FK to users
  stripe_subscription_id TEXT UNIQUE,     -- Stripe sub ID
  stripe_customer_id TEXT NOT NULL,       -- Stripe customer ID
  plan_type TEXT NOT NULL,                -- free/pro/enterprise
  status TEXT NOT NULL,                   -- active/canceled/past_due/incomplete
  current_period_start INTEGER NOT NULL,  -- Unix timestamp
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0, -- Boolean
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_subscriptions_user`: User's subscription history
- `idx_subscriptions_stripe_customer`: Stripe queries
- `idx_subscriptions_status`: Active subscriptions

**Plan Types**:
- `free`: 1 manuscript/month
- `pro`: 10 manuscripts/month
- `enterprise`: Unlimited manuscripts

**Status Values**:
- `active`: Current and paid
- `past_due`: Payment failed, retrying
- `canceled`: Subscription ended
- `incomplete`: Initial payment pending

---

### 4. Payment History Table

**Purpose**: Record all payments (subscriptions and one-time)

```sql
CREATE TABLE payment_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,                  -- FK to users
  subscription_id TEXT,                   -- FK to subscriptions (null for one-time)
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,                 -- For subscriptions
  amount INTEGER NOT NULL,                -- Cents
  currency TEXT DEFAULT 'usd',
  payment_type TEXT NOT NULL,             -- subscription/one_time
  status TEXT NOT NULL,                   -- succeeded/pending/failed/refunded
  description TEXT,
  metadata TEXT,                          -- JSON
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);
```

**Indexes**:
- `idx_payment_history_user`: User's payment history
- `idx_payment_history_created`: Sort by date
- `idx_payment_history_status`: Filter by status

---

### 5. Usage Tracking Table

**Purpose**: Track manuscript uploads for billing limits

```sql
CREATE TABLE usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  manuscript_id TEXT NOT NULL,            -- FK to manuscripts
  analysis_type TEXT NOT NULL,            -- full/basic
  assets_generated INTEGER DEFAULT 0,     -- Boolean
  credits_used INTEGER DEFAULT 1,
  timestamp INTEGER NOT NULL,
  billing_period_start INTEGER NOT NULL,  -- For monthly limit tracking
  billing_period_end INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_usage_tracking_user`: User's usage history
- `idx_usage_tracking_period`: Query by billing period
- `idx_usage_tracking_timestamp`: Sort by date

**Purpose**: Enforce monthly upload limits per plan tier

---

### 6. Cost Tracking Table

**Purpose**: Track API costs for profitability analysis

```sql
CREATE TABLE cost_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  manuscript_id TEXT,
  cost_center TEXT,                       -- anthropic_api/openai_api/stripe_fees
  feature_name TEXT,                      -- analysis/asset_generation/cover_generation
  operation TEXT,                         -- analyze_developmental/generate_description/etc
  cost_usd REAL,                          -- Cost in dollars
  input_tokens INTEGER,
  output_tokens INTEGER,
  model TEXT,                             -- claude-sonnet-4-20250514/dall-e-3
  metadata TEXT,                          -- JSON
  timestamp INTEGER
);
```

**Indexes**:
- `idx_cost_user_date_detailed`: User cost queries with date filtering

**Cost Centers**:
- `anthropic_api`: Claude API costs
- `openai_api`: DALL-E 3 costs
- `stripe_fees`: Payment processing fees

---

### 7. Audit Log Table

**Purpose**: Track all user actions for compliance and security

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,                   -- upload/download/delete/view/login
  resource_type TEXT NOT NULL,            -- manuscript/user/subscription
  resource_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                          -- JSON
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_audit_user`: User's activity history
- `idx_audit_user_timestamp`: User activity with date
- `idx_audit_timestamp`: All activity chronologically
- `idx_audit_action`: Filter by action type

**Common Actions**:
- `manuscript_upload`, `analysis_start`, `analysis_complete`
- `subscription_upgrade`, `subscription_cancel`
- `payment_succeeded`, `payment_failed`
- `admin_view_user`, `admin_issue_refund`

---

### 8. DMCA Requests Table

**Purpose**: Track copyright takedown requests

```sql
CREATE TABLE dmca_requests (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,            -- FK to manuscripts
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_company TEXT,
  claim_details TEXT NOT NULL,
  original_work_url TEXT,
  good_faith_attestation INTEGER DEFAULT 0,
  accuracy_attestation INTEGER DEFAULT 0,
  digital_signature TEXT,
  submitted_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending/reviewing/resolved/rejected
  resolution_notes TEXT,
  resolved_at INTEGER,
  resolved_by TEXT,                       -- Admin user ID
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_dmca_status`: Filter by status
- `idx_dmca_status_submitted`: Admin dashboard sorting
- `idx_dmca_submitted`: Sort by submission date

---

### 9. Submissions Table

**Purpose**: Track manuscript submissions to publishers (future feature)

```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,            -- FK to manuscripts
  publisher_id TEXT NOT NULL,             -- FK to users (role=publisher)
  status TEXT DEFAULT 'pending',          -- pending/accepted/rejected
  submitted_at INTEGER NOT NULL,
  notes TEXT,                             -- Cover letter
  response_notes TEXT,                    -- Publisher feedback
  responded_at INTEGER,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (publisher_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_submissions_manuscript`: Manuscript's submissions
- `idx_submissions_publisher`: Publisher's queue
- `idx_submissions_status`: Filter by status

**Note**: Currently unused, reserved for future publisher marketplace feature

---

### 10. Sessions Table

**Purpose**: Optional session storage (currently using KV)

```sql
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Index**:
- `idx_sessions_expires`: Cleanup expired sessions

**Note**: Platform currently uses KV for sessions (faster), but D1 option available

---

### 11. Verification Tokens Table

**Purpose**: Email verification and password reset tokens

```sql
CREATE TABLE verification_tokens (
  token TEXT PRIMARY KEY,                 -- 32-byte hex string
  user_id TEXT NOT NULL,
  token_type TEXT NOT NULL,               -- email_verification/password_reset
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,                 -- Boolean
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Index**:
- `idx_tokens_expires`: Cleanup expired tokens

**Token Types**:
- `email_verification`: Sent during registration
- `password_reset`: Sent via "Forgot Password" flow

**Expiry**: 24 hours for email verification, 1 hour for password reset

---

### 12. Daily Statistics Table

**Purpose**: Pre-computed daily metrics for admin dashboard

```sql
CREATE TABLE daily_statistics (
  date TEXT PRIMARY KEY,                  -- YYYY-MM-DD
  total_users INTEGER,
  new_users INTEGER,
  active_users INTEGER,
  total_manuscripts INTEGER,
  new_manuscripts INTEGER,
  completed_analyses INTEGER,
  failed_analyses INTEGER,
  revenue REAL,
  costs REAL,
  profit REAL,
  computed_at INTEGER
);
```

**Purpose**: Avoid expensive aggregate queries on large tables

---

### 13. Schema Version Table

**Purpose**: Track database migrations

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT NOT NULL
);
```

**Current Migrations**:
1. Initial schema
2. DMCA fields
3. Payment tables
4. Cost tracking
5. Full name field
6. Password reset tokens
7. Query optimization (indexes & views)

---

## Optimized Views

### 1. User Manuscripts View

**Purpose**: Join users and manuscripts for common queries

```sql
CREATE VIEW user_manuscripts AS
SELECT
  m.id, m.user_id, m.title, m.status, m.genre, m.word_count,
  m.uploaded_at, m.updated_at,
  u.email as user_email, u.role as user_role
FROM manuscripts m
JOIN users u ON m.user_id = u.id;
```

---

### 2. User Subscriptions with Usage View

**Purpose**: Subscription status + current period usage

```sql
CREATE VIEW user_subscriptions_with_usage AS
SELECT
  u.id as user_id,
  u.email,
  u.subscription_tier,
  s.id as subscription_id,
  s.plan_type,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  COUNT(ut.id) as manuscripts_this_period,
  CASE
    WHEN s.plan_type = 'free' THEN 1
    WHEN s.plan_type = 'pro' THEN 10
    WHEN s.plan_type = 'enterprise' THEN 999999
  END as monthly_limit
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN usage_tracking ut ON u.id = ut.user_id
  AND ut.billing_period_start = s.current_period_start
GROUP BY u.id, s.id;
```

**Usage**: Check if user can upload another manuscript

---

### 3. Pending DMCA View

**Purpose**: Admin dashboard for DMCA review

```sql
CREATE VIEW pending_dmca AS
SELECT
  d.*,
  m.title as manuscript_title,
  u.email as manuscript_owner_email
FROM dmca_requests d
JOIN manuscripts m ON d.manuscript_id = m.id
JOIN users u ON m.user_id = u.id
WHERE d.status = 'pending'
ORDER BY d.submitted_at DESC;
```

---

### 4. Recent Activity View

**Purpose**: Last 24 hours of platform activity

```sql
CREATE VIEW recent_activity AS
SELECT
  a.*,
  u.email as user_email
FROM audit_log a
JOIN users u ON a.user_id = u.id
WHERE a.timestamp > (strftime('%s', 'now') - 86400)
ORDER BY a.timestamp DESC;
```

---

## Data Types & Conventions

### Timestamps

**Format**: Unix timestamp (seconds since epoch)

```javascript
const timestamp = Math.floor(Date.now() / 1000);
```

**Rationale**: SQLite doesn't have native datetime type; Unix timestamps are efficient for sorting and arithmetic

### UUIDs

**Format**: 36-character UUID v4 string

```javascript
const id = crypto.randomUUID();
```

**Note**: D1 SQLite doesn't have native UUID type, stored as TEXT

### Boolean Values

**Format**: INTEGER (0 or 1)

```sql
email_verified INTEGER DEFAULT 0
```

**Rationale**: SQLite doesn't have native BOOLEAN type

### JSON Fields

**Format**: TEXT column with JSON string

```sql
metadata TEXT  -- Store as JSON.stringify(obj)
```

**Usage**:
```javascript
const metadata = JSON.parse(row.metadata);
```

### Currency

**Format**: INTEGER (cents) for exact arithmetic

```sql
amount INTEGER  -- Store $29.00 as 2900
```

**Conversion**:
```javascript
const dollars = cents / 100;
const cents = Math.round(dollars * 100);
```

---

## Query Patterns

### 1. Check Upload Permission

```sql
SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?
```

Check: `manuscripts_this_period < monthly_limit`

---

### 2. Get User's Manuscripts

```sql
SELECT * FROM manuscripts
WHERE user_id = ?
ORDER BY uploaded_at DESC
LIMIT ? OFFSET ?
```

With caching (MAN-28):
```javascript
const cached = await env.CACHE_KV.get(`manuscripts:${userId}`);
if (cached) return JSON.parse(cached);
```

---

### 3. Track Manuscript Upload

```sql
INSERT INTO usage_tracking (
  id, user_id, subscription_id, manuscript_id,
  billing_period_start, billing_period_end, timestamp
) VALUES (?, ?, ?, ?, ?, ?, ?)
```

---

### 4. Get Revenue Analytics

```sql
SELECT
  DATE(created_at, 'unixepoch') as date,
  SUM(amount) / 100 as revenue,
  COUNT(*) as transaction_count
FROM payment_history
WHERE status = 'succeeded'
  AND created_at > ?
  AND created_at < ?
GROUP BY date
ORDER BY date DESC
```

---

### 5. Cost Analysis by User

```sql
SELECT
  user_id,
  SUM(cost_usd) as total_cost,
  COUNT(DISTINCT manuscript_id) as manuscripts,
  SUM(cost_usd) / COUNT(DISTINCT manuscript_id) as avg_cost_per_manuscript
FROM cost_tracking
WHERE timestamp > ?
GROUP BY user_id
ORDER BY total_cost DESC
LIMIT 100
```

---

## Migrations

### Migration Strategy

1. **Naming**: `migration_NNN_description.sql`
2. **Version Tracking**: Update `schema_version` table
3. **Rollback**: Keep backups before applying

### Example Migration

```sql
-- Migration 008: Add author bio field
-- Date: 2025-11-01

-- Check current version
SELECT version FROM schema_version ORDER BY version DESC LIMIT 1;
-- Expected: 7

-- Apply changes
ALTER TABLE users ADD COLUMN author_bio TEXT;

-- Update version
INSERT INTO schema_version (version, applied_at, description)
VALUES (8, strftime('%s', 'now'), 'Added author bio field');
```

### Applied Migrations

| Version | Description | Date |
|---------|-------------|------|
| 1 | Initial schema | 2025-10-12 |
| 2 | DMCA fields | 2025-10-13 |
| 3 | Payment tables (subscriptions, payment_history, usage_tracking) | 2025-10-13 |
| 4 | Cost tracking | 2025-10-14 |
| 5 | Full name field | 2025-10-15 |
| 6 | Password reset tokens | 2025-10-16 |
| 7 | Query optimization (composite indexes, views, daily stats) | 2025-10-27 |

---

## Performance Optimization

### Composite Indexes (Migration 007)

**Purpose**: Optimize common multi-column queries

```sql
CREATE INDEX idx_manuscripts_user_status_date
  ON manuscripts(user_id, status, uploaded_at DESC);

CREATE INDEX idx_manuscripts_user_genre_date
  ON manuscripts(user_id, genre, uploaded_at DESC);

CREATE INDEX idx_cost_user_date_detailed
  ON cost_tracking(user_id, timestamp DESC, feature_name, cost_center);
```

**Impact**: 10-50x faster for filtered + sorted queries

### Query Result Caching (MAN-28)

**KV Cache Layer**: `CACHE_KV` namespace

**TTLs**:
- User profiles: 1 hour
- Manuscript metadata: 15 minutes
- Manuscript lists: 5 minutes
- Analysis results: 1 day

**Invalidation**: On update/delete operations

---

## Database Limits

### D1 Limits (Free Tier)

- **Database size**: 5 GB
- **Reads**: 50,000 per day
- **Writes**: 5,000 per day
- **Maximum database size per row**: 1 MB

### Current Usage (Estimated)

- **Users**: ~10 KB per user
- **Manuscripts**: ~5 KB per manuscript (metadata only, files in R2)
- **Audit log**: ~1 KB per entry
- **Estimated capacity**: 500K users, 1M manuscripts

### Scaling Strategy

If limits exceeded:
1. Upgrade to D1 paid tier
2. Move audit log to separate database
3. Archive old data (>1 year) to R2

---

## Security

### SQL Injection Prevention

**Always use prepared statements**:

```javascript
// ✅ SAFE
await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

// ❌ UNSAFE
await env.DB.prepare(`SELECT * FROM users WHERE email = '${email}'`).first();
```

### Sensitive Data

**Encrypted Fields**:
- `password_hash`: bcrypt with cost 12
- `verification_tokens`: Random 32-byte hex strings

**Never Exposed**:
- Password hashes (never returned in API responses)
- Stripe secret keys (in environment variables)

### Access Control

**Row-Level Security** (enforced in application code):
```javascript
// Only return user's own manuscripts
const manuscripts = await env.DB.prepare(
  'SELECT * FROM manuscripts WHERE user_id = ?'
).bind(userId).all();
```

---

## Backup & Recovery

### Automated Backups

**Schedule**: Daily at 3 AM UTC (via CRON trigger)

```javascript
// Triggered by wrangler.toml cron schedule
export default {
  async scheduled(event, env, ctx) {
    // Backup D1 to R2
    const backup = await createDatabaseBackup(env);
    await env.BACKUPS.put(`backup-${Date.now()}.sql`, backup);
  }
};
```

**Retention**: 30 days

### Manual Backup

```bash
wrangler d1 backup create manuscript-platform
wrangler d1 backup download manuscript-platform backup-id
```

---

## Monitoring

### Key Metrics

1. **Database Size**:
   ```sql
   SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();
   ```

2. **Table Row Counts**:
   ```sql
   SELECT 'users' as table_name, COUNT(*) FROM users
   UNION ALL
   SELECT 'manuscripts', COUNT(*) FROM manuscripts
   UNION ALL
   SELECT 'audit_log', COUNT(*) FROM audit_log;
   ```

3. **Query Performance**:
   - Monitor via Cloudflare Analytics
   - Log slow queries (>100ms)

---

## References

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Database Design Best Practices](https://www.sqlstyle.guide/)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-10)
**Version**: 1.0
