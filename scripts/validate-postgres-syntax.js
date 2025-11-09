#!/usr/bin/env node
/**
 * PostgreSQL Syntax Validator
 * Validates that all SQL files are PostgreSQL-compatible
 * Checks for remaining SQLite syntax and validates conversions
 *
 * Usage:
 *   node scripts/validate-postgres-syntax.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validation results
const results = {
  filesChecked: 0,
  passed: 0,
  warnings: 0,
  errors: 0,
  issues: []
};

/**
 * Check for SQLite-specific syntax that should have been converted
 */
function checkForSQLiteSyntax(content, filePath) {
  const issues = [];

  // Check for AUTOINCREMENT (should be BIGSERIAL)
  if (content.match(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/i)) {
    issues.push({
      severity: 'ERROR',
      pattern: 'AUTOINCREMENT',
      message: 'Found AUTOINCREMENT - should be BIGSERIAL PRIMARY KEY',
      file: filePath
    });
  }

  // Check for unixepoch() (should be EXTRACT(EPOCH FROM NOW())::BIGINT)
  const unixepochMatches = content.match(/unixepoch\(\)/gi);
  if (unixepochMatches) {
    issues.push({
      severity: 'ERROR',
      pattern: 'unixepoch()',
      message: `Found ${unixepochMatches.length} unixepoch() calls - should be EXTRACT(EPOCH FROM NOW())::BIGINT`,
      file: filePath
    });
  }

  // Check for SQLite trigger syntax (BEGIN...END blocks)
  if (content.match(/CREATE\s+TRIGGER.*FOR\s+EACH\s+ROW\s+BEGIN/is)) {
    issues.push({
      severity: 'ERROR',
      pattern: 'SQLite Trigger',
      message: 'Found SQLite trigger with BEGIN...END - should use PostgreSQL function + EXECUTE FUNCTION',
      file: filePath
    });
  }

  // Check for IF NOT EXISTS in triggers (not supported in PostgreSQL)
  if (content.match(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS/i)) {
    issues.push({
      severity: 'ERROR',
      pattern: 'IF NOT EXISTS (trigger)',
      message: 'Found IF NOT EXISTS in CREATE TRIGGER - not supported in PostgreSQL',
      file: filePath
    });
  }

  return issues;
}

/**
 * Check for proper PostgreSQL syntax
 */
function checkPostgreSQLSyntax(content, filePath) {
  const issues = [];

  // If file has triggers, check for proper function definitions
  if (content.match(/CREATE\s+TRIGGER/i)) {
    // Should have EXECUTE FUNCTION
    if (!content.match(/EXECUTE\s+FUNCTION/i)) {
      issues.push({
        severity: 'ERROR',
        pattern: 'Missing EXECUTE FUNCTION',
        message: 'Trigger found but missing EXECUTE FUNCTION clause',
        file: filePath
      });
    }

    // Should have function definition (RETURNS TRIGGER)
    if (!content.match(/RETURNS\s+TRIGGER/i)) {
      issues.push({
        severity: 'WARNING',
        pattern: 'Missing Function Definition',
        message: 'Trigger found but no trigger function definition (may be in separate file)',
        file: filePath
      });
    }

    // Should use BEFORE or AFTER UPDATE (not in BEGIN block)
    if (!content.match(/(?:BEFORE|AFTER)\s+UPDATE\s+ON/i)) {
      issues.push({
        severity: 'ERROR',
        pattern: 'Invalid Trigger Timing',
        message: 'Trigger missing BEFORE/AFTER UPDATE clause',
        file: filePath
      });
    }
  }

  // Check for proper BIGSERIAL usage
  if (content.match(/BIGSERIAL\s+PRIMARY\s+KEY/i)) {
    // Good - this is correct PostgreSQL syntax
    // No issue to report
  }

  // Check for EXTRACT(EPOCH FROM NOW())::BIGINT
  if (content.match(/EXTRACT\s*\(\s*EPOCH\s+FROM\s+NOW\s*\(\s*\)\s*\)\s*::\s*BIGINT/i)) {
    // Good - this is correct PostgreSQL syntax
    // No issue to report
  }

  return issues;
}

/**
 * Check for proper data types
 */
function checkDataTypes(content, filePath) {
  const issues = [];

  // Check for INTEGER columns that might be timestamps (should be BIGINT)
  const timestampColumnPattern = /(created_at|updated_at|analyzed_at|sent_at|read_at|fetched_at|scanned_at|last_updated|generated_at|tracked_at|computed_at|connected_at|started_at|ended_at|last_activity_at|expires_at|deprecated_at|last_crawled_at|offer_date|conflict_detected_at|validated_at|calculated_at|assignment_date|deadline_date|submission_date|fetch_started_at|report_date|last_successful_scan|last_definition_update|last_fetch_at)\s+INTEGER/gi;

  const timestampIntegerMatches = content.match(timestampColumnPattern);
  if (timestampIntegerMatches) {
    issues.push({
      severity: 'ERROR',
      pattern: 'INTEGER (timestamp column)',
      message: `Found ${timestampIntegerMatches.length} timestamp columns using INTEGER - should be BIGINT (Y2038 issue)`,
      file: filePath
    });
  }

  // Check for REAL (should be DOUBLE PRECISION)
  const realMatches = content.match(/\bREAL\b/gi);
  if (realMatches) {
    issues.push({
      severity: 'ERROR',
      pattern: 'REAL',
      message: `Found ${realMatches.length} REAL data types - should be DOUBLE PRECISION`,
      file: filePath
    });
  }

  return issues;
}

/**
 * Check for proper INSERT syntax
 */
function checkInsertSyntax(content, filePath) {
  const issues = [];

  // Check for INSERT OR IGNORE (should be INSERT ... ON CONFLICT)
  if (content.match(/INSERT\s+OR\s+IGNORE/i)) {
    issues.push({
      severity: 'ERROR',
      pattern: 'INSERT OR IGNORE',
      message: 'Found INSERT OR IGNORE - should be INSERT ... ON CONFLICT DO NOTHING',
      file: filePath
    });
  }

  return issues;
}

/**
 * Check for proper VIEW syntax
 */
function checkViewSyntax(content, filePath) {
  const issues = [];

  // Check for CREATE VIEW IF NOT EXISTS (should be CREATE OR REPLACE VIEW)
  if (content.match(/CREATE\s+VIEW\s+IF\s+NOT\s+EXISTS/i)) {
    issues.push({
      severity: 'ERROR',
      pattern: 'CREATE VIEW IF NOT EXISTS',
      message: 'Found CREATE VIEW IF NOT EXISTS - should be CREATE OR REPLACE VIEW',
      file: filePath
    });
  }

  return issues;
}

/**
 * Check for proper JSON function usage
 */
function checkJSONFunctions(content, filePath) {
  const issues = [];

  // Check for json_array_length without type cast
  const jsonArrayLengthPattern = /json_array_length\s*\(\s*(\w+)\s*\)(?!\s*::json)/gi;
  const matches = content.match(jsonArrayLengthPattern);
  if (matches) {
    issues.push({
      severity: 'ERROR',
      pattern: 'json_array_length',
      message: `Found ${matches.length} json_array_length() calls without ::json type cast`,
      file: filePath
    });
  }

  return issues;
}

/**
 * Validate a single SQL file
 */
function validateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    results.filesChecked++;

    const allIssues = [
      ...checkForSQLiteSyntax(content, filePath),
      ...checkPostgreSQLSyntax(content, filePath),
      ...checkDataTypes(content, filePath),
      ...checkInsertSyntax(content, filePath),
      ...checkViewSyntax(content, filePath),
      ...checkJSONFunctions(content, filePath)
    ];

    if (allIssues.length === 0) {
      results.passed++;
      console.log(`✅ ${path.basename(filePath)}`);
      return true;
    } else {
      // Count errors and warnings
      const errors = allIssues.filter(i => i.severity === 'ERROR');
      const warnings = allIssues.filter(i => i.severity === 'WARNING');

      results.errors += errors.length;
      results.warnings += warnings.length;

      console.log(`${errors.length > 0 ? '❌' : '⚠️ '} ${path.basename(filePath)}`);

      allIssues.forEach(issue => {
        console.log(`   ${issue.severity === 'ERROR' ? '❌' : '⚠️ '} ${issue.pattern}: ${issue.message}`);
        results.issues.push(issue);
      });

      return errors.length === 0; // Only return false if there are errors (not warnings)
    }

  } catch (error) {
    console.error(`   ❌ Error reading file: ${error.message}`);
    results.errors++;
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PostgreSQL Syntax Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // Get all SQL files
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const sqlDir = path.join(process.cwd(), 'sql');
  const rootSchemas = [
    path.join(process.cwd(), 'combined-schema.sql'),
    path.join(process.cwd(), 'postgres-schema.sql')
  ];

  const allFiles = [];

  // Migrations
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.endsWith('.backup') && !f.endsWith('.skip'))
      .map(f => path.join(migrationsDir, f));
    allFiles.push(...files);
  }

  // SQL folder
  if (fs.existsSync(sqlDir)) {
    const files = fs.readdirSync(sqlDir)
      .filter(f => f.endsWith('.sql') && !f.endsWith('.backup'))
      .map(f => path.join(sqlDir, f));
    allFiles.push(...files);
  }

  // Root schemas
  rootSchemas.forEach(schema => {
    if (fs.existsSync(schema)) {
      allFiles.push(schema);
    }
  });

  console.log(`Validating ${allFiles.length} SQL files...\n`);

  // Validate all files
  allFiles.forEach(file => validateFile(file));

  // Print summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Validation Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files checked:    ${results.filesChecked}
Passed:           ${results.passed}
Errors:           ${results.errors}
Warnings:         ${results.warnings}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  if (results.errors === 0 && results.warnings === 0) {
    console.log('✅ All files passed validation!\n');
    console.log('All SQL files are PostgreSQL-compatible and ready for deployment.\n');
    process.exit(0);
  } else if (results.errors === 0) {
    console.log(`⚠️  All files passed with ${results.warnings} warnings.\n`);
    console.log('Warnings indicate potential issues but do not block deployment.\n');
    process.exit(0);
  } else {
    console.log(`❌ Validation failed with ${results.errors} errors.\n`);
    console.log('Errors must be fixed before deploying to PostgreSQL.\n');

    // Group errors by pattern
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Errors by Pattern:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const errorsByPattern = {};
    results.issues
      .filter(i => i.severity === 'ERROR')
      .forEach(issue => {
        if (!errorsByPattern[issue.pattern]) {
          errorsByPattern[issue.pattern] = [];
        }
        errorsByPattern[issue.pattern].push(issue.file);
      });

    Object.keys(errorsByPattern).forEach(pattern => {
      console.log(`\n${pattern}: ${errorsByPattern[pattern].length} files`);
      errorsByPattern[pattern].forEach(file => {
        console.log(`  - ${path.basename(file)}`);
      });
    });

    console.log('\n');
    process.exit(1);
  }
}

main();
