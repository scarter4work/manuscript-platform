/**
 * Apply Base PostgreSQL Schema
 * Applies the base schema before running migrations
 */

import pg from 'pg';
import fs from 'fs/promises';
const { Client } = pg;

async function applyBaseSchema() {
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

    // Read base schema
    const schema = await fs.readFile('postgres-schema.sql', 'utf-8');
    console.log('✓ Loaded postgres-schema.sql');

    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`✓ Found ${statements.length} SQL statements`);

    // Execute each statement
    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        await client.query(statement);
        executed++;
        if (executed % 50 === 0) {
          console.log(`  Executed ${executed}/${statements.length} statements...`);
        }
      } catch (error) {
        if (error.message.includes('already exists')) {
          skipped++;
        } else {
          console.error(`\n❌ Error in statement: ${statement.substring(0, 100)}...`);
          console.error(`   Error: ${error.message}`);
        }
      }
    }

    await client.end();

    console.log(`\n✅ Base schema applied!`);
    console.log(`   Executed: ${executed} statements`);
    console.log(`   Skipped: ${skipped} statements (already exists)`);
    console.log('\nNext step: Run tests');
    console.log('  TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/manuscript_platform_test npm test');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyBaseSchema();
