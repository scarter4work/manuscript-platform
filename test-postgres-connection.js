/**
 * Test PostgreSQL Connection
 * Tries common credential combinations to find working connection
 */

import pg from 'pg';
const { Client } = pg;

const commonCombinations = [
  { user: 'postgres', password: 'password', description: 'Default (password)' },
  { user: 'postgres', password: 'postgres', description: 'Default (postgres)' },
  { user: 'postgres', password: '', description: 'Default (no password)' },
  { user: 'postgres', password: 'admin', description: 'Common (admin)' },
  { user: 'postgres', password: '123456', description: 'Common (123456)' },
];

async function testConnection(user, password, description) {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user,
    password,
    database: 'postgres', // Default database
    ssl: false
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    await client.end();

    const version = result.rows[0].version.split(' ')[1];

    console.log(`\n✅ SUCCESS: ${description}`);
    console.log(`   User: ${user}`);
    console.log(`   Password: ${password}`);
    console.log(`   PostgreSQL Version: ${version}`);
    console.log(`\n📋 Connection String:`);
    console.log(`   TEST_DATABASE_URL=postgresql://${user}:${password}@localhost:5432/manuscript_platform_test`);
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${description} - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing PostgreSQL connections on localhost:5432...\n');

  for (const combo of commonCombinations) {
    const success = await testConnection(combo.user, combo.password, combo.description);
    if (success) {
      console.log('\n✨ Found working credentials! Use the connection string above.');
      console.log('\nNext steps:');
      console.log('1. Create test database:');
      console.log(`   psql -U ${combo.user} -c "CREATE DATABASE manuscript_platform_test;"`);
      console.log('\n2. Set environment variable (Git Bash):');
      console.log(`   export TEST_DATABASE_URL="postgresql://${combo.user}:${combo.password}@localhost:5432/manuscript_platform_test"`);
      console.log('\n3. Run tests:');
      console.log('   npm test');
      process.exit(0);
    }
  }

  console.log('\n❌ None of the common credentials worked.');
  console.log('\nTry these options:');
  console.log('1. Check PostgreSQL service is running:');
  console.log('   - Windows: Services app -> Look for "postgresql"');
  console.log('   - Or run: pg_ctl status');
  console.log('\n2. Reset password:');
  console.log('   - Edit pg_hba.conf (usually in C:\\Program Files\\PostgreSQL\\XX\\data\\)');
  console.log('   - Change "md5" to "trust" for local connections');
  console.log('   - Restart PostgreSQL service');
  console.log('   - Connect: psql -U postgres');
  console.log('   - Change password: ALTER USER postgres PASSWORD \'newpassword\';');
  console.log('   - Change pg_hba.conf back to "md5"');
  console.log('   - Restart service');
}

main().catch(console.error);
