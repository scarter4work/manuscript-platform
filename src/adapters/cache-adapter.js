/**
 * Cache Adapter: Redis → Cloudflare KV API
 *
 * Wraps Redis client to provide Cloudflare KV-compatible API
 * for the CacheManager (db-cache.js)
 */

/**
 * Creates a KV-compatible wrapper around Redis client
 * @param {Object} redisClient - Redis client from session-adapter
 * @returns {Object} KV-compatible cache interface
 */
export function createCacheAdapter(redisClient) {
  if (!redisClient) {
    console.warn('Redis client not provided to cache adapter');
    return null;
  }

  return {
    /**
     * Get value from Redis (KV-compatible API)
     * @param {string} key - Cache key
     * @param {string} type - 'text' or 'json' (ignored, we always parse)
     * @returns {Promise<any>} Parsed JSON value or null
     */
    async get(key, type = 'json') {
      try {
        const value = await redisClient.get(key);
        if (!value) return null;

        // Always return parsed JSON (matches KV behavior)
        return JSON.parse(value);
      } catch (error) {
        console.error(`Cache adapter get error for key ${key}:`, error.message);
        return null;
      }
    },

    /**
     * Set value in Redis with TTL (KV-compatible API)
     * @param {string} key - Cache key
     * @param {string} value - Stringified JSON value
     * @param {Object} options - Options object with expirationTtl
     * @returns {Promise<void>}
     */
    async put(key, value, options = {}) {
      try {
        const ttl = options.expirationTtl || options.ttl || 3600; // Default 1 hour

        // Redis SETEX: key, seconds, value
        await redisClient.setEx(key, ttl, value);
      } catch (error) {
        console.error(`Cache adapter put error for key ${key}:`, error.message);
        // Don't throw - caching failures shouldn't break the app
      }
    },

    /**
     * Delete value from Redis (KV-compatible API)
     * @param {string} key - Cache key
     * @returns {Promise<void>}
     */
    async delete(key) {
      try {
        await redisClient.del(key);
      } catch (error) {
        console.error(`Cache adapter delete error for key ${key}:`, error.message);
      }
    },

    /**
     * List keys (not used by CacheManager but here for completeness)
     * @returns {Promise<Object>}
     */
    async list() {
      try {
        // Redis KEYS is expensive - use SCAN in production
        const keys = await redisClient.keys('*');
        return { keys: keys.map(name => ({ name })) };
      } catch (error) {
        console.error('Cache adapter list error:', error.message);
        return { keys: [] };
      }
    }
  };
}
