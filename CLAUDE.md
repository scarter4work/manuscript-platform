# Manuscript Publishing Platform - Claude Memory

## Project Overview

AI-powered platform for indie authors to edit, publish, and market manuscripts. Built on Render's cloud infrastructure with PostgreSQL, Redis, and Backblaze B2 storage.

**Revenue Model**: 15-20% of author royalties (authors pay nothing upfront)

## Architecture

**Production Stack (Render):**
- Express.js on Node.js (Render Web Service)
- PostgreSQL (Render Managed Database)
- Redis (Render Session Storage)
- Backblaze B2 (Object storage for manuscripts/assets)
- Claude API (AI manuscript analysis)

**Storage Buckets (Backblaze B2):**
- `manuscript-raw` - Original uploads
- `manuscript-processed` - AI-analyzed with feedback
- `manuscript-marketing-assets` - Covers, photos, promotional materials
- `manuscript-platform-backups` - Database backups

**Domain:**
- Production: `selfpubhub.co` (both frontend and API served from same origin)

## Current State

**Completed:**
- ✅ Manuscript upload system (PDF, DOCX, TXT, EPUB)
- ✅ Backblaze B2 storage with PostgreSQL metadata
- ✅ Developmental editing agent (plot, character, pacing)
- ✅ Line editing agent (prose improvement)
- ✅ Copy editing agent (grammar, consistency)
- ✅ Enhanced Metadata System (Issue #51 - 49 genres, 24 content warnings, word count validation)
- ✅ Author Bio Generator (Issue #43)
- ✅ Cover Design Brief Generator (Issue #46)
- ✅ Multi-Platform Export Packages (Issue #58 - D2D, IngramSpark, Apple Books)

**Completed (MVP Features):**
- ✅ Query Letters & Synopsis Management (Issue #49 - AI generation, version tracking)
- ✅ Submission Package Bundler (Issue #50 - Package templates, ZIP downloads)
- ✅ Nuanced Submission Response System (Issue #52 - 8 response types, feedback tracking, R&R workflow)

**🎉 MVP MILESTONE: ALL 4 MVP FEATURES COMPLETE! 🎉**
- ✅ Issue #51 - Enhanced Manuscript Metadata System
- ✅ Issue #49 - Query Letters & Synopsis Management
- ✅ Issue #50 - Submission Package Bundler
- ✅ Issue #52 - Nuanced Submission Response System

**Key Files:**
- `server.js` - Express.js server (Render production)
- `render.yaml` - Render deployment configuration
- `src/adapters/` - Database, storage, and session adapters for Render infrastructure
- `src/router/router.js` - Platform-agnostic routing layer
- `src/handlers/` - API request handlers
- `src/generators/` - AI content generation modules

## Agile Development Workflow

### Definition of Done (DoD)
Work is **NOT COMPLETE** until ALL acceptance criteria are met:

1. ✓ Render deployment succeeds
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
- Platform: **Windows** (Git Bash/MSYS)
- Testing requires optional dependencies: `@rollup/rollup-win32-x64-msvc`, `@esbuild/win32-x64`
- `.npmrc` allows optional dependencies (required for Vitest + native modules on Windows)
- Vitest configured for Node.js environment (was Cloudflare Workers)

### Platform-Specific Rules
**"I'm not on Linux, I'm on Windows, and I have to deal with it"**

- Use **Render MCP** for Render deployment operations (deployments, logs, services)
  - ✅ **Configured**: MCP server at `~/.claude/mcp.json`
  - Endpoint: `https://mcp.render.com/mcp` (SSE transport)
  - API token stored in MCP config (rotate regularly)
  - Check deployment status, view logs, manage services
  - Prefer MCP over manual API calls or web console checks
  - **Note**: Requires Claude Code restart after config changes
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

### Enhanced Metadata (Issue #51)
- `GET /genres` - Get genre taxonomy (49 genres, hierarchical)
- `GET /genres/:id` - Get specific genre with subgenres
- `GET /genres/:id/subgenres` - Get subgenres
- `GET /content-warnings` - Get content warnings (24 warnings, 6 categories)
- `PATCH /manuscripts/:id/enhanced-metadata` - Update metadata
- `GET /manuscripts/:id/validate-genre` - Validate word count vs genre
- `GET /manuscripts/:id/metadata-history` - Get change history

### Query Letters & Synopsis (Issue #49)
- `POST /manuscripts/:id/documents/generate` - AI generate query letter or synopsis
- `POST /manuscripts/:id/documents/generate-all` - Generate all 3 documents
- `GET /manuscripts/:id/documents` - List supporting documents
- `GET /manuscripts/:id/documents/:docId` - Get specific document
- `PUT /manuscripts/:id/documents/:docId` - Update (creates new version)
- `DELETE /manuscripts/:id/documents/:docId` - Delete document
- `GET /manuscripts/:id/documents/:docType/versions` - Version history

### Submission Packages (Issue #50)
- `POST /manuscripts/:id/packages` - Create submission package
- `GET /manuscripts/:id/packages` - List packages
- `GET /manuscripts/:id/packages/:pkgId` - Get package details
- `PUT /manuscripts/:id/packages/:pkgId` - Update package
- `DELETE /manuscripts/:id/packages/:pkgId` - Delete package
- `GET /manuscripts/:id/packages/:pkgId/download` - Download as ZIP
- `POST /manuscripts/:id/packages/:pkgId/duplicate` - Duplicate package
- `GET /manuscripts/:id/packages/templates` - Get package templates

### Submission Tracking (Issue #52)
- `POST /manuscripts/:id/submissions` - Create submission
- `GET /manuscripts/:id/submissions` - List submissions
- `GET /submissions/:id` - Get submission details
- `PATCH /submissions/:id/response` - Update response (8 types)
- `POST /submissions/:id/feedback` - Add categorized feedback
- `GET /submissions/:id/feedback` - Get all feedback
- `PATCH /submissions/:id/feedback/:fbId` - Mark feedback as addressed
- `POST /submissions/:id/resubmit` - Create R&R resubmission
- `GET /manuscripts/:id/feedback-summary` - Aggregate feedback summary

## Security Notes
**Current**: Cookie-based authentication with httpOnly, secure cookies
**Implemented**:
- ✅ Rate limiting (Redis-based)
- ✅ File virus scanning (ClamAV)

**Production TODO**:
- API key rotation
- Enhanced data encryption
- GDPR compliance

## Cost Structure
- Render Web Service: $7/month (Starter plan)
- PostgreSQL Database: $7/month (Starter plan)
- Redis: Free tier
- Backblaze B2: $0.005/GB storage + $0.01/GB egress
- Claude API: ~$2-4 per manuscript analysis

## Recent Activity Log

### 2025-11-10 (Issue #73 Committed & Closed)
- **Committed Issue #73 Final Changes**
  - Commit `1ff9ada`: feat(issue-73): Complete Cloudflare migration - 100% Render infrastructure
  - 32 files committed: all handler updates, database adapters, test infrastructure
  - Added comprehensive issue close documentation (`.github-issues/issue-73-close.md`)
  - Pushed to GitHub main branch

- **Issue #73 Status**
  - ✅ Closed on GitHub (already marked complete)
  - ✅ All 4 phases complete (Frontend URLs, R2, Queues, Documentation)
  - ✅ 135 files migrated total
  - ✅ Platform 100% vendor-independent (no Cloudflare dependencies)

- **Workflow Reminder**
  - Reinforced: Always commit work immediately after completion
  - Follow kanban board workflow discipline
  - Never leave uncommitted changes overnight

### 2025-11-09 (Cloudflare Migration Complete - Issue #73)
- **Completed Full Cloudflare → Render Migration (Issue #73)**
  - Phase 1: Frontend URLs + R2 Storage (61 files migrated to env.R2.getBucket())
  - Phase 2.1: Queue system (Redis-backed with retries, scheduling, DLQ)
  - Phase 2.2: KV Cache (already using cache adapter)
  - Phase 3: Archived deprecated files (wrangler.toml, worker-router.js, dist/)
  - Phase 4: Updated documentation

- **Redis Queue Service Features**
  - Job persistence in Redis hashes
  - Exponential backoff retries (5s → 30s → 5min)
  - Delayed/scheduled jobs using sorted sets
  - Dead letter queue for permanently failed jobs
  - Standalone worker process (`npm run worker`)

- **Migration Scripts Created**
  - `scripts/migrate-r2-to-adapter.js` - Automated R2 storage migration
  - `scripts/migrate-queue-to-redis.js` - Automated queue migration

- **Overall Progress**
  - 220+ files audited
  - 67 files migrated (61 R2, 6 queue)
  - 134 files already using adapters (D1, KV)
  - Estimated 10 hours → Actual 6 hours (40% time savings)

### 2025-11-08 (File Virus Scanning Implemented)
- **Implemented ClamAV Virus Scanner (Issue #65)**
  - Created `virus-scanner.js` service module with ClamAV integration
  - Added scanning to manuscript uploads (`/upload/manuscript`)
  - Added scanning to marketing asset uploads (`/upload/marketing`)
  - Fail-closed mode in production (blocks uploads if scanner unavailable)
  - Graceful degradation in development (allows uploads with warning)

- **Database Migration #038: Security Incidents**
  - Created `security_incidents` table (malware detections, suspicious activity)
  - Created `file_scan_results` table (audit log of all scans)
  - Created `scanner_health` table (monitor ClamAV status)
  - Created analytics views for security monitoring

- **Docker Compose Configuration**
  - Added ClamAV service (port 3310)
  - Auto-updates virus definitions daily
  - 512MB RAM allocation for optimal performance

- **Security Features**:
  - EICAR test file detection
  - Malware incident logging with IP tracking
  - Scan result audit trail (duration, file size, viruses found)
  - Scanner health monitoring
  - Configurable fail-open/fail-closed behavior

### 2025-11-05 (Login Fixes & Redis Rate Limiting)
- **Fixed Critical Login Failures**
  - Resolved `ReferenceError: origin is not defined` in auth-handlers.js
  - Moved origin declaration outside try block for proper error handling
  - Fixed CORS headers in error responses

- **Refactored Rate Limiting for Redis**
  - Replaced Cloudflare KV (env.SESSIONS) with direct Redis client usage (env.REDIS)
  - Rewrote isRateLimited(), recordLoginAttempt(), clearRateLimit()
  - Uses native Redis commands: get, set (with EX), del
  - Proper error handling with graceful degradation
  - Rate limiting now fully functional on Render deployment

- **Test Infrastructure Fixes**
  - Fixed Vitest configuration to work with Node.js environment (was Cloudflare Workers)
  - Installed Windows-specific optional dependencies (@rollup/rollup-win32-x64-msvc, @esbuild/win32-x64)
  - All 125 tests passing

### 2025-11-04 (Render Migration)
- **Render Deployment Configuration**
  - Created `server.js` Express.js adapter for Render
  - Implemented platform adapters: database (D1→PostgreSQL), storage (R2→Backblaze B2), session (KV→Redis)
  - Fixed `render.yaml` configuration issues:
    - Removed unsupported `maxmemoryPolicy` field from Redis service config
    - Changed plan from deprecated `starter` to `standard` (web) and `free` (database/Redis)
    - Moved Redis from `databases` to `services` section
  - Deployment targets: PostgreSQL database, Redis cache, Express web service
  - ✅ **Configured Render MCP server** at `~/.claude/mcp.json` for deployment monitoring
  - API token rotated for security

### 2025-11-03 (MVP COMPLETION DAY! 🎉)
- **COMPLETED Issue #51**: Enhanced Manuscript Metadata System
  - Database migration: 3 new tables (genres, content_warning_types, manuscript_metadata_history)
  - Added 10 metadata columns to manuscripts table
  - Seed data: 49 genres (Fiction/Nonfiction hierarchy), 24 content warnings
  - 7 API endpoints for metadata management
  - Frontend UI: metadata.html (670 lines)
  - Word count validation against genre norms

- **COMPLETED Issue #49**: Query Letters & Synopsis Management System
  - Database migration: supporting_documents table with version tracking
  - AI Generators: query-letter-generator.js (220 lines), synopsis-generator.js (350 lines)
  - 7 API endpoints for document generation and management
  - Frontend UI: documents.html (230 lines)
  - Query letters (250-500 words), Short synopsis (500w), Long synopsis (2500w)
  - Version management with rollback capability

- **COMPLETED Issue #50**: Submission Package Bundler
  - Database migration: submission_packages, package_document_map tables
  - Package handlers: submission-package-handlers.js (650 lines)
  - 8 API endpoints for package CRUD operations
  - Frontend UI: packages.html (480 lines)
  - Package templates: agent query, full manuscript, query only, contest
  - Client-side ZIP generation using JSZip library
  - Document selection interface with ordering

- **COMPLETED Issue #52**: Nuanced Submission Response System
  - Database migration: submissions table enhancement, submission_feedback table
  - Response handlers: submission-response-handlers.js (750 lines)
  - 9 API endpoints for submission lifecycle
  - Frontend UI: submissions.html (520 lines)
  - 8 response types (form rejection, R&R, request full, offer, etc.)
  - 10 categorized feedback types (plot, character, pacing, etc.)
  - R&R workflow with revision tracking and resubmission linking
  - Feedback summary dashboard with aggregate statistics
  - Color-coded response badges

- **🎉 MVP MILESTONE ACHIEVED**: All 4 MVP features (#51, #49, #50, #52) complete and deployed!
  - Complete traditional publishing workflow from metadata to submission tracking
  - Total code added: ~4,600 lines across 3 sessions
  - All deployments successful, zero errors
  - All database migrations applied successfully

### 2025-11-02
- Completed Issue #58: Multi-Platform Export Packages UI
- Completed Issue #46: AI Cover Design Brief Generator
- Completed Issue #43: Author Bio Generator

### 2025-11-01
- Set up CLAUDE.md for project memory
- Established GitHub workflow rules
- Noted Claude Code 2.0.31 stability issues

## Deprecated/Legacy Infrastructure

**✅ Cloudflare Stack Fully Deprecated (Issues #74, #73 - Completed 2025-11-09)**

The platform was originally built on Cloudflare's edge infrastructure but has been **100% migrated to Render**. All Cloudflare dependencies have been removed from the codebase.

**Archived Files** (moved to `archive/deprecated/`):
- `wrangler.toml` - Cloudflare Workers configuration
- `worker-router.js` - Cloudflare Workers entry point
- `dist/` - Build artifacts (deleted, added to .gitignore)

**Migration Complete (Issue #73):**

| Cloudflare Service | Render Replacement | Migration | Status |
|--------------------|-------------------|-----------|--------|
| **Workers** (serverless) | Express.js on Node.js | server.js adapter | ✅ Complete |
| **R2** (object storage) | Backblaze B2 | storage-adapter.js | ✅ Complete (61 files) |
| **D1** (SQLite database) | PostgreSQL | database-adapter.js | ✅ Complete (67 files, no changes needed) |
| **KV** (key-value store) | Redis | cache-adapter.js | ✅ Complete (no changes needed) |
| **Queues** (job queue) | Redis queue service | queue-service.js | ✅ Complete (6 files + worker) |

**Adapter Layer:**
All adapters provide drop-in compatibility with original Cloudflare APIs:
- `src/adapters/database-adapter.js` - D1 → PostgreSQL (auto-converts `?` → `$1, $2, $3`)
- `src/adapters/storage-adapter.js` - R2 → Backblaze B2 (S3-compatible)
- `src/adapters/cache-adapter.js` - KV → Redis (get/put/delete)
- `src/services/queue-service.js` - Cloudflare Queues → Redis (with retries, scheduling, DLQ)

**Migration Timeline:**
- **Issue #74** (2025-11-08): SQLite → PostgreSQL migration (49 migration files, 500+ syntax fixes)
- **Issue #73** (2025-11-09): Complete Cloudflare cleanup (220+ files audited, 10 hours work → 6 hours actual)

**Why We Migrated:**
- Render provides a more traditional Node.js environment with better debugging
- PostgreSQL offers more robust relational database features than D1 (SQLite)
- Backblaze B2 is more cost-effective than R2 for large file storage
- Redis provides production-ready queue features (retries, scheduling, DLQ)
- Consolidated infrastructure reduces complexity and vendor lock-in

---

*This file is updated by Claude to maintain project context across sessions.*
