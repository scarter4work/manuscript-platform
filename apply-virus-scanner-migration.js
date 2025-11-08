import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function applyVirusScannerMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production PostgreSQL...');
    await client.connect();
    console.log('✓ Connected\n');

    console.log('📝 Applying virus scanner migration...\n');

    // Create security_incidents table
    console.log('Creating security_incidents table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        resolved_by TEXT,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('✓ security_incidents table created');

    // Create indexes for security_incidents
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(type);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON security_incidents(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_user ON security_incidents(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_resolved ON security_incidents(resolved);
      CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON security_incidents(ip_address);
    `);
    console.log('✓ security_incidents indexes created');

    // Create file_scan_results table
    console.log('Creating file_scan_results table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS file_scan_results (
        id TEXT PRIMARY KEY,
        file_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        scan_status TEXT NOT NULL,
        scanner_name TEXT NOT NULL,
        viruses_found TEXT,
        scan_duration_ms INTEGER,
        scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    console.log('✓ file_scan_results table created');

    // Create indexes for file_scan_results
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_file_scan_results_status ON file_scan_results(scan_status);
      CREATE INDEX IF NOT EXISTS idx_file_scan_results_scanned ON file_scan_results(scanned_at DESC);
      CREATE INDEX IF NOT EXISTS idx_file_scan_results_user ON file_scan_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_file_scan_results_file_key ON file_scan_results(file_key);
    `);
    console.log('✓ file_scan_results indexes created');

    // Create scanner_health table
    console.log('Creating scanner_health table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS scanner_health (
        id TEXT PRIMARY KEY,
        scanner_name TEXT NOT NULL,
        status TEXT NOT NULL,
        last_successful_scan TIMESTAMP,
        virus_definitions_version TEXT,
        last_definition_update TIMESTAMP,
        error_message TEXT,
        checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        response_time_ms INTEGER
      );
    `);
    console.log('✓ scanner_health table created');

    // Create indexes for scanner_health
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scanner_health_scanner ON scanner_health(scanner_name);
      CREATE INDEX IF NOT EXISTS idx_scanner_health_checked ON scanner_health(checked_at DESC);
    `);
    console.log('✓ scanner_health indexes created');

    // Create malware_uploads view
    console.log('Creating malware_uploads view...');
    await client.query(`
      CREATE OR REPLACE VIEW malware_uploads AS
      SELECT
        f.id,
        f.file_name,
        f.file_key,
        f.file_size,
        f.viruses_found,
        f.scanned_at,
        f.user_id,
        u.email as user_email,
        s.ip_address,
        s.details as incident_details
      FROM file_scan_results f
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN security_incidents s ON s.details LIKE '%' || f.file_key || '%'
      WHERE f.scan_status = 'infected'
      ORDER BY f.scanned_at DESC;
    `);
    console.log('✓ malware_uploads view created');

    // Create scanner_status view
    console.log('Creating scanner_status view...');
    await client.query(`
      CREATE OR REPLACE VIEW scanner_status AS
      SELECT
        scanner_name,
        status,
        virus_definitions_version,
        last_definition_update,
        checked_at,
        response_time_ms,
        CASE
          WHEN status = 'online' AND checked_at > NOW() - INTERVAL '5 minutes' THEN 'healthy'
          WHEN status = 'online' THEN 'stale'
          ELSE 'unhealthy'
        END as health_status
      FROM scanner_health
      WHERE id IN (
        SELECT id FROM scanner_health
        WHERE scanner_name IN (
          SELECT DISTINCT scanner_name FROM scanner_health
        )
        ORDER BY checked_at DESC
        LIMIT 1
      );
    `);
    console.log('✓ scanner_status view created');

    console.log('\n✅ Virus scanner migration applied successfully!');

    // Verify tables exist
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (
        table_name LIKE '%scanner%' OR
        table_name LIKE '%security%' OR
        table_name LIKE '%scan%'
      )
      ORDER BY table_name
    `);

    console.log('\n📊 Virus scanner tables:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

applyVirusScannerMigration();
