#!/usr/bin/env node
/**
 * B2 Credential Verification Script
 *
 * This script helps diagnose and verify Backblaze B2 credentials.
 * Run this locally or in production to test B2 connectivity.
 */

import { S3Client, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function verifyB2Credentials() {
  log('cyan', '\n=== B2 Credential Verification ===\n');

  // Load environment variables
  const config = {
    endpoint: process.env.B2_ENDPOINT?.trim(),
    region: process.env.B2_REGION?.trim(),
    accessKeyId: process.env.B2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY?.trim(),
  };

  // Step 1: Check if all required env vars are present
  log('blue', '1. Checking environment variables...');
  const missing = [];
  for (const [key, value] of Object.entries(config)) {
    if (!value) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    log('red', `   ✗ Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  log('green', '   ✓ All environment variables present\n');

  // Step 2: Validate credential format
  log('blue', '2. Validating credential format...');
  console.log(`   Endpoint: ${config.endpoint}`);
  console.log(`   Region: ${config.region}`);
  console.log(`   Access Key ID: ${config.accessKeyId.substring(0, 4)}... (length: ${config.accessKeyId.length})`);
  console.log(`   Secret Key: ${'*'.repeat(8)}... (length: ${config.secretAccessKey.length})`);

  // Backblaze B2 credentials are typically:
  // - keyID: 25 characters starting with '000'
  // - applicationKey: 31 characters
  // BUT when using S3-compatible API, the format may differ

  const warnings = [];

  // Check if credentials look like standard B2 format
  if (!config.accessKeyId.startsWith('000') && !config.accessKeyId.startsWith('005')) {
    warnings.push('Access Key ID doesn\'t start with expected prefix (000 or 005)');
  }

  // Check for common issues
  if (config.accessKeyId.includes(' ') || config.secretAccessKey.includes(' ')) {
    log('red', '   ✗ Credentials contain spaces!');
    process.exit(1);
  }

  if (config.accessKeyId.includes('\n') || config.secretAccessKey.includes('\n')) {
    log('red', '   ✗ Credentials contain newlines!');
    process.exit(1);
  }

  if (warnings.length > 0) {
    log('yellow', '   ⚠ Warnings:');
    warnings.forEach(w => log('yellow', `     - ${w}`));
  } else {
    log('green', '   ✓ Credential format looks valid\n');
  }

  // Step 3: Test S3 client initialization
  log('blue', '3. Initializing S3 client...');
  let client;
  try {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    log('green', '   ✓ S3 client initialized\n');
  } catch (error) {
    log('red', `   ✗ Failed to initialize S3 client: ${error.message}`);
    process.exit(1);
  }

  // Step 4: Test connectivity (list buckets)
  log('blue', '4. Testing connectivity (list buckets)...');
  try {
    const command = new ListBucketsCommand({});
    const response = await client.send(command);
    log('green', `   ✓ Successfully connected to B2!`);
    log('green', `   ✓ Found ${response.Buckets?.length || 0} buckets:\n`);

    if (response.Buckets && response.Buckets.length > 0) {
      response.Buckets.forEach(bucket => {
        console.log(`     - ${bucket.Name} (created: ${bucket.CreationDate})`);
      });
    }
    console.log('');
  } catch (error) {
    log('red', `   ✗ Failed to list buckets: ${error.name}`);
    log('red', `   ✗ Error: ${error.message}`);

    if (error.name === 'InvalidAccessKeyId') {
      log('yellow', '\n   Troubleshooting:');
      log('yellow', '   - Verify Access Key ID is correct in Backblaze dashboard');
      log('yellow', '   - Check for leading/trailing whitespace');
      log('yellow', '   - Ensure you\'re using the S3-compatible API credentials');
      log('yellow', '   - Verify the key hasn\'t been deleted or revoked');
    }

    process.exit(1);
  }

  // Step 5: Test write permissions (optional)
  const testBucket = process.env.B2_BUCKET_MANUSCRIPTS_RAW?.trim();
  if (testBucket) {
    log('blue', `5. Testing write permissions to '${testBucket}'...`);
    try {
      const testKey = `_test/${Date.now()}.txt`;
      const command = new PutObjectCommand({
        Bucket: testBucket,
        Key: testKey,
        Body: Buffer.from('B2 credential test file'),
        ContentType: 'text/plain',
      });

      await client.send(command);
      log('green', `   ✓ Successfully wrote test file: ${testKey}\n`);
    } catch (error) {
      log('red', `   ✗ Failed to write test file: ${error.name}`);
      log('red', `   ✗ Error: ${error.message}`);

      if (error.name === 'NoSuchBucket') {
        log('yellow', `\n   The bucket '${testBucket}' does not exist.`);
        log('yellow', '   Create it in the Backblaze dashboard first.');
      }

      process.exit(1);
    }
  }

  log('green', '=== ✓ All checks passed! ===\n');
  process.exit(0);
}

// Run verification
verifyB2Credentials().catch(error => {
  log('red', `\nUnexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
