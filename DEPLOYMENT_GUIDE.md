# Deployment Guide - Render + Backblaze B2

## Current Progress ✅

- ✅ Express server created (`server.js`)
- ✅ Dependencies installed
- ✅ PostgreSQL schema exported (`postgres-schema.sql` - 172KB)
- ✅ Render configuration created (`render.yaml`)
- ✅ Migration guide documented (`MIGRATION.md`)

## Next Steps

### 1. Sign Up for Services

**Backblaze B2** (Storage)
1. Go to https://www.backblaze.com/b2/sign-up.html
2. Sign up for free account (10GB free storage)
3. Go to App Keys → Create new key
4. Save: `keyID` and `applicationKey`
5. Create 4 buckets:
   - `manuscripts-raw`
   - `manuscripts-processed`
   - `marketing-assets`
   - `manuscript-platform-backups`
6. Note the endpoint (usually `https://s3.us-west-000.backblazeb2.com`)

**Render** (Hosting)
1. Go to https://render.com
2. Sign up (free tier available)
3. Connect your GitHub account
4. We'll use the dashboard to deploy

### 2. Deploy to Render

**Option A: Deploy from Dashboard**
1. Push your code to GitHub
2. In Render dashboard: New → Blueprint
3. Connect your repo
4. Render will read `render.yaml` automatically
5. Add secret environment variables:
   - `ANTHROPIC_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `B2_ACCESS_KEY_ID` (from Backblaze)
   - `B2_SECRET_ACCESS_KEY` (from Backblaze)

**Option B: Deploy via CLI**
```bash
# Install Render CLI
npm install -g @renderinc/cli

# Login
render login

# Deploy
render deploy
```

### 3. Initialize Database

Once deployed, connect to your PostgreSQL database:

```bash
# Get database connection string from Render dashboard
# Run the schema
psql $DATABASE_URL < postgres-schema.sql
```

### 4. Test Deployment

```bash
# Health check
curl https://your-app.onrender.com/health

# Test auth
curl https://your-app.onrender.com/auth/me
```

### 5. Configure Custom Domain

In Render dashboard:
1. Go to your web service → Settings
2. Scroll to "Custom Domain"
3. Add `scarter4workmanuscripthub.com`
4. Update your DNS:
   - Type: CNAME
   - Name: @
   - Value: your-app.onrender.com

### 6. Monitor & Optimize

- Check logs in Render dashboard
- Monitor PostgreSQL usage
- Watch Redis memory
- Set up alerts for errors

## Costs

**Monthly Estimate:**
- Render Web Service: $7-25/month
- Render PostgreSQL: $7/month  
- Render Redis: $10/month
- Backblaze B2: ~$0.25/month (for 50GB)

**Total: ~$25-45/month**

## Rollback

If something goes wrong:
- Cloudflare Workers still running
- Can switch DNS back anytime
- Keep this deployment as staging until validated

## Support

- Render Docs: https://render.com/docs
- Backblaze B2 Docs: https://www.backblaze.com/b2/docs/
- GitHub Issues: Create if you hit blockers

