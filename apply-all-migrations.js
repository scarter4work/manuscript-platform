import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

/**
 * Convert SQLite SQL to PostgreSQL SQL
 */
function convertSQLiteToPostgreSQL(sql) {
  let converted = sql;

  // STEP 1: Convert triggers FIRST (before unixepoch conversion)
  // Match triggers with or without "FOR EACH ROW"
  // Pattern 1: WITH "FOR EACH ROW"
  const triggerRegex1 = /CREATE TRIGGER(?:\s+IF NOT EXISTS)?\s+([^\s]+)\s+AFTER UPDATE ON ([^\s]+)\s+FOR EACH ROW\s+BEGIN\s+UPDATE ([^\s]+) SET updated_at = (?:unixepoch\(\)|NOW\(\)) WHERE id = NEW\.id;\s+END/gi;

  // Pattern 2: WITHOUT "FOR EACH ROW" (SQLite allows this, implies FOR EACH ROW)
  const triggerRegex2 = /CREATE TRIGGER(?:\s+IF NOT EXISTS)?\s+([^\s]+)\s+AFTER UPDATE ON ([^\s]+)\s+BEGIN\s+UPDATE ([^\s]+) SET updated_at = (?:unixepoch\(\)|NOW\(\)) WHERE id = NEW\.id;\s+END/gi;

  const createTriggerFunction = (triggerName, tableName) => `
-- Create trigger function for ${tableName}
CREATE OR REPLACE FUNCTION update_${tableName}_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};
CREATE TRIGGER ${triggerName}
  BEFORE UPDATE ON ${tableName}
  FOR EACH ROW
  EXECUTE FUNCTION update_${tableName}_timestamp();`;

  converted = converted.replace(triggerRegex1, (match, triggerName, tableName, tableName2) => {
    return createTriggerFunction(triggerName, tableName);
  });

  converted = converted.replace(triggerRegex2, (match, triggerName, tableName, tableName2) => {
    return createTriggerFunction(triggerName, tableName);
  });

  // STEP 2: Replace all known timestamp column names with TIMESTAMP type
  const timestampColumns = [
    'created_at', 'updated_at', 'completed_at', 'expires_at', 'last_login',
    'scanned_at', 'checked_at', 'scheduled_at', 'triggered_at', 'resolved_at',
    'acknowledged_at', 'email_sent_at', 'applied_at', 'fetched_at',
    'offer_date', 'acceptance_date', 'contract_date', 'publication_date',
    'reversion_date', 'blocked_at', 'added_at', 'uploaded_at', 'generated_at',
    'changed_at', 'search_timestamp', 'tracked_at', 'started_at', 'ended_at',
    'conflict_detected_at', 'validated_at', 'assignment_date', 'submission_date',
    'decision_date', 'response_date', 'window_opens_at', 'window_closes_at',
    'last_successful_scan', 'last_definition_update', 'deadline_date',
    'reminder_sent_at', 'formatted_at', 'sent_at', 'read_at', 'sync_timestamp',
    'calculated_at', 'analyzed_at', 'computed_at', 'last_activity_at', 'indexed_at',
    'exported_at', 'imported_at', 'processed_at', 'verified_at', 'archived_at',
    'connected_at', 'fetch_started_at', 'fetch_completed_at', 'last_checked_at',
    'discovered_at', 'published_at', 'modified_at', 'accessed_at', 'last_updated',
    'report_date', 'query_date', 'review_date', 'score_date', 'rank_date'
  ];

  const timestampPattern = timestampColumns.join('|');

  // Replace INTEGER timestamps with TIMESTAMP (with default)
  converted = converted.replace(
    new RegExp(`\\b(${timestampPattern})\\s+INTEGER\\s+NOT\\s+NULL\\s+DEFAULT\\s+\\(unixepoch\\(\\)\\)`, 'gi'),
    '$1 TIMESTAMP NOT NULL DEFAULT NOW()'
  );

  // Replace INTEGER timestamps with TIMESTAMP (NOT NULL, no default)
  converted = converted.replace(
    new RegExp(`\\b(${timestampPattern})\\s+INTEGER\\s+NOT\\s+NULL`, 'gi'),
    '$1 TIMESTAMP NOT NULL'
  );

  // Replace INTEGER timestamps with TIMESTAMP (nullable)
  converted = converted.replace(
    new RegExp(`\\b(${timestampPattern})\\s+INTEGER(?![\\w])`, 'gi'),
    '$1 TIMESTAMP'
  );

  // Replace any remaining unixepoch() with NOW()
  converted = converted.replace(/DEFAULT \(unixepoch\(\)\)/gi, 'DEFAULT NOW()');
  converted = converted.replace(/DEFAULT unixepoch\(\)/gi, 'DEFAULT NOW()');

  // Replace BOOLEAN DEFAULT 0/1 with DEFAULT FALSE/TRUE
  converted = converted.replace(/BOOLEAN\s+DEFAULT\s+0/gi, 'BOOLEAN DEFAULT FALSE');
  converted = converted.replace(/BOOLEAN\s+DEFAULT\s+1/gi, 'BOOLEAN DEFAULT TRUE');
  converted = converted.replace(/BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+0/gi, 'BOOLEAN NOT NULL DEFAULT FALSE');
  converted = converted.replace(/BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+1/gi, 'BOOLEAN NOT NULL DEFAULT TRUE');

  // Replace INTEGER column DEFAULT 0/1 for columns that look like booleans
  const booleanColumns = [
    'resolved', 'acknowledged', 'email_sent', 'used', 'is_active', 'email_verified',
    'enabled', 'include_full', 'is_default', 'is_public', 'is_archived',
    'notify_on_response', 'allow_resubmissions', 'auto_close', 'is_template',
    'is_custom', 'requires_approval', 'featured', 'active', 'verified', 'published',
    'approved', 'rejected', 'archived', 'deleted', 'hidden', 'locked', 'pinned'
  ];
  const boolPattern = booleanColumns.join('|');

  // INTEGER with DEFAULT 0/1
  converted = converted.replace(
    new RegExp(`\\b(${boolPattern})\\s+INTEGER\\s+DEFAULT\\s+0`, 'gi'),
    '$1 BOOLEAN DEFAULT FALSE'
  );
  converted = converted.replace(
    new RegExp(`\\b(${boolPattern})\\s+INTEGER\\s+DEFAULT\\s+1`, 'gi'),
    '$1 BOOLEAN DEFAULT TRUE'
  );

  // INTEGER NOT NULL (no default) - convert to BOOLEAN NOT NULL
  converted = converted.replace(
    new RegExp(`\\b(${boolPattern})\\s+INTEGER\\s+NOT\\s+NULL(?![^,;]*DEFAULT)`, 'gi'),
    '$1 BOOLEAN NOT NULL'
  );

  // INTEGER nullable (no default, no NOT NULL)
  converted = converted.replace(
    new RegExp(`\\b(${boolPattern})\\s+INTEGER(?!\\s+(NOT\\s+NULL|DEFAULT))`, 'gi'),
    '$1 BOOLEAN'
  );

  // Replace boolean values in INSERT/UPDATE/WHERE clauses (convert 0/1 to FALSE/TRUE)
  // This handles VALUES (..., 0, ...) and SET column = 0, etc.
  for (const boolCol of booleanColumns) {
    // Handle table-aliased columns (e.g., g.is_active = 1)
    converted = converted.replace(
      new RegExp(`(\\w+\\.)?${boolCol}\\s*=\\s*1\\b`, 'gi'),
      (match, alias) => `${alias || ''}${boolCol} = TRUE`
    );
    converted = converted.replace(
      new RegExp(`(\\w+\\.)?${boolCol}\\s*=\\s*0\\b`, 'gi'),
      (match, alias) => `${alias || ''}${boolCol} = FALSE`
    );
    // In VALUES clauses - this is trickier, handled with context
    converted = converted.replace(
      new RegExp(`\\b${boolCol}\\s*,\\s*1\\b`, 'gi'),
      `${boolCol}, TRUE`
    );
    converted = converted.replace(
      new RegExp(`\\b${boolCol}\\s*,\\s*0\\b`, 'gi'),
      `${boolCol}, FALSE`
    );
  }

  // Replace DATE(column, 'unixepoch') with column::DATE
  // Since we're converting INTEGER timestamps to TIMESTAMP, no need for TO_TIMESTAMP
  converted = converted.replace(/DATE\((\w+),\s*'unixepoch'\)/gi, "$1::DATE");

  // Convert unix timestamp date arithmetic (e.g., unixepoch() - (30 * 86400))
  // Pattern: unixepoch() - (X * 86400) means "X days ago"
  // PostgreSQL equivalent: NOW() - INTERVAL 'X days'
  converted = converted.replace(/unixepoch\(\)\s*-\s*\((\d+)\s*\*\s*86400\)/gi, "NOW() - INTERVAL '$1 days'");

  // Convert unixepoch() - timestamp_column to EXTRACT(EPOCH FROM (NOW() - timestamp_column))
  // This handles patterns like: (unixepoch() - uw.started_at) / 86400
  // List of known timestamp columns to handle
  const timestampColPattern = timestampColumns.join('|');
  converted = converted.replace(
    new RegExp(`\\(unixepoch\\(\\)\\s*-\\s*(\\w+\\.(?:${timestampColPattern})|(?:${timestampColPattern}))\\)`, 'gi'),
    (match, col) => `EXTRACT(EPOCH FROM (NOW() - ${col}))`
  );
  converted = converted.replace(
    new RegExp(`\\((\\w+\\.(?:${timestampColPattern})|(?:${timestampColPattern}))\\s*-\\s*unixepoch\\(\\)\\)`, 'gi'),
    (match, col) => `EXTRACT(EPOCH FROM (${col} - NOW()))`
  );

  // Convert timestamp_column1 - timestamp_column2 to EXTRACT(EPOCH FROM (col1 - col2))
  // This handles patterns like: (uw.completed_at - uw.started_at) / 86400
  converted = converted.replace(
    new RegExp(`\\((\\w+\\.(?:${timestampColPattern})|(?:${timestampColPattern}))\\s*-\\s*(\\w+\\.(?:${timestampColPattern})|(?:${timestampColPattern}))\\)`, 'gi'),
    (match, col1, col2) => `EXTRACT(EPOCH FROM (${col1} - ${col2}))`
  );

  // Replace remaining unixepoch() function with EXTRACT(EPOCH FROM NOW())::INTEGER
  converted = converted.replace(/unixepoch\(\)/gi, "EXTRACT(EPOCH FROM NOW())::INTEGER");

  // Convert trailing 1/0 in INSERT VALUES for boolean columns
  // Pattern: ]', <number>, 1) or ]', <number>, 0) commonly used for (version, is_active)
  converted = converted.replace(/\]',\s*(\d+),\s*1\s*\)/g, "]', $1, TRUE)");
  converted = converted.replace(/\]',\s*(\d+),\s*0\s*\)/g, "]', $1, FALSE)");

  // Also handle simple trailing 1/0 after string literals (other INSERT patterns)
  converted = converted.replace(/',\s*1\s*\)/g, "', TRUE)");
  converted = converted.replace(/',\s*0\s*\)/g, "', FALSE)");

  // Fix ROUND() function calls - PostgreSQL requires NUMERIC, not DOUBLE PRECISION
  // Convert ROUND(expression, digits) to ROUND(CAST((expression) AS NUMERIC), digits)
  // Use [\s\S]*? to match across newlines non-greedily
  converted = converted.replace(
    /ROUND\s*\(([\s\S]*?),\s*(\d+)\s*\)/gi,
    (match, expr, digits) => {
      // Count parentheses to ensure we're matching the right closing paren
      let parenCount = 0;
      let lastCommaPos = -1;
      for (let i = 0; i < expr.length; i++) {
        if (expr[i] === '(') parenCount++;
        else if (expr[i] === ')') parenCount--;
        else if (expr[i] === ',' && parenCount === 0) lastCommaPos = i;
      }
      return `ROUND(CAST((${expr.trim()}) AS NUMERIC), ${digits})`;
    }
  );

  // Replace SQLite group_concat() with PostgreSQL string_agg()
  converted = converted.replace(/group_concat\(([^,)]+),\s*'([^']+)'\)/gi, "string_agg($1, '$2')");
  converted = converted.replace(/group_concat\(([^)]+)\)/gi, "string_agg($1, ',')"); // Default separator

  // Replace CREATE VIEW IF NOT EXISTS with CREATE OR REPLACE VIEW
  converted = converted.replace(/CREATE VIEW IF NOT EXISTS/gi, 'CREATE OR REPLACE VIEW');

  // Fix DROP statements
  converted = converted.replace(/DROP TRIGGER IF EXISTS (\w+);/gi, '-- DROP TRIGGER IF EXISTS $1 -- needs table name\n');
  converted = converted.replace(/DROP TABLE IF EXISTS (\w+);/gi, 'DROP TABLE IF EXISTS $1 CASCADE;');
  converted = converted.replace(/DROP VIEW IF EXISTS (\w+);/gi, 'DROP VIEW IF EXISTS $1 CASCADE;');

  // Fix ALTER TABLE DROP COLUMN to include CASCADE
  converted = converted.replace(/ALTER TABLE (\w+) DROP COLUMN (\w+);/gi, 'ALTER TABLE $1 DROP COLUMN IF EXISTS $2 CASCADE;');

  return converted;
}

/**
 * Apply a single migration file
 */
async function applyMigration(client, filePath, migrationName) {
  try {
    console.log(`\n📄 Reading ${migrationName}...`);
    const sql = await fs.readFile(filePath, 'utf-8');

    console.log(`🔄 Converting SQLite → PostgreSQL...`);
    const converted = convertSQLiteToPostgreSQL(sql);

    // Split by semicolon but respect $$ ... $$ blocks (PostgreSQL function bodies)
    const statements = [];
    let current = '';
    let inDollarQuote = false;
    const chars = converted.split('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = i < chars.length - 1 ? chars[i + 1] : '';

      // Check for $$ delimiter
      if (char === '$' && nextChar === '$') {
        inDollarQuote = !inDollarQuote;
        current += char + nextChar;
        i++; // Skip next $
      }
      // Split on semicolon only if not inside $$ ... $$
      else if (char === ';' && !inDollarQuote) {
        statements.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last statement if any
    if (current.trim().length > 0) {
      statements.push(current.trim());
    }

    // Remove comment lines from each statement
    const cleanedStatements = statements
      .map(s => {
        const lines = s.split('\n');
        const sqlLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return sqlLines.join('\n').trim();
      })
      .filter(s => s.length > 0);

    console.log(`⚙️  Executing ${cleanedStatements.length} statements...`);

    // Debug: Show first few statements
    if (cleanedStatements.length > 0) {
      console.log(`\n   📋 First statement: ${cleanedStatements[0].substring(0, 100).replace(/\n/g, ' ')}...`);
    }

    for (let i = 0; i < cleanedStatements.length; i++) {
      const stmt = cleanedStatements[i];
      if (stmt.length === 0) continue;

      try {
        await client.query(stmt);
        console.log(`   ✓ Statement ${i + 1}/${statements.length}: ${stmt.substring(0, 60).replace(/\n/g, ' ')}...`);
      } catch (err) {
        // Ignore errors for things that already exist
        if (err.message.includes('already exists') ||
            err.message.includes('duplicate')) {
          console.log(`   ⏭️  Skipped (already exists): ${stmt.substring(0, 50)}...`);
        } else {
          console.error(`   ❌ Error in statement ${i + 1}:`, err.message);
          console.error(`   Statement: ${stmt.substring(0, 200)}...`);
          throw err;
        }
      }
    }

    console.log(`✅ ${migrationName} applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to apply ${migrationName}:`, error.message);
    return false;
  }
}

/**
 * Main migration runner
 */
async function runAllMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to production database\n');

    // Create migrations tracking table
    console.log('📋 Creating migrations tracking table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Migrations tracking table ready\n');

    // Get list of migration files
    const migrationsDir = 'migrations';
    const files = await fs.readdir(migrationsDir);

    // Filter for migration files and sort them
    const migrationFiles = files
      .filter(f => f.endsWith('.sql') && f.startsWith('migration_'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files\n`);
    console.log('=' .repeat(60));

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');

      // Check if already applied
      const result = await client.query(
        'SELECT * FROM schema_migrations WHERE migration_name = $1',
        [migrationName]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${migrationName} (already applied on ${result.rows[0].applied_at.toISOString()})`);
        skipped++;
        continue;
      }

      // Apply migration
      const filePath = path.join(migrationsDir, file);
      const success = await applyMigration(client, filePath, migrationName);

      if (success) {
        // Record as applied
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [migrationName]
        );
        applied++;
      } else {
        failed++;
      }

      console.log('=' .repeat(60));
    }

    console.log(`\n\n📊 Migration Summary:`);
    console.log(`  ✅ Applied: ${applied}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📋 Total: ${migrationFiles.length}`);

    if (failed === 0) {
      console.log(`\n\n🎉 All migrations completed successfully!`);
    } else {
      console.log(`\n\n⚠️  Some migrations failed. Check errors above.`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runAllMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
