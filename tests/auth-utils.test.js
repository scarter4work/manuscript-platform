import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateEmail,
  hashPassword,
  verifyPassword,
  AUTH_CONFIG
} from '../src/utils/auth-utils.js';

describe('Authentication Utilities', () => {
  describe('validatePassword', () => {
    it('should accept a valid password', () => {
      const result = validatePassword('Test123!@#');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Test1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('test123!@#');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('TEST123!@#');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
    });

    it('should reject password without number', () => {
      const result = validatePassword('TestTest!@#');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    it('should reject password without special character', () => {
      const result = validatePassword('TestTest123');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('special'))).toBe(true);
    });

    it('should reject null or undefined password', () => {
      const resultNull = validatePassword(null);
      const resultUndef = validatePassword(undefined);

      expect(resultNull.valid).toBe(false);
      expect(resultUndef.valid).toBe(false);
    });

    it('should accept password with all requirements', () => {
      const passwords = [
        'MyP@ssw0rd',
        'Secure123!',
        'Test@123Pass',
        'P@ssw0rdStrong!'
      ];

      passwords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should return multiple errors for invalid password', () => {
      const result = validatePassword('test');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.uk',
        'first.last@subdomain.example.com',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
        null,
        undefined
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true);
      expect(validateEmail('user@localhost')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
    });
  });

  describe('hashPassword and verifyPassword', () => {
    it('should hash a password', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'Test123!@#';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // bcrypt includes salt, so hashes should be different
      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test123!@#';
      const wrongPassword = 'Wrong123!@#';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle empty passwords', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();

      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(true);
    });

    it('should be case sensitive', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('test123!@#', hash);
      expect(isValid).toBe(false);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'T3st!' + 'a'.repeat(100);
      const hash = await hashPassword(longPassword);

      const isValid = await verifyPassword(longPassword, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('AUTH_CONFIG', () => {
    it('should have valid configuration values', () => {
      expect(AUTH_CONFIG.SESSION_DURATION).toBeGreaterThan(0);
      expect(AUTH_CONFIG.SESSION_DURATION_REMEMBER).toBeGreaterThan(AUTH_CONFIG.SESSION_DURATION);
      expect(AUTH_CONFIG.PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
      expect(AUTH_CONFIG.BCRYPT_COST).toBeGreaterThanOrEqual(10);
      expect(AUTH_CONFIG.BCRYPT_COST).toBeLessThanOrEqual(15);
    });

    it('should have password requirements defined', () => {
      expect(AUTH_CONFIG.PASSWORD_REQUIREMENTS).toBeDefined();
      expect(AUTH_CONFIG.PASSWORD_REQUIREMENTS.uppercase).toBe(true);
      expect(AUTH_CONFIG.PASSWORD_REQUIREMENTS.lowercase).toBe(true);
      expect(AUTH_CONFIG.PASSWORD_REQUIREMENTS.number).toBe(true);
      expect(AUTH_CONFIG.PASSWORD_REQUIREMENTS.special).toBe(true);
    });

    it('should have rate limit configuration', () => {
      expect(AUTH_CONFIG.RATE_LIMIT).toBeDefined();
      expect(AUTH_CONFIG.RATE_LIMIT.LOGIN_ATTEMPTS).toBeGreaterThan(0);
      expect(AUTH_CONFIG.RATE_LIMIT.LOGIN_WINDOW).toBeGreaterThan(0);
    });
  });
});
