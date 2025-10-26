import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ConflictError,
  ServerError,
  ExternalServiceError,
  createErrorResponse,
  assert,
  assertAuthenticated,
  assertAuthorized
} from '../error-handling.js';

describe('Error Handling', () => {
  describe('Error Classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR', { foo: 'bar' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.timestamp).toBeDefined();
    });

    it('should serialize AppError to JSON correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_CODE');
      const json = error.toJSON();

      expect(json.error.code).toBe('TEST_CODE');
      expect(json.error.message).toBe('Test error');
      expect(json.error.statusCode).toBe(400);
      expect(json.error.timestamp).toBeDefined();
    });

    it('should create AuthenticationError with 401 status', () => {
      const error = new AuthenticationError('Please log in');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Please log in');
    });

    it('should create AuthorizationError with 403 status', () => {
      const error = new AuthorizationError('Admin only');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.message).toBe('Admin only');
    });

    it('should create ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create NotFoundError with 404 status', () => {
      const error = new NotFoundError('Manuscript', 'abc-123');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe("Manuscript with ID 'abc-123' not found");
    });

    it('should create RateLimitError with 429 status', () => {
      const error = new RateLimitError(120);

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(120);
    });

    it('should create ConflictError with 409 status', () => {
      const error = new ConflictError('Email already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should create ServerError with 500 status', () => {
      const error = new ServerError('Database connection failed');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create ExternalServiceError with service name', () => {
      const error = new ExternalServiceError('Anthropic', 'API timeout');

      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.service).toBe('Anthropic');
    });
  });

  describe('createErrorResponse', () => {
    it('should create Response with correct status and JSON', () => {
      const error = new ValidationError('Invalid data');
      const response = createErrorResponse(error);

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');
      const response = createErrorResponse(error);

      expect(response.status).toBe(500);
    });

    it('should include Retry-After header for rate limit errors', () => {
      const error = new RateLimitError(60);
      const response = createErrorResponse(error);

      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should merge additional headers', () => {
      const error = new AuthenticationError();
      const response = createErrorResponse(error, null, { 'X-Custom': 'value' });

      expect(response.headers.get('X-Custom')).toBe('value');
    });
  });

  describe('Assertion Helpers', () => {
    it('assert should not throw when condition is true', () => {
      expect(() => {
        assert(true, 'Should not throw');
      }).not.toThrow();
    });

    it('assert should throw ValidationError when condition is false', () => {
      expect(() => {
        assert(false, 'Condition failed');
      }).toThrow(ValidationError);
    });

    it('assert should include details in error', () => {
      try {
        assert(false, 'Field required', { field: 'email' });
      } catch (error) {
        expect(error.details).toEqual({ field: 'email' });
      }
    });

    it('assertAuthenticated should not throw when userId exists', () => {
      expect(() => {
        assertAuthenticated('user-123');
      }).not.toThrow();
    });

    it('assertAuthenticated should throw when userId is null', () => {
      expect(() => {
        assertAuthenticated(null);
      }).toThrow(AuthenticationError);
    });

    it('assertAuthenticated should throw when userId is undefined', () => {
      expect(() => {
        assertAuthenticated(undefined);
      }).toThrow(AuthenticationError);
    });

    it('assertAuthorized should not throw when permission is true', () => {
      expect(() => {
        assertAuthorized(true);
      }).not.toThrow();
    });

    it('assertAuthorized should throw when permission is false', () => {
      expect(() => {
        assertAuthorized(false, 'Admin only');
      }).toThrow(AuthorizationError);
    });
  });

  describe('Error Inheritance', () => {
    it('should maintain instanceof relationships', () => {
      const error = new ValidationError();

      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should have correct error names', () => {
      expect(new AuthenticationError().name).toBe('AuthenticationError');
      expect(new ValidationError().name).toBe('ValidationError');
      expect(new NotFoundError('User').name).toBe('NotFoundError');
    });
  });
});
