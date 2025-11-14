/**
 * Global Test Setup
 *
 * Runs before all tests to initialize the test environment.
 * Handles database setup, cleanup, and makes test helpers globally available.
 *
 * Usage:
 * - beforeAll: Set up test database and run migrations
 * - beforeEach: Reset database to clean state
 * - afterAll: Teardown test database
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetTestDatabase,
  getTestDb,
} from './test-helpers/database.js';

let testDb = null;

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('\n🧪 Setting up test environment...');

  try {
    // Only initialize database if TEST_DATABASE_URL is set
    if (process.env.TEST_DATABASE_URL) {
      testDb = await setupTestDatabase();
      console.log('✓ Test database initialized');

      // Make test database globally available
      global.testDb = testDb;
    } else {
      console.log('ℹ️  Skipping database setup (TEST_DATABASE_URL not set)');
      console.log('ℹ️  Tests requiring database will be skipped or use mocks');
    }

    console.log('✓ Test environment ready\n');
  } catch (error) {
    console.error('❌ Failed to set up test environment:', error);
    console.error('💡 Ensure PostgreSQL is running at TEST_DATABASE_URL');
    console.error('💡 Current TEST_DATABASE_URL:', process.env.TEST_DATABASE_URL);
    throw error;
  }
}, 60000); // 60 second timeout for setup

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('\n🧹 Tearing down test environment...');

  try {
    if (testDb) {
      await teardownTestDatabase();
      console.log('✓ Test database cleaned up');
    }

    // Clean up globals
    delete global.testDb;

    console.log('✓ Test environment cleaned up\n');
  } catch (error) {
    console.error('❌ Failed to tear down test environment:', error);
    // Don't throw - we're cleaning up
  }
}, 30000); // 30 second timeout for teardown

/**
 * Reset database before each test
 *
 * This ensures each test starts with a clean slate.
 * Much faster than dropping/recreating tables.
 * Only runs if database was initialized.
 */
beforeEach(async () => {
  if (testDb) {
    await resetTestDatabase();
  }
  // No-op if database not initialized (unit tests with mocks only)
}, 30000); // 30 second timeout per test reset (increased for large schemas)

/**
 * Cleanup after each test (optional)
 *
 * Add any per-test cleanup logic here.
 */
afterEach(async () => {
  // Optional: Log test results, cleanup temp files, etc.
});

/**
 * Global error handler for unhandled rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in tests:', reason);
});

/**
 * Graceful shutdown handler
 */
process.on('SIGINT', async () => {
  console.log('\n⚠ Received SIGINT, cleaning up...');
  if (testDb) {
    await teardownTestDatabase();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠ Received SIGTERM, cleaning up...');
  if (testDb) {
    await teardownTestDatabase();
  }
  process.exit(0);
});

/**
 * Export helper for accessing test database in tests
 *
 * Usage:
 *   import { getTestDb } from '../setup.js';
 *   const db = getTestDb();
 */
export { getTestDb };
