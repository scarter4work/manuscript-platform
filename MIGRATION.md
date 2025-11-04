# Migration Guide: Cloudflare Workers → Render + Backblaze B2

## Overview
Moving from Cloudflare's edge platform to Render for more control and simpler deployment.

## Architecture Changes

### Before (Cloudflare)
- Workers (Edge compute)
- D1 (SQLite database)
- R2 (Object storage)
- KV (Key-value store)
- Queues (Async jobs)

### After (Render + Backblaze)
- Web Service (Node.js + Express)
- PostgreSQL (Managed database)
- Backblaze B2 (S3-compatible object storage)
- Redis (Sessions + cache)
- Background Workers (Async jobs via BullMQ)

## Migration Steps

### 1. Database Migration (D1 → PostgreSQL)
- [x] Install pg client
- [ ] Export D1 schema
- [ ] Convert SQLite schema to PostgreSQL
- [ ] Export D1 data
- [ ] Import data to PostgreSQL
- [ ] Create adapter layer for compatibility

### 2. Storage Migration (R2 → Backblaze B2)
- [x] Install AWS SDK
- [ ] Sign up for Backblaze B2
- [ ] Create buckets: manuscripts-raw, manuscripts-processed, marketing-assets, backups
- [ ] Configure S3-compatible endpoints
- [ ] Create R2-compatible wrapper class
- [ ] Test file upload/download

### 3. Session Store (KV → Redis)
- [x] Install redis + connect-redis
- [ ] Set up Redis on Render
- [ ] Create KV-compatible wrapper
- [ ] Migrate session logic

### 4. Server Setup
- [x] Create Express server
- [ ] Build Workers→Express adapter
- [ ] Wire up existing router
- [ ] Test locally

### 5. Render Configuration
- [ ] Create render.yaml
- [ ] Configure environment variables
- [ ] Set up PostgreSQL service
- [ ] Set up Redis service
- [ ] Deploy staging environment

### 6. Testing & Cutover
- [ ] Test all endpoints
- [ ] Run test suite
- [ ] Configure custom domain
- [ ] Update DNS
- [ ] Monitor for issues

## Environment Variables Needed

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://user:pass@host:6379

# Backblaze B2
B2_ENDPOINT=https://s3.us-west-000.backblazeb2.com
B2_REGION=us-west-000
B2_ACCESS_KEY_ID=your-key-id
B2_SECRET_ACCESS_KEY=your-secret-key
B2_BUCKET_MANUSCRIPTS_RAW=manuscripts-raw
B2_BUCKET_MANUSCRIPTS_PROCESSED=manuscripts-processed
B2_BUCKET_MARKETING_ASSETS=marketing-assets
B2_BUCKET_BACKUPS=manuscript-platform-backups

# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secret-here
ANTHROPIC_API_KEY=your-key
STRIPE_SECRET_KEY=your-key
STRIPE_WEBHOOK_SECRET=your-secret
FRONTEND_URL=https://scarter4workmanuscripthub.com
```

## Cost Estimate (Monthly)

### Render
- Web Service: $7-25/month (Starter-Standard)
- PostgreSQL: $7/month (512MB RAM)
- Redis: $10/month (25MB)
**Subtotal: $24-42/month**

### Backblaze B2
- Storage: $0.005/GB (first 10GB free)
- Downloads: Free (to Render)
- For 50GB storage: $0.25/month
**Subtotal: ~$0.25/month**

### Total: ~$25-45/month
(vs Cloudflare Workers which was ~$5/month but didn't work)

## Rollback Plan

If migration fails:
1. Keep Cloudflare Workers running during testing
2. Use workers.dev subdomain for testing Render
3. Only switch DNS after full validation
4. Keep 7-day backup of D1 database

## Timeline
- Setup & Testing: 2-3 hours
- Data Migration: 30 minutes
- DNS Cutover: 5 minutes (24-48hr propagation)

