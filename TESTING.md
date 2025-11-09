# Testing Guide

This document explains how to set up and run tests for the Manuscript Publishing Platform.

## Overview

The platform uses **Vitest** as the test framework with the following test types:
- **Unit Tests**: Test individual functions in isolation with mocks
- **Integration Tests**: Test API handlers with real database connections
- **E2E Tests**: End-to-end tests of complete user workflows

## Test Statistics

### Issue #67 - Authentication Handler Tests (COMPLETE ✅)
- **File**: `tests/integration/handlers/auth-handlers.test.js` (1266 lines)
- **Test Count**: 56 tests across 8 test suites
- **Coverage Target**: 80%+ branch coverage
- **Test Suites**:
  - POST /auth/register (10 tests)
  - POST /auth/login (12 tests)
  - POST /auth/verify-email (6 tests)
  - POST /auth/request-password-reset (8 tests)
  - POST /auth/reset-password (8 tests)
  - POST /auth/logout (3 tests)
  - GET /auth/me (5 tests)
  - POST /auth/resend-verification (4 tests)

### Issue #68 - Payment & Webhook Handler Tests (PENDING 🚧)
- **File**: `tests/integration/handlers/payment-handlers.test.js` (Not yet created)
- **Test Count**: 60+ tests planned
- **Coverage Target**: 80%+ branch coverage

## Prerequisites

### Required Software

1. **Node.js** (v22.20.0 or higher)
   ```bash
   node --version
   npm --version
   ```

2. **PostgreSQL** (v14 or higher)  
   **REQUIRED FOR INTEGRATION TESTS**
   - **Windows**: Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)
   - **macOS**: `brew install postgresql@14`
   - **Linux**: `sudo apt-get install postgresql-14`

### PostgreSQL Setup for Tests

#### 1. Install PostgreSQL

Download and install PostgreSQL from the official website. During installation:
- Set password for `postgres` superuser (use `password` for local dev)
- Set port to `5432` (default)
- Remember the installation directory

#### 2. Create Test Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create test database
CREATE DATABASE manuscript_platform_test;

# Verify database was created
\l

# Exit psql
\q
```

#### 3. Verify Connection

```bash
psql -U postgres -d manuscript_platform_test -c "SELECT version();"
```

Expected output: PostgreSQL version information

## Environment Variables

### Test Environment Variables

The test suite uses default values if environment variables are not set:

**Default Connection String**:
```
postgresql://postgres:password@localhost:5432/manuscript_platform_test
```

**To override**, set `TEST_DATABASE_URL`:
```bash
export TEST_DATABASE_URL="postgresql://username:password@host:port/database"
```

## Running Tests

### Prerequisites Check
Before running tests, ensure PostgreSQL is running:
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1;"
```

### All Tests
```bash
npm test
```

### Watch Mode (Re-run on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test Suites
```bash
# Integration tests only
npm run test:integration

# Specific test file
npm test -- tests/integration/handlers/auth-handlers.test.js
```

## Test Structure

```
tests/
├── setup.js                      # Global test setup (runs migrations)
├── test-helpers/
│   ├── database.js               # PostgreSQL test utilities
│   ├── factories.js              # Test data factories
│   ├── mocks.js                  # Mock objects (Redis, email)
│   └── stripe-helpers.js         # Stripe webhook signature helpers
├── unit/                         # Unit tests (mocks only)
├── integration/
│   └── handlers/
│       ├── auth-handlers.test.js          # ✅ COMPLETE (56 tests)
│       └── payment-handlers.test.js       # 🚧 PENDING
└── e2e/                          # End-to-end tests
```

## Test Helpers

### Database Utilities
```javascript
import {
  getTestDb,           // Get test database client
  insertTestRecord,    // Insert test data
  findTestRecord,      // Find single record
  countTestRecords     // Count matching records
} from './test-helpers/database.js';
```

### Factories
```javascript
import {
  createTestUser,              // Create test user with bcrypt password
  createVerificationToken,     // Create email/password reset token
} from './test-helpers/factories.js';
```

### Mocks
```javascript
import {
  mockRedis,          // In-memory Redis mock for sessions
} from './test-helpers/mocks.js';

// Mock email service
const mockEmailService = {
  sendEmailVerification: vi.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
};
```

## Troubleshooting

### Error: "Test database not initialized"
**Cause**: PostgreSQL not running or connection failed  
**Solution**:
1. Install PostgreSQL (see Prerequisites section)
2. Ensure PostgreSQL service is running
3. Verify connection: `psql -U postgres -c "SELECT 1;"`
4. Create test database if it doesn't exist
5. Check password matches default (`password`) or set TEST_DATABASE_URL

### Error: "Failed to set up test environment"
**Cause**: PostgreSQL connection refused  
**Solution**:
- Check PostgreSQL is running: `pg_ctl status`
- Verify port 5432 is not blocked by firewall
- Ensure `postgres` user password is `password` (or set TEST_DATABASE_URL)

### Error: "relation does not exist"
**Cause**: Migrations haven't run  
**Solution**:
- `tests/setup.js` automatically runs migrations from `migrations/` directory
- Check for migration SQL syntax errors
- View logs in test output for migration failures

## Current Status

### Completed ✅
- Test infrastructure (setup.js, database utilities, factories, mocks)
- Auth handler tests: 56 tests across 8 suites
- Test documentation (TESTING.md)

### In Progress 🚧
- Payment handler tests (Issue #68)
- Setting up local PostgreSQL for test execution

### Pending ⏳
- Run auth tests with PostgreSQL and verify coverage
- Complete payment handler tests
- Run payment tests and verify coverage
- Document test patterns
- Close Issues #67 and #68

## Notes

**Windows Users**: PostgreSQL installation on Windows requires administrator privileges. Download the installer from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) and follow the installation wizard.

**Alternative**: Use Docker for PostgreSQL:
```bash
docker run --name manuscript-test-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=manuscript_platform_test -p 5432:5432 -d postgres:14
```

Then run tests:
```bash
npm test
```

---

**Last Updated**: 2025-11-08  
**Test Framework**: Vitest 3.2.4  
**Database**: PostgreSQL 14+ (required for integration tests)  
**Node.js**: 22.20.0+
