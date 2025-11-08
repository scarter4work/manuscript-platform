import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function checkScannerHealth() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected\n');

    // Check scanner_health table
    const health = await client.query(`
      SELECT * FROM scanner_health
      ORDER BY checked_at DESC
      LIMIT 5
    `);

    if (health.rows.length > 0) {
      console.log('📊 Scanner Health Records:\n');
      health.rows.forEach((row, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  Scanner: ${row.scanner_name}`);
        console.log(`  Status: ${row.status}`);
        console.log(`  Checked: ${row.checked_at}`);
        console.log(`  Version: ${row.virus_definitions_version || 'N/A'}`);
        console.log(`  Response Time: ${row.response_time_ms || 'N/A'}ms`);
        if (row.error_message) {
          console.log(`  Error: ${row.error_message}`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  No scanner health records found');
      console.log('   This means the virus scanner hasn\'t initialized yet');
      console.log('   This is normal - it will initialize on next deployment or restart\n');
    }

    // Check scanner_status view
    const status = await client.query('SELECT * FROM scanner_status');
    if (status.rows.length > 0) {
      console.log('📊 Current Scanner Status:\n');
      status.rows.forEach(row => {
        console.log(`  Scanner: ${row.scanner_name}`);
        console.log(`  Health: ${row.health_status}`);
        console.log(`  Status: ${row.status}`);
        console.log(`  Last Check: ${row.checked_at}`);
      });
    } else {
      console.log('⚠️  No active scanner status (tables just created)\n');
    }

    // Check for any scan results
    const scans = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN scan_status = 'clean' THEN 1 END) as clean,
             COUNT(CASE WHEN scan_status = 'infected' THEN 1 END) as infected
      FROM file_scan_results
    `);

    console.log('\n📊 File Scan Statistics:');
    console.log(`  Total Scans: ${scans.rows[0].total}`);
    console.log(`  Clean: ${scans.rows[0].clean}`);
    console.log(`  Infected: ${scans.rows[0].infected}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkScannerHealth();
