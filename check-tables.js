/**
 * Check what tables exist in test database
 */

import pg from 'pg';
const { Client } = pg;

async function checkTables() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'manuscript_platform_test',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✓ Connected to test database\n');

    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log(`Found ${result.rows.length} tables:\n`);
    result.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.tablename}`);
    });

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
