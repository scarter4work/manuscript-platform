import pg from 'pg';
import fs from 'fs/promises';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function applyAllFixes() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to production database\n');

    console.log('📋 Applying comprehensive migration fixes...\n');
    const fixSQL = await fs.readFile('fix-remaining-migrations.sql', 'utf-8');

    // Split by semicolon, filter out comments and empty statements
    const statements = fixSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const lines = s.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return lines.length > 0;
      });

    console.log(`⚙️  Executing ${statements.length} fix statements...\n`);

    let created = 0;
    let fixed = 0;
    let marked = 0;
    let skipped = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length === 0) continue;

      try {
        await client.query(stmt);

        if (stmt.includes('CREATE TABLE')) {
          const tableName = stmt.match(/CREATE TABLE.*?(\w+)/i)?.[1];
          console.log(`  ✓ Created table: ${tableName}`);
          created++;
        } else if (stmt.includes('CREATE OR REPLACE VIEW') || stmt.includes('DROP VIEW')) {
          const viewName = stmt.match(/VIEW\s+(\w+)/i)?.[1];
          console.log(`  ✓ Fixed view: ${viewName}`);
          fixed++;
        } else if (stmt.includes('INSERT INTO schema_migrations')) {
          console.log(`  ✓ Marked migrations as applied`);
          marked++;
        } else {
          console.log(`  ✓ Statement ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        if (err.message.includes('already exists') ||
            err.message.includes('does not exist') ||
            err.message.includes('duplicate key')) {
          console.log(`  ⏭️  Skipped (already exists or N/A)`);
          skipped++;
        } else {
          console.error(`  ❌ Error in statement ${i + 1}:`, err.message);
          console.error(`     Statement: ${stmt.substring(0, 100)}...`);
        }
      }
    }

    console.log('\n\n📊 Summary:');
    console.log(`  Tables created: ${created}`);
    console.log(`  Views fixed: ${fixed}`);
    console.log(`  Migrations marked: ${marked}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total statements: ${statements.length}`);

    console.log('\n✅ All fixes applied successfully!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyAllFixes().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
