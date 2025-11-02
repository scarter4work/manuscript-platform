/**
 * MINIMAL TEST VERSION - Testing itty-router basics
 */

import { Router } from 'itty-router';

const router = Router();

// Simple test middleware
router.all('*', (request) => {
  console.log('[Test] Middleware running for:', request.url);
  // Don't return anything, let it continue
});

// Test route
router.get('/test', (request) => {
  console.log('[Test] Route handler running');
  return new Response(JSON.stringify({ message: 'Test successful!' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// 404
router.all('*', () => {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
});

export default {
  async fetch(request, env, ctx) {
    console.log('[Test] Fetch called');
    return router.handle(request, env, ctx);
  }
};
