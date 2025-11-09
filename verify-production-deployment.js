import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function verifyDeployment() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check applied migrations
    console.log('📊 MIGRATION STATUS');
    console.log('━'.repeat(60));
    const migrations = await client.query(`
      SELECT migration_name, applied_at
      FROM schema_migrations
      ORDER BY applied_at DESC
      LIMIT 5;
    `);
    console.log(`✅ Total migrations applied: ${migrations.rowCount}`);
    console.log('\nLatest 5 migrations:');
    migrations.rows.forEach(row => {
      const date = new Date(row.applied_at).toISOString();
      console.log(`   - ${row.migration_name} (${date})`);
    });

    // Check tables
    console.log('\n📋 TABLE COUNT');
    console.log('━'.repeat(60));
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log(`✅ Total tables: ${tables.rowCount}`);

    // Check views
    console.log('\n👁️  VIEW COUNT');
    console.log('━'.repeat(60));
    const views = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(`✅ Total views: ${views.rowCount}`);

    // Check triggers
    console.log('\n⚡ TRIGGER COUNT');
    console.log('━'.repeat(60));
    const triggers = await client.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY trigger_name;
    `);
    console.log(`✅ Total triggers: ${triggers.rowCount}`);

    // Sample triggers
    if (triggers.rowCount > 0) {
      console.log('\nSample triggers (first 10):');
      triggers.rows.slice(0, 10).forEach(row => {
        console.log(`   - ${row.trigger_name} on ${row.event_object_table}`);
      });
    }

    // Check indexes
    console.log('\n📇 INDEX COUNT');
    console.log('━'.repeat(60));
    const indexes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname;
    `);
    console.log(`✅ Total indexes: ${indexes.rowCount}`);

    // Check trigger functions
    console.log('\n🔧 TRIGGER FUNCTION COUNT');
    console.log('━'.repeat(60));
    const functions = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name;
    `);
    console.log(`✅ Total functions: ${functions.rowCount}`);

    // Sample key tables
    console.log('\n📂 KEY TABLES VERIFICATION');
    console.log('━'.repeat(60));
    const keyTables = [
      'users',
      'manuscripts',
      'genres',
      'content_warning_types',
      'supporting_documents',
      'submission_packages',
      'publishers',
      'publisher_submission_windows',
      'security_incidents',
      'file_scan_results'
    ];

    for (const tableName of keyTables) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1;
      `, [tableName]);

      if (result.rows[0].count > 0) {
        console.log(`   ✅ ${tableName}`);
      } else {
        console.log(`   ❌ ${tableName} - MISSING!`);
      }
    }

    // Check for critical views
    console.log('\n🔍 KEY VIEWS VERIFICATION');
    console.log('━'.repeat(60));
    const keyViews = [
      'genre_usage_stats',
      'manuscript_metadata_validation',
      'open_submission_windows',
      'upcoming_deadlines'
    ];

    for (const viewName of keyViews) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = $1;
      `, [viewName]);

      if (result.rows[0].count > 0) {
        console.log(`   ✅ ${viewName}`);
      } else {
        console.log(`   ❌ ${viewName} - MISSING!`);
      }
    }

    // Database size
    console.log('\n💾 DATABASE SIZE');
    console.log('━'.repeat(60));
    const size = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);
    console.log(`✅ Total size: ${size.rows[0].size}`);

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 DEPLOYMENT VERIFICATION COMPLETE');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error verifying deployment:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

verifyDeployment()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
