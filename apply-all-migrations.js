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

  // Replace INTEGER timestamps with BIGINT for unix timestamps
  // Look for timestamp column names and convert them
  converted = converted.replace(/\b(created_at|updated_at|completed_at|expires_at|last_login|scanned_at|checked_at|scheduled_at|triggered_at|resolved_at|acknowledged_at|email_sent_at|applied_at|fetched_at|offer_date|acceptance_date|contract_date|publication_date|reversion_date|blocked_at|added_at|uploaded_at|generated_at)\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+\(unixepoch\(\)\)/gi,
    '$1 TIMESTAMP NOT NULL DEFAULT NOW()');

  // Handle timestamp columns without default
  converted = converted.replace(/\b(created_at|updated_at|completed_at|expires_at|last_login|scanned_at|checked_at|scheduled_at|triggered_at|resolved_at|acknowledged_at|email_sent_at|applied_at|fetched_at|offer_date|acceptance_date|contract_date|publication_date|reversion_date|blocked_at|added_at|uploaded_at|generated_at)\s+INTEGER\s+NOT\s+NULL/gi,
    '$1 TIMESTAMP NOT NULL');

  // Handle nullable timestamp columns
  converted = converted.replace(/\b(created_at|updated_at|completed_at|expires_at|last_login|scanned_at|checked_at|scheduled_at|triggered_at|resolved_at|acknowledged_at|email_sent_at|applied_at|fetched_at|offer_date|acceptance_date|contract_date|publication_date|reversion_date|blocked_at|added_at|uploaded_at|generated_at)\s+INTEGER(?![\w])/gi,
    '$1 BIGINT');

  // Replace any remaining unixepoch() with NOW()
  converted = converted.replace(/DEFAULT \(unixepoch\(\)\)/gi, 'DEFAULT NOW()');
  converted = converted.replace(/DEFAULT unixepoch\(\)/gi, 'DEFAULT NOW()');

  // Replace CREATE VIEW IF NOT EXISTS with just CREATE OR REPLACE VIEW
  converted = converted.replace(/CREATE VIEW IF NOT EXISTS/gi, 'CREATE OR REPLACE VIEW');

  // Fix DROP TRIGGER statements to include ON table_name
  // This is a simplification - ideally we'd parse the context
  converted = converted.replace(/DROP TRIGGER IF EXISTS (\w+);/gi, '-- DROP TRIGGER IF EXISTS $1; -- Commented out - needs table name');

  // Replace SQLite triggers with PostgreSQL functions + triggers
  // Match: CREATE TRIGGER [IF NOT EXISTS] name AFTER UPDATE ON table FOR EACH ROW BEGIN ... END;
  const triggerRegex = /CREATE TRIGGER(?:\s+IF NOT EXISTS)?\s+([^\s]+)\s+AFTER UPDATE ON ([^\s]+)\s+FOR EACH ROW\s+BEGIN\s+UPDATE ([^\s]+) SET updated_at = (?:unixepoch\(\)|NOW\(\)) WHERE id = NEW\.id;\s+END/gi;

  converted = converted.replace(triggerRegex, (match, triggerName, tableName, tableName2) => {
    return `
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
  EXECUTE FUNCTION update_${tableName}_timestamp()`;
  });

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

    // Split by semicolon to execute statement by statement
    const statements = converted
      .split(';')
      .map(s => {
        // Remove comment lines but keep SQL statements
        const lines = s.split('\n');
        const sqlLines = lines.filter(line => {
          const trimmed = line.trim();
          // Keep lines that are not comments OR are part of SQL
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return sqlLines.join('\n').trim();
      })
      .filter(s => s.length > 0);

    console.log(`⚙️  Executing ${statements.length} statements...`);

    // Debug: Show first few statements
    if (statements.length > 0) {
      console.log(`\n   📋 First statement: ${statements[0].substring(0, 100).replace(/\n/g, ' ')}...`);
    }

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
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
