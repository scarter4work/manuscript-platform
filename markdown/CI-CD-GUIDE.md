# CI/CD Pipeline Guide

**Last Updated:** October 25, 2025
**Issue:** MAN-32
**Status:** Active

---

## Overview

This repository uses GitHub Actions for Continuous Integration (CI) and Continuous Deployment (CD) to ensure code quality and enable safe, automated deployments.

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

**Jobs:**

#### Lint and Validate
- Install dependencies
- Run ESLint (code quality checks)
- Validate Wrangler configuration
- Check for exposed secrets in code

#### Security Audit
- Run `npm audit` for dependency vulnerabilities
- Check for outdated dependencies

#### Build Validation
- Validate JavaScript syntax
- Check file sizes (warns if worker.js > 1MB)

**Status:** ✅ Runs automatically on every push/PR

### 2. Deployment Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Manual workflow dispatch only (no automatic deployments)

**Inputs:**
- `environment`: Choose `production` or `staging`

**Jobs:**

#### Deploy
1. Validate deployment (dry-run)
2. Deploy to Cloudflare Workers
3. Wait for stabilization (30 seconds)
4. Run smoke tests:
   - API health check (expects 401 Unauthorized)
   - CORS headers verification
   - Security headers (HSTS) verification
5. Create deployment record
6. Notify success/failure

**Status:** ⏸️ Manual trigger required

---

## GitHub Secrets Configuration

The following secrets must be configured in GitHub repository settings (Settings → Secrets and variables → Actions):

### Required Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers deploy permissions | Cloudflare Dashboard → My Profile → API Tokens → Create Token → Edit Cloudflare Workers template |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard → Workers & Pages → Overview (right sidebar) |

### How to Add Secrets

1. Go to GitHub repository: https://github.com/scarter4work/manuscript-platform
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret from the table above

---

## Usage

### Running CI Checks Locally

```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Validate Wrangler config
npx wrangler deploy --dry-run

# Run security audit
npm audit

# Check for outdated packages
npm outdated
```

### Deploying to Production

**Manual Deployment via GitHub Actions:**

1. Go to https://github.com/scarter4work/manuscript-platform/actions
2. Click on **Deploy to Production** workflow
3. Click **Run workflow** button
4. Select `production` environment
5. Click **Run workflow**
6. Monitor the deployment progress
7. Verify smoke tests pass

**Manual Deployment via CLI (Alternative):**

```bash
# Deploy directly via wrangler (use sparingly)
npx wrangler deploy
```

### Viewing Workflow Status

- **CI Status:** Visible on every commit/PR as status checks
- **Deployment Status:** View in Actions tab after manual trigger
- **Deployment History:** Actions tab → Deploy to Production workflow

---

## Environment Protection Rules

### Production Environment

- **Manual approval required:** No automatic deployments
- **Deployment method:** GitHub Actions workflow dispatch only
- **Post-deployment:** Automatic smoke tests
- **Rollback:** Manual via Cloudflare dashboard or `npx wrangler rollback`

### Staging Environment (Future)

- **Auto-deploy:** On push to `develop` branch
- **Purpose:** Pre-production testing
- **URL:** TBD (staging.scarter4workmanuscripthub.com)

---

## Deployment Checklist

Before triggering a production deployment:

- [ ] All CI checks passing on main branch
- [ ] Changes tested locally with `npm run dev`
- [ ] No secrets or sensitive data in code
- [ ] Breaking changes documented
- [ ] Database migrations tested (if applicable)
- [ ] Monitoring dashboard ready (check for errors post-deploy)

After deployment:

- [ ] Smoke tests passed in workflow
- [ ] Manual verification: `curl https://api.scarter4workmanuscripthub.com/manuscripts` (should return 401)
- [ ] Monitor error rates for 15 minutes
- [ ] Check Cloudflare Analytics for anomalies
- [ ] Test critical user flows (login, upload, analysis)

---

## Rollback Procedures

### Option 1: Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Workers & Pages → manuscript-upload-api
2. Click **Deployments** tab
3. Find previous working deployment
4. Click **⋯** → **Rollback to this deployment**

### Option 2: Wrangler CLI

```bash
# Rollback to previous deployment
npx wrangler rollback --message "Rolling back due to [issue]"

# View deployment history
npx wrangler deployments list
```

### Option 3: Redeploy Previous Commit

```bash
# Find last known-good commit
git log --oneline

# Checkout that commit
git checkout <commit-hash>

# Deploy
npx wrangler deploy

# Return to main
git checkout main
```

---

## Troubleshooting

### CI Workflow Fails

**ESLint errors:**
```bash
# Fix automatically
npm run lint:fix

# Review errors
npm run lint
```

**Secrets detected:**
- Never commit API keys, tokens, or passwords
- Use `.dev.vars` for local secrets (gitignored)
- Use `npx wrangler secret put` for production secrets

**npm audit failures:**
```bash
# Review vulnerabilities
npm audit

# Fix automatically (if possible)
npm audit fix

# For high-risk vulnerabilities, update packages manually
npm update <package-name>
```

### Deployment Workflow Fails

**Authentication errors:**
- Verify `CLOUDFLARE_API_TOKEN` is set correctly
- Verify `CLOUDFLARE_ACCOUNT_ID` matches your account
- Check token permissions (must have Workers deploy access)

**Smoke tests fail:**
- Check if API is actually down: `curl https://api.scarter4workmanuscripthub.com/manuscripts`
- Review Cloudflare Workers logs: `npx wrangler tail`
- Check for deployment errors in Cloudflare dashboard

**Queue consumer errors:**
- Expected warning: `Queue already has a consumer` (safe to ignore)
- Deployment succeeds despite this warning

---

## Monitoring Post-Deployment

### Immediate (0-15 minutes)

1. **Check Cloudflare Analytics:**
   - Dashboard → Workers & Pages → manuscript-upload-api → Metrics
   - Verify request rate is normal
   - Check error rate (should be < 1%)

2. **Monitor Live Logs:**
   ```bash
   npx wrangler tail --format pretty
   ```

3. **Test Critical Endpoints:**
   ```bash
   # Test API health
   curl https://api.scarter4workmanuscripthub.com/manuscripts

   # Test login
   curl -X POST https://api.scarter4workmanuscripthub.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```

### Short-term (1 hour)

- Review error rates in Cloudflare Analytics
- Check Sentry for new errors (when configured)
- Verify no user reports of issues

### Long-term (24 hours)

- Compare metrics to pre-deployment baseline
- Review any anomalies
- Update runbook if new issues discovered

---

## Best Practices

1. **Always test locally first:** `npm run dev` before pushing
2. **Run linter before commit:** `npm run lint:fix`
3. **Keep commits focused:** One feature/fix per commit
4. **Write descriptive commit messages:** Include context and reasoning
5. **Monitor after deployment:** Watch for errors for 15 minutes minimum
6. **Document breaking changes:** Update documentation when APIs change
7. **Use manual deployments:** No auto-deploy to production
8. **Keep secrets out of code:** Use Wrangler secrets or environment variables

---

## CI/CD Metrics

Track these metrics to improve deployment quality:

- **Deployment frequency:** How often we deploy
- **Deployment success rate:** % of successful deployments
- **Mean time to deploy:** Time from commit to production
- **Rollback rate:** % of deployments that require rollback
- **CI build time:** How long CI checks take
- **Smoke test pass rate:** % of deployments passing smoke tests

---

## Future Enhancements

Planned improvements to the CI/CD pipeline:

- [ ] **Staging environment:** Auto-deploy develop branch to staging
- [ ] **Integration tests:** E2E tests in CI pipeline
- [ ] **Performance tests:** Load testing before production
- [ ] **Automated rollback:** Rollback on smoke test failures
- [ ] **Slack notifications:** Deployment status to Slack channel
- [ ] **Deployment approval gates:** Required reviews before production deploy
- [ ] **Blue-green deployments:** Zero-downtime deployments
- [ ] **Canary releases:** Gradual traffic shifting to new version

---

## Related Documentation

- **Production Runbook:** `PRODUCTION-RUNBOOK.md` - Operations manual
- **Monitoring Guide:** `MONITORING-IMPLEMENTATION-GUIDE.md` - Observability setup
- **Security Audit:** `SECURITY-AUDIT-REPORT.md` - Security practices
- **Environment Status:** `PRODUCTION-ENVIRONMENT-STATUS.md` - Infrastructure overview

---

## Contact & Support

**Primary Contact:** scarter4work@yahoo.com

**Useful Links:**
- GitHub Repository: https://github.com/scarter4work/manuscript-platform
- Cloudflare Dashboard: https://dash.cloudflare.com
- Linear Issue: https://linear.app/manuscript-publishing-platform/issue/MAN-32

---

**Last Updated:** October 25, 2025
**Next Review:** After first production deployment via GitHub Actions
