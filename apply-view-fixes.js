import pg from 'pg';
import fs from 'fs/promises';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function applyFixes() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to production database\n');

    // Apply GROUP BY fixes
    console.log('📋 Applying GROUP BY view fixes...');
    const groupBySQL = await fs.readFile('fix-group-by-views.sql', 'utf-8');

    const statements = groupBySQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        const viewName = stmt.match(/VIEW\s+(\w+)/i)?.[1] || 'unknown';
        console.log(`  ✓ Fixed view: ${viewName}`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`  ⏭️  Skipped (table doesn't exist yet)`);
        } else {
          console.error(`  ❌ Error:`, err.message);
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log('  GROUP BY view fixes applied');
    console.log('\n✅ Fixup complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyFixes().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
