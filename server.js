/**
 * Express server adapter for Manuscript Platform
 * Wraps existing Workers code to run on Render
 */

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Import adapters
import { createDatabaseAdapter } from './src/adapters/database-adapter.js';
import { createStorageAdapter } from './src/adapters/storage-adapter.js';
import { createSessionStore, createSessionMiddleware } from './src/adapters/session-adapter.js';
import { createCacheAdapter } from './src/adapters/cache-adapter.js';

// Import services
import { initVirusScanner, updateScannerHealth } from './src/services/virus-scanner.js';
import { createQueueService } from './src/services/queue-service.js';

// Import router
import { routeRequest } from './src/router/router.js';

// Environment configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static('frontend'));

// Initialize adapters and environment
let env;
let sessionMiddleware;

async function initializeAdapters() {
  try {
    console.log('Initializing adapters...');

    // In test mode, use TEST_DATABASE_URL if available
    const dbUrl = NODE_ENV === 'test' && process.env.TEST_DATABASE_URL
      ? process.env.TEST_DATABASE_URL
      : process.env.DATABASE_URL;

    // Create database adapter (D1 → PostgreSQL)
    const db = createDatabaseAdapter({ ...process.env, DATABASE_URL: dbUrl });
    console.log('✓ Database adapter initialized');

    // Create storage adapter (R2 → Backblaze B2)
    const storage = createStorageAdapter(process.env);
    console.log('✓ Storage adapter initialized');

    // Create session store (KV → Redis)
    const { store, client: redisClient } = await createSessionStore(process.env);
    sessionMiddleware = createSessionMiddleware(process.env, store);
    console.log('✓ Session store initialized');

    // Create cache adapter (Redis → KV API)
    const cacheKV = createCacheAdapter(redisClient);
    console.log('✓ Cache adapter initialized');

    // Create queue service (Cloudflare Queue → Redis)
    const queueService = createQueueService(redisClient);
    console.log('✓ Queue service initialized');

    // Create env object that mimics Workers env
    env = {
      // Database
      DB: db,

      // Storage adapter (handlers use env.R2.getBucket('bucket_name'))
      R2: storage,

      // Queue service (handlers use env.QUEUE.send('queueName', jobData))
      QUEUE: queueService,

      // Redis client (for KV operations)
      REDIS: redisClient,

      // Cache (for db-cache.js)
      CACHE_KV: cacheKV,

      // Environment variables
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
      FRONTEND_URL: process.env.FRONTEND_URL,
      EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
      EMAIL_ADMIN_ADDRESS: process.env.EMAIL_ADMIN_ADDRESS,
      EMAIL_REPLY_TO_ADDRESS: process.env.EMAIL_REPLY_TO_ADDRESS,
      MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
      SESSION_DURATION: process.env.SESSION_DURATION,
      NODE_ENV,
    };

    console.log('✓ Environment initialized');

    // Apply session middleware
    app.use(sessionMiddleware);
    console.log('✓ Session middleware applied');

    // Initialize virus scanner (non-blocking)
    initVirusScanner(process.env).then(success => {
      if (success) {
        console.log('✓ Virus scanner initialized');
        // Update scanner health in database
        updateScannerHealth(db).catch(err => {
          console.warn('Failed to update scanner health:', err.message);
        });
      } else {
        console.warn('⚠ Virus scanner initialization failed (uploads will continue without scanning)');
      }
    }).catch(err => {
      console.error('✗ Virus scanner error:', err.message);
    });

  } catch (error) {
    console.error('Failed to initialize adapters:', error);
    throw error; // Don't exit, let caller handle it
  }
}

// CORS helper function
function addCorsHeaders(response, additionalHeaders = {}) {
  const headers = new Headers(response.headers);

  headers.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');

  // Add additional headers (rate limiting, etc.)
  for (const [key, value] of Object.entries(additionalHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Convert Express request to Workers Request
function expressToWorkersRequest(req) {
  const protocol = req.secure ? 'https' : 'http';
  const host = req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    headers.set(key, Array.isArray(value) ? value[0] : value);
  }

  const init = {
    method: req.method,
    headers,
  };

  // Add body for non-GET/HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body) {
      init.body = JSON.stringify(req.body);
    }
  }

  return new Request(url, init);
}

// Convert Workers Response to Express response
async function workersToExpressResponse(workersResponse, res) {
  // Set status
  res.status(workersResponse.status);

  // Set headers
  for (const [key, value] of workersResponse.headers.entries()) {
    res.set(key, value);
  }

  // Handle body
  const contentType = workersResponse.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await workersResponse.json();
    res.json(json);
  } else if (contentType.includes('text/')) {
    const text = await workersResponse.text();
    res.send(text);
  } else {
    const buffer = Buffer.from(await workersResponse.arrayBuffer());
    res.send(buffer);
  }
}

// Main route handler - delegates to Workers router
app.use(async (req, res, next) => {
  try {
    // Skip if env not initialized yet
    if (!env) {
      return res.status(503).json({ error: 'Service initializing, please retry' });
    }

    // OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
      return res.status(200)
        .set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
        .set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        .set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        .set('Access-Control-Allow-Credentials', 'true')
        .end();
    }

    // Convert to Workers Request
    const workersRequest = expressToWorkersRequest(req);

    // Route through Workers router
    const rateLimitHeaders = {}; // TODO: Implement rate limiting
    const allHeaders = {};

    const workersResponse = await routeRequest(
      workersRequest,
      env,
      addCorsHeaders,
      rateLimitHeaders,
      allHeaders
    );

    if (workersResponse) {
      await workersToExpressResponse(workersResponse, res);
    } else {
      // No route matched
      next();
    }
  } catch (error) {
    console.error('Route handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    adapters: env ? 'initialized' : 'initializing',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Initialize and start server
async function start() {
  try {
    // Start HTTP server FIRST so Render sees it as "deployed"
    const server = app.listen(PORT, () => {
      console.log(`\n✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${NODE_ENV}`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log('⏳ Initializing adapters...\n');
    });

    // Initialize adapters in background
    initializeAdapters().catch(error => {
      console.error('Failed to initialize adapters:', error);
      console.error('Server will continue running but API requests will fail until adapters are ready');
      // TODO: Add retry logic here
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if not running in test mode
if (NODE_ENV !== 'test') {
  start();
} else {
  // In test mode, initialize adapters immediately (but don't start HTTP server)
  initializeAdapters().catch(error => {
    console.error('Failed to initialize adapters in test mode:', error);
  });
}

// Export for tests
export default app;
export { initializeAdapters, env };
