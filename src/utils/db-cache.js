/**
 * Database Caching Layer for MAN-28
 *
 * Implements KV-based caching for frequently accessed database queries
 * to reduce D1 query load and improve API response times.
 *
 * Cache Strategy:
 * - User profiles: 1 hour TTL
 * - Manuscript metadata: 15 min TTL
 * - Analysis results: 1 day TTL
 * - Admin stats: 5 min TTL
 *
 * Cache Invalidation:
 * - On data update, clear related cache keys
 * - TTL-based expiration for all entries
 */

/**
 * Generate cache keys with consistent naming
 */
export const CacheKeys = {
  userProfile: (userId) => `user:${userId}`,
  userSubscription: (userId) => `user:${userId}:subscription`,
  manuscript: (manuscriptId) => `manuscript:${manuscriptId}`,
  manuscriptList: (userId, status, genre, page) => `manuscripts:${userId}:${status || 'all'}:${genre || 'all'}:p${page}`,
  manuscriptStats: (userId) => `manuscript-stats:${userId}`,
  analysisStatus: (manuscriptKey) => `analysis-status:${manuscriptKey}`,
  analysisResult: (manuscriptKey, type) => `analysis:${manuscriptKey}:${type}`,
  adminStats: () => `admin:stats`,
  costSummary: (userId, month) => `cost:${userId}:${month}`,
  dailyCosts: (date) => `cost:daily:${date}`,
};

/**
 * Cache TTL values in seconds
 */
export const CacheTTL = {
  USER_PROFILE: 3600,        // 1 hour
  MANUSCRIPT_META: 900,      // 15 minutes
  MANUSCRIPT_LIST: 300,      // 5 minutes
  ANALYSIS_RESULT: 86400,    // 1 day
  ANALYSIS_STATUS: 3600,     // 1 hour
  ADMIN_STATS: 300,          // 5 minutes
  COST_DATA: 3600,           // 1 hour
};

/**
 * Cache Manager - handles all caching operations
 */
export class CacheManager {
  constructor(kv) {
    this.kv = kv;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null if not found/expired
   */
  async get(key) {
    try {
      const value = await this.kv.get(key, 'json');
      return value;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<void>}
   */
  async set(key, value, ttl) {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl
      });
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      // Don't throw - caching failures shouldn't break the app
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * Note: KV doesn't support pattern matching, so we track keys we need to invalidate
   * @param {string[]} keys - Array of keys to delete
   * @returns {Promise<void>}
   */
  async deleteMany(keys) {
    try {
      await Promise.all(keys.map(key => this.kv.delete(key)));
    } catch (error) {
      console.error('Cache delete many error:', error);
    }
  }

  /**
   * Cache-aside pattern: get from cache or fetch from DB
   * @param {string} key - Cache key
   * @param {number} ttl - TTL in seconds
   * @param {Function} fetchFn - Async function to fetch data if not cached
   * @returns {Promise<any>}
   */
  async getOrFetch(key, ttl, fetchFn) {
    // Try cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch from source
    const data = await fetchFn();

    // Store in cache for next time
    if (data !== null && data !== undefined) {
      await this.set(key, data, ttl);
    }

    return data;
  }
}

/**
 * User-specific cache operations
 */
export class UserCache {
  constructor(cache) {
    this.cache = cache;
  }

  /**
   * Get user profile from cache or DB
   */
  async getProfile(userId, env) {
    return this.cache.getOrFetch(
      CacheKeys.userProfile(userId),
      CacheTTL.USER_PROFILE,
      async () => {
        const result = await env.DB.prepare(
          'SELECT id, email, full_name, role, subscription_tier, created_at, last_login FROM users WHERE id = ?'
        ).bind(userId).first();
        return result;
      }
    );
  }

  /**
   * Get user subscription info from cache or DB
   */
  async getSubscription(userId, env) {
    return this.cache.getOrFetch(
      CacheKeys.userSubscription(userId),
      CacheTTL.USER_PROFILE,
      async () => {
        const result = await env.DB.prepare(
          'SELECT * FROM user_subscriptions_with_usage WHERE user_id = ?'
        ).bind(userId).first();
        return result;
      }
    );
  }

  /**
   * Invalidate user cache on profile update
   */
  async invalidate(userId) {
    await this.cache.deleteMany([
      CacheKeys.userProfile(userId),
      CacheKeys.userSubscription(userId),
      CacheKeys.manuscriptStats(userId),
    ]);
  }
}

/**
 * Manuscript-specific cache operations
 */
export class ManuscriptCache {
  constructor(cache) {
    this.cache = cache;
  }

  /**
   * Get manuscript metadata from cache or DB
   */
  async getMetadata(manuscriptId, userId, env) {
    return this.cache.getOrFetch(
      CacheKeys.manuscript(manuscriptId),
      CacheTTL.MANUSCRIPT_META,
      async () => {
        const result = await env.DB.prepare(
          'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
        ).bind(manuscriptId, userId).first();

        if (result && result.metadata) {
          result.metadata = JSON.parse(result.metadata);
        }

        return result;
      }
    );
  }

  /**
   * Get analysis status from cache (reduces R2 HEAD requests)
   */
  async getAnalysisStatus(manuscriptKey, env) {
    return this.cache.getOrFetch(
      CacheKeys.analysisStatus(manuscriptKey),
      CacheTTL.ANALYSIS_STATUS,
      async () => {
        // Batch R2 HEAD requests
        const [devAnalysis, lineAnalysis, copyAnalysis, assets] = await Promise.all([
          env.R2.getBucket('manuscripts_processed').head(`${manuscriptKey}-analysis.json`),
          env.R2.getBucket('manuscripts_processed').head(`${manuscriptKey}-line-analysis.json`),
          env.R2.getBucket('manuscripts_processed').head(`${manuscriptKey}-copy-analysis.json`),
          env.R2.getBucket('manuscripts_processed').head(`${manuscriptKey}-assets.json`),
        ]);

        return {
          developmental: !!devAnalysis,
          lineEditing: !!lineAnalysis,
          copyEditing: !!copyAnalysis,
          assetsGenerated: !!assets,
        };
      }
    );
  }

  /**
   * Get manuscript statistics from cache
   */
  async getStats(userId, env) {
    return this.cache.getOrFetch(
      CacheKeys.manuscriptStats(userId),
      CacheTTL.MANUSCRIPT_LIST,
      async () => {
        const [totalResults, byStatus, byGenre, wordCountResults] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as count FROM manuscripts WHERE user_id = ?').bind(userId).first(),
          env.DB.prepare('SELECT status, COUNT(*) as count FROM manuscripts WHERE user_id = ? GROUP BY status').bind(userId).all(),
          env.DB.prepare('SELECT genre, COUNT(*) as count FROM manuscripts WHERE user_id = ? GROUP BY genre').bind(userId).all(),
          env.DB.prepare('SELECT SUM(word_count) as total, AVG(word_count) as average FROM manuscripts WHERE user_id = ?').bind(userId).first(),
        ]);

        return {
          total: totalResults?.count || 0,
          byStatus: byStatus.results || [],
          byGenre: byGenre.results || [],
          wordCounts: wordCountResults || { total: 0, average: 0 },
        };
      }
    );
  }

  /**
   * Invalidate manuscript cache on update
   */
  async invalidate(manuscriptId, userId, manuscriptKey) {
    const keysToDelete = [
      CacheKeys.manuscript(manuscriptId),
      CacheKeys.manuscriptStats(userId),
      CacheKeys.analysisStatus(manuscriptKey),
    ];

    // Also clear paginated list caches for this user
    // Note: This is a simplified approach. In production, consider more granular cache keys
    await this.cache.deleteMany(keysToDelete);
  }
}

/**
 * Admin dashboard cache operations
 */
export class AdminCache {
  constructor(cache) {
    this.cache = cache;
  }

  /**
   * Get admin dashboard stats from cache
   */
  async getStats(env) {
    return this.cache.getOrFetch(
      CacheKeys.adminStats(),
      CacheTTL.ADMIN_STATS,
      async () => {
        const [users, manuscripts, dmca, costs] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM manuscripts').first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM dmca_requests WHERE status = ?').bind('pending').first(),
          env.DB.prepare('SELECT SUM(cost_usd) as total FROM cost_tracking WHERE date(created_at, \'unixepoch\') = date(\'now\')').first(),
        ]);

        return {
          totalUsers: users?.count || 0,
          totalManuscripts: manuscripts?.count || 0,
          pendingDmca: dmca?.count || 0,
          todayCosts: costs?.total || 0,
        };
      }
    );
  }

  /**
   * Invalidate admin stats cache
   */
  async invalidate() {
    await this.cache.delete(CacheKeys.adminStats());
  }
}

/**
 * Initialize cache system for request
 */
export function initCache(env) {
  const cacheManager = new CacheManager(env.CACHE_KV);

  return {
    cache: cacheManager,
    user: new UserCache(cacheManager),
    manuscript: new ManuscriptCache(cacheManager),
    admin: new AdminCache(cacheManager),
  };
}
