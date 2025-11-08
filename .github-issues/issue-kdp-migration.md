# 🔧 Migrate KDP Package Generator from R2 to Storage Adapter

## Priority: MEDIUM
**Impact**: KDP exports may fail on Render (uses deprecated R2 binding)
**Effort**: 2-3 hours
**Risk**: Feature failure, user frustration

## Problem

KDP package generator at `src/generators/kdp-package-generator.js` still references `env.R2_MANUSCRIPTS` (Cloudflare R2 bucket) instead of using the storage adapter. This is documented in the file itself with a TODO comment.

**Affected Lines**:
- Line 79: Manuscript retrieval
- Line 111: Cover image retrieval
- Line 585: Package upload
- Line 606: Cleanup

**Current Code**:
```javascript
// Line 10-12 (TODO comment)
/**
 * TODO: Update to use storage adapter instead of env.R2_MANUSCRIPTS
 * Lines 79, 111, 585, 606 use env.R2_MANUSCRIPTS (Cloudflare R2)
 * Should be updated to use src/adapters/storage-adapter.js for Backblaze B2
 */

// Line 79
const manuscriptObject = await env.R2_MANUSCRIPTS.get(manuscriptKey);

// Line 111
const coverObject = await env.R2_MANUSCRIPTS.get(coverKey);

// Line 585
await env.R2_MANUSCRIPTS.put(packageKey, packageBuffer);

// Line 606
await env.R2_MANUSCRIPTS.delete(tempKey);
```

## Required Changes

### 1. Update Line 79 - Manuscript Retrieval

```javascript
// BEFORE
const manuscriptObject = await env.R2_MANUSCRIPTS.get(manuscriptKey);
const manuscriptBuffer = await manuscriptObject.arrayBuffer();

// AFTER
const manuscriptBucket = env.MANUSCRIPTS_RAW; // Use adapter bucket
const manuscriptObject = await manuscriptBucket.get(manuscriptKey);
const manuscriptBuffer = Buffer.from(await manuscriptObject.Body.arrayBuffer());
```

### 2. Update Line 111 - Cover Image Retrieval

```javascript
// BEFORE
const coverObject = await env.R2_MANUSCRIPTS.get(coverKey);
const coverBuffer = await coverObject.arrayBuffer();

// AFTER
const assetsBucket = env.MARKETING_ASSETS; // Use adapter bucket
const coverObject = await assetsBucket.get(coverKey);
const coverBuffer = Buffer.from(await coverObject.Body.arrayBuffer());
```

### 3. Update Line 585 - Package Upload

```javascript
// BEFORE
await env.R2_MANUSCRIPTS.put(packageKey, packageBuffer, {
  httpMetadata: {
    contentType: 'application/zip'
  }
});

// AFTER
const processingBucket = env.MANUSCRIPTS_PROCESSED; // Use adapter bucket
await processingBucket.put({
  Key: packageKey,
  Body: packageBuffer,
  ContentType: 'application/zip',
  Metadata: {
    type: 'kdp-package',
    manuscriptId: manuscriptId,
    createdAt: new Date().toISOString()
  }
});
```

### 4. Update Line 606 - Cleanup

```javascript
// BEFORE
await env.R2_MANUSCRIPTS.delete(tempKey);

// AFTER
const processingBucket = env.MANUSCRIPTS_PROCESSED;
await processingBucket.delete({ Key: tempKey });
```

## Storage Adapter API Reference

The storage adapter at `src/adapters/storage-adapter.js` provides a Backblaze B2 wrapper with R2-compatible API:

```javascript
// Get bucket
const bucket = env.MANUSCRIPTS_RAW;  // or MANUSCRIPTS_PROCESSED, MARKETING_ASSETS

// Get object
const object = await bucket.get(key);
const buffer = Buffer.from(await object.Body.arrayBuffer());

// Put object
await bucket.put({
  Key: key,
  Body: buffer,
  ContentType: 'application/pdf',
  Metadata: { ... }
});

// Delete object
await bucket.delete({ Key: key });

// List objects
const objects = await bucket.list({ Prefix: 'prefix/' });
```

## Testing Checklist

- [ ] Test KDP package generation with valid manuscript
- [ ] Test with cover image
- [ ] Test without cover image
- [ ] Test package download
- [ ] Test package cleanup (temp files deleted)
- [ ] Verify storage adapter methods called correctly
- [ ] Test error handling (missing manuscript)
- [ ] Test error handling (corrupted file)
- [ ] Verify Content-Type set correctly
- [ ] Verify metadata stored

## Integration Test

```javascript
// tests/integration/generators/kdp-package-generator.test.js
import { generateKDPPackage } from '../../../src/generators/kdp-package-generator.js';
import { vi } from 'vitest';

describe('KDP Package Generator', () => {
  it('should use storage adapter, not R2 directly', async () => {
    const mockBucket = {
      get: vi.fn().mockResolvedValue({
        Body: { arrayBuffer: () => Promise.resolve(Buffer.from('test content')) }
      }),
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({})
    };

    const env = {
      MANUSCRIPTS_RAW: mockBucket,
      MANUSCRIPTS_PROCESSED: mockBucket,
      MARKETING_ASSETS: mockBucket
    };

    await generateKDPPackage('manuscript-id', env);

    // Verify storage adapter methods were called
    expect(mockBucket.get).toHaveBeenCalled();
    expect(mockBucket.put).toHaveBeenCalled();

    // Verify env.R2_MANUSCRIPTS was NOT used
    expect(env.R2_MANUSCRIPTS).toBeUndefined();
  });

  it('should generate valid KDP package', async () => {
    // Create test manuscript
    const manuscriptId = await createTestManuscript({
      title: 'Test Book',
      content: 'Chapter 1...'
    });

    const packageKey = await generateKDPPackage(manuscriptId, env);

    // Verify package exists
    const packageExists = await env.MANUSCRIPTS_PROCESSED.get(packageKey);
    expect(packageExists).toBeTruthy();

    // Verify package is a valid ZIP
    const packageBuffer = await packageExists.Body.arrayBuffer();
    const zip = new AdmZip(Buffer.from(packageBuffer));
    const entries = zip.getEntries();

    // KDP package should contain manuscript file
    expect(entries.length).toBeGreaterThan(0);
  });
});
```

## Files to Modify

1. `src/generators/kdp-package-generator.js` (4 locations)
2. `tests/integration/generators/kdp-package-generator.test.js` (NEW or UPDATE)

## Acceptance Criteria

- [ ] All references to `env.R2_MANUSCRIPTS` removed
- [ ] Uses `env.MANUSCRIPTS_RAW`, `env.MANUSCRIPTS_PROCESSED`, `env.MARKETING_ASSETS`
- [ ] Storage adapter API used correctly
- [ ] TODO comment removed
- [ ] Tests pass with storage adapter mocks
- [ ] KDP export works end-to-end
- [ ] No Cloudflare-specific code remains

## Verification Steps

1. Search codebase for `R2_MANUSCRIPTS`: Should return 0 results
2. Run KDP export: `POST /manuscripts/:id/kdp-export`
3. Verify package uploaded to Backblaze B2
4. Verify temp files cleaned up
5. Download package and verify contents

## Related Issues

- Part of Cloudflare migration (Issue #62, #63)
- Migration audit: CLOUDFLARE-MIGRATION-AUDIT.md (Issue #3)

## References

- KDP generator: `src/generators/kdp-package-generator.js`
- Storage adapter: `src/adapters/storage-adapter.js`
- TODO comment: Line 10-12