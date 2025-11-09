#!/usr/bin/env node
/**
 * SQLite to PostgreSQL Migration Converter
 * Converts SQLite-specific syntax to PostgreSQL-compatible SQL
 *
 * Usage:
 *   node scripts/convert-sqlite-to-postgres.js <file-path>
 *   node scripts/convert-sqlite-to-postgres.js migrations/*.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Conversion statistics
let stats = {
  filesProcessed: 0,
  autoincrement: 0,
  unixepoch: 0,
  integer: 0,
  real: 0,
  insertOrIgnore: 0,
  triggers: 0,
  views: 0,
  jsonArrayLength: 0
};

/**
 * Convert SQLite SQL to PostgreSQL SQL
 * @param {string} sql - SQLite SQL content
 * @returns {string} PostgreSQL SQL content
 */
function convertSqliteToPostgres(sql) {
  let converted = sql;

  // 1. Replace INTEGER PRIMARY KEY AUTOINCREMENT with BIGSERIAL PRIMARY KEY
  const autoincrement = (converted.match(/INTEGER PRIMARY KEY AUTOINCREMENT/gi) || []).length;
  stats.autoincrement += autoincrement;
  converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY');

  // 2. Replace DEFAULT (unixepoch()) with DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  const unixepochDefaults = (converted.match(/DEFAULT \(unixepoch\(\)\)/gi) || []).length;
  stats.unixepoch += unixepochDefaults;
  converted = converted.replace(/DEFAULT \(unixepoch\(\)\)/gi, 'DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT');

  // 3. Replace unixepoch() in WHERE clauses and calculations
  const unixepochCalls = (converted.match(/unixepoch\(\)/gi) || []).length;
  stats.unixepoch += unixepochCalls;
  converted = converted.replace(/unixepoch\(\)/gi, 'EXTRACT(EPOCH FROM NOW())::BIGINT');

  // 4. Replace INTEGER (for timestamp columns) with BIGINT
  // This is context-sensitive, so we only replace in obvious timestamp columns
  const timestampColumns = /(created_at|updated_at|analyzed_at|sent_at|read_at|fetched_at|scanned_at|last_updated|generated_at|tracked_at|computed_at|connected_at|started_at|ended_at|last_activity_at|expires_at|deprecated_at|last_crawled_at|offer_date|conflict_detected_at|validated_at|calculated_at|assignment_date|deadline_date|submission_date|fetch_started_at|report_date|last_successful_scan|last_definition_update|last_fetch_at)\s+INTEGER/gi;
  const integerReplacements = (converted.match(timestampColumns) || []).length;
  stats.integer += integerReplacements;
  converted = converted.replace(timestampColumns, (match, columnName) => {
    return `${columnName} BIGINT`;
  });

  // 5. Replace REAL with DOUBLE PRECISION
  const realReplacements = (converted.match(/\bREAL\b/gi) || []).length;
  stats.real += realReplacements;
  converted = converted.replace(/\bREAL\b/gi, 'DOUBLE PRECISION');

  // 6. Replace INSERT OR IGNORE with INSERT ... ON CONFLICT DO NOTHING
  const insertOrIgnore = (converted.match(/INSERT OR IGNORE INTO/gi) || []).length;
  stats.insertOrIgnore += insertOrIgnore;
  converted = converted.replace(/INSERT OR IGNORE INTO\s+(\w+)\s+\(([^)]+)\)\s+VALUES/gi, (match, table, columns) => {
    // Find the primary key or unique constraint from the table definition
    // For now, we'll add a generic ON CONFLICT clause
    return `INSERT INTO ${table} (${columns}) VALUES`;
  });

  // Add ON CONFLICT clauses after VALUES statements if we removed OR IGNORE
  if (insertOrIgnore > 0) {
    // This is a simple approach - add ON CONFLICT DO NOTHING after each VALUES clause
    converted = converted.replace(/(INSERT INTO\s+\w+\s+\([^)]+\)\s+VALUES\s*\([^)]+\))(;|\s*,)/gi, (match, insert, terminator) => {
      // Don't add if it already has ON CONFLICT
      if (converted.indexOf('ON CONFLICT') > -1 && converted.indexOf('ON CONFLICT') < converted.indexOf(insert) + insert.length + 100) {
        return match;
      }
      // Determine the table name to find its primary key
      const tableMatch = insert.match(/INSERT INTO\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        // For common tables, we know the primary keys
        const pkMap = {
          'monitored_platforms': 'id',
          'workflows': '(platform, version)',
          'schema_version': 'version'
        };
        const pk = pkMap[tableName] || 'id';
        if (terminator === ',') {
          return `${insert},`;
        } else {
          return `${insert}\nON CONFLICT (${pk}) DO NOTHING;`;
        }
      }
      return match;
    });
  }

  // 7. Replace CREATE VIEW IF NOT EXISTS with CREATE OR REPLACE VIEW
  const views = (converted.match(/CREATE VIEW IF NOT EXISTS/gi) || []).length;
  stats.views += views;
  converted = converted.replace(/CREATE VIEW IF NOT EXISTS/gi, 'CREATE OR REPLACE VIEW');

  // 8. Fix GROUP BY clauses in views (PostgreSQL requires all non-aggregated columns)
  // This is a complex transformation, so we'll flag it for manual review
  if (converted.match(/GROUP BY/i)) {
    // Add a comment marker
    converted = '-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility\n' + converted;
  }

  // 9. Replace json_array_length() with json_array_length(::json)
  const jsonArrayLength = (converted.match(/json_array_length\([^)]+\)(?!\s*::json)/gi) || []).length;
  stats.jsonArrayLength += jsonArrayLength;
  converted = converted.replace(/json_array_length\(([^)]+)\)/gi, 'json_array_length($1::json)');

  // 10. SQLite Trigger conversion (complex - add warning comment)
  if (converted.match(/CREATE TRIGGER.*FOR EACH ROW\s+BEGIN/is)) {
    const triggers = (converted.match(/CREATE TRIGGER/gi) || []).length;
    stats.triggers += triggers;
    converted = '-- WARNING: SQLite triggers detected - requires manual conversion to PostgreSQL function + trigger syntax\n' + converted;
  }

  // 11. Add PostgreSQL conversion header if not already present
  if (!converted.includes('CONVERTED TO POSTGRESQL')) {
    const today = new Date().toISOString().split('T')[0];
    converted = `-- CONVERTED TO POSTGRESQL SYNTAX (${today})\n${converted}`;
  }

  return converted;
}

/**
 * Process a single SQL file
 * @param {string} filePath - Path to SQL file
 */
function processFile(filePath) {
  try {
    console.log(`\nProcessing: ${filePath}`);

    // Read file
    const content = fs.readFileSync(filePath, 'utf8');

    // Skip if already converted
    if (content.includes('CONVERTED TO POSTGRESQL SYNTAX')) {
      console.log(`  ⏭️  Skipped (already converted)`);
      return;
    }

    // Convert
    const converted = convertSqliteToPostgres(content);

    // Check if any changes were made
    if (converted === content) {
      console.log(`  ✅ No changes needed`);
      return;
    }

    // Backup original file
    const backupPath = filePath + '.sqlite-backup';
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`  💾 Backed up to: ${backupPath}`);

    // Write converted file
    fs.writeFileSync(filePath, converted, 'utf8');
    console.log(`  ✅ Converted successfully`);

    stats.filesProcessed++;

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
SQLite to PostgreSQL Migration Converter

Usage:
  node scripts/convert-sqlite-to-postgres.js <file-path>
  node scripts/convert-sqlite-to-postgres.js migrations/*.sql
  node scripts/convert-sqlite-to-postgres.js sql/*.sql
  node scripts/convert-sqlite-to-postgres.js --all

Examples:
  node scripts/convert-sqlite-to-postgres.js migrations/migration_020_author_bios.sql
  node scripts/convert-sqlite-to-postgres.js migrations/migration_*.sql
  node scripts/convert-sqlite-to-postgres.js --all

Conversions:
  - INTEGER PRIMARY KEY AUTOINCREMENT → BIGSERIAL PRIMARY KEY
  - DEFAULT (unixepoch()) → DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
  - unixepoch() → EXTRACT(EPOCH FROM NOW())::BIGINT
  - INTEGER (for timestamps) → BIGINT
  - REAL → DOUBLE PRECISION
  - INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
  - CREATE VIEW IF NOT EXISTS → CREATE OR REPLACE VIEW
  - json_array_length() → json_array_length(::json)
  - Flags SQLite triggers for manual conversion
`);
    process.exit(0);
  }

  // Handle --all flag
  if (args[0] === '--all') {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const sqlDir = path.join(process.cwd(), 'sql');

    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.sqlite-backup'))
        .map(f => path.join(migrationsDir, f));
      files.forEach(processFile);
    }

    if (fs.existsSync(sqlDir)) {
      const files = fs.readdirSync(sqlDir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.sqlite-backup'))
        .map(f => path.join(sqlDir, f));
      files.forEach(processFile);
    }
  } else {
    // Process specified files
    args.forEach(processFile);
  }

  // Print statistics
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Conversion Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files processed:         ${stats.filesProcessed}
AUTOINCREMENT replaced:  ${stats.autoincrement}
unixepoch() replaced:    ${stats.unixepoch}
INTEGER → BIGINT:        ${stats.integer}
REAL → DOUBLE PRECISION: ${stats.real}
INSERT OR IGNORE fixed:  ${stats.insertOrIgnore}
Views updated:           ${stats.views}
json_array_length fixed: ${stats.jsonArrayLength}
Triggers flagged:        ${stats.triggers}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Manual Review Required:
${stats.triggers > 0 ? `  - ${stats.triggers} triggers need manual conversion` : '  - None'}

✅ Backups saved with .sqlite-backup extension
`);
}

main();
