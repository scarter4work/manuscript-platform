import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function checkSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to production database\n');

    // Get all tables
    console.log('📊 Tables in production database:');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`Found ${tables.rows.length} tables:\n`);

    for (const table of tables.rows) {
      console.log(`\n📋 Table: ${table.table_name}`);

      // Get columns for this table
      const columns = await client.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table.table_name]);

      columns.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name}: ${col.data_type} ${nullable}${def}`);
      });
    }

    // Check specific columns mentioned in Issue #70
    console.log('\n\n🔍 Checking critical columns from Issue #70:');

    const checks = [
      { table: 'users', column: 'role' },
      { table: 'users', column: 'subscription_tier' },
      { table: 'manuscripts', column: 'uploaded_at' },
      { table: 'manuscripts', column: 'word_count' },
      { table: 'manuscripts', column: 'title' }
    ];

    for (const check of checks) {
      const result = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.column]);

      if (result.rows.length > 0) {
        console.log(`  ✅ ${check.table}.${check.column} EXISTS`);
      } else {
        console.log(`  ❌ ${check.table}.${check.column} MISSING`);
      }
    }

    // Count records in key tables
    console.log('\n\n📈 Record counts:');
    const keyTables = ['users', 'manuscripts', 'sessions', 'analyses'];
    for (const tableName of keyTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        console.log(`  ${tableName}: ${count.rows[0].count} records`);
      } catch (err) {
        console.log(`  ${tableName}: TABLE NOT FOUND`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkSchema().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
