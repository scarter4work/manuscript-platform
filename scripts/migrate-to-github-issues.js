#!/usr/bin/env node

/**
 * Migrate Linear Tickets to GitHub Issues
 *
 * This script migrates all Linear tickets (MAN-*) to GitHub Issues
 * and creates a GitHub Project board for kanban-style tracking.
 *
 * Prerequisites:
 * 1. Install GitHub CLI: https://cli.github.com/
 * 2. Authenticate: gh auth login
 *
 * Usage:
 *   node migrate-to-github-issues.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Repository info
const REPO_OWNER = 'scarter4work';
const REPO_NAME = 'manuscript-platform';
const REPO = `${REPO_OWNER}/${REPO_NAME}`;

// Color coding for labels
const LABELS = {
  'priority: high': 'd73a4a', // red
  'priority: medium': 'fbca04', // yellow
  'priority: low': '0e8a16', // green
  'type: feature': 'a2eeef', // blue
  'type: bug': 'd73a4a', // red
  'type: optimization': 'c5def5', // light blue
  'status: done': '0e8a16', // green
  'status: in-progress': 'fbca04', // yellow
  'status: todo': 'd4c5f9', // purple
  'platform: draft2digital': 'e3f2fd',
  'platform: ingramspark': 'f3e5f5',
  'platform: apple-books': 'e8f5e9',
};

// Ticket definitions from Linear
const TICKETS = [
  {
    id: 'MAN-28',
    title: 'Database Query Optimization and Caching',
    status: 'done',
    priority: 'medium',
    type: 'optimization',
    description: `## Overview
Implement comprehensive database query optimization and caching system.

## Features
- KV-based caching layer with TTL management
- Cursor-based pagination (faster than OFFSET)
- Composite indexes for common query patterns
- Prepared statement caching
- Query performance monitoring

## Impact
- 50-80% faster API responses
- 60-70% reduction in D1 query costs
- 75% reduction in R2 requests
- 10x better scalability

## Status
✅ Complete and deployed

## Files
- db-cache.js
- db-utils.js
- migrations/007-query-optimization.sql
- docs/DB-OPTIMIZATION.md`,
    labels: ['priority: medium', 'type: optimization', 'status: done'],
  },
  {
    id: 'MAN-40',
    title: 'Draft2Digital Export Packages',
    status: 'done',
    priority: 'high',
    type: 'feature',
    description: `## Overview
Build export package system for Draft2Digital platform.

## Features
- EPUB and DOCX format support
- Cover image processing
- README generation with upload instructions
- Package expiration tracking (30 days)
- Download tracking

## Technical Implementation
- Database: d2d_export_packages table
- R2 Storage: exports/d2d/{userId}/{packageId}/
- API Endpoints: POST/GET /exports/d2d/*
- Document Processing: JSZip for EPUB, mammoth for DOCX parsing

## Status
✅ Complete and deployed

## Files
- export-handler.js
- epub-generator.js
- migration_021_multi_platform_exports.sql`,
    labels: ['priority: high', 'type: feature', 'status: done', 'platform: draft2digital'],
  },
  {
    id: 'MAN-41',
    title: 'IngramSpark Export Packages',
    status: 'done',
    priority: 'high',
    type: 'feature',
    description: `## Overview
Build export package system for IngramSpark platform (print and ebook).

## Features
- Print book support with trim sizes, page count, paper types
- Interior PDF generation with proper bleed
- Print cover PDF with spine width calculation
- EPUB for ebook distribution
- README with IngramSpark upload instructions

## Print Options
- Trim Sizes: 6x9, 5.5x8.5, 5x8, 8.5x11
- Page Count: 24-828 (even pages)
- Paper Types: Cream/White 50#-70#
- Automatic bleed inclusion
- Spine width calculation

## Technical Implementation
- Database: ingramspark_export_packages table
- R2 Storage: exports/ingramspark/{userId}/{packageId}/
- PDF Generation: pdf-lib (Workers-compatible)
- Cover Processing: Spine calculation + pdf-lib

## Status
✅ Complete and deployed

## Files
- export-handler.js
- pdf-generator.js
- cover-processor.js`,
    labels: ['priority: high', 'type: feature', 'status: done', 'platform: ingramspark'],
  },
  {
    id: 'MAN-42',
    title: 'Apple Books Export Packages',
    status: 'done',
    priority: 'high',
    type: 'feature',
    description: `## Overview
Build export package system for Apple Books platform.

## Features
- EPUB 3.0 generation
- Age rating and explicit content flags
- EPUB validation
- Cover image validation and processing
- README with Apple Books Connect upload instructions

## Validation
- EPUB 3.0 compliance
- Cover dimensions (1600x2400 recommended)
- Metadata completeness
- File size limits

## Technical Implementation
- Database: apple_books_export_packages table
- R2 Storage: exports/apple_books/{userId}/{packageId}/
- EPUB Generation: JSZip + manual EPUB 3.0 assembly
- Validation: format-validator.js

## Status
✅ Complete and deployed

## Files
- export-handler.js
- epub-generator.js
- format-validator.js`,
    labels: ['priority: high', 'type: feature', 'status: done', 'platform: apple-books'],
  },
  {
    id: 'MAN-43',
    title: 'Document Processing Pipeline',
    status: 'done',
    priority: 'high',
    type: 'feature',
    description: `## Overview
Central document processing pipeline for generating platform-specific export packages.

## Features
- DOCX to EPUB conversion (JSZip + mammoth)
- DOCX to PDF conversion (pdf-lib)
- Cover image processing
- Platform-specific format handling
- Multi-platform batch processing
- Format validation

## Workers-Compatible Libraries
- ✅ JSZip - EPUB assembly
- ✅ pdf-lib - PDF generation
- ✅ mammoth - DOCX parsing
- ✅ Replaced epub-gen-memory (uses eval())
- ✅ Replaced sharp (native binaries)
- ✅ Replaced PDFKit (compatibility issues)

## Status
✅ Complete and deployed

## Files
- document-processor.js
- epub-generator.js (complete rewrite)
- pdf-generator.js (complete rewrite)
- cover-processor.js (rewrite)
- format-validator.js`,
    labels: ['priority: high', 'type: feature', 'status: done'],
  },
  {
    id: 'MAN-44',
    title: 'Export Packages Frontend UI',
    status: 'done',
    priority: 'high',
    type: 'feature',
    description: `## Overview
Frontend interface for multi-platform export package system.

## Features
- Export dashboard with package listing
- Platform filtering (D2D, IngramSpark, Apple Books)
- Create export package interface
- Platform-specific option forms
- Package details view
- Individual file downloads
- Status badges and expiration tracking

## UI/UX
- Card-based layout
- Platform color coding
- Loading states and animations
- Responsive design
- Form validation
- Error handling

## Technical Implementation
- Single Page Application (SPA)
- Vanilla JavaScript (no framework)
- Multi-view navigation
- API integration via fetch

## Status
✅ Complete and deployed

## Files
- frontend/exports.html (850+ lines)
- frontend/dashboard-spa.html (navigation update)

## Production
- https://scarter4workmanuscripthub.com/exports.html`,
    labels: ['priority: high', 'type: feature', 'status: done'],
  },
];

/**
 * Execute command and return output
 */
function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (error) {
    if (options.allowError) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if gh CLI is installed and authenticated
 */
function checkPrerequisites() {
  console.log('Checking prerequisites...\n');

  // Check gh CLI
  const ghVersion = exec('gh --version', { silent: true, allowError: true });
  if (!ghVersion) {
    console.error('❌ GitHub CLI (gh) is not installed.');
    console.error('   Install from: https://cli.github.com/');
    console.error('   Or run: winget install --id GitHub.cli');
    process.exit(1);
  }
  console.log('✅ GitHub CLI installed:', ghVersion.split('\n')[0]);

  // Check authentication
  const authStatus = exec('gh auth status', { silent: true, allowError: true });
  if (!authStatus || authStatus.includes('not logged in')) {
    console.error('❌ Not authenticated with GitHub.');
    console.error('   Run: gh auth login');
    process.exit(1);
  }
  console.log('✅ Authenticated with GitHub\n');
}

/**
 * Create labels if they don't exist
 */
function createLabels() {
  console.log('Creating labels...\n');

  for (const [name, color] of Object.entries(LABELS)) {
    try {
      exec(`gh label create "${name}" --color ${color} --repo ${REPO}`, {
        silent: true,
        allowError: true,
      });
      console.log(`✅ Created label: ${name}`);
    } catch (error) {
      // Label might already exist
      console.log(`ℹ️  Label already exists: ${name}`);
    }
  }

  console.log();
}

/**
 * Create GitHub issue from ticket
 */
function createIssue(ticket) {
  console.log(`Creating issue: ${ticket.id} - ${ticket.title}...`);

  const labels = ticket.labels.join(',');
  const body = ticket.description;

  try {
    const result = exec(
      `gh issue create --repo ${REPO} --title "[${ticket.id}] ${ticket.title}" --body "${body.replace(/"/g, '\\"')}" --label "${labels}"`,
      { silent: true }
    );

    const issueUrl = result.trim();
    console.log(`✅ Created: ${issueUrl}\n`);

    return issueUrl;
  } catch (error) {
    console.error(`❌ Failed to create issue ${ticket.id}`);
    console.error(error.message);
    return null;
  }
}

/**
 * Create GitHub Project board
 */
function createProjectBoard() {
  console.log('Creating GitHub Project board...\n');

  try {
    const result = exec(
      `gh project create --owner ${REPO_OWNER} --title "Manuscript Platform" --repo ${REPO}`,
      { silent: true, allowError: true }
    );

    if (result) {
      console.log(`✅ Created project board: ${result.trim()}\n`);
      return result.trim();
    } else {
      console.log('ℹ️  Project board might already exist or gh projects not available\n');
      return null;
    }
  } catch (error) {
    console.log('ℹ️  Could not create project board via CLI (may need to create manually)\n');
    return null;
  }
}

/**
 * Main migration function
 */
function migrate() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Linear → GitHub Issues Migration                         ║');
  console.log('║  Manuscript Platform                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  checkPrerequisites();
  createLabels();

  console.log('Creating issues from Linear tickets...\n');
  const issueUrls = [];

  for (const ticket of TICKETS) {
    const url = createIssue(ticket);
    if (url) {
      issueUrls.push({ ticket: ticket.id, url });
    }
  }

  createProjectBoard();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Migration Complete!                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Summary:');
  console.log(`   - Created ${issueUrls.length} issues`);
  console.log(`   - Created ${Object.keys(LABELS).length} labels`);
  console.log();

  console.log('📌 Created Issues:');
  issueUrls.forEach(({ ticket, url }) => {
    console.log(`   ${ticket}: ${url}`);
  });
  console.log();

  console.log('🎯 Next Steps:');
  console.log('   1. Visit: https://github.com/scarter4work/manuscript-platform/issues');
  console.log('   2. Create a Project board: https://github.com/scarter4work/manuscript-platform/projects');
  console.log('   3. Add issues to the board and organize into columns (Todo, In Progress, Done)');
  console.log('   4. Use labels to filter and organize issues');
  console.log();

  console.log('✅ You can now use GitHub Issues for ticket tracking!');
  console.log('   - Create new issues: gh issue create');
  console.log('   - List issues: gh issue list');
  console.log('   - View issue: gh issue view <number>');
  console.log();
}

// Run migration
if (require.main === module) {
  migrate();
}

module.exports = { migrate, TICKETS, LABELS };
