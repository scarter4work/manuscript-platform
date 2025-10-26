/**
 * Standardized Error Handling for Manuscript Platform
 *
 * Provides consistent error responses and logging across all endpoints.
 */

import { logError } from './logging.js';

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        statusCode: this.statusCode,
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * 401 - Authentication required or failed
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * 403 - User authenticated but lacks permission
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Permission denied', details = null) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

/**
 * 400 - Invalid request data
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * 404 - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', { resource, id });
  }
}

/**
 * 429 - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * 409 - Resource conflict (e.g., duplicate email)
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * 500 - Internal server error
 */
export class ServerError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, 'INTERNAL_ERROR', details);
  }
}

/**
 * 502/503 - External service failure (Claude, Stripe, etc.)
 */
export class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error', statusCode = 502) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR', { service });
    this.service = service;
  }
}

// ============================================================================
// ERROR RESPONSE UTILITIES
// ============================================================================

/**
 * Create a standardized error response
 *
 * @param {Error|AppError} error - The error object
 * @param {Request} request - The request that caused the error
 * @param {Object} headers - Additional headers to include
 * @returns {Response} Formatted error response
 */
export function createErrorResponse(error, request = null, headers = {}) {
  // Generate request ID for tracking
  const requestId = crypto.randomUUID();

  // Determine if this is an AppError or generic Error
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const errorCode = isAppError ? error.code : 'INTERNAL_ERROR';

  // Construct error response
  const errorResponse = {
    error: {
      code: errorCode,
      message: error.message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  // Include details if available (and not in production or for non-sensitive errors)
  if (isAppError && error.details) {
    errorResponse.error.details = error.details;
  }

  // For rate limit errors, include retry-after
  if (error instanceof RateLimitError) {
    headers['Retry-After'] = String(error.retryAfter);
    errorResponse.error.retryAfter = error.retryAfter;
  }

  // Log error for monitoring
  if (request) {
    const url = new URL(request.url);
    logError({
      message: error.message,
      code: errorCode,
      statusCode,
      requestId,
      path: url.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      stack: error.stack
    });
  }

  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Wrap an async function with error handling
 * Catches errors and returns standardized error responses
 *
 * @param {Function} handler - Async function to wrap
 * @param {Object} headers - Default headers to include in responses
 * @returns {Function} Wrapped handler function
 */
export function withErrorHandling(handler, headers = {}) {
  return async (request, env, ...args) => {
    try {
      return await handler(request, env, ...args);
    } catch (error) {
      // If error is already a Response, return it
      if (error instanceof Response) {
        return error;
      }

      // Otherwise, create standardized error response
      return createErrorResponse(error, request, headers);
    }
  };
}

/**
 * Assert a condition and throw ValidationError if false
 *
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message if assertion fails
 * @param {*} details - Additional error details
 * @throws {ValidationError}
 */
export function assert(condition, message, details = null) {
  if (!condition) {
    throw new ValidationError(message, details);
  }
}

/**
 * Assert user is authenticated
 *
 * @param {string|null} userId - User ID from request
 * @param {string} message - Custom error message
 * @throws {AuthenticationError}
 */
export function assertAuthenticated(userId, message = 'Authentication required') {
  if (!userId) {
    throw new AuthenticationError(message);
  }
}

/**
 * Assert user has required permission
 *
 * @param {boolean} hasPermission - Whether user has permission
 * @param {string} message - Custom error message
 * @throws {AuthorizationError}
 */
export function assertAuthorized(hasPermission, message = 'Permission denied') {
  if (!hasPermission) {
    throw new AuthorizationError(message);
  }
}

// ============================================================================
// ERROR LOGGING HELPERS
// ============================================================================

/**
 * Log and rethrow an error with additional context
 *
 * @param {Error} error - The original error
 * @param {string} context - Additional context about where the error occurred
 * @param {Object} metadata - Additional metadata to log
 * @throws {Error} Rethrows the original error
 */
export function logAndRethrow(error, context, metadata = {}) {
  logError({
    message: `${context}: ${error.message}`,
    error: error.message,
    stack: error.stack,
    context,
    ...metadata
  });

  throw error;
}
