# Deployment Checklist

## ⚠️ IMPORTANT: Always follow this checklist when deploying to production

### Pre-Deployment Steps

1. **Test Locally**
   ```bash
   npx wrangler dev --local --port 8787
   ```
   - Verify functionality works as expected
   - Test all modified features

2. **Check Git Status**
   ```bash
   git status
   ```
   - Review all modified files
   - Ensure no sensitive data is being committed

### Production Deployment Process

**⚠️ CRITICAL: ALWAYS COMMIT TO GITHUB BEFORE OR IMMEDIATELY AFTER PRODUCTION DEPLOY**

#### Step 1: Deploy to Cloudflare
```bash
npx wrangler deploy
```

#### Step 2: Commit and Push to GitHub (REQUIRED)
```bash
# Stage changes
git add <files>

# Commit with descriptive message
git commit -m "Description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push
```

#### Step 3: Verify Deployment
- Test production endpoints
- Check admin console functionality
- Verify user-facing features

### Why This Matters

1. **Version Control**: GitHub is the source of truth for the codebase
2. **Backup**: Production code is backed up in version control
3. **Collaboration**: Team members can see what's deployed
4. **Rollback**: Easy to revert to previous versions if needed
5. **Audit Trail**: Clear history of what was deployed and when

### Common Deployment Scenarios

**Scenario 1: New Feature**
1. Implement feature locally
2. Test with `wrangler dev`
3. Deploy to production: `npx wrangler deploy`
4. **IMMEDIATELY**: Commit and push to GitHub

**Scenario 2: Bug Fix**
1. Fix bug locally
2. Test fix
3. Deploy: `npx wrangler deploy`
4. **IMMEDIATELY**: Commit and push to GitHub

**Scenario 3: Configuration Change**
1. Update config (wrangler.toml, etc.)
2. Deploy: `npx wrangler deploy`
3. **IMMEDIATELY**: Commit and push to GitHub

### Excluded Files (Never Commit)

- `.dev.vars` - Local secrets
- `.claude/settings.local.json` - Local settings
- `node_modules/` - Dependencies
- `.wrangler/` - Build artifacts

### Emergency Rollback Procedure

If production deploy fails:

1. **Revert in Cloudflare**
   ```bash
   git log  # Find last good commit
   git checkout <commit-hash>
   npx wrangler deploy
   git checkout main
   ```

2. **Fix and redeploy**
   - Fix the issue
   - Test locally
   - Deploy again
   - Commit to GitHub

---

## 📋 Quick Checklist

- [ ] Tested locally with `wrangler dev`
- [ ] Deployed to production: `npx wrangler deploy`
- [ ] **COMMITTED TO GITHUB** ✅
- [ ] **PUSHED TO GITHUB** ✅
- [ ] Verified production functionality
- [ ] No sensitive data in commit

---

**Remember: GitHub commit is NOT optional. It's a required step in every production deployment.**
