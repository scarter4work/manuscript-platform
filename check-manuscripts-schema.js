import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function checkSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'manuscripts'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Manuscripts table columns:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
