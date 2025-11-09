import pg from 'pg';
import fs from 'fs/promises';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function createMissingViews() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    console.log('📖 Reading migration_031 file...');
    const sql = await fs.readFile('migrations/migration_031_submission_windows_deadlines.sql', 'utf-8');

    // Extract the two view definitions
    const openWindowsMatch = sql.match(/CREATE OR REPLACE VIEW open_submission_windows AS[\s\S]*?(?=CREATE OR REPLACE VIEW|-- View:|$)/);
    const upcomingDeadlinesMatch = sql.match(/CREATE OR REPLACE VIEW upcoming_deadlines AS[\s\S]*?(?=--|$)/);

    if (!openWindowsMatch || !upcomingDeadlinesMatch) {
      throw new Error('Could not extract view definitions from migration file');
    }

    const openWindowsView = openWindowsMatch[0].trim().replace(/--.*$/gm, '').trim();
    const upcomingDeadlinesView = upcomingDeadlinesMatch[0].trim().replace(/--.*$/gm, '').trim();

    console.log('🔧 Creating open_submission_windows view...');
    await client.query(openWindowsView);
    console.log('✅ open_submission_windows created\n');

    console.log('🔧 Creating upcoming_deadlines view...');
    await client.query(upcomingDeadlinesView);
    console.log('✅ upcoming_deadlines created\n');

    // Verify
    console.log('🔍 Verifying views...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN ('open_submission_windows', 'upcoming_deadlines')
      ORDER BY table_name;
    `);

    console.log(`✅ Found ${result.rowCount} views:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error creating views:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

createMissingViews()
  .then(() => {
    console.log('\n✅ Missing views created successfully!');
    process.exit(0);
  })
  .catch(() => {
    console.error('\n❌ Failed to create missing views');
    process.exit(1);
  });
