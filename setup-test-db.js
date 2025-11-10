/**
 * Set up test database for PostgreSQL
 * Creates manuscript_platform_test database and runs migrations
 */

import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TEST_DB_NAME = 'manuscript_platform_test';

const ADMIN_CONFIG = {
  host: '127.0.0.1',  // Use IPv4 to avoid pg_hba.conf issues with localhost/IPv6
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Bjoran32!',
  ssl: false
};

const TEST_CONFIG = {
  host: '127.0.0.1',  // Use IPv4 to avoid pg_hba.conf issues with localhost/IPv6
  port: 5432,
  database: TEST_DB_NAME,
  user: 'postgres',
  password: 'Bjoran32!',
  ssl: false
};

async function setupTestDatabase() {
  console.log('🧪 Setting up test database...\n');

  // Step 1: Connect to default postgres database
  console.log('1️⃣  Connecting to PostgreSQL...');
  const adminClient = new Client(ADMIN_CONFIG);
  await adminClient.connect();
  console.log('✓ Connected to PostgreSQL\n');

  // Step 2: Ensure test database exists (skip if already exists)
  console.log('2️⃣  Checking test database...');
  try {
    const result = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = '${TEST_DB_NAME}'`);
    if (result.rows.length > 0) {
      console.log(`✓ Database exists: ${TEST_DB_NAME}\n`);
    } else {
      await adminClient.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      console.log(`✓ Created database: ${TEST_DB_NAME}\n`);
    }
  } catch (error) {
    console.error('✗ Failed to check/create database:', error.message);
    throw error;
  }

  await adminClient.end();

  // Step 3: Connect to test database
  console.log('3️⃣  Connecting to test database...');
  const testClient = new Client(TEST_CONFIG);
  await testClient.connect();
  console.log('✓ Connected to test database\n');

  // Step 4: Run migrations
  console.log('4️⃣  Running migrations...');
  const migrationsDir = join(process.cwd(), 'migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.skip'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of migrationFiles) {
    try {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');

      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await testClient.query(statement);
      }

      console.log(`  ✓ ${file}`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ ${file}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n✓ Migrations complete: ${successCount} succeeded, ${errorCount} failed\n`);

  // Step 5: Verify tables created
  console.log('5️⃣  Verifying tables...');
  const result = await testClient.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log(`✓ Created ${result.rows.length} tables:\n`);
  result.rows.forEach(row => {
    console.log(`  - ${row.tablename}`);
  });

  await testClient.end();

  console.log('\n✅ Test database setup complete!');
  console.log(`\n📝 Set this environment variable to run tests:\n`);
  console.log(`TEST_DATABASE_URL="postgresql://postgres:Bjoran32%21@localhost:5432/${TEST_DB_NAME}"\n`);
}

// Run setup
setupTestDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
