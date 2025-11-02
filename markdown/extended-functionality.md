# Extended Functionality - Manuscript Platform

## System Requirements & Architecture

### Core Technology Stack
- **Platform**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite-based)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **KV Store**: Cloudflare KV (sessions, cache, metadata)
- **Frontend**: Static HTML/JS served from Workers
- **Deployment**: `wrangler` CLI

### Data Model Requirements

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'author', -- author/publisher/admin
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  email_verified INTEGER DEFAULT 0
);
```

#### Manuscripts Table
```sql
CREATE TABLE manuscripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL, -- path to file in R2
  file_hash TEXT NOT NULL, -- SHA-256 for duplicate detection
  status TEXT DEFAULT 'draft', -- draft/submitted/under_review/accepted/rejected
  metadata TEXT, -- JSON: genre, word_count, file_type, etc.
  uploaded_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  flagged_for_review INTEGER DEFAULT 0, -- boolean for DMCA/content issues
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_manuscripts_user ON manuscripts(user_id);
CREATE INDEX idx_manuscripts_hash ON manuscripts(file_hash);
CREATE INDEX idx_manuscripts_status ON manuscripts(status);
```

#### Submissions Table
```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  publisher_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending/accepted/rejected
  submitted_at INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id),
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);

CREATE INDEX idx_submissions_manuscript ON submissions(manuscript_id);
CREATE INDEX idx_submissions_publisher ON submissions(publisher_id);
```

#### Audit Log Table
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- upload/download/delete/update/view
  resource_type TEXT NOT NULL, -- manuscript/user/submission
  resource_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  ip_address TEXT,
  metadata TEXT, -- JSON for additional context
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```

#### DMCA Requests Table
```sql
CREATE TABLE dmca_requests (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_company TEXT,
  claim_details TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending/reviewing/resolved/rejected
  resolution_notes TEXT,
  resolved_at INTEGER,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id)
);

CREATE INDEX idx_dmca_status ON dmca_requests(status);
```

---

## Functional Requirements

### Authentication & Authorization

**User Registration:**
- Email/password authentication
- Email verification required before full access
- Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char
- Verification token stored in KV with 24hr expiry
- Welcome email sent on successful verification

**Session Management:**
- Sessions stored in Cloudflare KV
- Session duration: 24 hours (sliding window)
- Session key structure: `session:{session_id}`
- Auto-logout on expiry
- "Remember me" option extends to 30 days

**Password Reset:**
- Reset token sent via email
- Token valid for 1 hour
- Stored in KV: `reset:{token}` → `{user_id, expires_at}`
- Old password invalidated on successful reset

**Role-Based Access:**
- Authors: upload manuscripts, view own submissions
- Publishers: review submissions, accept/reject
- Admins: full access, user management, DMCA handling

---

### Manuscript Management

**Upload Specifications:**
- Supported formats: `.doc`, `.docx`, `.pdf`, `.txt`, `.rtf`, `.odt`
- Max file size: 50MB per manuscript
- Streaming upload to R2 (no buffering in Workers)
- Client-side validation before upload
- Progress indicator during upload

**File Processing Pipeline:**
1. Validate file type and size
2. Generate SHA-256 hash
3. Check for duplicates (hash collision)
4. Generate unique ID for manuscript
5. Stream to R2: `manuscripts/{user_id}/{manuscript_id}/{version}.{ext}`
6. Store metadata in D1
7. Update audit log
8. Return success response with manuscript details

**Duplicate Detection:**
- Hash comparison against existing manuscripts
- If duplicate found: prompt user to confirm or cancel
- Allow same user to upload same file (different projects)
- Flag cross-user duplicates for review

**Versioning:**
- Each edit creates new version in R2
- R2 key includes version number: `{manuscript_id}/v{n}.{ext}`
- D1 stores version history in metadata JSON
- Users can revert to previous versions
- Max 10 versions retained per manuscript

**Download/Preview:**
- Pre-signed R2 URLs with 1-hour expiry
- Audit log entry on download
- Preview generation for supported formats (future enhancement)

---

### Storage Strategy

**R2 Bucket Structure:**
```
manuscripts/
  {user_id}/
    {manuscript_id}/
      v1.docx
      v2.docx
      metadata.json (optional cache)

backups/
  database/
    {date}/
      d1-export.sql
  manuscripts/
    {date}/
      {user_id}/
        {manuscript_id}/...
```

**Backup Schedule:**
- Daily D1 export to R2 at 2 AM UTC
- Incremental R2 snapshots (versioning enabled)
- 30-day retention on deleted items (soft delete)
- Monthly full archive to cold storage (future)

**Recovery Procedures:**
- Point-in-time recovery from D1 exports
- R2 object restore from version history
- User-initiated recovery within 30 days of deletion

---

### DMCA Compliance & Content Moderation

**Pre-Upload Checks:**
- Copyright attestation checkbox (required)
- User agrees they own rights or have permission
- Warning text about penalties for false claims

**Post-Upload Monitoring:**
- File hash stored for future duplicate detection
- Manual flagging by admins/publishers
- Future: automated similarity detection API integration

**Takedown Request Process:**
1. Public form at `/dmca-request`
2. Required fields:
   - Requester name, email, company
   - Manuscript URL or ID
   - Description of copyrighted work
   - Statement of good faith belief
   - Physical/electronic signature
3. Request stored in D1
4. Email notification to admin
5. Manuscript flagged and hidden from public view
6. User notified of claim
7. Counter-notice option for user (10 days)
8. Resolution logged in database

**Admin Review Queue:**
- Dashboard showing flagged manuscripts
- Filter by flag reason (DMCA, inappropriate, spam)
- Approve/reject with notes
- Automatic email notifications to involved parties

**DMCA Agent Information:**
- Registered with US Copyright Office ($6 fee)
- Contact info displayed in site footer
- Email: dmca@{domain}
- Response time: within 24 hours of receipt

---

### Security Requirements

**Data Protection:**
- All passwords hashed with bcrypt (cost factor: 12)
- No sensitive data in logs or error messages
- SQL injection prevention: parameterized queries only
- XSS prevention: sanitize all user inputs
- CSRF protection on state-changing operations

**API Security:**
- Rate limiting:
  - Auth endpoints: 5 attempts/minute per IP
  - File uploads: 10/hour per user
  - API calls: 100/hour per user
- CORS policies: whitelist known origins only
- Content Security Policy headers
- Secure headers: HSTS, X-Frame-Options, X-Content-Type-Options

**File Security:**
- Virus scanning on upload (future enhancement)
- Magic byte validation (verify actual file type)
- Sandboxed preview generation
- No executable file types allowed

**Session Security:**
- HttpOnly cookies for session tokens
- Secure flag (HTTPS only)
- SameSite=Strict
- Regenerate session ID on privilege escalation

---

### Performance Requirements

**Response Time Targets:**
- API responses: <500ms (p95)
- Static pages: <200ms (p95)
- File upload: streaming, no timeout
- Database queries: <100ms average

**Optimization Strategies:**
- CDN caching for static assets (max-age: 1 year)
- D1 query optimization: indexed lookups
- KV caching for frequently accessed data
- Lazy loading for manuscript lists
- Pagination: 20 items per page
- Connection pooling for D1

**Scalability Considerations:**
- Cloudflare Workers: auto-scales globally
- R2: unlimited storage, no egress fees
- D1: monitor query performance, add indexes as needed
- KV: used for hot data only (sessions, cache)

---

### Monitoring & Logging

**Application Logs:**
- All requests logged via Cloudflare Analytics
- Error tracking: failed uploads, auth errors, 500s
- Custom metrics: upload success rate, avg file size
- Alert thresholds: >5% error rate, >1s p95 latency

**Audit Trail:**
- Every manuscript operation logged (upload/download/delete/update)
- User authentication events (login/logout/failed attempts)
- Admin actions (user management, DMCA resolutions)
- Retention: 90 days in D1, 1 year in cold storage

**Storage Metrics:**
- Per-user storage quota tracking
- Total platform storage usage
- Bandwidth usage (R2 API calls)
- Database size monitoring

**Alerts:**
- Failed login attempts >10 in 5 minutes (brute force)
- Unusual upload patterns (spam detection)
- DMCA request received
- Database or R2 errors
- Quota approaching limits

---

### UI/UX Requirements

**Responsive Design:**
- Mobile-first approach
- Breakpoints: 320px, 768px, 1024px, 1440px
- Touch-friendly controls on mobile
- Hamburger menu for navigation on small screens

**Accessibility:**
- WCAG 2.1 AA compliance minimum
- Semantic HTML structure
- ARIA labels where needed
- Keyboard navigation support
- High contrast mode support
- Screen reader tested

**User Flows:**
- **Upload**: Drag-drop or file picker → validation → progress bar → success/error
- **Dashboard**: List view with filters (status, date) → sort options → pagination
- **Submission**: Select manuscript → choose publisher → add notes → confirm
- **Review**: Publisher sees submissions → preview manuscript → accept/reject with feedback

**Error Handling:**
- Clear, actionable error messages
- No technical jargon in user-facing errors
- Retry options for transient failures
- Graceful degradation on JS disabled

---

### Legal & Compliance

**Terms of Service:**
- User agreement required on signup
- Copyright ownership warranty
- Platform liability limitations
- User conduct rules
- Termination conditions
- Dispute resolution process

**Privacy Policy:**
- Data collection disclosure
- Data usage and sharing policies
- User rights (access, deletion, export)
- Cookie usage
- Third-party services disclosure
- Contact for privacy concerns

**GDPR-Lite Compliance:**
- User data export capability (JSON format)
- Account deletion with data purge
- Opt-out of marketing communications
- Clear consent for data processing
- Data retention policies

**Cookie Consent:**
- Banner on first visit
- Essential cookies only (session)
- No tracking without consent
- Cookie policy page

---

## Future Enhancements (Roadmap)

### Phase 2 Features
- **Publisher Workflow**: Submission review dashboard, bulk actions
- **Email Notifications**: Status changes, submission received, DMCA alerts
- **Advanced Search**: Full-text search in D1, filters by genre/date/status
- **Collaboration**: Multi-author manuscripts, comments, revision requests
- **Analytics**: User dashboard with submission stats, acceptance rates

### Phase 3 Features
- **Payment Processing**: Submission fees, revenue sharing
- **Automated Content Scanning**: API integration (Copyleaks, CopyScape)
- **API for Integrations**: REST API for third-party tools
- **Mobile Apps**: iOS/Android native apps
- **AI Tools**: Grammar checking, genre classification, similarity scoring

### Phase 4 Features
- **Marketplace**: Connect authors with publishers/agents
- **Contracts**: Digital signing, template library
- **Royalty Tracking**: Sales data integration, payment distribution
- **Community Features**: Forums, author profiles, reviews
- **White-label**: Self-hosted option for publishers

---

## Development Guidelines for claude-code

### Code Standards
- **Language**: TypeScript preferred for type safety
- **Async Patterns**: Use async/await, avoid callbacks
- **Error Handling**: Try-catch blocks on all I/O operations
- **Validation**: Zod or similar for input validation
- **HTTP Status Codes**: Proper REST semantics (200, 201, 400, 401, 403, 404, 500)
- **Logging**: Structured JSON logs, no sensitive data

### Testing Checklist
- [ ] Auth flow: signup, login, logout, password reset
- [ ] File upload: various formats, size limits, errors
- [ ] Database queries: correct results, proper indexes
- [ ] Error states: network failures, invalid inputs, unauthorized access
- [ ] Security: SQL injection attempts, XSS vectors, CSRF
- [ ] Performance: response times under load
- [ ] Accessibility: keyboard navigation, screen reader

### Deployment Process
1. Test locally with `wrangler dev`
2. Run migrations on D1 staging database
3. Deploy to staging environment
4. Smoke test critical paths
5. Deploy to production
6. Monitor logs for errors
7. Rollback plan ready

### Environment Variables (wrangler.toml)
```toml
[vars]
ENVIRONMENT = "production"
MAX_FILE_SIZE = 52428800  # 50MB in bytes
SESSION_DURATION = 86400  # 24 hours in seconds
DMCA_EMAIL = "dmca@example.com"
SUPPORT_EMAIL = "support@example.com"

[[d1_databases]]
binding = "DB"
database_name = "manuscript-platform"
database_id = "<production-database-id>"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "manuscripts"

[[kv_namespaces]]
binding = "SESSIONS"
id = "<production-kv-id>"
```

### Common Patterns

**D1 Query with Error Handling:**
```typescript
try {
  const result = await env.DB.prepare(
    'SELECT * FROM manuscripts WHERE user_id = ?'
  ).bind(userId).all();
  
  if (!result.success) {
    throw new Error('Database query failed');
  }
  
  return result.results;
} catch (error) {
  console.error('DB Error:', error);
  throw new Error('Failed to fetch manuscripts');
}
```

**R2 Upload with Streaming:**
```typescript
async function uploadToR2(file: File, key: string, env: Env): Promise<void> {
  const stream = file.stream();
  
  await env.STORAGE.put(key, stream, {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      originalName: file.name,
      uploadedAt: Date.now().toString(),
    },
  });
}
```

**Session Management:**
```typescript
async function createSession(userId: string, env: Env): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionData = { userId, createdAt: Date.now() };
  
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify(sessionData),
    { expirationTtl: 86400 } // 24 hours
  );
  
  return sessionId;
}
```

---

## Notes for Continuity

### Key Principles
1. **Separation of Concerns**: D1 for metadata, R2 for files, KV for ephemeral data
2. **Security First**: Validate everything, trust nothing from users
3. **Fail Gracefully**: Always provide helpful error messages
4. **Audit Everything**: Log all significant actions for compliance
5. **Performance Matters**: Optimize queries, use indexes, cache wisely

### Current State
- Platform in active development
- Deployed on Cloudflare Workers
- Using Indiana LLC structure for business entity
- DMCA compliance is priority for launch
- Backup and disaster recovery required before production

### Business Context
- Manuscript publishing platform for authors and publishers
- B2B focus initially (publishers as customers)
- Potential B2C expansion (authors pay submission fees)
- Liability concerns around copyright and data loss
- Need solid ToS and insurance before scaling

---

## Contact & Support

**For Development Questions:**
- Continue working with claude-code for implementation
- Refer to Cloudflare docs: https://docs.cloudflare.com

**For Business/Legal Questions:**
- Consult with attorney for ToS, Privacy Policy
- DMCA agent registration: https://www.copyright.gov
- Indiana LLC info: https://inbiz.in.gov

**Platform Owner:**
- Location: Indiana, USA
- Entity: LLC (to be formed)
- Deployment: Cloudflare Workers/R2/D1

---

*Last Updated: October 12, 2025*
*Version: 1.0*
