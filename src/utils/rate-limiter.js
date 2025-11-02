/**
 * Comprehensive Rate Limiting Module (MAN-25)
 *
 * Implements rate limiting across all API endpoints to:
 * - Protect against API abuse and DDoS attacks
 * - Prevent excessive Claude API costs
 * - Ensure fair resource allocation
 * - Support tier-based limits (Free, Pro, Enterprise)
 *
 * Uses Cloudflare Workers KV for distributed rate limiting with sliding window algorithm
 */

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

export const RATE_LIMITS = {
  // Per-IP Limits (protect against abuse from single IP)
  IP: {
    LOGIN: { requests: 5, window: 15 * 60 },          // 5 attempts per 15 minutes
    REGISTRATION: { requests: 3, window: 60 * 60 },   // 3 registrations per hour
    PASSWORD_RESET: { requests: 3, window: 60 * 60 }, // 3 reset requests per hour
    UPLOAD: { requests: 10, window: 60 * 60 },        // 10 uploads per hour
    API_GENERAL: { requests: 100, window: 60 },       // 100 requests per minute
  },

  // Per-User Limits (based on subscription tier)
  USER: {
    FREE: {
      manuscripts_per_month: 1,
      analysis_per_day: 1,
      api_calls_per_day: 10,
      uploads_per_day: 1,
    },
    PRO: {
      manuscripts_per_month: 10,
      analysis_per_day: 10,
      api_calls_per_day: 1000,
      uploads_per_day: 10,
    },
    ENTERPRISE: {
      manuscripts_per_month: Infinity,
      analysis_per_day: Infinity,
      api_calls_per_day: 10000,
      uploads_per_day: Infinity,
    },
    ADMIN: {
      manuscripts_per_month: Infinity,
      analysis_per_day: Infinity,
      api_calls_per_day: Infinity,
      uploads_per_day: Infinity,
    },
  },

  // Per-Endpoint Specific Limits
  ENDPOINT: {
    '/auth/login': { requests: 5, window: 15 * 60 },          // Stricter for auth
    '/auth/register': { requests: 3, window: 60 * 60 },
    '/auth/password-reset-request': { requests: 3, window: 60 * 60 },
    '/manuscripts/upload': { requests: 10, window: 60 * 60 }, // 10 per hour
    '/manuscripts/analyze': { requests: 5, window: 60 * 60 }, // 5 per hour
    '/admin/*': { requests: 1000, window: 60 },               // Admin endpoints
  },
};

// ============================================================================
// RATE LIMIT CHECKER
// ============================================================================

/**
 * Check if a request should be rate limited
 *
 * @param {Object} options - Rate limit check options
 * @param {string} options.type - Type of limit: 'ip', 'user', 'endpoint'
 * @param {string} options.identifier - IP address or user ID
 * @param {string} options.endpoint - Endpoint path (for endpoint-specific limits)
 * @param {string} options.tier - User tier (for user limits): 'FREE', 'PRO', 'ENTERPRISE', 'ADMIN'
 * @param {Object} options.env - Cloudflare environment
 * @returns {Promise<{limited: boolean, remaining: number, reset: number, limit: number}>}
 */
export async function checkRateLimit({ type, identifier, endpoint, tier, env }) {
  let limit, window;

  // Determine limit based on type
  if (type === 'ip') {
    const limitConfig = getIPLimit(endpoint);
    limit = limitConfig.requests;
    window = limitConfig.window;
  } else if (type === 'user') {
    const limitConfig = getUserLimit(tier, endpoint);
    limit = limitConfig.limit;
    window = limitConfig.window;
  } else if (type === 'endpoint') {
    const limitConfig = getEndpointLimit(endpoint);
    limit = limitConfig.requests;
    window = limitConfig.window;
  } else {
    throw new Error(`Unknown rate limit type: ${type}`);
  }

  // If limit is Infinity (Enterprise/Admin), skip rate limiting
  if (limit === Infinity) {
    return {
      limited: false,
      remaining: Infinity,
      reset: 0,
      limit: Infinity,
    };
  }

  // Generate KV key
  const key = generateRateLimitKey(type, identifier, endpoint);

  // Get current request count from KV
  const data = await env.SESSIONS.get(key);
  const now = Date.now();

  if (!data) {
    // First request in this window
    await recordRequest(key, env, window, now);
    return {
      limited: false,
      remaining: limit - 1,
      reset: now + (window * 1000),
      limit,
    };
  }

  const limitData = JSON.parse(data);

  // Check if window has expired
  if (now > limitData.reset) {
    // Window expired, reset counter
    await recordRequest(key, env, window, now);
    return {
      limited: false,
      remaining: limit - 1,
      reset: now + (window * 1000),
      limit,
    };
  }

  // Window still active, check if limit exceeded
  if (limitData.count >= limit) {
    // Rate limit exceeded
    return {
      limited: true,
      remaining: 0,
      reset: limitData.reset,
      limit,
    };
  }

  // Increment counter
  limitData.count++;
  await env.SESSIONS.put(
    key,
    JSON.stringify(limitData),
    { expirationTtl: Math.ceil(window) }
  );

  return {
    limited: false,
    remaining: limit - limitData.count,
    reset: limitData.reset,
    limit,
  };
}

/**
 * Record a request in the rate limit window
 */
async function recordRequest(key, env, window, now) {
  const limitData = {
    count: 1,
    reset: now + (window * 1000),
  };

  await env.SESSIONS.put(
    key,
    JSON.stringify(limitData),
    { expirationTtl: Math.ceil(window) }
  );
}

/**
 * Generate a unique KV key for rate limiting
 */
function generateRateLimitKey(type, identifier, endpoint) {
  const endpointSafe = endpoint ? endpoint.replace(/\//g, '_') : 'general';
  return `rate_limit:${type}:${identifier}:${endpointSafe}`;
}

// ============================================================================
// LIMIT CONFIGURATION HELPERS
// ============================================================================

/**
 * Get IP-based rate limit for an endpoint
 */
function getIPLimit(endpoint) {
  // Check for endpoint-specific IP limits
  if (endpoint.startsWith('/auth/login')) {
    return RATE_LIMITS.IP.LOGIN;
  } else if (endpoint.startsWith('/auth/register')) {
    return RATE_LIMITS.IP.REGISTRATION;
  } else if (endpoint.includes('password-reset')) {
    return RATE_LIMITS.IP.PASSWORD_RESET;
  } else if (endpoint.includes('/upload')) {
    return RATE_LIMITS.IP.UPLOAD;
  } else {
    return RATE_LIMITS.IP.API_GENERAL;
  }
}

/**
 * Get user-based rate limit for a tier and endpoint
 */
function getUserLimit(tier, endpoint) {
  const tierLimits = RATE_LIMITS.USER[tier] || RATE_LIMITS.USER.FREE;

  // Determine which limit to apply based on endpoint
  if (endpoint.includes('/upload')) {
    return { limit: tierLimits.uploads_per_day, window: 24 * 60 * 60 };
  } else if (endpoint.includes('/analyze')) {
    return { limit: tierLimits.analysis_per_day, window: 24 * 60 * 60 };
  } else {
    return { limit: tierLimits.api_calls_per_day, window: 24 * 60 * 60 };
  }
}

/**
 * Get endpoint-specific rate limit
 */
function getEndpointLimit(endpoint) {
  // Match endpoint patterns
  for (const [pattern, limit] of Object.entries(RATE_LIMITS.ENDPOINT)) {
    if (pattern.includes('*')) {
      // Wildcard match
      const prefix = pattern.replace('/*', '');
      if (endpoint.startsWith(prefix)) {
        return limit;
      }
    } else if (endpoint === pattern || endpoint.startsWith(pattern)) {
      return limit;
    }
  }

  // Default general API limit
  return RATE_LIMITS.IP.API_GENERAL;
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Apply rate limiting to a request
 * Returns rate limit response if limited, null if allowed
 *
 * @param {Request} request - Incoming request
 * @param {Object} env - Cloudflare environment
 * @param {string|null} userId - User ID (if authenticated)
 * @param {string|null} userTier - User tier (FREE, PRO, ENTERPRISE, ADMIN)
 * @returns {Promise<Response|null>} Rate limit response or null if allowed
 */
export async function applyRateLimit(request, env, userId = null, userTier = null) {
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Apply IP-based rate limit
  const ipLimit = await checkRateLimit({
    type: 'ip',
    identifier: ip,
    endpoint,
    env,
  });

  if (ipLimit.limited) {
    return createRateLimitResponse(ipLimit, 'IP');
  }

  // Apply user-based rate limit (if authenticated)
  if (userId && userTier) {
    const userLimit = await checkRateLimit({
      type: 'user',
      identifier: userId,
      endpoint,
      tier: userTier,
      env,
    });

    if (userLimit.limited) {
      return createRateLimitResponse(userLimit, 'User');
    }
  }

  // Apply endpoint-specific rate limit
  const endpointLimit = await checkRateLimit({
    type: 'endpoint',
    identifier: ip, // Use IP for endpoint limits
    endpoint,
    env,
  });

  if (endpointLimit.limited) {
    return createRateLimitResponse(endpointLimit, 'Endpoint');
  }

  // No rate limit exceeded - return the most restrictive limit info for headers
  // Use IP limit as it's the most restrictive for general requests
  return {
    response: null,
    headers: createRateLimitHeaders(ipLimit),
    limitInfo: ipLimit
  };
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(limitInfo) {
  const resetTime = new Date(limitInfo.reset).toUTCString();
  const retryAfter = Math.ceil((limitInfo.reset - Date.now()) / 1000);

  return {
    'X-RateLimit-Limit': String(limitInfo.limit),
    'X-RateLimit-Remaining': String(limitInfo.remaining),
    'X-RateLimit-Reset': resetTime,
    'Retry-After': String(retryAfter),
  };
}

/**
 * Create a 429 Too Many Requests response
 */
function createRateLimitResponse(limitInfo, limitType) {
  const headers = createRateLimitHeaders(limitInfo);
  const retryAfter = Math.ceil((limitInfo.reset - Date.now()) / 1000);

  const response = new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    message: `Too many requests. ${limitType} rate limit exceeded.`,
    limit: limitInfo.limit,
    remaining: 0,
    resetAt: new Date(limitInfo.reset).toISOString(),
    retryAfter: `${retryAfter} seconds`,
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  return {
    response: response,
    headers: headers,
    limitInfo: limitInfo
  };
}

// ============================================================================
// ADMIN HELPERS
// ============================================================================

/**
 * Get rate limit stats for a user or IP
 *
 * @param {Object} options - Options
 * @param {string} options.type - 'ip' or 'user'
 * @param {string} options.identifier - IP or user ID
 * @param {Object} options.env - Cloudflare environment
 * @returns {Promise<Object>} Rate limit statistics
 */
export async function getRateLimitStats({ type, identifier, env }) {
  const keys = [];

  // Generate possible keys for this identifier
  const endpoints = ['login', 'register', 'upload', 'analyze', 'general'];

  for (const endpoint of endpoints) {
    const key = `rate_limit:${type}:${identifier}:${endpoint}`;
    const data = await env.SESSIONS.get(key);

    if (data) {
      const limitData = JSON.parse(data);
      keys.push({
        endpoint,
        count: limitData.count,
        reset: new Date(limitData.reset).toISOString(),
      });
    }
  }

  return {
    type,
    identifier,
    limits: keys,
  };
}

/**
 * Clear rate limits for a user or IP (admin function)
 *
 * @param {Object} options - Options
 * @param {string} options.type - 'ip' or 'user'
 * @param {string} options.identifier - IP or user ID
 * @param {Object} options.env - Cloudflare environment
 * @returns {Promise<void>}
 */
export async function clearRateLimits({ type, identifier, env }) {
  // Clear all possible rate limit keys for this identifier
  const endpoints = ['login', 'register', 'upload', 'analyze', 'general', '_auth_login', '_auth_register'];

  const deletePromises = endpoints.map(endpoint => {
    const key = `rate_limit:${type}:${identifier}:${endpoint}`;
    return env.SESSIONS.delete(key);
  });

  await Promise.all(deletePromises);

  console.log(`[RateLimit] Cleared all limits for ${type}:${identifier}`);
}

// ============================================================================
// USAGE TRACKING (for subscription limits)
// ============================================================================

/**
 * Track manuscript usage for subscription tier enforcement
 *
 * @param {string} userId - User ID
 * @param {Object} env - Cloudflare environment
 * @returns {Promise<{count: number, limit: number, allowed: boolean}>}
 */
export async function checkManuscriptLimit(userId, tier, env) {
  const tierLimits = RATE_LIMITS.USER[tier] || RATE_LIMITS.USER.FREE;
  const limit = tierLimits.manuscripts_per_month;

  if (limit === Infinity) {
    return { count: 0, limit: Infinity, allowed: true };
  }

  // Query database for manuscripts created this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartUnix = Math.floor(monthStart.getTime() / 1000);

  const result = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM manuscripts
    WHERE author_id = ? AND created_at >= ?
  `).bind(userId, monthStartUnix).first();

  const count = result.count;
  const allowed = count < limit;

  return { count, limit, allowed };
}
