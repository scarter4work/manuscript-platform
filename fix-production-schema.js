import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function fixProductionSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to production database\n');

    // Test connection
    const result = await client.query('SELECT NOW()');
    console.log('✓ Connection test passed:', result.rows[0].now);

    console.log('\n📝 Checking current schema...\n');

    // Check users table columns
    const usersColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('Current users table columns:');
    usersColumns.rows.forEach(row => console.log(`  - ${row.column_name}`));

    // Check manuscripts table columns
    const manuscriptsColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'manuscripts'
      ORDER BY ordinal_position
    `);
    console.log('\nCurrent manuscripts table columns:');
    manuscriptsColumns.rows.forEach(row => console.log(`  - ${row.column_name}`));

    console.log('\n📝 Applying missing column migrations...\n');

    // Add missing columns to users table
    console.log('Adding "role" column to users table...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'author';
    `);
    console.log('✓ Added role column');

    console.log('Adding "subscription_tier" column to users table...');
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
    `);
    console.log('✓ Added subscription_tier column');

    // Add missing columns to manuscripts table
    console.log('Adding "uploaded_at" column to manuscripts table...');
    await client.query(`
      ALTER TABLE manuscripts
      ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT NOW();
    `);
    console.log('✓ Added uploaded_at column');

    console.log('Adding "word_count" column to manuscripts table...');
    await client.query(`
      ALTER TABLE manuscripts
      ADD COLUMN IF NOT EXISTS word_count INTEGER;
    `);
    console.log('✓ Added word_count column');

    console.log('Adding "title" column to manuscripts table...');
    await client.query(`
      ALTER TABLE manuscripts
      ADD COLUMN IF NOT EXISTS title TEXT;
    `);
    console.log('✓ Added title column');

    // Backfill uploaded_at with created_at for existing rows
    console.log('\nBackfilling uploaded_at with created_at for existing rows...');
    const updateResult = await client.query(`
      UPDATE manuscripts
      SET uploaded_at = created_at
      WHERE uploaded_at IS NULL
    `);
    console.log(`✓ Updated ${updateResult.rowCount} rows`);

    console.log('\n📝 Verifying schema changes...\n');

    // Verify users table
    const usersColumnsAfter = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('Updated users table columns:');
    usersColumnsAfter.rows.forEach(row => console.log(`  - ${row.column_name}`));

    // Verify manuscripts table
    const manuscriptsColumnsAfter = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'manuscripts'
      ORDER BY ordinal_position
    `);
    console.log('\nUpdated manuscripts table columns:');
    manuscriptsColumnsAfter.rows.forEach(row => console.log(`  - ${row.column_name}`));

    // Test queries that were failing
    console.log('\n📝 Testing previously failing queries...\n');

    try {
      await client.query('SELECT id, email, full_name, role, subscription_tier, created_at, last_login FROM users LIMIT 1');
      console.log('✓ Users query with role/subscription_tier works');
    } catch (err) {
      console.error('✗ Users query failed:', err.message);
    }

    try {
      await client.query('SELECT * FROM manuscripts ORDER BY uploaded_at DESC LIMIT 1');
      console.log('✓ Manuscripts query with uploaded_at works');
    } catch (err) {
      console.error('✗ Manuscripts query failed:', err.message);
    }

    try {
      await client.query('SELECT SUM(word_count) as total FROM manuscripts LIMIT 1');
      console.log('✓ Manuscripts query with word_count works');
    } catch (err) {
      console.error('✗ Manuscripts query failed:', err.message);
    }

    console.log('\n✅ Production schema fixed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

fixProductionSchema();
