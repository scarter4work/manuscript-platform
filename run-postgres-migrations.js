import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function runMigrations() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');

    // Test connection
    const result = await client.query('SELECT NOW()');
    console.log('✓ Connection test passed:', result.rows[0].now);

    console.log('\n📝 Creating base schema...');
    
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          plan TEXT DEFAULT 'free',
          manuscripts_count INTEGER DEFAULT 0,
          monthly_analyses INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          email_verified BOOLEAN DEFAULT FALSE
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `);
    console.log('✓ Users table created');

    await client.query(`
      -- Manuscripts table
      CREATE TABLE IF NOT EXISTS manuscripts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          report_id TEXT UNIQUE NOT NULL,
          manuscript_key TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_size BIGINT,
          genre TEXT,
          status TEXT DEFAULT 'uploaded',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_manuscripts_user_id ON manuscripts(user_id);
      CREATE INDEX IF NOT EXISTS idx_manuscripts_report_id ON manuscripts(report_id);
      CREATE INDEX IF NOT EXISTS idx_manuscripts_created_at ON manuscripts(created_at);
    `);
    console.log('✓ Manuscripts table created');

    await client.query(`
      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
    console.log('✓ Sessions table created');

    await client.query(`
      -- Analyses table
      CREATE TABLE IF NOT EXISTS analyses (
          id TEXT PRIMARY KEY,
          manuscript_id TEXT NOT NULL,
          analysis_type TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          overall_score REAL,
          issues_count INTEGER,
          completed_at TIMESTAMP,
          FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_analyses_manuscript_id ON analyses(manuscript_id);
    `);
    console.log('✓ Analyses table created');

    await client.query(`
      -- Usage logs table
      CREATE TABLE IF NOT EXISTS usage_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp);
    `);
    console.log('✓ Usage logs table created');

    await client.query(`
      -- Payments table
      CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency TEXT DEFAULT 'USD',
          status TEXT NOT NULL,
          plan TEXT NOT NULL,
          stripe_payment_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    `);
    console.log('✓ Payments table created');

    // Password reset tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
    `);
    console.log('✓ Password reset tokens table created');

    console.log('\n✅ Base schema created successfully!');
    console.log('\nTables created:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigrations();
