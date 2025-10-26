/**
 * Error Handling Middleware
 *
 * Global error handler for itty-router
 * Catches all errors and converts them to standardized error responses
 */

import { createErrorResponse } from '../error-handling.js';
import { addCorsHeaders } from './cors.js';

/**
 * Global error handling middleware for itty-router
 * Catches errors thrown by route handlers or middleware and converts them to proper responses
 *
 * This middleware should be used with itty-router's error handling:
 *
 * Usage:
 *   export default {
 *     fetch: (request, env, ctx) =>
 *       router
 *         .handle(request, env, ctx)
 *         .catch(err => errorHandler(err, request, env))
 *   }
 *
 * Or with Router.all():
 *   router.all('*', async (request, env) => {
 *     try {
 *       // ... normal handling
 *     } catch (error) {
 *       return errorHandler(error, request, env);
 *     }
 *   });
 */
export function errorHandler(error, request, env) {
  console.error('Error handler caught:', error);

  // If error is already a Response, just add headers and return it
  if (error instanceof Response) {
    return addResponseHeaders(error, request);
  }

  // Create standardized error response
  const errorResponse = createErrorResponse(error, request);

  // Add CORS and rate limit headers
  return addResponseHeaders(errorResponse, request);
}

/**
 * Add CORS and rate limit headers to a response
 * Used internally by errorHandler to ensure all responses have proper headers
 */
function addResponseHeaders(response, request) {
  // Get rate limit headers if available (set by rateLimitMiddleware)
  const rateLimitHeaders = request.rateLimitHeaders || {};

  // Add CORS headers using the cors middleware helper
  return addCorsHeaders(response, request, rateLimitHeaders);
}

/**
 * Async wrapper for route handlers with automatic error handling
 * Wraps a route handler to automatically catch and handle errors
 *
 * Usage:
 *   router.get('/manuscripts', withErrorHandler(async (request, env) => {
 *     // Your handler code that might throw errors
 *     const manuscripts = await getManuscripts(env, request.userId);
 *     return Response.json(manuscripts);
 *   }));
 *
 * This is an alternative to using the global error handler if you want
 * per-route error handling.
 */
export function withErrorHandler(handler) {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      return errorHandler(error, request, env);
    }
  };
}

/**
 * Error boundary middleware
 * Can be added to router to catch errors from subsequent middleware/handlers
 *
 * Usage:
 *   router.all('*', errorBoundary);
 *   router.get('/route', handler); // Errors in handler will be caught
 */
export async function errorBoundary(request, env, ctx) {
  try {
    // Continue to next middleware/handler
    return;
  } catch (error) {
    return errorHandler(error, request, env);
  }
}

/**
 * Log errors to external monitoring service (future enhancement)
 * Could integrate with Sentry, Datadog, etc.
 */
export async function logErrorToMonitoring(error, request, env) {
  // TODO: Add integration with error monitoring service
  // Example: await env.SENTRY_DSN.report(error, request);

  // For now, just console.error (appears in Cloudflare logs)
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString(),
  });
}
