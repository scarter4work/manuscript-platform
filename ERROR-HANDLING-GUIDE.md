# Error Handling Guide

This document explains how to use the standardized error handling system in the Manuscript Platform.

## Overview

The platform uses a consistent error handling approach with:
- **Standardized error classes** for common scenarios
- **Automatic logging** of all errors
- **Consistent JSON response format**
- **Proper HTTP status codes**
- **Request tracking** with unique IDs

## Error Classes

### AuthenticationError (401)

Use when user needs to log in or authentication failed.

```javascript
import { AuthenticationError } from './error-handling.js';

// Simple usage
throw new AuthenticationError();
// Response: { error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication required', statusCode: 401, ... }}

// With custom message
throw new AuthenticationError('Invalid session token');

// With details
throw new AuthenticationError('Token expired', { expiresAt: '2025-01-01T00:00:00Z' });
```

### AuthorizationError (403)

Use when user is authenticated but lacks permission.

```javascript
import { AuthorizationError } from './error-handling.js';

throw new AuthorizationError('Admin access required');
throw new AuthorizationError('You do not own this manuscript');
```

### ValidationError (400)

Use for invalid input data.

```javascript
import { ValidationError } from './error-handling.js';

throw new ValidationError('Invalid email format');
throw new ValidationError('Missing required field', { field: 'title' });
throw new ValidationError('File too large', {
  maxSize: '50MB',
  actualSize: '75MB'
});
```

### NotFoundError (404)

Use when a resource doesn't exist.

```javascript
import { NotFoundError } from './error-handling.js';

throw new NotFoundError('Manuscript', manuscriptId);
// Response: "Manuscript with ID 'abc-123' not found"

throw new NotFoundError('User', email);
// Response: "User with ID 'user@example.com' not found"
```

### RateLimitError (429)

Use when rate limit is exceeded.

```javascript
import { RateLimitError } from './error-handling.js';

throw new RateLimitError(60); // Retry after 60 seconds
// Automatically adds Retry-After header to response
```

### ConflictError (409)

Use for resource conflicts (duplicate email, etc.).

```javascript
import { ConflictError } from './error-handling.js';

throw new ConflictError('Email already registered');
throw new ConflictError('Manuscript title must be unique');
```

### ServerError (500)

Use for internal server errors.

```javascript
import { ServerError } from './error-handling.js';

throw new ServerError('Database connection failed');
throw new ServerError('Failed to process file', { reason: error.message });
```

### ExternalServiceError (502/503)

Use when external APIs fail (Claude, Stripe, etc.).

```javascript
import { ExternalServiceError } from './error-handling.js';

throw new ExternalServiceError('Anthropic', 'API timeout');
throw new ExternalServiceError('Stripe', 'Payment processing failed', 503);
```

## Assertion Helpers

For cleaner code, use assertion helpers instead of if-statements:

### assert()

```javascript
import { assert } from './error-handling.js';

// Instead of:
if (!title || title.length === 0) {
  throw new ValidationError('Title is required');
}

// Use:
assert(title && title.length > 0, 'Title is required');
assert(wordCount <= 500000, 'Manuscript too long', { wordCount, maxWords: 500000 });
```

### assertAuthenticated()

```javascript
import { assertAuthenticated } from './error-handling.js';

// Check if user is authenticated
assertAuthenticated(userId);
assertAuthenticated(userId, 'Please log in to upload manuscripts');
```

### assertAuthorized()

```javascript
import { assertAuthorized } from './error-handling.js';

// Check if user has permission
const isOwner = manuscript.user_id === userId;
assertAuthorized(isOwner, 'You do not own this manuscript');

const isAdmin = user.role === 'admin';
assertAuthorized(isAdmin, 'Admin access required');
```

## Using Error Handling in Endpoints

### Method 1: Throw errors directly

```javascript
async function handleGetManuscript(request, env) {
  // Will automatically be caught and converted to proper response
  const { getUserFromRequest } = await import('./auth-utils.js');
  const userId = await getUserFromRequest(request, env);

  assertAuthenticated(userId);

  const manuscriptId = new URL(request.url).searchParams.get('id');
  assert(manuscriptId, 'Manuscript ID required');

  const manuscript = await env.DB.prepare(
    'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
  ).bind(manuscriptId, userId).first();

  if (!manuscript) {
    throw new NotFoundError('Manuscript', manuscriptId);
  }

  return new Response(JSON.stringify(manuscript), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Method 2: Use withErrorHandling wrapper

```javascript
import { withErrorHandling } from './error-handling.js';

const handleGetManuscript = withErrorHandling(async (request, env, corsHeaders) => {
  // Errors thrown here will automatically become proper error responses
  assertAuthenticated(await getUserFromRequest(request, env));

  const manuscriptId = getQueryParam(request, 'id');
  const manuscript = await fetchManuscript(env, manuscriptId);

  return jsonResponse(manuscript);
}, { 'X-Custom-Header': 'value' });
```

### Method 3: Use createErrorResponse for custom error handling

```javascript
import { createErrorResponse } from './error-handling.js';

async function handleUpload(request, env) {
  try {
    // Your upload logic
    return successResponse;
  } catch (error) {
    // Automatically logs and formats error
    return createErrorResponse(error, request, corsHeaders);
  }
}
```

## Error Response Format

All errors return this standardized JSON format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File too large",
    "details": {
      "maxSize": "50MB",
      "actualSize": "75MB"
    },
    "statusCode": 400,
    "timestamp": "2025-10-26T20:00:00.000Z",
    "requestId": "uuid-here"
  }
}
```

## Migration Guide

### Before (inconsistent):

```javascript
if (!userId) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
  });
}

if (!manuscript) {
  return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
    status: 404,
    headers: { ...allHeaders, 'Content-Type': 'application/json' }
  });
}
```

### After (standardized):

```javascript
import { assertAuthenticated, NotFoundError } from './error-handling.js';

assertAuthenticated(userId);

if (!manuscript) {
  throw new NotFoundError('Manuscript', manuscriptId);
}

// Or even simpler:
assert(manuscript, 'Manuscript not found');
```

## Benefits

1. **Consistency**: All errors follow the same format
2. **Automatic logging**: Every error is logged with context
3. **Request tracking**: Unique requestId for debugging
4. **Less code**: Assertions replace verbose if-statements
5. **Better DX**: Clear error classes for different scenarios
6. **Testability**: Easy to test error scenarios

## Best Practices

1. **Use specific error classes** - Don't use generic `AppError`
2. **Include helpful details** - Add context to help debugging
3. **Use assertions** - Cleaner than if-statements
4. **Log before throwing** - Use `logAndRethrow()` for context
5. **Handle external service errors** - Wrap API calls appropriately

## Example: Complete Endpoint

```javascript
import {
  assertAuthenticated,
  assertAuthorized,
  assert,
  NotFoundError,
  ValidationError,
  ExternalServiceError
} from './error-handling.js';

async function handleAnalyzeManuscript(request, env, corsHeaders) {
  // 1. Authentication
  const { getUserFromRequest } = await import('./auth-utils.js');
  const userId = await getUserFromRequest(request, env);
  assertAuthenticated(userId);

  // 2. Validation
  const manuscriptId = new URL(request.url).searchParams.get('id');
  assert(manuscriptId, 'Manuscript ID required');

  // 3. Fetch resource
  const manuscript = await env.DB.prepare(
    'SELECT * FROM manuscripts WHERE id = ?'
  ).bind(manuscriptId).first();

  if (!manuscript) {
    throw new NotFoundError('Manuscript', manuscriptId);
  }

  // 4. Authorization
  assertAuthorized(
    manuscript.user_id === userId,
    'You do not own this manuscript'
  );

  // 5. Business logic
  try {
    const analysis = await analyzeWithClaude(manuscript);
    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    throw new ExternalServiceError('Anthropic', error.message);
  }
}
```

## Testing Errors

```javascript
import { describe, it, expect } from 'vitest';
import { ValidationError, NotFoundError } from '../error-handling.js';

describe('Manuscript Upload', () => {
  it('should reject files that are too large', async () => {
    const largeFile = createLargeFile(100 * 1024 * 1024); // 100MB

    await expect(handleUpload(largeFile)).rejects.toThrow(ValidationError);
  });

  it('should return 404 for non-existent manuscript', async () => {
    await expect(getManuscript('invalid-id')).rejects.toThrow(NotFoundError);
  });
});
```
