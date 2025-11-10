/**
 * Apply PostgreSQL migrations in correct order
 *
 * Order:
 * 1. sql/schema.sql (base tables: users, manuscripts, submissions, etc.)
 * 2. sql/migration_*.sql (early migrations)
 * 3. migrations/migration_*.sql (later features)
 */

import { Client } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  database: 'manuscript_platform_test',
  user: 'postgres',
  password: 'Bjoran32!',
  ssl: false
};

// Files to apply in order
const MIGRATION_FILES = [
  // Base schema first
  'sql/schema.sql',

  // Early migrations from sql/ folder
  'sql/migration_002_dmca_fields.sql',
  'sql/migration_003_payment_tables.sql',
  'sql/migration_004_cost_tracking.sql',
  'sql/migration_005_add_full_name.sql',
  'sql/migration_006_password_reset_tokens.sql',
  'sql/migration_007_team_collaboration.sql',
  'sql/migration_008_email_system.sql',
  'sql/migration_009_audiobook_tables.sql',
  'sql/migration_010_review_system.sql',
  'sql/migration_011_publishing_system.sql',
  'sql/migration_012_public_api.sql',
  'sql/migration_013_kdp_export.sql',
  'sql/migration_019_series_management.sql',
  'sql/migration_020_doc_monitoring.sql',
  'sql/migration_021_multi_platform_exports.sql',
  'sql/migration_022_progress_tracking.sql',

  // Later feature migrations from migrations/ folder
  'migrations/migration_020_author_bios.sql',
  'migrations/migration_021_cover_design_briefs.sql',
  'migrations/migration_022_enhanced_metadata.sql',
  'migrations/migration_022_seed_data.sql',
  'migrations/migration_023_supporting_documents.sql',
  'migrations/migration_024_submission_packages.sql',
  'migrations/migration_025_submission_responses.sql',
  'migrations/migration_026_human_editor.sql',
  'migrations/migration_027_marketing_content.sql',
  'migrations/migration_028_manuscript_formatting.sql',
  'migrations/migration_029_communication_system.sql',
  'migrations/migration_030_slush_pile_management.sql',
  'migrations/migration_031_submission_windows_deadlines.sql',
  'migrations/migration_032_kdp_integration.sql',
  'migrations/migration_033_market_analysis.sql',
  'migrations/migration_034_sales_tracking.sql',
  'migrations/migration_035_rights_management.sql',
  'migrations/migration_036_ai_chat_assistants.sql',
  'migrations/migration_037_competitive_analysis.sql',
  'migrations/migration_038_security_incidents.sql',
];

async function applyMigrations() {
  console.log('🔧 Applying PostgreSQL migrations in order...\n');

  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('✓ Connected to manuscript_platform_test\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of MIGRATION_FILES) {
    const filePath = join(process.cwd(), file);

    if (!existsSync(filePath)) {
      console.log(`  ⊘ ${file} (not found, skipping)`);
      skipCount++;
      continue;
    }

    try {
      const sql = readFileSync(filePath, 'utf8');

      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (stmtError) {
          // Some errors are acceptable (e.g., "already exists")
          if (stmtError.message.includes('already exists') ||
              stmtError.message.includes('does not exist')) {
            // Ignore
          } else {
            throw stmtError;
          }
        }
      }

      console.log(`  ✓ ${file}`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ ${file}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n✓ Migrations complete: ${successCount} succeeded, ${skipCount} skipped, ${errorCount} failed\n`);

  // Verify tables created
  const result = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log(`✓ Total tables in database: ${result.rows.length}\n`);

  if (result.rows.length > 50) {
    console.log(`  (showing first 20 tables)`);
    result.rows.slice(0, 20).forEach(row => {
      console.log(`  - ${row.tablename}`);
    });
    console.log(`  ...and ${result.rows.length - 20} more\n`);
  } else {
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });
  }

  await client.end();

  console.log('\n✅ Database setup complete!');
  console.log(`\n📝 Set TEST_DATABASE_URL to run tests:\n`);
  console.log(`export TEST_DATABASE_URL="postgresql://postgres:Bjoran32%21@127.0.0.1:5432/manuscript_platform_test"\n`);
}

applyMigrations()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
