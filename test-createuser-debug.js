/**
 * Debug script to test createTestUser function
 */
import { Client } from 'pg';
import { createTestUser } from './tests/test-helpers/factories.js';
import { setupTestDatabase, getTestDb } from './tests/test-helpers/database.js';

async function main() {
  console.log('1. Setting up test database...');
  await setupTestDatabase();

  const testDb = getTestDb();
  console.log('2. Test database initialized');
  console.log('3. testDb has query method?', typeof testDb.query === 'function');

  console.log('4. Creating test user with database...');
  const user = await createTestUser(testDb, {
    email: 'debug-test@example.com',
    password_hash: '$2a$10$DEBUG_HASH',
    email_verified: true
  });

  console.log('5. User object created:', user.email);

  console.log('6. Querying via testDb (same connection as insert)...');
  const result1 = await testDb.query(
    'SELECT * FROM users WHERE email = $1',
    ['debug-test@example.com']
  );

  if (result1.rows.length > 0) {
    console.log('✅ Found via testDb:', result1.rows[0].email);
  } else {
    console.log('❌ NOT found via testDb!');
  }

  console.log('\n7. Querying via testDbAdapter (different connection - like handlers)...');
  const { getTestDbAdapter } = await import('./tests/test-helpers/database.js');
  const testDbAdapter = getTestDbAdapter();

  const result2 = await testDbAdapter.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind('debug-test@example.com').first();

  if (result2) {
    console.log('✅ Found via testDbAdapter:', result2.email);
  } else {
    console.log('❌ NOT found via testDbAdapter! THIS IS THE BUG!');
  }

  await testDb.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
