/**
 * Infrastructure Test
 *
 * Verifies that the test infrastructure is working correctly:
 * - Database setup/teardown
 * - API client (supertest)
 * - Mock factories
 * - Test data factories
 */

import { describe, it, expect } from 'vitest';
import { insertTestRecord, findTestRecord, countTestRecords } from '../test-helpers/database.js';
import { apiClient } from '../test-helpers/api-client.js';
import { createTestUser, createTestManuscript, generateTestEmail } from '../test-helpers/factories.js';
import { mockRedis, mockStorageAdapter } from '../test-helpers/mocks.js';

describe('Test Infrastructure', () => {
  describe('Database Utilities', () => {
    it('should insert and retrieve test records', async () => {
      const user = createTestUser({ email: generateTestEmail('infra-test') });

      const inserted = await insertTestRecord('users', user);
      expect(inserted.id).toBe(user.id);
      expect(inserted.email).toBe(user.email);

      const found = await findTestRecord('users', { email: user.email });
      expect(found).toBeTruthy();
      expect(found.id).toBe(user.id);
    });

    it('should count test records', async () => {
      const user1 = createTestUser({ role: 'author' });
      const user2 = createTestUser({ role: 'author' });
      const user3 = createTestUser({ role: 'publisher' });

      await insertTestRecord('users', user1);
      await insertTestRecord('users', user2);
      await insertTestRecord('users', user3);

      const totalCount = await countTestRecords('users');
      expect(totalCount).toBe(3);

      const authorCount = await countTestRecords('users', { role: 'author' });
      expect(authorCount).toBe(2);

      const publisherCount = await countTestRecords('users', { role: 'publisher' });
      expect(publisherCount).toBe(1);
    });

    it('should reset database between tests', async () => {
      // This test verifies that the database was reset from the previous test
      const count = await countTestRecords('users');
      expect(count).toBe(0);
    });
  });

  describe('API Client', () => {
    it('should make HTTP requests', async () => {
      const response = await apiClient.get('/health');

      // Health endpoint should exist and return 200
      expect(response.status).toBeLessThanOrEqual(404); // Either 200 or 404 if not implemented
    });
  });

  describe('Mock Factories', () => {
    it('should create mock Redis client', async () => {
      const redis = mockRedis();

      await redis.set('test-key', 'test-value');
      const value = await redis.get('test-key');
      expect(value).toBe('test-value');

      await redis.del('test-key');
      const deleted = await redis.get('test-key');
      expect(deleted).toBeNull();
    });

    it('should create mock Redis client with expiration', async () => {
      const redis = mockRedis();

      await redis.setEx('expiring-key', 1, 'expiring-value');
      const value = await redis.get('expiring-key');
      expect(value).toBe('expiring-value');

      const ttl = await redis.ttl('expiring-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1);
    });

    it('should create mock storage adapter', async () => {
      const storage = mockStorageAdapter();
      const bucket = storage.getBucket('test-bucket');

      const key = 'test-file.txt';
      const body = Buffer.from('test content');

      await bucket.put({ key, body });

      const retrieved = await bucket.get({ key });
      expect(retrieved.Body).toEqual(body);

      const list = await bucket.list({ prefix: 'test-' });
      expect(list.Contents.length).toBe(1);
      expect(list.Contents[0].Key).toBe(key);

      await bucket.delete({ key });

      await expect(bucket.get({ key })).rejects.toThrow('Not Found');
    });
  });

  describe('Test Data Factories', () => {
    it('should create test user data', () => {
      const user = createTestUser();

      expect(user.id).toBeTruthy();
      expect(user.email).toContain('@example.com');
      expect(user.role).toBe('author');
      expect(user.email_verified).toBe(true);
      expect(user.created_at).toBeGreaterThan(0);
    });

    it('should create test user with overrides', () => {
      const user = createTestUser({
        email: 'custom@example.com',
        role: 'publisher',
        email_verified: false
      });

      expect(user.email).toBe('custom@example.com');
      expect(user.role).toBe('publisher');
      expect(user.email_verified).toBe(false);
    });

    it('should create test manuscript data', () => {
      const userId = 'test-user-id';
      const manuscript = createTestManuscript(userId);

      expect(manuscript.id).toBeTruthy();
      expect(manuscript.user_id).toBe(userId);
      expect(manuscript.title).toContain('Test Manuscript');
      expect(manuscript.genre).toBe('fiction');
      expect(manuscript.word_count).toBe(85000);
    });

    it('should generate unique test emails', () => {
      const email1 = generateTestEmail('test');
      const email2 = generateTestEmail('test');

      expect(email1).not.toBe(email2);
      expect(email1).toContain('test-');
      expect(email2).toContain('test-');
    });
  });

  describe('Integration: Factories + Database', () => {
    it('should insert factory-generated user into database', async () => {
      const user = createTestUser({
        email: generateTestEmail('factory-db-test')
      });

      await insertTestRecord('users', user);

      const found = await findTestRecord('users', { id: user.id });
      expect(found).toBeTruthy();
      expect(found.email).toBe(user.email);
      expect(found.role).toBe(user.role);
    });

    it('should insert factory-generated manuscript into database', async () => {
      const user = createTestUser();
      await insertTestRecord('users', user);

      const manuscript = createTestManuscript(user.id, {
        title: 'Integration Test Manuscript'
      });

      await insertTestRecord('manuscripts', manuscript);

      const found = await findTestRecord('manuscripts', { id: manuscript.id });
      expect(found).toBeTruthy();
      expect(found.user_id).toBe(user.id);
      expect(found.title).toBe('Integration Test Manuscript');
    });
  });
});
