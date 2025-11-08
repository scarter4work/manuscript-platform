import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function checkProductionTables() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected\n');

    // List all tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Production Tables:');
    tables.rows.forEach((row, i) => console.log(`${i + 1}. ${row.table_name}`));

    console.log(`\n✅ Total: ${tables.rows.length} tables`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkProductionTables();
