import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function createView() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    const viewSQL = `
CREATE OR REPLACE VIEW upcoming_deadlines AS
SELECT
  sd.*,
  m.title as manuscript_title,
  m.genre,

  -- Days until deadline
  CAST(EXTRACT(EPOCH FROM (sd.deadline_date - NOW())) / 86400.0 AS INTEGER) as days_until_deadline,

  -- Overdue flag
  CASE WHEN sd.deadline_date < NOW() THEN 1 ELSE 0 END as is_overdue

FROM submission_deadlines sd
JOIN manuscripts m ON sd.submission_id = m.id
WHERE sd.deadline_date > NOW() - INTERVAL '7 days'
ORDER BY sd.deadline_date ASC;
    `;

    console.log('🔧 Creating upcoming_deadlines view...');
    await client.query(viewSQL);
    console.log('✅ upcoming_deadlines created\n');

    // Verify
    console.log('🔍 Verifying view...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name = 'upcoming_deadlines';
    `);

    if (result.rowCount > 0) {
      console.log('✅ upcoming_deadlines view verified');
    } else {
      console.log('❌ upcoming_deadlines view not found');
    }

  } catch (error) {
    console.error('❌ Error creating view:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

createView()
  .then(() => {
    console.log('\n✅ View created successfully!');
    process.exit(0);
  })
  .catch(() => {
    console.error('\n❌ Failed to create view');
    process.exit(1);
  });
