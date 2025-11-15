#!/usr/bin/env node
/**
 * Apply missing migrations to production database
 * Usage: node scripts/apply-missing-migrations.js
 *
 * Requires DATABASE_URL environment variable from Render
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  console.error('');
  console.error('Get it from: https://dashboard.render.com/d/dpg-d45bhn6uk2gs73cdp7vg-a');
  console.error('Then run: DATABASE_URL="postgresql://..." node scripts/apply-missing-migrations.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Missing migrations in order
const MIGRATIONS = [
  'migration_002_dmca_fields.sql',
  'migration_003_payment_tables.sql',
  'migration_004_cost_tracking.sql',
  'migration_004_rate_limiting.sql',
  'migration_005_add_full_name.sql',
  'migration_006_password_reset_tokens.sql',
  'migration_007_team_collaboration.sql',
  'migration_008_email_system.sql',
  'migration_009_audiobook_tables.sql',
  'migration_010_review_system.sql',
  'migration_011_publishing_system.sql',
  'migration_012_public_api.sql',
  'migration_013_kdp_export.sql',
  'migration_019_series_management.sql',
  'migration_020_doc_monitoring.sql',
  'migration_021_multi_platform_exports.sql',
  'migration_022_progress_tracking.sql',
];

async function applyMigrations() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking current migration status...\n');

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const migrationFile of MIGRATIONS) {
      const migrationName = migrationFile.replace('.sql', '');
      process.stdout.write(`⏳ ${migrationName}... `);

      // Check if already applied
      const check = await client.query(
        'SELECT COUNT(*) FROM schema_migrations WHERE migration_name = $1',
        [migrationName]
      );

      if (parseInt(check.rows[0].count) > 0) {
        console.log('⏭️  Skipped (already applied)');
        skipped++;
        continue;
      }

      // Read and apply migration
      try {
        const migrationPath = join(projectRoot, 'sql', migrationFile);
        const sql = readFileSync(migrationPath, 'utf8');

        // Begin transaction
        await client.query('BEGIN');

        // Apply migration
        await client.query(sql);

        // Record in schema_migrations
        await client.query(
          'INSERT INTO schema_migrations (migration_name, applied_at) VALUES ($1, NOW())',
          [migrationName]
        );

        // Commit transaction
        await client.query('COMMIT');

        console.log('✅ Applied');
        applied++;
      } catch (error) {
        // Rollback on error
        await client.query('ROLLBACK');
        console.log(`❌ Failed: ${error.message}`);
        failed++;

        // Continue with next migration instead of exiting
        console.log('   Continuing with remaining migrations...\n');
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Applied: ${applied}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('');

    // Show final count
    const totalResult = await client.query('SELECT COUNT(*) FROM schema_migrations');
    console.log(`📦 Total migrations in database: ${totalResult.rows[0].count}`);

    if (failed > 0) {
      console.log('\n⚠️  Some migrations failed. Check the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All migrations completed successfully!');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

applyMigrations().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
