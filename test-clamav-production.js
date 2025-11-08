import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function checkClamAVStatus() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected\n');

    // Check if scanner_health or scanner_status table exists
    console.log('📝 Checking for virus scanner tables...\n');

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%scanner%' OR table_name LIKE '%virus%' OR table_name LIKE '%security%'
    `);

    if (tables.rows.length > 0) {
      console.log('✅ Found virus scanner tables:');
      tables.rows.forEach(row => console.log(`   - ${row.table_name}`));

      // Try to query scanner health
      for (const row of tables.rows) {
        try {
          const data = await client.query(`SELECT * FROM ${row.table_name} ORDER BY checked_at DESC LIMIT 1`);
          if (data.rows.length > 0) {
            console.log(`\n📊 ${row.table_name} (latest entry):`);
            console.log(JSON.stringify(data.rows[0], null, 2));
          }
        } catch (err) {
          // Table might not have checked_at column
          try {
            const data = await client.query(`SELECT * FROM ${row.table_name} LIMIT 1`);
            if (data.rows.length > 0) {
              console.log(`\n📊 ${row.table_name} (sample):`);
              console.log(JSON.stringify(data.rows[0], null, 2));
            }
          } catch (err2) {
            console.log(`   (Can't query ${row.table_name})`);
          }
        }
      }
    } else {
      console.log('⚠️  No virus scanner tables found in database');
      console.log('   Migration migration_038_security_incidents.sql may not be applied');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkClamAVStatus();
