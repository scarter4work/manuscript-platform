# System Architecture & Technology Stack (MAN-5)

## Overview

The Manuscript Platform is a serverless, edge-based publishing platform built entirely on Cloudflare's infrastructure. It provides AI-powered manuscript analysis, marketing asset generation, and publishing tools for indie authors.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                              │
│  Web Browser → HTTPS → Cloudflare CDN → Custom Domain          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE COMPUTE LAYER                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Cloudflare Worker (Main Router)                │ │
│  │  - worker-router.js (Hono framework)                     │ │
│  │  - Routes: /auth, /manuscripts, /analysis, /payments    │ │
│  │  - Middleware: Auth, CORS, Rate Limiting                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           Queue Consumers (Background Workers)           │ │
│  │  - queue-consumer.js (Analysis pipeline)                │ │
│  │  - asset-generation-consumer.js (Asset generation)      │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                              │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  D1 SQLite  │  │   R2 Object │  │  KV Store   │           │
│  │  Database   │  │   Storage   │  │  (Cache)    │           │
│  │             │  │             │  │             │           │
│  │  - Users    │  │  - Raw MSS  │  │  - Sessions │           │
│  │  - MSS Meta │  │  - Processed│  │  - Cache    │           │
│  │  - Payments │  │  - Assets   │  │  - Limits   │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │             Cloudflare Queues                           │  │
│  │  - manuscript-analysis-queue                           │  │
│  │  - asset-generation-queue                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Anthropic   │  │    Stripe    │  │ MailChannels │        │
│  │  Claude API  │  │   Payments   │  │    Email     │        │
│  │              │  │              │  │              │        │
│  │  - Analysis  │  │  - Billing   │  │  - Verify    │        │
│  │  - Assets    │  │  - Webhooks  │  │  - Resets    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Platform
- **Runtime**: Cloudflare Workers (V8 isolates, zero cold starts)
- **Framework**: Hono.js (lightweight web framework)
- **Language**: JavaScript/Node.js (with ES modules)
- **Deployment**: Wrangler CLI

### Data Storage
| Service | Purpose | Size/Limits | Cost Model |
|---------|---------|-------------|------------|
| **D1 Database** | SQLite database for metadata, users, transactions | 5 GB free | Read/write operations |
| **R2 Object Storage** | Manuscript files, analysis results, generated assets | Unlimited | $0.015/GB storage |
| **KV Namespace** | Sessions, cache, rate limiting | 1 GB free | Read/write operations |
| **Queues** | Async job processing | 10,000 messages/day free | Per message |

### External APIs
- **Anthropic Claude API**: AI analysis and content generation
  - Model: Claude Sonnet 4
  - Cost: ~$3-5 per manuscript analysis
  - Usage: All 13 AI agents

- **Stripe**: Payment processing
  - Subscriptions, one-time payments
  - Webhooks for automation
  - Customer portal for self-service

- **MailChannels**: Email delivery (free for Cloudflare Workers)
  - Transactional emails
  - No SMTP required

### Frontend
- **Vanilla JavaScript**: No framework overhead
- **Modern CSS**: Responsive design, utility classes
- **SPA Architecture**: `dashboard-spa.js` for main UI
- **Build System**: Vite + TypeScript (for modern frontend)

---

## Request Flow

### Typical User Request Flow

```
1. User Request
   ↓
2. Cloudflare CDN (SSL termination, caching)
   ↓
3. Worker Receives Request
   ↓
4. Auth Middleware (check session)
   ↓
5. Rate Limiting (check KV)
   ↓
6. Route Handler (Hono router)
   ↓
7. Business Logic
   ├─→ D1 Query (if needed)
   ├─→ R2 Fetch (if needed)
   ├─→ KV Get (if needed)
   └─→ External API (if needed)
   ↓
8. Response with CORS headers
   ↓
9. Cloudflare CDN (edge caching)
   ↓
10. User Receives Response
```

### Async Processing Flow

```
1. User Uploads Manuscript
   ↓
2. Worker Stores in R2
   ↓
3. Worker Enqueues Job
   ↓
4. Queue Consumer Picks Up Job
   ↓
5. Consumer Runs 3 Analysis Agents Sequentially
   │  ├─→ Developmental Agent (3-5 min)
   │  ├─→ Line Editing Agent (4-6 min)
   │  └─→ Copy Editing Agent (3-5 min)
   ↓
6. Results Stored in R2
   ↓
7. Status Updated in D1
   ↓
8. Frontend Polls for Completion
```

---

## Design Decisions

### Why Cloudflare Workers?

**Advantages:**
- **Zero Cold Starts**: V8 isolates start in <1ms
- **Global Edge Network**: 300+ locations worldwide
- **Cost Effective**: Free tier covers significant usage
- **Integrated Stack**: All services (D1, R2, KV, Queues) in one platform
- **Automatic Scaling**: No capacity planning needed

**Trade-offs:**
- Limited to 10ms CPU time per request (mitigated with queues)
- No persistent connections (serverless)
- Eventual consistency in KV

### Why Hono Framework?

**Benefits:**
- **Lightweight**: 12KB, minimal overhead
- **Fast Routing**: Optimized for edge
- **Modern API**: Similar to Express.js
- **TypeScript Support**: Built-in types
- **Middleware System**: Easy to extend

**Alternative Considered:**
- itty-router: Even lighter, but less features

### Why No Frontend Framework?

**Rationale:**
- Vanilla JS loads faster (no framework overhead)
- Simpler to understand and maintain
- Less build complexity
- Sufficient for current feature set

**Future Consideration:**
- Vite + TypeScript build system added (MAN-27)
- Can migrate incrementally to React/Vue if needed

### Why Sequential Agent Processing?

**Current Approach:**
Each agent runs sequentially in a single job:
1. Developmental → 2. Line Editing → 3. Copy Editing

**Rationale:**
- Simpler error handling
- Easier to track progress
- Each agent can use previous agent's output
- Avoids hitting Claude API rate limits

**Future Optimization:**
- Could parallelize agents if needed
- Would require separate queues per agent

---

## Scalability & Performance

### Current Limits
- **Concurrent Requests**: Unlimited (edge autoscaling)
- **Worker CPU**: 10ms per request (synced operations)
- **Queue Processing**: 100 concurrent consumers
- **D1 Queries**: 50,000 reads/day (free tier)
- **R2 Operations**: Unlimited reads, Class A operations billed

### Performance Benchmarks

| Operation | Response Time | Cost |
|-----------|---------------|------|
| Static file (cached) | ~20ms | Free (CDN cache) |
| Auth check (KV cached) | ~50ms | $0.000005 |
| Manuscript list (DB) | ~200ms | $0.00001 |
| Manuscript upload | ~500ms | $0.015/GB |
| Analysis job (async) | 10-15 min | $3-5 (Claude API) |

### Bottlenecks
1. **Claude API**: Most expensive and slowest operation
   - Mitigation: Async processing with queues
   - Future: Cache analysis results, reuse patterns

2. **D1 Query Latency**: 50-200ms per query
   - Mitigation: KV caching layer (MAN-28)
   - Future: Batch queries, optimize indexes

3. **R2 HEAD Requests**: Checking file existence
   - Mitigation: Cache analysis status in KV (MAN-28)
   - Future: Track in D1 database

---

## Security Architecture

### Authentication
- Session-based authentication
- Cookies: HttpOnly, Secure, SameSite=Strict
- Sessions stored in D1 + KV cache
- Bcrypt password hashing (cost 12)

### Authorization
- Role-based access control (author, publisher, admin)
- Middleware checks on protected routes
- User ownership verification on resources

### Data Protection
- **In Transit**: HTTPS everywhere (Cloudflare SSL)
- **At Rest**: Cloudflare's encryption
- **Sensitive Data**: API keys in secrets, not code

### Rate Limiting
- Per-IP limits in KV
- Per-user limits based on subscription tier
- Login attempt throttling (5 attempts/15 min)

### CORS
- Allowed origin: `https://selfpubhub.co`
- Credentials: Allowed
- Methods: GET, POST, PUT, DELETE, OPTIONS

---

## Cost Structure

### Monthly Operating Costs (Estimated)

**Cloudflare Services:**
- Workers: Free (100K requests/day)
- D1: Free (5GB, 50K reads/day)
- R2: ~$5 (300 GB storage)
- KV: Free (1M reads/day)
- Queues: Free (10K messages/day)
- **Total Cloudflare: ~$5/month**

**External Services:**
- Anthropic Claude: ~$150/month (50 manuscripts)
- Stripe: 2.9% + $0.30 per transaction
- MailChannels: Free (1,000 emails/day)
- **Total External: ~$150+/month**

**Optimizations (MAN-28):**
- Caching reduces D1 costs by 70%
- Reduces R2 operations by 75%
- **Projected savings: ~$60/month**

---

## Deployment Architecture

### Environments
- **Local Development**: Miniflare (local simulator)
- **Remote Development**: Cloudflare dev environment
- **Production**: Edge deployment via Wrangler

### CI/CD Pipeline
- **Trigger**: Push to `main` branch
- **Steps**: Lint → Validate → Deploy → Smoke Test
- **Rollback**: Automated on failure
- **Monitoring**: Cloudflare Analytics + Logs

### Configuration Management
- `wrangler.toml`: Infrastructure as code
- `.dev.vars`: Local secrets (gitignored)
- Cloudflare Dashboard: Production secrets

---

## Monitoring & Observability

### Current Monitoring
- Cloudflare Workers Analytics
- Console logs (searchable in dashboard)
- Error tracking via try/catch
- Manual log review

### Missing (Future Work)
- Structured logging
- APM (Application Performance Monitoring)
- Error aggregation (Sentry)
- Custom dashboards
- Alerting on thresholds

---

## Dependencies

### Runtime Dependencies
```json
{
  "bcryptjs": "^2.4.3",           // Password hashing
  "mammoth": "^1.8.0",            // DOCX parsing
  "pdf-lib": "^1.17.1",           // PDF manipulation
  "hono": "^4.0.0"                // Web framework
}
```

### Development Dependencies
```json
{
  "wrangler": "^3.0.0",           // Cloudflare CLI
  "vite": "^5.0.0",               // Frontend build
  "typescript": "^5.0.0",         // Type checking
  "tailwindcss": "^3.0.0"         // CSS framework
}
```

---

## File Structure

```
manuscript-platform/
├── worker-router.js              # Main entry point (Hono app)
├── worker.js                     # Legacy router (being phased out)
├── wrangler.toml                 # Infrastructure configuration
│
├── routes/                       # Hono route modules
│   ├── auth.js                   # /auth/* routes
│   ├── manuscripts.js            # /manuscripts/* routes
│   ├── analysis.js               # /analysis/* routes
│   ├── payments.js               # /payments/* routes
│   ├── admin.js                  # /admin/* routes
│   └── assets.js                 # /assets/* routes
│
├── handlers/                     # Business logic handlers
│   ├── auth-handlers.js          # Registration, login, verification
│   ├── manuscript-handlers.js    # CRUD operations
│   ├── payment-handlers.js       # Stripe integration
│   └── admin-handlers.js         # Admin operations
│
├── agents/                       # AI analysis agents
│   ├── developmental-agent.js    # Plot, character, pacing
│   ├── line-editing-agent.js     # Prose improvements
│   ├── copy-editing-agent.js     # Grammar, style
│   └── [9 more agents...]        # Assets, formatting, marketing
│
├── consumers/                    # Queue processors
│   ├── queue-consumer.js         # Analysis pipeline
│   └── asset-generation-consumer.js
│
├── frontend/                     # Static web assets
│   ├── dashboard-spa.html        # Main SPA
│   ├── dashboard-spa.js          # SPA logic
│   ├── admin-*.html              # Admin dashboards
│   └── [30+ HTML files]
│
├── frontend-src/                 # Modern frontend (MAN-27)
│   ├── pages/                    # TypeScript pages
│   ├── api/client.ts             # Typed API client
│   └── utils/helpers.ts          # Utilities
│
├── migrations/                   # Database migrations
│   ├── 001-initial.sql
│   ├── 002-dmca.sql
│   ├── 003-payments.sql
│   ├── 004-cost-tracking.sql
│   └── 007-query-optimization.sql
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # This file
│   ├── DB-OPTIMIZATION.md        # MAN-28 guide
│   └── MIGRATION.md              # Frontend migration
│
└── .github/workflows/            # CI/CD
    ├── ci.yml                    # Continuous integration
    ├── deploy.yml                # Manual deployment
    └── auto-deploy.yml           # Auto deployment
```

---

## Integration Points

### Cloudflare Services
- **Workers**: Main compute platform
- **D1**: Metadata storage via SQL
- **R2**: File storage via S3-compatible API
- **KV**: Cache via key-value API
- **Queues**: Job processing via message queue

### External APIs
- **Anthropic**: REST API with streaming
- **Stripe**: REST API + webhooks
- **MailChannels**: SMTP-like API for Workers

---

## Future Architecture Considerations

### Potential Improvements
1. **Caching Layer**: Redis/Durable Objects for complex caching
2. **Real-time Updates**: WebSockets or SSE for progress
3. **Microservices**: Split analysis agents into separate workers
4. **Multi-region**: Active-active replication
5. **CDN Optimization**: More aggressive caching strategies

### Scalability Roadmap
- **Current**: Handles ~1,000 users, 100 analyses/day
- **Target (6 months)**: 10,000 users, 1,000 analyses/day
- **Target (1 year)**: 100,000 users, 10,000 analyses/day

---

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Hono Framework](https://hono.dev/)
- [Anthropic API](https://docs.anthropic.com/)
- [Stripe API](https://stripe.com/docs/api)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-5)
**Version**: 1.0
