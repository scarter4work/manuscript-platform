# Test Coverage Analysis - Manuscript Publishing Platform

**Date**: 2025-11-06  
**Test Framework**: Vitest  
**Current Status**: 5 test files, 125 tests passing

---

## Executive Summary

The codebase has **minimal test coverage**: only 5 test files covering ~4.7% of the handler suite (5/44 handlers). **44 handler files exist with 0 tests**, including critical authentication and payment flows. **0 integration tests** exist for E2E workflows.

**Risk Level**: **CRITICAL** - Essential production flows (auth, payments, webhooks) are untested.

---

## Section 1: Existing Tests

### Test Files (5 total - 125 tests)

| File | Tests | Coverage | Status |
|------|-------|----------|--------|
| `tests/auth-utils.test.js` | 22 | Password hashing, validation, auth config | ✅ Utility-level |
| `tests/error-handling.test.js` | 24 | Error classes, assertion helpers | ✅ Utility-level |
| `tests/metadata-handlers.test.js` | 21 | Genre validation, content warnings, word counts | ✅ Data-level |
| `tests/document-generation.test.js` | 27 | Query letters, synopses, version management | ✅ Data-level |
| `tests/submission-packages.test.js` | 31 | Package templates, ZIP generation, document ordering | ✅ Data-level |

**Test Characteristics**:
- All tests are **Vitest** using `describe`/`it`/`expect`
- **No mocking**: Tests validate data structures and logic, not HTTP handlers
- **No async/integration tests**: Auth-utils tests are async but isolated (no DB)
- **No request/response testing**: No tests call actual handler functions
- **No database tests**: No D1/PostgreSQL queries tested
- **No API endpoint tests**: No HTTP route testing

---

## Section 2: Untested Handlers (44 files)

### CRITICAL PRIORITY (Core Auth/Payments)

**Risk**: Production-breaking bugs in essential workflows

#### 1. **auth-handlers.js** (862 lines) - 9 endpoints
- `register()` - User registration with email verification
- `login()` - Login with rate limiting (recently fixed bcrypt issue)
- `logout()` - Session destruction
- `getMe()` - Current user info
- `verifyEmail()` - Email confirmation
- `resendVerification()` - Resend verification email
- `passwordResetRequest()` - Start password reset
- `passwordReset()` - Complete password reset
- `verifyResetToken()` - Validate reset token

**What's NOT tested**:
- Registration validation (email uniqueness, password requirements)
- Rate limiting enforcement
- Session cookie handling (httpOnly, secure)
- Email verification flow
- Password reset token validation
- Error handling (duplicate email, invalid token, rate limit exceeded)
- CORS header injection (recently fixed origin bug)
- Redis session storage interaction

**Recent fixes not covered**:
- Fix for `ReferenceError: origin is not defined` (2025-11-05)
- bcrypt migration from PBKDF2
- Redis rate limiting implementation

---

#### 2. **webhook-handlers.js** (200+ lines) - Stripe webhooks
- `handleStripeWebhook()` - Main webhook dispatcher
- Signature verification
- Event routing (payment_intent.succeeded, customer.subscription.updated, etc.)

**What's NOT tested**:
- Stripe signature verification
- Webhook event parsing
- Subscription creation/update flows
- Payment confirmation emails
- Failed payment handling
- Refund processing
- Invalid signature rejection (security critical)

**Security risk**: Unsigned webhooks could trigger false transactions

---

#### 3. **payment-handlers.js** (400+ lines) - Stripe integration
- `createCheckoutSession()` - Subscription checkout
- `createPaymentIntent()` - One-time payment
- `createPortalSession()` - Stripe customer portal
- `getSubscription()` - Subscription status
- `getPaymentHistory()` - User's payment history
- `checkCanUpload()` - Usage limit enforcement
- `trackUsage()` - Record API usage
- `createFreeSubscription()` - Activate free tier

**What's NOT tested**:
- Checkout session creation
- Price lookup from Stripe
- Subscription state transitions
- Usage tracking accuracy
- Free tier activation
- Payment failure handling
- Plan downgrade logic

---

### HIGH PRIORITY (Core Features)

**Risk**: Data corruption, lost user work, unauthorized access

#### 4. **manuscript-handlers.js** (660 lines) - Library management
- `listManuscripts()` - List user's manuscripts
- `getManuscript()` - Get single manuscript
- `updateManuscript()` - Modify metadata
- `deleteManuscript()` - Remove from library
- `reanalyzeManuscript()` - Trigger re-analysis

**What's NOT tested**:
- Access control (user can only see their manuscripts)
- Pagination logic
- Filtering/sorting
- Soft/hard delete
- Re-analysis triggering
- Database query performance

---

#### 5. **submission-response-handlers.js** (661 lines) - Issue #52
- `createSubmission()` - Create submission record
- `listSubmissions()` - List user's submissions
- `getSubmission()` - Get submission details
- `updateSubmissionResponse()` - Record agent response (8 types)
- `createFeedback()` - Add categorized feedback
- `listFeedback()` - Get feedback
- `updateFeedback()` - Mark feedback as addressed
- `createResubmission()` - Handle R&R
- `getFeedbackSummary()` - Aggregate feedback

**What's NOT tested**:
- Response type validation (form rejection, R&R, request full, offer, etc.)
- Feedback categorization (plot, character, pacing, etc.)
- R&R workflow (linking resubmissions to originals)
- Feedback addressing workflow
- Feedback summary calculation
- Data integrity (e.g., can't change response type after adding feedback)

**MVP Feature**: This is Issue #52 (completed but untested)

---

#### 6. **submission-package-handlers.js** (626 lines) - Issue #50
- `createPackage()` - Create package from documents
- `listPackages()` - List packages for manuscript
- `getPackage()` - Get package details
- `updatePackage()` - Modify package
- `deletePackage()` - Remove package
- `downloadPackage()` - Download as ZIP
- `duplicatePackage()` - Clone package
- `getPackageTemplates()` - Return template list

**What's NOT tested**:
- Package template validation
- Document inclusion validation
- ZIP file generation (uses JSZip library)
- File ordering in ZIP
- Download tracking
- Package duplication logic
- Template selection

**MVP Feature**: This is Issue #50 (completed but untested)

---

#### 7. **supporting-documents-handlers.js** - Issue #49
- `generateDocument()` - AI generate query letter or synopsis
- `generateAllDocuments()` - Batch generate all 3 documents
- `listDocuments()` - Get supporting documents
- `getDocument()` - Get single document
- `updateDocument()` - Save new version
- `deleteDocument()` - Remove document
- `getDocumentVersions()` - Version history

**What's NOT tested**:
- Document type validation (query_letter, synopsis_short, synopsis_long)
- Word count validation (250-500, 500w, 2500w)
- Version creation and rollback
- AI generation via Claude API
- Cost tracking for generations
- Document ordering

**MVP Feature**: This is Issue #49 (completed but untested)

---

#### 8. **enhanced-metadata-handlers.js** - Issue #51
- `getGenres()` - Get genre taxonomy
- `getGenre()` - Get specific genre
- `getSubgenres()` - Get subgenres
- `getContentWarnings()` - Get warnings list
- `updateManuscriptMetadata()` - Update metadata
- `validateGenreWordCount()` - Validate word count vs genre
- `getMetadataHistory()` - Get change history

**What's NOT tested**:
- Genre hierarchy (Fiction/Nonfiction with subgenres)
- Content warning categories
- Word count validation rules
- Metadata history tracking
- Concurrent update handling

**MVP Feature**: This is Issue #51 (completed but untested)

---

#### 9. **cover-handlers.js** (678 lines)
- `uploadCover()` - Upload cover image
- `getCover()` - Retrieve cover
- `deleteCover()` - Delete cover
- `getCoverSpecifications()` - Get platform-specific specs
- `calculateSpine()` - Calculate print spine width
- `generateCoverBrief()` - AI generate cover design brief
- `getCoverBrief()` - Retrieve brief
- `generateMidjourneyPrompt()` - Generate AI art prompt
- `getGenreTemplates()` - Get genre-specific templates

**What's NOT tested**:
- Image upload handling (FormData parsing)
- Image validation (dimensions, format)
- Backblaze B2 storage interaction
- Brief generation via Claude API
- Platform specifications accuracy
- Spine width calculation formula

---

### MEDIUM PRIORITY (Extended Features)

**Risk**: Feature failures, reduced functionality

#### 10. **admin-handlers.js** (737 lines)
- User management, admin dashboard, system monitoring

#### 11. **team-handlers.js** (794 lines)
- Team creation, member management, manuscript sharing, activity tracking

#### 12. **audiobook-handlers.js**
- Audiobook asset management

#### 13. **review-handlers.js**
- Review monitoring and sentiment analysis

#### 14. **marketing-handlers.js** (681 lines)
- Marketing asset generation

#### 15. **sales-tracking-handlers.js** (866 lines)
- Sales data tracking and analytics

#### 16. **communication-handlers.js** (855 lines)
- Internal communication system

#### 17. **slush-pile-handlers.js** (728 lines)
- Unagented manuscript management

#### 18. **submission-windows-handlers.js** (755 lines)
- Submission deadline tracking

#### 19. **rights-management-handlers.js** (835 lines)
- Rights and contracts tracking

#### 20. **ai-chat-handlers.js** (753 lines)
- Real-time AI chat interface

#### 21. **competitive-analysis-handlers.js** (987 lines)
- Market analysis tools

#### 22-44. **Other handlers** (23 more files)
- KDP export, publishing, formatting, market analysis, human editor, etc.

---

## Section 3: Untested Generators (11 files)

**Current**: 0 tests for generators

| Generator | Size | Purpose | Status |
|-----------|------|---------|--------|
| `query-letter-generator.js` | ~220 LOC | Generate query letters (Issue #49) | ❌ Untested |
| `synopsis-generator.js` | ~350 LOC | Generate synopses (Issue #49) | ❌ Untested |
| `author-bio-generator.js` | ~150 LOC | Generate author bios (Issue #43) | ❌ Untested |
| `market-analysis-generator.js` | ~300 LOC | Generate market analysis | ❌ Untested |
| `marketing-content-generator.js` | ~200 LOC | Generate marketing copy | ❌ Untested |
| `human-style-editor.js` | ~250 LOC | Human editing agent | ❌ Untested |
| `pdf-generator.js` | ~150 LOC | Generate PDF from manuscript | ❌ Untested |
| `epub-generator.js` | ~150 LOC | Generate EPUB | ❌ Untested |
| `kdp-package-generator.js` | ~180 LOC | Generate KDP metadata | ❌ Untested |
| `annotated-manuscript-generator.js` | ~200 LOC | Add annotations to manuscript | ❌ Untested |
| `report-generator.js` | ~150 LOC | Generate analysis reports | ❌ Untested |

**What's NOT tested**:
- Claude API integration (prompt correctness, token usage)
- Output validation (word counts, format)
- Error handling (API timeouts, malformed responses)
- Cost calculation
- Template rendering

---

## Section 4: Untested Services (9 files)

**Current**: 0 tests for services

| Service | Functions | Purpose | Status |
|---------|-----------|---------|--------|
| `email-service.js` | 20+ | Send emails (verification, payment, notifications) | ❌ Untested |
| `user-notifier.js` | 3 | In-app notifications | ❌ Untested |
| `doc-crawler.js` | 3 | Fetch platform documentation | ❌ Untested |
| `change-analyzer.js` | ~5 | Analyze document changes | ❌ Untested |
| `change-detector.js` | ~5 | Detect changes in content | ❌ Untested |
| `knowledge-updater.js` | 6 | Update agent knowledge base | ❌ Untested |
| `progress-tracker.js` | 5 | Track publishing progress | ❌ Untested |
| `review-analyzer.js` | ~3 | Analyze book reviews | ❌ Untested |
| `auth.js` | 5+ | Core auth utilities | ⚠️ Partially tested (auth-utils only) |

**What's NOT tested**:
- Email sending (SendGrid integration)
- Email template rendering
- Notification creation and delivery
- Error handling (network failures, API errors)
- Rate limiting
- Retry logic
- Database interactions

---

## Section 5: Critical Paths Without Tests

### Authentication Flow (🔴 CRITICAL)
```
User Register → Validation → Hash Password → Create Session → Send Email
                                                              → Email Verification Link
User Login → Rate Limit Check → Verify Password → Create Session → Set Cookie
                                                                   → Return User Data
User Logout → Destroy Session → Clear Cookie
User Password Reset → Verify Token → Hash New Password → Update DB → Send Email
```

**No tests for**:
- Registration validation (email uniqueness, password strength)
- Rate limit enforcement (5 attempts in 15 minutes)
- Session creation and cookie handling
- Email verification link validity (24-hour expiry)
- Password reset token validity (1-hour expiry)
- Concurrent login handling
- Session hijacking prevention

**Impact**: 100% of authentication is untested. Recent bcrypt migration (2025-11-05) was deployed without tests.

---

### Payment & Subscription Flow (🔴 CRITICAL)
```
User Selects Plan → Create Stripe Checkout → Redirect to Stripe
                                              → Stripe Webhook (payment_intent.succeeded)
                                              → Update Subscription
                                              → Send Confirmation Email
                                              → Update Usage Limits
User Cancels → Customer Portal → Stripe Webhook (customer.subscription.deleted)
               → Update Subscription Status
               → Downgrade Usage Limits
```

**No tests for**:
- Checkout session creation
- Stripe webhook signature verification (security critical)
- Payment success/failure handling
- Subscription state transitions
- Usage limit enforcement
- Failed payment retry logic
- Refund handling
- Plan upgrade/downgrade

**Impact**: Financial transactions are untested. Signature verification bypass could lead to unauthorized charges.

---

### File Upload & Storage Flow (🔴 CRITICAL)
```
User Uploads Manuscript → Validate File → Extract Text
                                         → Store in B2
                                         → Create DB Record
                                         → Queue Analysis
Trigger Analysis → Fetch from B2 → Extract Content
                                 → Send to Claude API
                                 → Store Results
                                 → Generate Assets
```

**No tests for**:
- File format validation (PDF, DOCX, TXT, EPUB)
- File size limits
- Backblaze B2 upload/download
- Text extraction accuracy
- Database record creation
- Analysis triggering
- Error recovery (network failures)

---

### Submission & Publishing Workflow (⚠️ HIGH)
```
Create Submission → Select Package → Add Response
                                   → Add Feedback
                                   → Generate Summary

Publish to Platform → Format Preparation → Metadata Generation
                                        → Platform Upload
                                        → Track Progress
```

**No tests for**:
- Submission status transitions
- Response type validation
- Feedback categorization
- Package template application
- ZIP generation and download
- Progress tracking accuracy
- Platform metadata formatting

---

## Section 6: Test Infrastructure Issues

### Missing Test Utilities

**No mocking/stubbing library** for:
- Database queries (D1/PostgreSQL)
- External API calls (Claude, Stripe, SendGrid)
- File operations (Backblaze B2)
- Email sending
- Session storage (Redis)

**Current workaround**: Tests validate logic in isolation without external dependencies.

**Consequence**: Can't test error handling, network failures, API timeouts.

---

### Missing Integration Test Framework

**No tests for**:
- HTTP request/response cycle
- CORS headers
- Authentication middleware
- Error response formatting
- Rate limiting headers
- Request body validation

**Example gap**: No test validates that `POST /auth/register` returns 400 with specific error message when email already exists.

---

### Missing E2E Test Framework

**No tests for**:
- Complete user workflows
- Data flow across multiple handlers
- Database state after operations
- Concurrent request handling
- Session persistence
- File cleanup on errors

---

### Configuration Issues

**Vitest configuration** (`vitest.config.js` - if exists):
- No coverage thresholds set
- No test file patterns enforced
- No setup files for common test utilities
- No database fixtures or factories

---

## Section 7: Test Coverage Gaps Summary

### By Component Type

| Component Type | Total | Tested | Coverage | Priority |
|---|---|---|---|---|
| Handlers | 44 | 0 | 0% | 🔴 CRITICAL |
| Generators | 11 | 0 | 0% | 🟡 HIGH |
| Services | 9 | 0.5 (auth.js partial) | 5.5% | 🟡 HIGH |
| API Endpoints | 100+ | 0 | 0% | 🔴 CRITICAL |
| Database | All | 0 | 0% | 🟡 HIGH |
| E2E Workflows | All | 0 | 0% | 🔴 CRITICAL |

### By Risk Level

| Risk Level | Count | Examples |
|---|---|---|
| 🔴 CRITICAL | 15 | Auth, payments, webhooks, file upload |
| 🟡 HIGH | 20 | Manuscript management, publishing, team |
| 🟢 MEDIUM | 9 | Marketing, reviews, audiobooks |

---

## Section 8: Recommended Test Strategy

### Phase 1: Foundation (Weeks 1-2) - 🔴 CRITICAL

**Priority 1**: Authentication handlers (auth-handlers.js)
- 9 endpoints, 862 lines
- Tests needed: 40-50 test cases
- Estimated effort: 12-16 hours
- Tools: Vitest with mocking library (sinon, testdouble)
- Focus: Registration, login, password reset, email verification

**Priority 2**: Payment handlers + webhooks (payment-handlers.js + webhook-handlers.js)
- 13 endpoints, 600+ lines
- Tests needed: 30-40 test cases
- Estimated effort: 10-14 hours
- Tools: Vitest + Stripe mock library
- Focus: Checkout, webhooks, subscription state

**Subtotal**: ~50 test cases, 22-30 hours

---

### Phase 2: MVP Features (Weeks 3-4) - Issue #49-52

**Priority 3**: Submission handlers (submission-response-handlers.js, submission-package-handlers.js, supporting-documents-handlers.js)
- 20+ endpoints
- Tests needed: 60-80 test cases
- Estimated effort: 18-24 hours
- Focus: Document generation, package bundling, response tracking

**Priority 4**: Enhanced metadata (enhanced-metadata-handlers.js)
- 7 endpoints
- Tests needed: 20-30 test cases
- Estimated effort: 6-8 hours

**Subtotal**: ~100 test cases, 24-32 hours

---

### Phase 3: Extended Features (Weeks 5-6) - 🟡 HIGH

**Priority 5**: Manuscript handlers
**Priority 6**: Cover handlers
**Priority 7**: Team handlers
**Priority 8**: Admin handlers

**Subtotal**: ~120 test cases, 36-48 hours

---

### Phase 4: Integration & E2E (Weeks 7+)

**User registration → login → upload manuscript → analysis → publish workflow**

---

## Section 9: Quick Wins

### Low-effort, high-impact tests

1. **File upload validation** (2-3 hours)
   - File format checks
   - File size limits
   - Error handling

2. **Database query tests** (3-4 hours)
   - Manuscript CRUD
   - User queries
   - Permission checks

3. **Email template tests** (2-3 hours)
   - Email content validation
   - Template variable substitution
   - HTML structure

4. **Rate limiting tests** (2 hours)
   - Redis interactions
   - Rate limit headers
   - Bypass for whitelisted IPs

---

## Section 10: Test Infrastructure Setup

### Recommended Libraries

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",           // Already installed
    "@vitest/coverage-v8": "^3.2.4", // Already installed
    "@testing-library/node": "^1.1.4", // For HTTP testing
    "supertest": "^7.0.0",        // HTTP request testing
    "sinon": "^18.0.0",           // Mocking/stubbing
    "testdouble": "^4.0.0",       // Alternative to sinon
    "faker": "^6.7.0",            // Test data generation
    "@faker-js/faker": "^9.0.0",  // Modern faker
    "factory.ts": "^2.0.0"        // Model factories
  }
}
```

### Vitest Configuration

Create `vitest.config.js`:
```javascript
export default {
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
      ],
      lines: 50,      // Target 50% coverage by year-end
      functions: 50,
      branches: 40,
      statements: 50,
    },
  },
};
```

### Test Utilities Boilerplate

Create `tests/test-helpers.js`:
```javascript
// Mock database
// Mock external APIs (Claude, Stripe, SendGrid)
// Create test request/response objects
// Create database test fixtures
// Create auth tokens
```

---

## Section 11: Affected Issues & Milestones

### MVP Features (Completed but untested)

- **Issue #49**: Query Letters & Synopsis - ✅ Code done, ❌ Tests missing
- **Issue #50**: Submission Package Bundler - ✅ Code done, ❌ Tests missing
- **Issue #51**: Enhanced Metadata System - ✅ Code done, ❌ Tests missing
- **Issue #52**: Submission Response System - ✅ Code done, ❌ Tests missing

### Recent Fixes Not Covered by Tests

- **2025-11-05**: Fixed login `ReferenceError: origin is not defined`
- **2025-11-05**: Migrated rate limiting to Redis (from KV)
- **2025-11-04**: Migrated password hashing to bcrypt (from PBKDF2)

**Risk**: Future changes could reintroduce these bugs undetected.

---

## Section 12: Action Items

### Immediate (This Week)

- [ ] Create `vitest.config.js` with coverage thresholds
- [ ] Create `tests/test-helpers.js` with mocking utilities
- [ ] Add test.ts file for TypeScript support (if adopting TS)
- [ ] Set up code coverage reporting in CI/CD
- [ ] Create GitHub issue #XX: "Implement auth handler tests"

### Short-term (This Month)

- [ ] Write 50+ tests for auth handlers (register, login, password reset)
- [ ] Write 40+ tests for payment handlers + webhooks
- [ ] Write 80+ tests for MVP features (Issues #49-52)
- [ ] Reach 25% code coverage target

### Medium-term (Next Quarter)

- [ ] Write 120+ tests for extended features
- [ ] Implement integration tests (HTTP layer)
- [ ] Implement E2E tests (user workflows)
- [ ] Reach 60%+ code coverage target

---

## Conclusion

**Current State**: Minimal test coverage (5 files, 125 tests) covering utilities only.

**Critical Gaps**: 44 handlers, 11 generators, 9 services completely untested. Authentication, payments, and file uploads lack any automated tests.

**Recommendation**: Begin with Phase 1 (auth + payments) using Vitest + supertest + sinon. Establish test infrastructure and patterns before expanding to full coverage.

**Estimated Timeline**: 12-16 weeks to reach 60% coverage across all critical paths.

---

**Generated**: 2025-11-06  
**Analyst**: Claude Code  
**Status**: Ready for action planning
