/**
 * CORS and Security Headers Middleware
 */

const ALLOWED_ORIGINS = [
  'https://selfpubhub.co',
  'https://www.selfpubhub.co',
  'https://manuscript-platform.pages.dev',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://localhost:8787',
  'null', // Allow file:// protocol
];

const SECURITY_HEADERS = {
  // Content Security Policy - Prevents XSS attacks
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;",
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Enable browser XSS protection
  'X-XSS-Protection': '1; mode=block',
  // Enforce HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Control browser features and APIs
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, X-Filename, X-Author-Id, X-File-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Get all headers (CORS + Security)
 */
export function getAllHeaders(request) {
  return {
    ...getCorsHeaders(request),
    ...SECURITY_HEADERS,
  };
}

/**
 * CORS middleware for itty-router
 * Adds CORS and security headers to all responses
 */
export function corsMiddleware(request) {
  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: getAllHeaders(request),
    });
  }

  // Attach headers to request context for use in responses
  request.corsHeaders = getAllHeaders(request);
}

/**
 * Add CORS headers to a response
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
