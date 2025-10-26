# Worker.js Router Refactoring Plan

## Current State

- **File**: `worker.js`
- **Size**: 2789 lines
- **Routes**: 50+ endpoints
- **Pattern**: Large if-else chain with inline handlers
- **Issues**: Hard to navigate, high merge conflict risk, difficult to test

## Goal

Refactor into modular, maintainable structure using **Hono** (switched from itty-router due to middleware issues).

## Route Groups Identified

### 1. Auth Routes (8 routes) - `/auth/*`
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/logout`
- GET `/auth/me`
- GET `/auth/verify-email`
- POST `/auth/password-reset-request`
- POST `/auth/password-reset`
- GET `/auth/verify-reset-token`

**Handler files already exist:** `auth-handlers.js`, `password-reset-handlers.js`

### 2. Manuscript Routes (3 routes)
- GET `/manuscripts`
- GET `/manuscripts/stats`
- POST `/upload/manuscript`
- POST `/upload/marketing`

**Handler file exists:** `manuscript-handlers.js`

### 3. Analysis Routes (5 routes) - `/analyze/*`
- POST `/analyze/developmental`
- POST `/analyze/line-editing`
- POST `/analyze/copy-editing`
- POST `/analyze/start`
- GET `/analyze/status`

### 4. Payment Routes (8 routes) - `/payments/*`
- POST `/payments/create-checkout-session`
- POST `/payments/create-payment-intent`
- POST `/payments/create-portal-session`
- GET `/payments/subscription`
- GET `/payments/history`
- GET `/payments/can-upload`
- POST `/payments/webhook`
- POST `/webhooks/stripe`

**Handler file exists:** `payment-handlers.js`

### 5. Admin Routes (14 routes) - `/admin/*`
- GET `/admin/users`
- GET `/admin/manuscripts`
- GET `/admin/analytics/overview`
- GET `/admin/analytics/activity`
- GET `/admin/billing/transactions`
- GET `/admin/billing/subscriptions/stats`
- GET `/admin/billing/revenue`
- GET `/admin/billing/failed-payments`
- POST `/admin/billing/refund`
- POST `/admin/billing/cancel-subscription`
- GET `/admin/dmca/requests`
- GET `/admin/dmca/stats`
- PATCH `/admin/dmca/status`
- POST `/admin/dmca/resolve`

**Handler files exist:** `admin-handlers.js`, `admin-billing-handlers.js`, `dmca-admin-handlers.js`

### 6. Assets & Publishing Routes (8 routes)
- POST `/generate-assets`
- GET `/assets`
- GET `/assets/status`
- POST `/format-manuscript`
- GET `/download-formatted`
- POST `/analyze-market`
- GET `/market-analysis`
- POST `/generate-social-media`
- GET `/social-media`

### 7. DMCA Routes (1 route)
- POST `/dmca/submit`

### 8. Results Routes (2 routes)
- GET `/results`
- POST `/generate-report`
- POST `/generate-annotated-manuscript`

## Migration Strategy

### Phase 1: Setup (CURRENT)
- ✅ Install itty-router
- ✅ Create `routes/` directory
- ✅ Create migration plan document

### Phase 2: Create Router Infrastructure ✅ COMPLETE
- ✅ Installed Hono (replaced itty-router)
- ✅ Created `worker-router.js` with Hono
- ✅ Created middleware:
  - CORS middleware (built-in Hono + custom security headers)
  - Auth middleware (attaches user to context)
  - Rate limiting middleware (integrates with rate-limiter.js)
  - Error handling (onError hook)
- ✅ Created `routes/auth.js` with all 8 auth routes
- ✅ Tested successfully - all routes working

### Phase 3: Incremental Migration
Extract routes in this order (easiest to hardest):
1. ✅ Auth routes (`routes/auth.js`)
2. Manuscript routes (`routes/manuscripts.js`)
3. Payment routes (`routes/payments.js`)
4. Admin routes (`routes/admin.js`)
5. Analysis routes (`routes/analysis.js`)
6. Assets routes (`routes/assets.js`)
7. DMCA routes (`routes/dmca.js`)
8. Results routes (`routes/results.js`)

### Phase 4: Clean up
- Remove old if-else chain from worker.js
- Update documentation
- Final testing

## New Structure

```
manuscript-platform/
├── worker.js (entry point, <100 lines)
├── routes/
│   ├── auth.js
│   ├── manuscripts.js
│   ├── analysis.js
│   ├── payments.js
│   ├── admin.js
│   ├── assets.js
│   ├── dmca.js
│   └── results.js
├── middleware/
│   ├── auth.js
│   ├── cors.js
│   ├── rateLimit.js
│   └── errorHandling.js
└── handlers/ (existing)
    ├── auth-handlers.js
    ├── manuscript-handlers.js
    ├── payment-handlers.js
    └── ...
```

## Example: New worker-router.js Entry Point (Using Hono)

```javascript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import registerAuthRoutes from './routes/auth';
import registerManuscriptRoutes from './routes/manuscripts';
// ... other route imports

const app = new Hono();

// Global middleware (CORS, Auth, Rate Limiting, Security Headers)
app.use('*', cors({ /* config */ }));
app.use('*', async (c, next) => {
  // Auth middleware - attach user to context
  await next();
});
app.use('*', async (c, next) => {
  // Rate limiting middleware
  await next();
});

// Error handling
app.onError((err, c) => {
  return createErrorResponse(err, c.req.raw);
});

// Register route groups
registerAuthRoutes(app);
registerManuscriptRoutes(app);
// ... other routes

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  // Queue consumers stay the same
  async queue(batch, env) {
    // existing queue logic
  }
};
```

## Example: routes/auth.js (Using Hono)

```javascript
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleGetMe
} from '../auth-handlers.js';
import { assertAuthenticated } from '../error-handling.js';

// Middleware to require authentication
function requireAuth(c, next) {
  const userId = c.get('userId');
  assertAuthenticated(userId);
  return next();
}

// Wrap handler to work with Hono context
function wrapHandler(handler) {
  return async (c) => {
    const response = await handler(c.req.raw, c.env);
    // Add rate limit headers from context
    const rateLimitHeaders = c.get('rateLimitHeaders') || {};
    const headers = new Headers(response.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  };
}

export default function registerAuthRoutes(app) {
  app.post('/auth/register', wrapHandler(handleRegister));
  app.post('/auth/login', wrapHandler(handleLogin));
  app.post('/auth/logout', requireAuth, wrapHandler(handleLogout));
  app.get('/auth/me', requireAuth, wrapHandler(handleGetMe));
  // ... other auth routes
}
```

## Benefits After Refactoring

1. **Maintainability**: Each route group in its own file
2. **Testability**: Routes can be tested in isolation
3. **DX**: Easy to find and modify routes
4. **Merge Conflicts**: Reduced (work in different files)
5. **Code Reuse**: Shared middleware
6. **Size**: worker.js reduced from 2789 lines to <100 lines

## Testing Strategy

For each migrated route group:
1. Run existing tests (`npm test`)
2. Test route in development (`wrangler dev`)
3. Deploy to staging
4. Run smoke tests
5. Deploy to production

## Timeline Estimate

- **Phase 1**: Complete ✅
- **Phase 2**: 2-3 hours (router infrastructure + auth routes)
- **Phase 3**: 4-6 hours (remaining route groups)
- **Phase 4**: 1 hour (cleanup)
- **Total**: ~8-12 hours of work

## Risk Mitigation

- Migrate one route group at a time
- Keep old and new code running side-by-side initially
- Extensive testing after each migration
- Can roll back individual route groups if issues arise

## Current Status

- ✅ itty-router installed
- ✅ routes/ directory created
- ✅ Migration plan documented
- ⏳ Ready to begin Phase 2

Next step: Create `routes/auth.js` as proof of concept.
