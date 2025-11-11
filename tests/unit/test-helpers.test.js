/**
 * Test Helper Infrastructure Tests
 *
 * Verifies that the test infrastructure is properly set up:
 * - Mock factories work correctly
 * - Test data factories generate valid data
 * - Database helpers are functional
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockStorageAdapter,
  mockRedis,
  mockClaudeAPI,
  mockEmailService,
  mockStripe,
} from '../test-helpers/mocks.js';
import {
  createTestUser,
  createTestManuscript,
  createTestAnalysis,
  createTestPayment,
  generateTestEmail,
  generateTestId,
} from '../test-helpers/factories.js';

describe('Mock Factories', () => {
  describe('Storage Adapter Mock', () => {
    it('should put and get objects', async () => {
      const storage = mockStorageAdapter();
      const bucket = storage.getBucket('test');

      await bucket.put('test-key', Buffer.from('test content'));
      const obj = await bucket.get('test-key');

      expect(obj).toBeTruthy();
      expect(obj.key).toBe('test-key');
      expect(obj.size).toBeGreaterThan(0);
    });

    it('should delete objects', async () => {
      const storage = mockStorageAdapter();
      const bucket = storage.getBucket('test');

      await bucket.put('test-key', Buffer.from('test content'));
      await bucket.delete('test-key');

      const obj = await bucket.get('test-key');
      expect(obj).toBeNull();
    });

    it('should list objects by prefix', async () => {
      const storage = mockStorageAdapter();
      const bucket = storage.getBucket('test');

      await bucket.put('manuscripts/user1/file1.pdf', Buffer.from('content1'));
      await bucket.put('manuscripts/user1/file2.pdf', Buffer.from('content2'));
      await bucket.put('manuscripts/user2/file3.pdf', Buffer.from('content3'));

      const result = await bucket.list({ prefix: 'manuscripts/user1/' });

      expect(result.objects).toHaveLength(2);
      expect(result.objects[0].key).toContain('user1');
    });
  });

  describe('Redis Mock', () => {
    it('should set and get values', async () => {
      const redis = mockRedis();

      await redis.set('test-key', 'test-value');
      const value = await redis.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should set values with expiration', async () => {
      const redis = mockRedis();

      await redis.setEx('test-key', 60, 'test-value');
      const value = await redis.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should delete keys', async () => {
      const redis = mockRedis();

      await redis.set('test-key', 'test-value');
      const deleted = await redis.del('test-key');

      expect(deleted).toBe(1);

      const value = await redis.get('test-key');
      expect(value).toBeNull();
    });

    it('should increment values', async () => {
      const redis = mockRedis();

      await redis.set('counter', '5');
      const newValue = await redis.incr('counter');

      expect(newValue).toBe(6);
    });
  });

  describe('Claude API Mock', () => {
    it('should return mock AI responses', async () => {
      const claude = mockClaudeAPI();

      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test prompt' }],
      });

      expect(response.content).toBeDefined();
      expect(response.content[0].text).toBeTruthy();
      expect(response.usage).toBeDefined();
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);
    });

    it('should include custom response text', async () => {
      const claude = mockClaudeAPI({ responseText: 'Custom AI response' });

      const response = await claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Test prompt' }],
      });

      expect(response.content[0].text).toBe('Custom AI response');
    });
  });

  describe('Email Service Mock', () => {
    it('should track sent emails', async () => {
      const emailService = mockEmailService();

      await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      const sentEmails = emailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe('test@example.com');
      expect(sentEmails[0].subject).toBe('Test Email');
    });

    it('should find emails by recipient', async () => {
      const emailService = mockEmailService();

      await emailService.sendEmail({
        to: 'user1@example.com',
        subject: 'Email 1',
        html: '<p>Content 1</p>',
      });

      await emailService.sendEmail({
        to: 'user2@example.com',
        subject: 'Email 2',
        html: '<p>Content 2</p>',
      });

      const email = emailService.findEmailTo('user1@example.com');
      expect(email).toBeTruthy();
      expect(email.subject).toBe('Email 1');
    });

    it('should clear sent emails', async () => {
      const emailService = mockEmailService();

      await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      emailService.clearSentEmails();

      const sentEmails = emailService.getSentEmails();
      expect(sentEmails).toHaveLength(0);
    });
  });

  describe('Stripe Mock', () => {
    it('should create checkout sessions', async () => {
      const stripe = mockStripe();

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: 'test@example.com',
        line_items: [{ price: 'price_123', quantity: 1 }],
      });

      expect(session.id).toMatch(/^cs_test_/);
      expect(session.url).toBeTruthy();
      expect(session.customer_email).toBe('test@example.com');
    });

    it('should create payment intents', async () => {
      const stripe = mockStripe();

      const payment = await stripe.paymentIntents.create({
        amount: 2999,
        currency: 'usd',
      });

      expect(payment.id).toMatch(/^pi_test_/);
      expect(payment.amount).toBe(2999);
      expect(payment.currency).toBe('usd');
    });

    it('should construct webhook events', () => {
      const stripe = mockStripe();

      const event = stripe.webhooks.constructEvent(
        JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_123' } },
        }),
        'test-signature',
        'test-secret'
      );

      expect(event.type).toBe('checkout.session.completed');
      expect(event.data.object.id).toBe('cs_123');
    });
  });
});

describe('Test Data Factories', () => {
  describe('User Factory', () => {
    it('should create valid user data', async () => {
      const user = await createTestUser();

      expect(user.id).toBeTruthy();
      expect(user.email).toMatch(/@example\.com$/);
      expect(user.password_hash).toBeTruthy();
      expect(user.role).toBe('author');
      expect(user.email_verified).toBe(true);
    });

    it('should accept overrides', async () => {
      const user = await createTestUser({
        email: 'custom@test.com',
        role: 'publisher',
        plan: 'premium',
      });

      expect(user.email).toBe('custom@test.com');
      expect(user.role).toBe('publisher');
      expect(user.plan).toBe('premium');
    });
  });

  describe('Manuscript Factory', () => {
    it('should create valid manuscript data', () => {
      const userId = 'user-123';
      const manuscript = createTestManuscript(userId);

      expect(manuscript.id).toBeTruthy();
      expect(manuscript.user_id).toBe(userId);
      expect(manuscript.report_id).toBeTruthy();
      expect(manuscript.title).toBeTruthy();
      expect(manuscript.genre).toBe('fiction');
      expect(manuscript.word_count).toBeGreaterThan(0);
    });

    it('should accept overrides', () => {
      const userId = 'user-123';
      const manuscript = createTestManuscript(userId, {
        title: 'My Custom Title',
        genre: 'romance',
        word_count: 70000,
      });

      expect(manuscript.title).toBe('My Custom Title');
      expect(manuscript.genre).toBe('romance');
      expect(manuscript.word_count).toBe(70000);
    });
  });

  describe('Analysis Factory', () => {
    it('should create valid analysis data', () => {
      const manuscriptId = 'manuscript-123';
      const analysis = createTestAnalysis(manuscriptId);

      expect(analysis.id).toBeTruthy();
      expect(analysis.manuscript_id).toBe(manuscriptId);
      expect(analysis.analysis_type).toBe('developmental');
      expect(analysis.status).toBe('completed');
      expect(analysis.tokens_used).toBeGreaterThan(0);
      expect(analysis.cost).toBeGreaterThan(0);
    });

    it('should include result JSON', () => {
      const manuscriptId = 'manuscript-123';
      const analysis = createTestAnalysis(manuscriptId);

      const result = JSON.parse(analysis.result);
      expect(result.overall_assessment).toBeTruthy();
      expect(result.strengths).toBeInstanceOf(Array);
      expect(result.weaknesses).toBeInstanceOf(Array);
    });
  });

  describe('Payment Factory', () => {
    it('should create valid payment data', () => {
      const userId = 'user-123';
      const payment = createTestPayment(userId);

      expect(payment.id).toBeTruthy();
      expect(payment.user_id).toBe(userId);
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.currency).toBe('usd');
      expect(payment.status).toBe('succeeded');
      expect(payment.stripe_payment_id).toMatch(/^pi_/);
    });
  });

  describe('Utility Functions', () => {
    it('should generate unique email addresses', () => {
      const email1 = generateTestEmail();
      const email2 = generateTestEmail();

      expect(email1).toMatch(/@example\.com$/);
      expect(email2).toMatch(/@example\.com$/);
      expect(email1).not.toBe(email2);
    });

    it('should generate unique IDs', () => {
      const id1 = generateTestId();
      const id2 = generateTestId();

      expect(id1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(id2).toHaveLength(32);
      expect(id1).not.toBe(id2);
    });
  });
});
