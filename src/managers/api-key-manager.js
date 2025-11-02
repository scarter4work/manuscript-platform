// API Key Management
// Handles generation, validation, and management of API keys for Enterprise tier

import { createHash, randomBytes } from 'crypto';

export class APIKeyManager {
  constructor(env) {
    this.env = env;
  }

  /**
   * Generate a new API key for a user
   * @param {string} userId - User ID
   * @param {string} name - Descriptive name for the key
   * @param {Array} scopes - API scopes (e.g., ['manuscripts:read', 'manuscripts:write'])
   * @returns {Object} API key details (includes plain key, only shown once)
   */
  async generateKey(userId, name, scopes = ['*']) {
    // Verify user is Enterprise tier
    const user = await this.env.DB.prepare(
      'SELECT subscription_tier FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user || user.subscription_tier !== 'enterprise') {
      throw new Error('API keys are only available for Enterprise tier users');
    }

    // Generate secure API key
    const keyId = this.generateKeyId();
    const secret = this.generateSecret();
    const apiKey = `sk_${keyId}_${secret}`; // Format: sk_{keyId}_{secret}

    // Hash the secret for storage
    const hashedSecret = this.hashSecret(secret);

    // Store in database
    const now = Math.floor(Date.now() / 1000);
    await this.env.DB.prepare(`
      INSERT INTO api_keys (
        id, user_id, key_id, hashed_secret, name, scopes,
        rate_limit_per_minute, rate_limit_per_day,
        is_active, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)
    `).bind(
      crypto.randomUUID(),
      userId,
      keyId,
      hashedSecret,
      name,
      JSON.stringify(scopes),
      100, // 100 requests per minute
      10000, // 10,000 requests per day
      now
    ).run();

    return {
      keyId,
      apiKey, // Only returned once, never stored in plain text
      name,
      scopes,
      createdAt: now,
      rateLimits: {
        perMinute: 100,
        perDay: 10000
      }
    };
  }

  /**
   * Validate an API key
   * @param {string} apiKey - API key in format sk_{keyId}_{secret}
   * @returns {Object} User and key details if valid, null if invalid
   */
  async validateKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk_')) {
      return null;
    }

    // Parse API key
    const parts = apiKey.split('_');
    if (parts.length !== 3) {
      return null;
    }

    const [, keyId, secret] = parts;

    // Lookup key in database
    const keyRecord = await this.env.DB.prepare(`
      SELECT k.*, u.email, u.subscription_tier, u.full_name
      FROM api_keys k
      JOIN users u ON k.user_id = u.id
      WHERE k.key_id = ? AND k.is_active = 1
    `).bind(keyId).first();

    if (!keyRecord) {
      return null;
    }

    // Verify secret hash
    const hashedSecret = this.hashSecret(secret);
    if (hashedSecret !== keyRecord.hashed_secret) {
      return null;
    }

    // Update last used timestamp
    await this.updateLastUsed(keyRecord.id);

    // Check rate limits
    const rateLimitOk = await this.checkRateLimit(keyRecord.id, keyRecord.rate_limit_per_minute, keyRecord.rate_limit_per_day);
    if (!rateLimitOk) {
      throw new Error('Rate limit exceeded');
    }

    return {
      keyId: keyRecord.key_id,
      userId: keyRecord.user_id,
      email: keyRecord.email,
      name: keyRecord.name,
      scopes: JSON.parse(keyRecord.scopes || '[]'),
      subscriptionTier: keyRecord.subscription_tier,
      fullName: keyRecord.full_name
    };
  }

  /**
   * Check rate limits for an API key
   */
  async checkRateLimit(keyId, perMinute, perDay) {
    const now = Math.floor(Date.now() / 1000);
    const oneMinuteAgo = now - 60;
    const oneDayAgo = now - 86400;

    // Check minute rate limit
    const minuteCount = await this.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM api_usage_logs
      WHERE api_key_id = ? AND timestamp >= ?
    `).bind(keyId, oneMinuteAgo).first();

    if (minuteCount.count >= perMinute) {
      return false;
    }

    // Check daily rate limit
    const dayCount = await this.env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM api_usage_logs
      WHERE api_key_id = ? AND timestamp >= ?
    `).bind(keyId, oneDayAgo).first();

    if (dayCount.count >= perDay) {
      return false;
    }

    return true;
  }

  /**
   * Log API usage
   */
  async logUsage(keyId, endpoint, method, statusCode, responseTime) {
    const now = Math.floor(Date.now() / 1000);

    await this.env.DB.prepare(`
      INSERT INTO api_usage_logs (
        id, api_key_id, endpoint, method, status_code,
        response_time_ms, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      keyId,
      endpoint,
      method,
      statusCode,
      responseTime,
      now
    ).run();
  }

  /**
   * Revoke an API key
   */
  async revokeKey(userId, keyId) {
    const result = await this.env.DB.prepare(`
      UPDATE api_keys
      SET is_active = 0, revoked_at = ?
      WHERE key_id = ? AND user_id = ?
    `).bind(
      Math.floor(Date.now() / 1000),
      keyId,
      userId
    ).run();

    return result.success;
  }

  /**
   * List all API keys for a user
   */
  async listKeys(userId) {
    const keys = await this.env.DB.prepare(`
      SELECT key_id, name, scopes, rate_limit_per_minute, rate_limit_per_day,
             is_active, created_at, last_used_at, revoked_at
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all();

    return keys.results.map(key => ({
      keyId: key.key_id,
      name: key.name,
      scopes: JSON.parse(key.scopes || '[]'),
      rateLimits: {
        perMinute: key.rate_limit_per_minute,
        perDay: key.rate_limit_per_day
      },
      isActive: Boolean(key.is_active),
      createdAt: key.created_at,
      lastUsedAt: key.last_used_at,
      revokedAt: key.revoked_at
    }));
  }

  /**
   * Get usage statistics for an API key
   */
  async getUsageStats(userId, keyId, days = 30) {
    const since = Math.floor(Date.now() / 1000) - (days * 86400);

    const stats = await this.env.DB.prepare(`
      SELECT
        COUNT(*) as total_requests,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests,
        endpoint,
        COUNT(*) as endpoint_count
      FROM api_usage_logs
      WHERE api_key_id IN (
        SELECT id FROM api_keys WHERE key_id = ? AND user_id = ?
      ) AND timestamp >= ?
      GROUP BY endpoint
      ORDER BY endpoint_count DESC
    `).bind(keyId, userId, since).all();

    const totalStats = await this.env.DB.prepare(`
      SELECT
        COUNT(*) as total_requests,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests
      FROM api_usage_logs
      WHERE api_key_id IN (
        SELECT id FROM api_keys WHERE key_id = ? AND user_id = ?
      ) AND timestamp >= ?
    `).bind(keyId, userId, since).first();

    return {
      period: `Last ${days} days`,
      totalRequests: totalStats?.total_requests || 0,
      avgResponseTime: totalStats?.avg_response_time || 0,
      successfulRequests: totalStats?.successful_requests || 0,
      errorRequests: totalStats?.error_requests || 0,
      successRate: totalStats?.total_requests > 0
        ? (totalStats.successful_requests / totalStats.total_requests * 100).toFixed(2) + '%'
        : '0%',
      byEndpoint: stats.results
    };
  }

  /**
   * Generate a key ID (first part of API key)
   */
  generateKeyId() {
    return randomBytes(8).toString('hex'); // 16 characters
  }

  /**
   * Generate a secret (second part of API key)
   */
  generateSecret() {
    return randomBytes(24).toString('hex'); // 48 characters
  }

  /**
   * Hash a secret for storage
   */
  hashSecret(secret) {
    return createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(keyDatabaseId) {
    await this.env.DB.prepare(`
      UPDATE api_keys
      SET last_used_at = ?
      WHERE id = ?
    `).bind(
      Math.floor(Date.now() / 1000),
      keyDatabaseId
    ).run();
  }

  /**
   * Check if user has permission for a scope
   */
  hasScope(keyScopes, requiredScope) {
    if (keyScopes.includes('*')) {
      return true;
    }

    // Check for exact match
    if (keyScopes.includes(requiredScope)) {
      return true;
    }

    // Check for wildcard match (e.g., 'manuscripts:*' matches 'manuscripts:read')
    const [resource, action] = requiredScope.split(':');
    if (keyScopes.includes(`${resource}:*`)) {
      return true;
    }

    return false;
  }
}

/**
 * Middleware to authenticate API requests
 */
export async function authenticateAPIKey(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Missing or invalid Authorization header'
    };
  }

  const apiKey = authHeader.replace('Bearer ', '');
  const manager = new APIKeyManager(env);

  try {
    const keyDetails = await manager.validateKey(apiKey);

    if (!keyDetails) {
      return {
        authenticated: false,
        error: 'Invalid API key'
      };
    }

    return {
      authenticated: true,
      keyDetails
    };
  } catch (error) {
    return {
      authenticated: false,
      error: error.message
    };
  }
}
