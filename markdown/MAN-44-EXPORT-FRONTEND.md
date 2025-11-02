# MAN-44: Frontend UI for Multi-Platform Export Packages

## Overview
Build the frontend interface for the multi-platform export package system (MAN-40, 41, 42).

## Background
The backend export system is fully implemented and deployed:
- Draft2Digital export packages (MAN-40) ✅
- IngramSpark export packages (MAN-41) ✅
- Apple Books export packages (MAN-42) ✅

Backend generates EPUB, PDF, and cover files with proper validation, but users have no UI to access these features.

## Requirements

### 1. Export Dashboard Page (`/exports.html`)
- Display list of all export packages across all platforms
- Filter by platform (Draft2Digital, IngramSpark, Apple Books)
- Show package status (generating, ready, failed, expired)
- Display metadata (title, author, created date, expires date)
- Download buttons for each file type
- Delete expired packages

### 2. Create Export Package Interface
- Platform selection (D2D, IngramSpark, Apple Books)
- Manuscript selection (from user's manuscripts)
- Platform-specific options:
  - **Draft2Digital**: pricing by territory, format preferences
  - **IngramSpark**: trim size, page count, paper type, ISBN
  - **Apple Books**: age rating, explicit content flag
- Generate button with progress indicator

### 3. Package Details View
- Show all files in package (manuscript, cover, interior, README)
- Download individual files or complete ZIP
- View package metadata
- Regenerate package option
- Platform-specific upload instructions

### 4. Integration with Dashboard
- Add "Export" tab to main dashboard
- Link from manuscript detail view
- Show export status in manuscript list

## Technical Approach
- Use existing frontend architecture (vanilla JS + Tailwind)
- API endpoints already exist:
  - `POST /exports/:platform/:manuscriptId` - Create export package
  - `GET /exports/:platform` - List export packages
  - `GET /exports/:platform/:packageId` - Get package details
  - `GET /exports/:platform/:packageId/:fileType` - Download file

## Acceptance Criteria
- [x] Backend APIs functional and deployed
- [ ] Users can create export packages for all three platforms
- [ ] Users can view list of all export packages
- [ ] Users can download generated files
- [ ] Platform-specific options are properly collected
- [ ] Error handling and validation in place
- [ ] Responsive design works on mobile

## Files to Create/Modify
- `frontend/exports.html` - Main export dashboard
- Update `frontend/dashboard-spa.html` - Add export navigation

## Priority
**HIGH** - Blocks user access to completed backend features

## Estimated Time
2-3 hours

---

**Status**: Todo
**Created**: 2025-10-31
**Assignee**: Claude
