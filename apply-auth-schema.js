/**
 * Apply Auth Test Schema
 * Applies minimal PostgreSQL schema for auth handler tests
 */

import pg from 'pg';
import fs from 'fs/promises';
const { Client } = pg;

async function applyAuthSchema() {
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
    console.log('✓ Connected to test database');

    // Read auth schema
    const schema = await fs.readFile('auth-test-schema.sql', 'utf-8');
    console.log('✓ Loaded auth-test-schema.sql');

    // Execute the entire schema (it has IF NOT EXISTS clauses)
    await client.query(schema);
    console.log('✓ Auth schema applied successfully');

    // Verify tables were created
    const result = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log(`\n✅ Created ${result.rows.length} tables:`);
    result.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.tablename}`);
    });

    await client.end();

    console.log('\n✨ Database ready for auth tests!');
    console.log('\nRun tests:');
    console.log('  export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/manuscript_platform_test"');
    console.log('  npm test -- tests/integration/handlers/auth-handlers.test.js');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyAuthSchema();
