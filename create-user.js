import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
const { Client } = pg;

const DATABASE_URL = 'postgresql://manuscript_platform_user:dcxKtPenX4XsMHokULvVlgxZpWOPe15v@dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com:5432/manuscript_platform';

async function createUser() {
  const client = new Client({ 
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL\n');

    const email = 'scarter4work@yahoo.com';
    const fullName = 'S Carter';
    const password = process.argv[2] || 'password123'; // Default password if not provided
    
    // Check if user already exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('⚠️  User already exists with email:', email);
      console.log('   User ID:', existing.rows[0].id);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Generate user ID
    const userId = randomBytes(16).toString('hex');
    
    // Insert user
    await client.query(`
      INSERT INTO users (id, email, password_hash, full_name, created_at, plan, is_active, email_verified)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'free', TRUE, TRUE)
    `, [userId, email, passwordHash, fullName]);

    console.log('✅ User account created successfully!');
    console.log('\nAccount Details:');
    console.log('  Email:', email);
    console.log('  Name:', fullName);
    console.log('  User ID:', userId);
    console.log('  Plan: free');
    console.log('  Password:', password);
    console.log('\n🔐 Login at: https://manuscript-platform.onrender.com/login.html');

  } catch (error) {
    console.error('❌ Failed to create user:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createUser();
