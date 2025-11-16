/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data:
 * - Users (authors, publishers, admins)
 * - Manuscripts
 * - Payments and subscriptions
 * - Submissions and packages
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate a unique test email
 * @param {string} prefix - Email prefix (default: 'test')
 * @returns {string} Unique email address
 */
export function generateTestEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@example.com`;
}

/**
 * Generate a unique ID
 * @returns {string} UUID-like ID
 */
export function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Alias for generateId (for backwards compatibility)
 * @returns {string} UUID-like ID
 */
export function generateTestId() {
  return generateId();
}

/**
 * Create test user data (and optionally insert into database)
 *
 * BACKWARDS COMPATIBLE: Accepts either (overrides) or (db, overrides)
 * - If called with db client: creates user data AND inserts into database
 * - If called without db: just returns user data
 *
 * @param {object} dbOrOverrides - Database client OR overrides object
 * @param {object} overrides - Override default values (if first param is db)
 * @returns {Promise<object>|object} User record
 */
export async function createTestUser(dbOrOverrides = {}, overrides = {}) {
  // Detect if first param is a database client
  const isDbClient = dbOrOverrides && typeof dbOrOverrides.query === 'function';
  const actualOverrides = isDbClient ? overrides : dbOrOverrides;

  const now = new Date().toISOString();

  const userData = {
    id: generateId(),
    email: generateTestEmail(),
    password_hash: '$2a$10$MOCKED_HASH', // Mock bcrypt hash
    role: 'author',
    email_verified: true,
    created_at: now,
    last_login: null,
    stripe_customer_id: null,
    ...actualOverrides
  };

  // If database client was provided, insert the user
  if (isDbClient) {
    const { insertTestRecord } = await import('./database.js');
    await insertTestRecord('users', userData);
  }

  return userData;
}

/**
 * Create test user with hashed password
 *
 * @param {object} options - User options
 * @param {string} options.email - User email
 * @param {string} options.password - Plain text password
 * @param {string} options.role - User role
 * @returns {Promise<object>} User record with bcrypt-hashed password
 */
export async function createTestUserWithPassword({ email, password, role = 'author', ...overrides }) {
  const password_hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  return {
    id: generateId(),
    email: email || generateTestEmail(),
    password_hash,
    role,
    email_verified: true,
    created_at: now,
    last_login: null,
    stripe_customer_id: null,
    ...overrides
  };
}

/**
 * Create test manuscript data
 *
 * @param {string} userId - User ID who owns the manuscript
 * @param {object} overrides - Override default values
 * @returns {object} Manuscript record
 */
export function createTestManuscript(userId, overrides = {}) {
  const now = new Date().toISOString();
  const id = generateId();

  return {
    id,
    user_id: userId,
    title: `Test Manuscript ${id.slice(0, 8)}`,
    r2_key: `manuscripts/raw/${id}.txt`, // Matches schema column name
    file_hash: crypto.randomBytes(32).toString('hex'), // Matches schema column name
    status: 'draft',
    genre: 'fiction',
    word_count: 85000,
    file_type: 'txt',
    metadata: null,
    uploaded_at: now,
    flagged_for_review: 0,
    ...overrides
  };
}

/**
 * Create test subscription data
 *
 * @param {string} userId - User ID
 * @param {object} overrides - Override default values
 * @returns {object} Subscription record
 */
export function createTestSubscription(userId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    user_id: userId,
    plan_type: 'free',
    status: 'active',
    stripe_subscription_id: null,
    stripe_price_id: null,
    current_period_start: now,
    current_period_end: now + 2592000, // +30 days
    cancel_at_period_end: false,
    created_at: now,
    updated_at: now,
    ...overrides,
    // Ensure stripe_customer_id is never null (required by schema)
    stripe_customer_id: overrides.stripe_customer_id || 'cus_test_' + generateId().substring(0, 8)
  };
}

/**
 * Create test payment data
 *
 * @param {string} userId - User ID
 * @param {object} overrides - Override default values
 * @returns {object} Payment record
 */
export function createTestPayment(userId, overrides = {}) {
  const now = new Date().toISOString();

  const stripePaymentId = `pi_${crypto.randomBytes(12).toString('hex')}`;

  return {
    id: generateId(),
    user_id: userId,
    amount: 2999, // $29.99
    currency: 'usd',
    status: 'succeeded',
    stripe_payment_intent_id: stripePaymentId,
    stripe_invoice_id: `in_${crypto.randomBytes(12).toString('hex')}`,
    payment_type: 'one_time',
    description: 'Freelancer Plan - Monthly',
    created_at: now,
    ...overrides
  };
}

/**
 * Create test verification token data
 *
 * @param {string} userId - User ID
 * @param {object} overrides - Override default values
 * @returns {object} Verification token record
 */
export function createTestVerificationToken(userId, overrides = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // +24 hours

  return {
    user_id: userId,
    token: crypto.randomBytes(32).toString('hex'),
    token_type: 'email_verification',
    used: false, // PostgreSQL BOOLEAN
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
    ...overrides
  };
}

/**
 * Create test supporting document data (query letter, synopsis)
 *
 * @param {string} manuscriptId - Manuscript ID
 * @param {object} overrides - Override default values
 * @returns {object} Supporting document record
 */
export function createTestDocument(manuscriptId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    manuscript_id: manuscriptId,
    document_type: 'query_letter',
    title: 'Query Letter v1',
    content: 'Dear Agent, I am seeking representation for my novel...',
    word_count: 350,
    version: 1,
    is_current_version: true,
    created_at: now,
    ...overrides
  };
}

/**
 * Create test submission package data
 *
 * @param {string} manuscriptId - Manuscript ID
 * @param {object} overrides - Override default values
 * @returns {object} Submission package record
 */
export function createTestPackage(manuscriptId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    manuscript_id: manuscriptId,
    package_name: 'Agent Query Package',
    package_type: 'agent_query',
    status: 'draft',
    document_order: null,
    created_at: now,
    ...overrides
  };
}

/**
 * Create test submission data
 *
 * @param {string} manuscriptId - Manuscript ID
 * @param {object} overrides - Override default values
 * @returns {object} Submission record
 */
export function createTestSubmission(manuscriptId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    manuscript_id: manuscriptId,
    publisher_name: 'Test Publishing House',
    publisher_email: 'submissions@testpub.com',
    submission_type: 'query',
    submitted_at: now,
    status: 'pending',
    response_date: null,
    response_type: null,
    created_at: now,
    ...overrides
  };
}

/**
 * Create test feedback data
 *
 * @param {string} submissionId - Submission ID
 * @param {object} overrides - Override default values
 * @returns {object} Feedback record
 */
export function createTestFeedback(submissionId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    submission_id: submissionId,
    feedback_category: 'plot',
    feedback_text: 'The plot structure needs more tension in the second act.',
    is_addressed: false,
    created_at: now,
    ...overrides
  };
}

/**
 * Create test marketing kit data
 *
 * @param {string} manuscriptId - Manuscript ID
 * @param {object} overrides - Override default values
 * @returns {object} Marketing kit record
 */
export function createTestMarketingKit(manuscriptId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    manuscript_id: manuscriptId,
    status: 'completed',
    generation_cost: 0.15,
    created_at: now,
    ...overrides
  };
}

/**
 * Create test social media post data
 *
 * @param {string} kitId - Marketing kit ID
 * @param {object} overrides - Override default values
 * @returns {object} Social media post record
 */
export function createTestSocialPost(kitId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    kit_id: kitId,
    platform: 'twitter',
    post_type: 'announcement',
    post_text: 'Excited to announce my new novel coming soon!',
    hashtags: JSON.stringify(['amwriting', 'booklaunch']),
    engagement_hook: 'Have you ever wondered what happens when...',
    optimal_posting_time: 'weekday_morning',
    character_count: 52,
    used: false,
    created_at: now,
    ...overrides
  };
}

/**
 * Create test audit log entry
 *
 * @param {string} userId - User ID
 * @param {object} overrides - Override default values
 * @returns {object} Audit log record
 */
export function createTestAuditLog(userId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    user_id: userId,
    event_type: 'login',
    event_details: JSON.stringify({ ip: '127.0.0.1', user_agent: 'test' }),
    ip_address: '127.0.0.1',
    created_at: now,
    ...overrides
  };
}

/**
 * Create test usage tracking data
 *
 * @param {string} userId - User ID
 * @param {object} overrides - Override default values
 * @returns {object} Usage tracking record
 */
export function createTestUsageTracking(userId, overrides = {}) {
  const now = new Date().toISOString();
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  return {
    id: generateId(),
    user_id: userId,
    period_start: Math.floor(firstOfMonth.getTime() / 1000),
    period_end: Math.floor(firstOfMonth.getTime() / 1000) + 2592000, // +30 days
    manuscripts_analyzed: 0,
    marketing_kits_generated: 0,
    kdp_packages_generated: 0,
    query_letters_generated: 0,
    created_at: now,
    ...overrides
  };
}

/**
 * Create a complete test user with all related records
 *
 * @param {object} options - User options
 * @returns {Promise<object>} Object with user, subscription, and usage tracking
 */
export async function createCompleteTestUser(options = {}) {
  const user = await createTestUserWithPassword({
    email: generateTestEmail(),
    password: 'TestPass123!',
    role: 'author',
    ...options
  });

  const subscription = createTestSubscription(user.id, {
    plan_type: options.plan_type || options.plan || 'free'
  });

  const usageTracking = createTestUsageTracking(user.id);

  return {
    user,
    subscription,
    usageTracking
  };
}

/**
 * Create a complete test manuscript with supporting documents
 *
 * @param {string} userId - User ID
 * @param {object} options - Manuscript options
 * @returns {object} Object with manuscript, documents, and package
 */
export function createCompleteTestManuscript(userId, options = {}) {
  const manuscript = createTestManuscript(userId, options);

  const queryLetter = createTestDocument(manuscript.id, {
    document_type: 'query_letter',
    title: 'Query Letter v1',
    word_count: 350
  });

  const shortSynopsis = createTestDocument(manuscript.id, {
    document_type: 'short_synopsis',
    title: 'Short Synopsis',
    word_count: 500
  });

  const longSynopsis = createTestDocument(manuscript.id, {
    document_type: 'long_synopsis',
    title: 'Long Synopsis',
    word_count: 2500
  });

  const submissionPackage = createTestPackage(manuscript.id, {
    package_type: 'agent_query',
    status: 'draft'
  });

  return {
    manuscript,
    documents: {
      queryLetter,
      shortSynopsis,
      longSynopsis
    },
    package: submissionPackage
  };
}

/**
 * Create a complete test submission with feedback
 *
 * @param {string} manuscriptId - Manuscript ID
 * @param {object} options - Submission options
 * @returns {object} Object with submission and feedback
 */
export function createCompleteTestSubmission(manuscriptId, options = {}) {
  const submission = createTestSubmission(manuscriptId, options);

  const feedback = [
    createTestFeedback(submission.id, {
      feedback_category: 'plot',
      feedback_text: 'Strong opening but pacing slows in middle.'
    }),
    createTestFeedback(submission.id, {
      feedback_category: 'character',
      feedback_text: 'Protagonist needs more distinct voice.'
    })
  ];

  return {
    submission,
    feedback
  };
}

/**
 * Create test analysis data
 *
 * @param {string} manuscriptId - Manuscript ID
 * @param {object} overrides - Override default values
 * @returns {object} Analysis record
 */
export function createTestAnalysis(manuscriptId, overrides = {}) {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    manuscript_id: manuscriptId,
    analysis_type: 'developmental',
    status: 'completed',
    tokens_used: 15000,
    cost: 0.45,
    result: JSON.stringify({
      overall_assessment: 'Strong opening with compelling characters. Consider tightening the middle section.',
      strengths: [
        'Engaging protagonist with clear motivation',
        'Well-paced opening chapters',
        'Strong dialogue that reveals character'
      ],
      weaknesses: [
        'Middle section lacks tension',
        'Secondary characters need development',
        'Some plot threads remain unresolved'
      ]
    }),
    created_at: now,
    completed_at: now,
    ...overrides
  };
}

/**
 * Export aliases for backward compatibility with test imports
 */
export const createVerificationToken = createTestVerificationToken;
