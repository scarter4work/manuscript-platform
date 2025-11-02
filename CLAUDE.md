# Manuscript Publishing Platform - Claude Memory

## Project Overview

AI-powered platform for indie authors to edit, publish, and market manuscripts. Built on Cloudflare's edge infrastructure.

**Revenue Model**: 15-20% of author royalties (authors pay nothing upfront)

## Architecture

**Stack:**
- Cloudflare Workers (serverless edge compute)
- R2 (object storage for manuscripts/assets)
- D1 (SQLite metadata - planned)
- Vectorize (comp title matching - planned)
- Claude API (AI manuscript analysis)

**Buckets:**
- `manuscripts-raw` - Original uploads
- `manuscripts-processed` - AI-analyzed with feedback
- `marketing-assets` - Covers, photos, promotional materials

**Domains:**
- API: `api.scarter4workmanuscripthub.com`
- Frontend: TBD

## Current State

**Completed:**
- ✅ Manuscript upload system (PDF, DOCX, TXT, EPUB)
- ✅ R2 storage with metadata
- ✅ Developmental editing agent (plot, character, pacing)
- ✅ Line editing agent (prose improvement)
- ✅ Copy editing agent (grammar, consistency)

**In Progress:**
- GitHub Issues migration from Linear
- CI/CD pipeline configuration
- Cross-platform build fixes

**Key Files:**
- `worker.js` - Main API routes and handlers
- `developmental-agent.js` - Developmental editing implementation
- `line-editing-agent.js` - Line editing implementation
- `copy-editing-agent.js` - Copy editing implementation
- `wrangler.toml` - Cloudflare configuration

## Agile Development Workflow

### Definition of Done (DoD)
Work is **NOT COMPLETE** until ALL acceptance criteria are met:

1. ✓ Cloudflare build succeeds
2. ✓ Integration tests pass
3. ✓ Zero deployment errors

**If any criteria fail, work is NOT done. Period.**

### Kanban Board Workflow
**CRITICAL**: All work must have a GitHub issue. No exceptions.

- **Before starting**: Create GitHub issue OR pick existing one from backlog
- **When picking up ticket**: Move to "In Progress" immediately
- **When completing**:
  - Verify Definition of Done (all 3 criteria above)
  - Move issue to next phase OR close it
  - Notify user of new status
  - Follow kanban workflow discipline

### Build System Notes
- Project uses npm (Node v22.20.0, npm 10.9.3)
- Wrangler version: 4.45.2
- Platform: **Windows** (Git Bash/MSYS)
- Recent fix: Removed platform-specific Rollup dependency for cross-platform builds
- `.npmrc` configured to skip optional dependencies

### Platform-Specific Rules
**"I'm not on Linux, I'm on Windows, and I have to deal with it"**

- Use **Cloudflare MCP** for Cloudflare operations (not bash/wrangler)
- Use **Windows MCP** for desktop operations when needed
- Bash commands may not work as expected - prefer MCP tools
- PowerShell available via `mcp__windows-mcp__Powershell-Tool` if needed

### Known Issues
- Claude Code 2.0.31 occasionally gets stuck in error loops after 400 errors
  - Symptom: Repeats same error on any input
  - Fix: Restart conversation
- Package-lock.json removed from git to prevent cross-platform conflicts

## API Endpoints

### File Management
- `POST /upload/manuscript` - Upload manuscript (FormData: file, authorId, manuscriptId)
- `POST /upload/marketing` - Upload marketing asset
- `GET /list/{authorId}?bucket=raw` - List files
- `GET /get/{key}?bucket=raw` - Get file
- `DELETE /delete/{key}?bucket=raw` - Delete file

### AI Analysis
- `POST /analyze/developmental` - Trigger analysis (JSON: manuscriptKey, genre)
- `GET /analysis/{manuscriptKey}` - Get results

## Security Notes
**Current**: Development mode (no auth)
**Production TODO**:
- Authentication (Cloudflare Access or JWT)
- Rate limiting
- File virus scanning
- API key rotation
- Data encryption
- GDPR compliance

## Cost Structure
- Cloudflare Workers: Free up to 100K requests/day
- R2: $0.015/GB storage
- Claude API: ~$2-4 per manuscript analysis

## Recent Activity Log

### 2025-11-01
- Set up CLAUDE.md for project memory
- Established GitHub workflow rules
- Noted Claude Code 2.0.31 stability issues

---

*This file is updated by Claude to maintain project context across sessions.*
