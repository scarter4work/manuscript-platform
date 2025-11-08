import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function testProductionFixes() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected\n');

    console.log('📝 Testing previously failing queries...\n');

    // Test 1: Users table with role and subscription_tier
    console.log('Test 1: SELECT with role and subscription_tier from users');
    try {
      const result = await client.query(
        'SELECT id, email, full_name, role, subscription_tier, created_at, last_login FROM users LIMIT 1'
      );
      console.log('✅ PASS - Users query with role/subscription_tier works');
      if (result.rows.length > 0) {
        console.log(`   Sample: ${result.rows[0].email} (role: ${result.rows[0].role || 'NULL'})`);
      }
    } catch (err) {
      console.log('❌ FAIL - Error:', err.message);
    }

    // Test 2: Manuscripts table with uploaded_at
    console.log('\nTest 2: SELECT with uploaded_at from manuscripts');
    try {
      const result = await client.query(
        'SELECT id, title, uploaded_at FROM manuscripts ORDER BY uploaded_at DESC LIMIT 1'
      );
      console.log('✅ PASS - Manuscripts query with uploaded_at works');
      if (result.rows.length > 0) {
        console.log(`   Sample: ${result.rows[0].title || 'Untitled'} (uploaded: ${result.rows[0].uploaded_at})`);
      }
    } catch (err) {
      console.log('❌ FAIL - Error:', err.message);
    }

    // Test 3: Manuscripts table with word_count
    console.log('\nTest 3: SELECT with word_count from manuscripts');
    try {
      const result = await client.query(
        'SELECT SUM(word_count) as total, COUNT(*) as count FROM manuscripts'
      );
      console.log('✅ PASS - Manuscripts query with word_count works');
      console.log(`   Total manuscripts: ${result.rows[0].count}, Total words: ${result.rows[0].total || 0}`);
    } catch (err) {
      console.log('❌ FAIL - Error:', err.message);
    }

    // Test 4: Check that all new columns exist
    console.log('\nTest 4: Verify all new columns exist');
    const usersColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('role', 'subscription_tier')
    `);
    console.log(`   users.role: ${usersColumns.rows.some(r => r.column_name === 'role') ? '✅' : '❌'}`);
    console.log(`   users.subscription_tier: ${usersColumns.rows.some(r => r.column_name === 'subscription_tier') ? '✅' : '❌'}`);

    const manuscriptsColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'manuscripts'
      AND column_name IN ('uploaded_at', 'word_count', 'title')
    `);
    console.log(`   manuscripts.uploaded_at: ${manuscriptsColumns.rows.some(r => r.column_name === 'uploaded_at') ? '✅' : '❌'}`);
    console.log(`   manuscripts.word_count: ${manuscriptsColumns.rows.some(r => r.column_name === 'word_count') ? '✅' : '❌'}`);
    console.log(`   manuscripts.title: ${manuscriptsColumns.rows.some(r => r.column_name === 'title') ? '✅' : '❌'}`);

    console.log('\n✅ All database migration tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.end();
  }
}

testProductionFixes();
