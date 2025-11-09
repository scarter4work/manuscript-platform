/**
 * Create Test Database
 * Creates the manuscript_platform_test database if it doesn't exist
 */

import pg from 'pg';
const { Client } = pg;

async function createTestDatabase() {
  // Connect to default postgres database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    ssl: false
  });

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL');

    // Check if database exists
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'manuscript_platform_test'"
    );

    if (checkResult.rows.length > 0) {
      console.log('ℹ Test database already exists');
    } else {
      // Create database
      await client.query('CREATE DATABASE manuscript_platform_test');
      console.log('✓ Created database: manuscript_platform_test');
    }

    await client.end();

    console.log('\n✅ Database ready!');
    console.log('\nNext step: Run tests');
    console.log('  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/manuscript_platform_test npm test');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestDatabase();
