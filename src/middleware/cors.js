import { allowedOrigins } from '../config/cors-config.js';

/**
 * Get CORS headers for a request
 * @param {Request} request - The incoming request
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Author-Id, X-File-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Get security headers (OWASP recommended)
 * @returns {Object} Security headers object
 */
export function getSecurityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  };
}

/**
 * Get combined CORS and security headers
 * @param {Request} request - The incoming request
 * @returns {Object} Combined headers object
 */
export function getAllHeaders(request) {
  return {
    ...getCorsHeaders(request),
    ...getSecurityHeaders(),
  };
}

/**
 * Add CORS and security headers to a response
 * @param {Response} response - The response to add headers to
 * @param {Request} request - The incoming request
 * @param {Object} extraHeaders - Additional headers to add
 * @returns {Response} Response with headers added
 */
export function addCorsHeaders(response, request, extraHeaders = {}) {
  const newHeaders = new Headers(response.headers);
  const allHeaders = { ...getAllHeaders(request), ...extraHeaders };

  Object.entries(allHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Handle CORS preflight requests
 * @param {Request} request - The incoming request
 * @returns {Response|null} Preflight response or null if not a preflight request
 */
export function handlePreflight(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: getAllHeaders(request) });
  }
  return null;
}
