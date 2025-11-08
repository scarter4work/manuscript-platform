import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function checkFeatureTables() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected\n');

    // Feature tables that should exist based on migrations 020-038
    const featureTables = [
      // Migration 020
      'author_bios',
      // Migration 021
      'cover_design_briefs',
      // Migration 022
      'genres',
      'content_warning_types',
      'manuscript_metadata_history',
      // Migration 023
      'supporting_documents',
      // Migration 024
      'submission_packages',
      'package_document_map',
      // Migration 025
      'submissions',
      'submission_feedback',
      // Migration 026
      'human_editors',
      'editorial_assignments',
      // Migration 027
      'marketing_kits',
      'social_posts',
      // Migration 028
      'formatting_outputs',
      // Migration 029
      'notification_preferences',
      'message_templates',
      // Migration 030
      'slush_pile_decisions',
      // Migration 031
      'submission_windows',
      // Migration 032
      'kdp_packages',
      // Migration 033
      'comp_titles',
      // Migration 034
      'sales_data',
      // Migration 035
      'rights_licenses',
      // Migration 036
      'ai_chat_sessions',
      // Migration 037
      'author_platform',
      // Migration 038
      'security_incidents',  // This one exists
      'file_scan_results',   // This one exists
      'scanner_health'       // This one exists
    ];

    console.log('🔍 Checking for feature tables:\n');

    const existing = [];
    const missing = [];

    for (const tableName of featureTables) {
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      if (result.rows.length > 0) {
        console.log(`  ✅ ${tableName}`);
        existing.push(tableName);
      } else {
        console.log(`  ❌ ${tableName}`);
        missing.push(tableName);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`  Existing feature tables: ${existing.length}/${featureTables.length}`);
    console.log(`  Missing feature tables: ${missing.length}/${featureTables.length}`);

    if (missing.length > 0) {
      console.log(`\n\n❌ Missing tables:`);
      missing.forEach(t => console.log(`     - ${t}`));
      console.log(`\n⚠️  These migrations need to be applied to enable full feature set`);
    } else {
      console.log(`\n\n✅ All feature tables exist!`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkFeatureTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
