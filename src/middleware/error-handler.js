import { logError } from '../utils/logging.js';
import { addCorsHeaders } from './cors.js';

/**
 * Global error handler middleware
 * @param {Error} error - The error that occurred
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {Object} extraHeaders - Additional headers to include
 * @returns {Response} Error response with appropriate status code
 */
export async function handleError(error, request, env, extraHeaders = {}) {
  console.error('Error occurred:', error);

  // Log error if logging is available
  if (env && typeof logError === 'function') {
    try {
      await logError(env, {
        message: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
  }

  // Determine appropriate status code
  let status = 500;
  let message = 'Internal server error';

  if (error.message.includes('Unauthorized') || error.message.includes('Authentication')) {
    status = 401;
    message = error.message;
  } else if (error.message.includes('Forbidden') || error.message.includes('permission')) {
    status = 403;
    message = error.message;
  } else if (error.message.includes('Not found') || error.message.includes('does not exist')) {
    status = 404;
    message = error.message;
  } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
    status = 400;
    message = error.message;
  }

  const response = new Response(
    JSON.stringify({
      error: message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return addCorsHeaders(response, request, extraHeaders);
}

/**
 * Wrap a handler function with error handling
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandling(handler) {
  return async (request, env, extraHeaders = {}) => {
    try {
      return await handler(request, env, extraHeaders);
    } catch (error) {
      return await handleError(error, request, env, extraHeaders);
    }
  };
}
