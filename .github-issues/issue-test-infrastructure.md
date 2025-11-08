# 🧪 Test Infrastructure: Set Up Comprehensive Testing Framework

## Priority: HIGH (Foundation)
**Impact**: Enables 100% branch coverage goal
**Effort**: 8-12 hours (one-time setup)
**Blocks**: All test coverage issues

## Problem

Test infrastructure is minimal. Only 5 test files exist with utility-level tests. Missing:
- Test database fixtures
- HTTP request testing (supertest)
- Mocking framework
- E2E test framework
- Test data factories
- Code coverage reporting

**Current State**:
- ✅ Vitest configured
- ✅ 125 passing tests (auth-utils, error-handling)
- ❌ No handler tests
- ❌ No API integration tests
- ❌ No E2E tests
- ❌ No test coverage reporting
- ❌ No CI/CD test automation

## Required Components

### 1. Test Database

**PostgreSQL Test Database** for integration tests:

```javascript
// tests/test-helpers/database.js
import { Client } from 'pg';

let testDb;

export async function setupTestDatabase() {
  testDb = new Client({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: false
  });

  await testDb.connect();

  // Run migrations
  await runMigrations(testDb);

  return testDb;
}

export async function teardownTestDatabase() {
  await testDb.query('DROP SCHEMA public CASCADE');
  await testDb.query('CREATE SCHEMA public');
  await testDb.end();
}

export async function resetTestDatabase() {
  // Clear all tables, reset sequences
  const tables = ['users', 'manuscripts', 'sessions', 'payment_history'];
  for (const table of tables) {
    await testDb.query(`TRUNCATE TABLE ${table} CASCADE`);
  }
}
```

### 2. HTTP Request Testing

**Supertest** for API endpoint testing:

```bash
npm install --save-dev supertest
```

```javascript
// tests/test-helpers/api-client.js
import request from 'supertest';
import app from '../../server.js';

export const apiClient = request(app);

// Helper to make authenticated requests
export async function authenticatedRequest(method, path, sessionCookie) {
  return apiClient[method](path)
    .set('Cookie', sessionCookie)
    .set('Content-Type', 'application/json');
}

// Helper to register + login a test user
export async function createAuthenticatedUser(email, password) {
  // Register
  await apiClient.post('/auth/register').send({ email, password });

  // Verify email
  const verifyToken = await getVerificationToken(email);
  await apiClient.get(`/auth/verify-email?token=${verifyToken}`);

  // Login
  const response = await apiClient.post('/auth/login').send({ email, password });
  const sessionCookie = response.headers['set-cookie'][0];

  return { email, sessionCookie };
}
```

### 3. Mocking Framework

**Vitest built-in mocks** for external services:

```javascript
// tests/test-helpers/mocks.js
import { vi } from 'vitest';

// Mock Backblaze B2
export function mockStorageAdapter() {
  return {
    getBucket: vi.fn(() => ({
      put: vi.fn().mockResolvedValue({ key: 'test-key' }),
      get: vi.fn().mockResolvedValue({ Body: Buffer.from('test content') }),
      delete: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue({ Contents: [] })
    }))
  };
}

// Mock Redis
export function mockRedis() {
  const store = new Map();
  return {
    get: vi.fn((key) => Promise.resolve(store.get(key))),
    set: vi.fn((key, val) => { store.set(key, val); return Promise.resolve('OK'); }),
    setEx: vi.fn((key, ttl, val) => { store.set(key, val); return Promise.resolve('OK'); }),
    del: vi.fn((key) => { store.delete(key); return Promise.resolve(1); })
  };
}

// Mock Claude API
export function mockClaudeAPI() {
  return vi.fn().mockResolvedValue({
    content: [{ text: 'Mocked AI response' }],
    usage: { input_tokens: 100, output_tokens: 200 }
  });
}

// Mock Email Service
export function mockEmailService() {
  return {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendEmailVerification: vi.fn().mockResolvedValue(true),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true)
  };
}

// Mock Stripe
export function mockStripe() {
  return {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' })
      }
    },
    webhooks: {
      constructEvent: vi.fn((body, sig, secret) => ({ type: 'checkout.session.completed', data: { object: {} } }))
    }
  };
}
```

### 4. Test Data Factories

**Factory functions** for consistent test data:

```javascript
// tests/test-helpers/factories.js
import { randomBytes } from 'crypto';

export function createTestUser(overrides = {}) {
  return {
    id: randomBytes(16).toString('hex'),
    email: `test-${Date.now()}@example.com`,
    password_hash: '$2a$10$MOCKED_HASH',
    role: 'author',
    email_verified: true,
    created_at: Math.floor(Date.now() / 1000),
    ...overrides
  };
}

export function createTestManuscript(userId, overrides = {}) {
  return {
    id: randomBytes(16).toString('hex'),
    user_id: userId,
    title: 'Test Manuscript',
    genre: 'fiction',
    word_count: 85000,
    status: 'uploaded',
    created_at: Math.floor(Date.now() / 1000),
    ...overrides
  };
}

export function createTestPayment(userId, overrides = {}) {
  return {
    id: randomBytes(16).toString('hex'),
    user_id: userId,
    amount: 2999, // $29.99
    currency: 'usd',
    status: 'succeeded',
    stripe_payment_id: `pi_${randomBytes(12).toString('hex')}`,
    created_at: Math.floor(Date.now() / 1000),
    ...overrides
  };
}
```

### 5. Code Coverage Reporting

**Vitest coverage** with c8:

```bash
npm install --save-dev @vitest/coverage-v8
```

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        '**/*.test.js',
        '**/*.config.js'
      ],
      branches: 80, // Target: 80% branch coverage
      functions: 80,
      lines: 80,
      statements: 80
    },
    setupFiles: ['./tests/setup.js']
  }
});
```

### 6. Global Test Setup

```javascript
// tests/setup.js
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './test-helpers/database.js';

let testDb;

// Run once before all tests
beforeAll(async () => {
  testDb = await setupTestDatabase();
});

// Run after all tests
afterAll(async () => {
  await teardownTestDatabase();
});

// Reset database before each test
beforeEach(async () => {
  await resetTestDatabase();
});

// Make test helpers globally available
global.testDb = testDb;
```

## Package Dependencies

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "supertest": "^6.3.3",
    "@testing-library/dom": "^9.3.3",
    "@testing-library/user-event": "^14.5.1"
  }
}
```

## Test Scripts

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:unit": "vitest run --dir tests/unit",
    "test:integration": "vitest run --dir tests/integration",
    "test:e2e": "vitest run --dir tests/e2e"
  }
}
```

## Directory Structure

```
tests/
├── setup.js                    # Global test setup
├── vitest.config.js            # Vitest configuration
├── test-helpers/
│   ├── database.js             # Test database utilities
│   ├── api-client.js           # HTTP request helpers
│   ├── mocks.js                # Mock factories
│   ├── factories.js            # Test data factories
│   └── assertions.js           # Custom assertions
├── unit/
│   ├── utils/                  # Utility function tests
│   ├── services/               # Service tests
│   └── generators/             # Generator tests
├── integration/
│   ├── handlers/               # Handler tests (with DB)
│   └── api/                    # API endpoint tests
├── e2e/
│   ├── user-workflows/         # End-to-end user flows
│   └── admin-workflows/        # Admin workflow tests
└── fixtures/
    ├── manuscripts/            # Sample manuscripts
    ├── images/                 # Test images
    └── data/                   # JSON fixtures
```

## Testing Checklist

- [ ] Set up test PostgreSQL database
- [ ] Configure Vitest with coverage
- [ ] Create test helpers (database, API client)
- [ ] Create mock factories (storage, Redis, Stripe, Claude)
- [ ] Create test data factories (users, manuscripts, payments)
- [ ] Add test scripts to package.json
- [ ] Create directory structure
- [ ] Document testing conventions
- [ ] Set up CI/CD test automation (GitHub Actions)
- [ ] Generate coverage badge

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: manuscript_platform_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm install

      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          TEST_DATABASE_URL: postgresql://postgres:test@localhost:5432/manuscript_platform_test

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Acceptance Criteria

- [ ] Test database setup/teardown works
- [ ] Supertest API requests work
- [ ] All mocks are functional
- [ ] Test data factories create valid records
- [ ] Coverage reporting generates HTML report
- [ ] Tests run in CI/CD
- [ ] Coverage badge displays on README
- [ ] Test scripts documented in README

## Next Steps (After Setup)

1. Issue #66: Write authentication handler tests
2. Issue #67: Write payment handler tests
3. Issue #68: Write file upload handler tests
4. Issue #69: Write MVP feature tests
5. Issue #70: Write integration tests
6. Issue #71: Write E2E tests

## Files to Create

1. `tests/setup.js` (NEW)
2. `tests/test-helpers/database.js` (NEW)
3. `tests/test-helpers/api-client.js` (NEW)
4. `tests/test-helpers/mocks.js` (NEW)
5. `tests/test-helpers/factories.js` (NEW)
6. `vitest.config.js` (UPDATE)
7. `.github/workflows/test.yml` (NEW)

## Related Issues

- Blocks: All test coverage issues (#66-71)
- Enables: 100% branch coverage goal
- Foundation for: CI/CD automation

## References

- Vitest docs: https://vitest.dev/
- Supertest: https://github.com/ladjs/supertest
- Testing Library: https://testing-library.com/