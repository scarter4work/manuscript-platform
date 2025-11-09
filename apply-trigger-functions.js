import pg from 'pg';
import fs from 'fs/promises';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function applyTriggerFunctions() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    console.log('📖 Reading trigger functions SQL file...');
    const sql = await fs.readFile('create-trigger-functions.sql', 'utf-8');
    console.log('✅ SQL file loaded\n');

    console.log('🔧 Applying trigger functions to database...');
    await client.query(sql);
    console.log('✅ All trigger functions created successfully!\n');

    console.log('📊 Verifying trigger functions...');
    const result = await client.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_name LIKE '%timestamp%'
      ORDER BY routine_name;
    `);

    console.log(`✅ Found ${result.rows.length} trigger functions:`);
    result.rows.forEach(row => {
      console.log(`   - ${row.routine_name}`);
    });

  } catch (error) {
    console.error('❌ Error applying trigger functions:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

applyTriggerFunctions()
  .then(() => {
    console.log('\n✅ Trigger functions applied successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to apply trigger functions');
    process.exit(1);
  });
