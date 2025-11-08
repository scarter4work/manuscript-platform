# Testing Guide - Manuscript Platform

Comprehensive testing infrastructure for the Manuscript Platform on Render. This guide covers unit tests, integration tests, E2E tests, and CI/CD automation.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Infrastructure](#test-infrastructure)
- [Writing Tests](#writing-tests)
- [Test Helpers](#test-helpers)
- [Mock Factories](#mock-factories)
- [Test Data Factories](#test-data-factories)
- [Running Tests](#running-tests)
- [Code Coverage](#code-coverage)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

---

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only

# Interactive test UI
npm run test:ui
```

---

## Test Infrastructure

### Current Status

✅ **Test Infrastructure Complete (Issue #66)** - 2025-11-08
✅ **Authentication Handler Tests Complete (Issue #67)** - 2025-11-08 (57 tests, bcrypt validation)
✅ **Payment & Webhook Handler Tests Complete (Issue #68)** - 2025-11-08 (58 tests, security-critical)
- ✅ 46 tests passing (existing unit tests)
- ✅ Vitest configured with 80% coverage target
- ✅ Test database helpers (PostgreSQL setup/teardown/reset)
- ✅ API client helpers (supertest with authentication flow)
- ✅ Mock factories (storage, Redis, Stripe, Claude, email)
- ✅ Test data factories (20+ factory functions)
- ✅ CI/CD workflow (GitHub Actions with PostgreSQL + Redis)
- ✅ Directory structure created (unit, integration, e2e, fixtures)
- ✅ Dependencies installed (supertest, @vitest/coverage-v8)

### Directory Structure

```
tests/
├── setup.js                    # Global test setup
├── test-helpers/
│   ├── database.js             # Database setup/teardown/reset
│   ├── api-client.js           # Supertest HTTP helpers
│   ├── mocks.js                # Mock factories (storage, Redis, etc.)
│   └── factories.js            # Test data factories
├── unit/                       # Unit tests (no database)
│   └── test-helpers.test.js    # Infrastructure tests (24 tests)
├── integration/                # Integration tests (with database)
├── e2e/                        # End-to-end tests
├── fixtures/                   # Test data fixtures
├── auth-utils.test.js          # Auth utilities (22 tests)
├── error-handling.test.js      # Error handling (24 tests)
├── metadata-handlers.test.js   # Metadata system (21 tests)
├── document-generation.test.js # Query letters (27 tests)
└── submission-packages.test.js # Package bundler (31 tests)
```

### Technology Stack

- **Test Runner**: Vitest (v3.2.4)
- **Coverage**: @vitest/coverage-v8
- **HTTP Testing**: Supertest (v7.1.4)
- **Mocking**: Vitest built-in mocks (`vi`)
- **Database**: PostgreSQL (test database)
- **CI/CD**: GitHub Actions

### Global Setup

The global setup file (`tests/setup.js`) runs before all tests:

- **Database Initialization**: Sets up test database (if `TEST_DATABASE_URL` is set)
- **Database Reset**: Clears all data between tests
- **Teardown**: Cleans up database after all tests

**Note**: Unit tests without database dependencies will run without `TEST_DATABASE_URL` set.

---

## Writing Tests

### Unit Tests

Unit tests test individual functions/modules in isolation **without** database dependencies.

**Location**: `tests/unit/`

**Example**: Testing mock factories

```javascript
// tests/unit/test-helpers.test.js
import { describe, it, expect } from 'vitest';
import { mockStorageAdapter } from '../test-helpers/mocks.js';

describe('Storage Adapter Mock', () => {
  it('should put and get objects', async () => {
    const storage = mockStorageAdapter();
    const bucket = storage.getBucket('test');

    await bucket.put('test-key', Buffer.from('test content'));
    const obj = await bucket.get('test-key');

    expect(obj).toBeTruthy();
    expect(obj.key).toBe('test-key');
  });
});
```

### Integration Tests

Integration tests test API endpoints **with** database interactions.

**Location**: `tests/integration/`

**Example**: Testing an API endpoint with database

```javascript
// tests/integration/handlers/auth-handlers.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../server.js';
import { createTestUser } from '../../test-helpers/factories.js';
import { insertTestData } from '../../test-helpers/database.js';
import { hashPassword } from '../../../src/utils/auth-utils.js';

describe('POST /auth/login', () => {
  let testUser;

  beforeEach(async () => {
    // Create test user in database
    testUser = await insertTestData('users', createTestUser({
      email: 'test@example.com',
      password_hash: await hashPassword('password123'),
    }));
  });

  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.headers['set-cookie']).toBeDefined();
  });
});
```

### E2E Tests

End-to-end tests test complete user workflows.

**Location**: `tests/e2e/`

**Example**: Complete manuscript upload workflow

```javascript
// tests/e2e/user-workflows/manuscript-upload.test.js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../server.js';
import { registerAndLoginUser } from '../../test-helpers/api-client.js';

describe('Manuscript Upload Workflow', () => {
  it('should upload, analyze, and export manuscript', async () => {
    // 1. Register and login
    const { sessionCookie } = await registerAndLoginUser(request(app));

    // 2. Upload manuscript
    const uploadResponse = await request(app)
      .post('/upload/manuscript')
      .set('Cookie', sessionCookie)
      .attach('file', 'tests/fixtures/manuscripts/sample.pdf')
      .field('title', 'Test Manuscript');

    expect(uploadResponse.status).toBe(201);
    const manuscriptId = uploadResponse.body.manuscriptId;

    // 3. Trigger analysis
    const analysisResponse = await request(app)
      .post('/analyze/developmental')
      .set('Cookie', sessionCookie)
      .send({ manuscriptId });

    expect(analysisResponse.status).toBe(200);
  });
});
```

---

## Test Helpers

### Database Helpers

Located in `tests/test-helpers/database.js`:

```javascript
import {
  setupTestDatabase,
  resetTestDatabase,
  query,
  insertTestData,
  countRecords
} from './test-helpers/database.js';

// Setup database (automatic via setup.js)
const db = await setupTestDatabase();

// Reset database (automatic before each test)
await resetTestDatabase();

// Execute raw SQL
const result = await query('SELECT * FROM users WHERE email = $1', ['test@example.com']);

// Insert test data
const user = await insertTestData('users', {
  id: 'user-123',
  email: 'test@example.com',
  password_hash: 'hashed-password',
});

// Count records
const userCount = await countRecords('users');
```

### API Client Helpers

Located in `tests/test-helpers/api-client.js`:

```javascript
import {
  createTestUser,
  registerAndLoginUser,
  loginTestUser,
  createTestManuscript,
  createTestAnalysis
} from './test-helpers/api-client.js';

// Create user in database
const user = await createTestUser({ email: 'test@example.com' });

// Register and login via API
const { userId, sessionCookie } = await registerAndLoginUser(apiClient);

// Login existing user
const { sessionCookie } = await loginTestUser(apiClient, 'test@example.com', 'password123');

// Make authenticated request
const response = await request(app)
  .get('/manuscripts')
  .set('Cookie', sessionCookie);
```

---

## Mock Factories

Located in `tests/test-helpers/mocks.js`:

### Storage Adapter Mock (Backblaze B2)

```javascript
import { mockStorageAdapter } from './test-helpers/mocks.js';

const storage = mockStorageAdapter();
const bucket = storage.getBucket('manuscripts_raw');

// Put object
await bucket.put('manuscripts/user1/file.pdf', Buffer.from('content'));

// Get object
const obj = await bucket.get('manuscripts/user1/file.pdf');

// Delete object
await bucket.delete('manuscripts/user1/file.pdf');

// List objects by prefix
const result = await bucket.list({ prefix: 'manuscripts/user1/' });

// Assert on mock calls
expect(bucket.put).toHaveBeenCalledWith('manuscripts/user1/file.pdf', expect.any(Buffer));
```

### Redis Mock

```javascript
import { mockRedis } from './test-helpers/mocks.js';

const redis = mockRedis();

// Set/get values
await redis.set('key', 'value');
const value = await redis.get('key');

// Set with expiration (seconds)
await redis.setEx('session:123', 3600, 'session-data');

// Delete keys
await redis.del('key');

// Increment counters
await redis.incr('counter');
```

### Claude API Mock

```javascript
import { mockClaudeAPI, setClaudeResponse } from './test-helpers/mocks.js';

// Create mock with default response
const claude = mockClaudeAPI({
  responseText: 'Custom AI response',
  inputTokens: 100,
  outputTokens: 200
});

// Make API call
const response = await claude.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  messages: [{ role: 'user', content: 'Analyze this manuscript...' }],
});

// Assert response
expect(response.content[0].text).toBe('Custom AI response');
expect(response.usage.input_tokens).toBe(100);

// Set custom response for next call
setClaudeResponse(claude, 'Specific test response', 150, 250);
```

### Email Service Mock (Resend)

```javascript
import { mockEmailService } from './test-helpers/mocks.js';

const emailService = mockEmailService();

// Send email
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Test Email',
  html: '<p>Content</p>',
});

// Get all sent emails
const sentEmails = emailService.getSentEmails();
expect(sentEmails).toHaveLength(1);

// Find specific email
const email = emailService.findEmailTo('user@example.com');
expect(email.subject).toBe('Test Email');

// Find emails by type
const verificationEmails = emailService.findEmailsByType('verification');

// Clear sent emails
emailService.clearSentEmails();
```

### Stripe Mock

```javascript
import { mockStripe, simulateStripeWebhook } from './test-helpers/mocks.js';

const stripe = mockStripe();

// Create checkout session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  customer_email: 'user@example.com',
  line_items: [{ price: 'price_123', quantity: 1 }],
});

expect(session.id).toMatch(/^cs_test_/);
expect(session.url).toBeTruthy();

// Create payment intent
const payment = await stripe.paymentIntents.create({
  amount: 2999,
  currency: 'usd',
});

// Simulate webhook event
const event = simulateStripeWebhook(stripe, 'checkout.session.completed', {
  id: session.id,
  payment_status: 'paid',
});
```

---

## Test Data Factories

Located in `tests/test-helpers/factories.js`:

### User Factory

```javascript
import {
  createTestUser,
  createTestPublisher,
  createTestReader
} from './test-helpers/factories.js';

// Create author with defaults
const user = createTestUser();

// Create with overrides
const publisher = createTestPublisher({
  email: 'publisher@example.com',
  full_name: 'Test Publisher',
  plan: 'premium',
});

// Create reader
const reader = createTestReader();
```

### Manuscript Factory

```javascript
import {
  createTestManuscript,
  createTestManuscriptWithGenre
} from './test-helpers/factories.js';

// Create manuscript
const manuscript = createTestManuscript('user-123');

// Create with specific genre
const fantasyManuscript = createTestManuscriptWithGenre('user-123', 'fantasy');

// Custom manuscript
const customManuscript = createTestManuscript('user-123', {
  title: 'Custom Title',
  word_count: 100000,
  status: 'analyzed',
});
```

### Other Factories

```javascript
import {
  createTestAnalysis,
  createTestDevelopmentalAnalysis,
  createTestPayment,
  createTestPaymentForService,
  createTestSubmission,
  createTestDocument,
  createTestQueryLetter,
  createTestPackage,
  generateTestEmail,
  generateTestId,
} from './test-helpers/factories.js';

// Analysis
const analysis = createTestAnalysis('manuscript-123');
const devAnalysis = createTestDevelopmentalAnalysis('manuscript-123');

// Payment
const payment = createTestPayment('user-123', { amount: 2999 });
const subscriptionPayment = createTestPaymentForService('user-123', 'subscription_monthly');

// Submission
const submission = createTestSubmission('manuscript-123', 'publisher-123');

// Document
const queryLetter = createTestQueryLetter('manuscript-123');
const document = createTestDocument('manuscript-123', 'short_synopsis');

// Package
const package = createTestPackage('manuscript-123', { package_type: 'query_only' });

// Utilities
const email = generateTestEmail('author'); // author-1730922345678-a3b2c1d4@example.com
const id = generateTestId(); // 32-character hex string
```

---

## Running Tests

### Command Reference

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run interactive UI
npm run test:ui

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only

# Run specific test file
npm test tests/unit/test-helpers.test.js

# Run tests matching pattern
npm test -- --grep="Authentication"
```

### Environment Variables

```bash
# Test database (optional for unit tests, required for integration tests)
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/manuscript_platform_test

# Redis (optional, uses mock if not set)
export REDIS_URL=redis://localhost:6379

# Node environment
export NODE_ENV=test
```

**Note**: Unit tests will run without `TEST_DATABASE_URL` set. The setup will automatically skip database initialization.

---

## Code Coverage

### Coverage Configuration

Vitest is configured to target **80% branch coverage** (see `vitest.config.js`):

```javascript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  branches: 80,
  functions: 80,
  lines: 80,
  statements: 80,
}
```

### Generate Coverage Report

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/index.html  # macOS
start coverage/index.html # Windows
xdg-open coverage/index.html # Linux
```

### Coverage Reports

- **Text**: Console output with summary
- **HTML**: `coverage/index.html` (interactive browser view)
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info` (for CI/CD tools like Codecov)

---

## CI/CD Integration

### GitHub Actions

Workflow: `.github/workflows/test.yml`

**Triggered on**:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

**Jobs**:
1. **test**: Run unit + integration tests with coverage
2. **e2e**: Run end-to-end tests
3. **test-matrix**: Test on Node 20, 22, 23 (main branch only)

**Services**:
- PostgreSQL 15 (test database)
- Redis 7 (cache)

**Features**:
- Linting check
- Test execution with coverage
- Automatic coverage upload to Codecov
- PR comment with coverage diff

---

## Best Practices

### 1. Use Factories, Not Inline Data

```javascript
// ❌ Bad: Inline data (hard to maintain)
const user = {
  id: 'user-123',
  email: 'test@example.com',
  password_hash: '$2a$10$...',
  // ... 10 more fields
};

// ✅ Good: Use factory
const user = createTestUser({ email: 'test@example.com' });
```

### 2. Mock External Services

```javascript
// ✅ Always mock storage, Redis, Stripe, Claude API
const storage = mockStorageAdapter();
const redis = mockRedis();
const stripe = mockStripe();
const claude = mockClaudeAPI();
```

### 3. Test Error Cases

```javascript
it('should handle missing required fields', async () => {
  const response = await request(app)
    .post('/auth/register')
    .send({ email: 'test@example.com' }); // Missing password

  expect(response.status).toBe(400);
  expect(response.body.error).toBeDefined();
});
```

### 4. Use Arrange-Act-Assert Pattern

```javascript
it('should create user with valid data', async () => {
  // Arrange: Set up test data
  const userData = createTestUser({ email: 'test@example.com' });

  // Act: Execute the function
  const user = await createUser(userData);

  // Assert: Verify the result
  expect(user.id).toBeTruthy();
  expect(user.email).toBe('test@example.com');
});
```

### 5. Keep Tests Isolated

Each test should be independent and not rely on other tests.

```javascript
// ✅ Good: Each test uses unique data
it('test 1', () => {
  const user = createTestUser(); // Unique ID generated
});

it('test 2', () => {
  const user = createTestUser(); // Different unique ID
});
```

---

## Coverage Goals

**Current Status**: 149 tests passing

**Target**: 80% branch coverage

**Priority**:
1. ✅ Test infrastructure (COMPLETE - Issue #66)
2. 🔲 Authentication handlers (Issue #67)
3. 🔲 Payment & webhook handlers (Issue #68)
4. 🔲 File upload handlers
5. 🔲 MVP feature handlers

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [PostgreSQL Testing](https://www.postgresql.org/docs/current/regress.html)
- [GitHub Actions CI/CD](https://docs.github.com/en/actions)

---

**Last Updated**: 2025-11-06
**Issue**: #66 - Test Infrastructure Setup
**Test Suite Version**: v2.0 (Render Migration)
**Total Tests**: 149 passing
