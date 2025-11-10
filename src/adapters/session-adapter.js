/**
 * Redis session store adapter
 * Provides session storage using Redis with express-session
 */

import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

/**
 * Create Redis session store
 * @param {Object} env - Environment variables
 * @returns {Promise<Object>}
 */
export async function createSessionStore(env) {
  const redisUrl = env.REDIS_URL;
  const isTest = env.NODE_ENV === 'test';

  if (!redisUrl && !isTest) {
    throw new Error('REDIS_URL environment variable is required');
  }

  // In test mode without Redis, use in-memory store
  if (!redisUrl && isTest) {
    console.log('⚠ Running in test mode without Redis - using in-memory session store');
    return {
      store: null, // express-session will use MemoryStore
      client: createMockRedisClient()
    };
  }

  // Create Redis client
  const redisClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 10000, // 10 second timeout
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis reconnection failed');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  redisClient.on('reconnecting', () => {
    console.log('Redis Client Reconnecting...');
  });

  // Connect to Redis with timeout and better error handling
  try {
    console.log(`Connecting to Redis at ${redisUrl.replace(/:[^:]*@/, ':****@')}...`);
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout after 10s')), 10000)
      )
    ]);
    console.log('✓ Redis connected successfully');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('Redis URL format:', redisUrl.replace(/:[^:]*@/, ':****@'));
    throw new Error(`Failed to connect to Redis: ${error.message}`);
  }

  // Create Redis store (connect-redis v7 with ESM)
  const store = new RedisStore({
    client: redisClient,
    prefix: 'manuscript:sess:',
    ttl: parseInt(env.SESSION_DURATION || '1800', 10), // 30 minutes default
  });

  return {
    store,
    client: redisClient
  };
}

/**
 * Create session middleware
 * @param {Object} env - Environment variables
 * @param {Object} store - Redis store instance
 * @returns {Function}
 */
export function createSessionMiddleware(env, store) {
  const sessionSecret = env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  return session({
    store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: parseInt(env.SESSION_DURATION || '1800', 10) * 1000, // milliseconds
      sameSite: 'strict',
    },
    name: 'manuscript.sid',
  });
}

/**
 * Create mock Redis client for test mode
 * @returns {Object} Mock Redis client
 */
function createMockRedisClient() {
  const store = new Map();

  return {
    get: async (key) => store.get(key) || null,
    set: async (key, value) => { store.set(key, value); },
    setEx: async (key, ttl, value) => { store.set(key, value); },
    del: async (key) => { store.delete(key); },
    connect: async () => {},
    quit: async () => {},
    on: () => {},
  };
}

export default { createSessionStore, createSessionMiddleware };
