import { Client } from 'pg';

async function testConnection() {
  console.log('Testing PostgreSQL connection...\n');

  const configs = [
    {
      name: 'With password (URL)',
      connectionString: 'postgresql://postgres:Bjoran32!@localhost:5432/postgres'
    },
    {
      name: 'With password (URL-encoded)',
      connectionString: 'postgresql://postgres:Bjoran32%21@localhost:5432/postgres'
    },
    {
      name: 'With password (config object)',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Bjoran32!'
    }
  ];

  for (const config of configs) {
    const client = new Client(config);
    console.log(`Testing: ${config.name}`);

    try {
      await client.connect();
      console.log('✓ Connected successfully!\n');

      const result = await client.query('SELECT version()');
      console.log('PostgreSQL version:', result.rows[0].version, '\n');

      await client.end();
      process.exit(0);
    } catch (error) {
      console.log(`✗ Failed: ${error.message}\n`);
      try {
        await client.end();
      } catch (e) {
        // Ignore
      }
    }
  }

  console.log('All connection attempts failed.');
  console.log('\nPossible issues:');
  console.log('1. PostgreSQL is not running');
  console.log('2. Password is incorrect');
  console.log('3. pg_hba.conf does not allow password auth from localhost');
  console.log('4. PostgreSQL is running on a different port\n');
}

testConnection().catch(console.error);
