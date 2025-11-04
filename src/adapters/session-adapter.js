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

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required');
  }

  // Create Redis client
  const redisClient = createClient({
    url: redisUrl,
    socket: {
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

  // Connect to Redis
  await redisClient.connect();

  // Create Redis store
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

export default { createSessionStore, createSessionMiddleware };
