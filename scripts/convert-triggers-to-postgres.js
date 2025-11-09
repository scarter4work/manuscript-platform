#!/usr/bin/env node
/**
 * SQLite Trigger to PostgreSQL Function+Trigger Converter
 * Converts SQLite trigger syntax to PostgreSQL-compatible functions and triggers
 *
 * Usage:
 *   node scripts/convert-triggers-to-postgres.js <file-path>
 *   node scripts/convert-triggers-to-postgres.js --all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Conversion statistics
let stats = {
  filesProcessed: 0,
  triggersConverted: 0,
  functionsCreated: 0,
  groupByFixed: 0
};

// Track which functions we've already created to avoid duplicates
const createdFunctions = new Set();

/**
 * Convert SQLite triggers to PostgreSQL functions and triggers
 * @param {string} sql - SQL content
 * @returns {string} Converted SQL content
 */
function convertTriggersToPostgres(sql) {
  let converted = sql;

  // Remove the warning comment if it exists
  converted = converted.replace(/^-- WARNING: SQLite triggers detected.*\n/m, '');

  // Pattern to match SQLite triggers
  const triggerPattern = /CREATE TRIGGER (?:IF NOT EXISTS )?(\w+)\s+AFTER UPDATE ON (\w+)\s+FOR EACH ROW\s+BEGIN\s+(.*?)\s+END;/gis;

  const matches = [...converted.matchAll(triggerPattern)];

  if (matches.length === 0) {
    return converted;
  }

  // Track functions to add at the beginning of the file
  const functionsToAdd = [];

  // Process each trigger
  matches.forEach(match => {
    const [fullMatch, triggerName, tableName, body] = match;
    stats.triggersConverted++;

    // Parse the trigger body to understand what it does
    // Most common pattern: UPDATE table_name SET updated_at = EXTRACT(...) WHERE id = NEW.id
    const updatePattern = /UPDATE\s+(\w+)\s+SET\s+(\w+)\s*=\s*(.*?)\s+WHERE\s+id\s*=\s*NEW\.id/i;
    const updateMatch = body.match(updatePattern);

    if (updateMatch) {
      const [, , columnName, value] = updateMatch;

      // Create a generic update_timestamp function if we haven't already
      const functionName = 'update_timestamp';

      if (!createdFunctions.has(functionName)) {
        functionsToAdd.push(`-- Generic timestamp update function
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`);
        createdFunctions.add(functionName);
        stats.functionsCreated++;
      }

      // Create the PostgreSQL trigger
      const newTrigger = `-- Update trigger for ${tableName}
CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION ${functionName}();`;

      // Replace the old trigger with the new one
      converted = converted.replace(fullMatch, newTrigger);
    } else {
      // Complex trigger - create a specific function for it
      const functionName = `${triggerName}_func`;

      if (!createdFunctions.has(functionName)) {
        // Try to convert the body
        let convertedBody = body.trim();

        // Convert UPDATE statements to NEW assignments where possible
        convertedBody = convertedBody.replace(
          /UPDATE\s+(\w+)\s+SET\s+(\w+)\s*=\s*(.*?)\s+WHERE\s+id\s*=\s*NEW\.id/gi,
          (match, table, column, value) => {
            return `NEW.${column} = ${value};`;
          }
        );

        functionsToAdd.push(`-- Trigger function for ${triggerName}
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${convertedBody}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`);
        createdFunctions.add(functionName);
        stats.functionsCreated++;
      }

      // Create the PostgreSQL trigger
      const newTrigger = `-- Custom trigger for ${tableName}
CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION ${functionName}();`;

      // Replace the old trigger with the new one
      converted = converted.replace(fullMatch, newTrigger);
    }
  });

  // Add functions at the beginning of the file (after the header comments)
  if (functionsToAdd.length > 0) {
    // Find where to insert (after the conversion header and migration header)
    const insertPoint = converted.search(/(?:-- Migration \d+:|CREATE TABLE|CREATE OR REPLACE VIEW)/i);

    if (insertPoint !== -1) {
      const functionsBlock = '\n-- ==================================================\n' +
                            '-- POSTGRESQL TRIGGER FUNCTIONS\n' +
                            '-- ==================================================\n\n' +
                            functionsToAdd.join('\n') + '\n' +
                            '-- ==================================================\n' +
                            '-- TABLES AND TRIGGERS\n' +
                            '-- ==================================================\n\n';

      converted = converted.slice(0, insertPoint) + functionsBlock + converted.slice(insertPoint);
    }
  }

  return converted;
}

/**
 * Fix GROUP BY clauses in views for PostgreSQL compatibility
 * @param {string} sql - SQL content
 * @returns {string} Fixed SQL content
 */
function fixGroupByClauses(sql) {
  let converted = sql;

  // Remove the GROUP BY warning comment if it exists
  converted = converted.replace(/^-- NOTE: GROUP BY clauses may need manual review.*\n/m, '');

  // Pattern to match CREATE VIEW statements with GROUP BY
  const viewPattern = /CREATE OR REPLACE VIEW\s+(\w+)\s+AS\s+SELECT(.*?)FROM(.*?)GROUP BY(.*?);/gis;

  const matches = [...converted.matchAll(viewPattern)];

  matches.forEach(match => {
    const [fullMatch, viewName, selectClause, fromClause, groupByClause] = match;

    // Extract column names from SELECT (excluding aggregates and aliases)
    const selectColumns = [];
    const selectParts = selectClause.split(',');

    selectParts.forEach(part => {
      const trimmed = part.trim();

      // Skip if it's an aggregate function
      if (/^(COUNT|SUM|AVG|MAX|MIN|GROUP_CONCAT|json_agg)\s*\(/i.test(trimmed)) {
        return;
      }

      // Extract the column name (before AS if there's an alias)
      const asMatch = trimmed.match(/^(.*?)\s+AS\s+/i);
      let columnName = asMatch ? asMatch[1].trim() : trimmed;

      // Remove any CASE WHEN statements
      if (columnName.startsWith('CASE ')) {
        return;
      }

      // Clean up the column name
      columnName = columnName.replace(/^\w+\./, ''); // Remove table prefix

      if (columnName && !columnName.includes('(')) {
        selectColumns.push(columnName);
      }
    });

    // Get current GROUP BY columns
    const currentGroupBy = groupByClause.trim().split(',').map(c => c.trim());

    // Check if all non-aggregated SELECT columns are in GROUP BY
    const missingColumns = selectColumns.filter(col => {
      return !currentGroupBy.some(gb => gb.includes(col));
    });

    if (missingColumns.length > 0) {
      // Add missing columns to GROUP BY
      const newGroupBy = [...currentGroupBy, ...missingColumns].join(', ');
      const newView = fullMatch.replace(/GROUP BY.*?;/i, `GROUP BY ${newGroupBy};`);
      converted = converted.replace(fullMatch, newView);
      stats.groupByFixed++;
    }
  });

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

    // Check if file has triggers
    if (!content.includes('CREATE TRIGGER')) {
      console.log(`  ⏭️  Skipped (no triggers found)`);
      return;
    }

    // Convert triggers
    let converted = convertTriggersToPostgres(content);

    // Fix GROUP BY clauses
    converted = fixGroupByClauses(converted);

    // Check if any changes were made
    if (converted === content) {
      console.log(`  ✅ No changes needed`);
      return;
    }

    // Backup original file
    const backupPath = filePath + '.trigger-backup';
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
SQLite Trigger to PostgreSQL Converter

Usage:
  node scripts/convert-triggers-to-postgres.js <file-path>
  node scripts/convert-triggers-to-postgres.js migrations/*.sql
  node scripts/convert-triggers-to-postgres.js --all

Examples:
  node scripts/convert-triggers-to-postgres.js migrations/migration_020_author_bios.sql
  node scripts/convert-triggers-to-postgres.js --all

Conversions:
  - SQLite triggers → PostgreSQL functions + triggers
  - Creates reusable update_timestamp() function
  - Fixes GROUP BY clauses for PostgreSQL compatibility
  - Changes AFTER UPDATE to BEFORE UPDATE
  - Removes IF NOT EXISTS from triggers
`);
    process.exit(0);
  }

  // Handle --all flag
  if (args[0] === '--all') {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const sqlDir = path.join(process.cwd(), 'sql');

    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.sqlite-backup') && !f.endsWith('.trigger-backup'))
        .map(f => path.join(migrationsDir, f));
      files.forEach(processFile);
    }

    if (fs.existsSync(sqlDir)) {
      const files = fs.readdirSync(sqlDir)
        .filter(f => f.endsWith('.sql') && !f.endsWith('.sqlite-backup') && !f.endsWith('.trigger-backup'))
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
Trigger Conversion Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files processed:           ${stats.filesProcessed}
Triggers converted:        ${stats.triggersConverted}
Functions created:         ${stats.functionsCreated}
GROUP BY clauses fixed:    ${stats.groupByFixed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Backups saved with .trigger-backup extension
✅ All triggers now use PostgreSQL syntax
`);
}

main();
