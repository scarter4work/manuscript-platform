/**
 * Manually verify a user's email in the database
 * Usage: node verify-email-manual.js <email>
 */

import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function verifyEmail(email) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if user exists
    const checkResult = await client.query(
      'SELECT id, email, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (checkResult.rows.length === 0) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    const user = checkResult.rows[0];
    console.log(`\nFound user: ${user.email}`);
    console.log(`Current verification status: ${user.email_verified ? 'Verified' : 'Not Verified'}`);

    if (user.email_verified) {
      console.log('\n✅ Email already verified!');
      process.exit(0);
    }

    // Update email_verified to true
    await client.query(
      'UPDATE users SET email_verified = TRUE, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = $1',
      [user.id]
    );

    console.log('\n✅ Email verified successfully!');
    console.log(`User ${email} can now log in.`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node verify-email-manual.js <email>');
  process.exit(1);
}

verifyEmail(email);
