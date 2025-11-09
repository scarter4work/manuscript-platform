/**
 * Test Database Utilities
 *
 * Provides utilities for managing PostgreSQL test database:
 * - Setup/teardown database connections
 * - Run migrations
 * - Reset database state between tests
 * - Insert test data
 */

import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDatabaseAdapter } from '../../src/adapters/database-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testDb = null;
let testDbAdapter = null;

/**
 * Set up test database connection and run migrations
 */
export async function setupTestDatabase() {
  const connectionString = process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/manuscript_platform_test';

  testDb = new Client({
    connectionString,
    ssl: false
  });

  await testDb.connect();
  console.log('✓ Test database connected');

  // Skip migrations - base schema already applied
  console.log('ℹ Skipping migrations (base schema already applied)');

  // Create D1-compatible database adapter for handlers
  testDbAdapter = createDatabaseAdapter({ DATABASE_URL: connectionString });
  console.log('✓ Database adapter created (D1-compatible interface)');

  return testDb;
}

/**
 * Tear down test database (drop all tables and close connection)
 */
export async function teardownTestDatabase() {
  if (!testDb) return;

  try {
    // Drop all tables in public schema
    await testDb.query('DROP SCHEMA public CASCADE');
    await testDb.query('CREATE SCHEMA public');
    await testDb.query('GRANT ALL ON SCHEMA public TO postgres');
    await testDb.query('GRANT ALL ON SCHEMA public TO public');

    console.log('✓ Test database cleaned');
  } catch (error) {
    console.error('Error cleaning test database:', error);
  } finally {
    // Close database adapter connection pool
    if (testDbAdapter) {
      await testDbAdapter.close();
      testDbAdapter = null;
      console.log('✓ Database adapter closed');
    }

    // Close test database client
    await testDb.end();
    testDb = null;
    console.log('✓ Test database disconnected');
  }
}

/**
 * Reset test database (truncate all tables, reset sequences)
 */
export async function resetTestDatabase() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }

  try {
    // Get all table names (excluding system tables)
    const result = await testDb.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tables = result.rows.map(row => row.tablename);

    if (tables.length === 0) {
      console.warn('No tables found to reset');
      return;
    }

    // Truncate all tables and reset sequences
    await testDb.query(`
      TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE
    `);

    // console.log(`✓ Reset ${tables.length} tables`);
  } catch (error) {
    console.error('Error resetting test database:', error);
    throw error;
  }
}

/**
 * Run all migration files in order
 */
async function runMigrations(db) {
  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Migrations are numbered, so alphabetical sort works

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');

      try {
        // Split by semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          await db.query(statement);
        }

        // console.log(`  ✓ Applied ${file}`);
      } catch (error) {
        // Some migrations might fail if tables already exist (idempotent migrations)
        // Only log errors that aren't "already exists" errors
        if (!error.message.includes('already exists')) {
          console.error(`  ✗ Error in ${file}:`, error.message);
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

/**
 * Insert a test record into the database
 * @param {string} table - Table name
 * @param {object} data - Record data
 * @returns {object} Inserted record
 */
export async function insertTestRecord(table, data) {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await testDb.query(query, values);
  return result.rows[0];
}

/**
 * Find a record in the database
 * @param {string} table - Table name
 * @param {object} conditions - WHERE conditions
 * @returns {object|null} Found record or null
 */
export async function findTestRecord(table, conditions) {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');

  const query = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;
  const result = await testDb.query(query, values);

  return result.rows[0] || null;
}

/**
 * Count records in a table
 * @param {string} table - Table name
 * @param {object} conditions - WHERE conditions (optional)
 * @returns {number} Record count
 */
export async function countTestRecords(table, conditions = {}) {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  const keys = Object.keys(conditions);
  const values = Object.values(conditions);

  let query = `SELECT COUNT(*) as count FROM ${table}`;

  if (keys.length > 0) {
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    query += ` WHERE ${whereClause}`;
  }

  const result = await testDb.query(query, values);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get the test database client
 * @returns {Client} PostgreSQL client
 */
export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

/**
 * Get the test database adapter (D1-compatible interface)
 * @returns {DatabaseAdapter} D1-compatible adapter for handlers
 */
export function getTestDbAdapter() {
  if (!testDbAdapter) {
    throw new Error('Test database adapter not initialized. Call setupTestDatabase() first.');
  }
  return testDbAdapter;
}

/**
 * Execute a raw SQL query on the test database
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {object} Query result
 */
export async function queryTestDb(sql, params = []) {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }
  return testDb.query(sql, params);
}
