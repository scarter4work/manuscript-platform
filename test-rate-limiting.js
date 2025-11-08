/**
 * Test Rate Limiting on Production
 *
 * Tests if rate limiting is working by making rapid requests
 * to see if we get 429 (Too Many Requests) responses
 */

const PRODUCTION_URL = 'https://selfpubhub.co';

async function testRateLimiting() {
  console.log('🔒 Testing Rate Limiting on Production\n');

  // Test 1: Login endpoint (5 attempts per 15 minutes)
  console.log('Test 1: Login Rate Limiting (5 attempts per 15 min)');
  console.log('Making 6 rapid login attempts with wrong credentials...\n');

  let blocked = false;
  let firstBlockedAt = null;

  for (let i = 1; i <= 6; i++) {
    try {
      const response = await fetch(`${PRODUCTION_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrongpassword123'
        })
      });

      const status = response.status;
      const data = await response.text();

      if (status === 429) {
        console.log(`  Attempt ${i}: ❌ BLOCKED (429 Too Many Requests)`);
        if (!blocked) {
          blocked = true;
          firstBlockedAt = i;
        }
      } else if (status === 400 || status === 401) {
        console.log(`  Attempt ${i}: ✅ Allowed (${status} Invalid Credentials)`);
      } else {
        console.log(`  Attempt ${i}: ⚠️  Unexpected (${status}): ${data.substring(0, 100)}`);
      }

      // Small delay to simulate realistic requests
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.log(`  Attempt ${i}: ❌ Error: ${error.message}`);
    }
  }

  console.log('');
  if (blocked) {
    console.log(`✅ PASS: Rate limiting is WORKING (blocked at attempt ${firstBlockedAt})`);
  } else {
    console.log('❌ FAIL: Rate limiting is NOT WORKING (no 429 responses)');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: General API endpoint (100 requests per minute)
  console.log('Test 2: General API Rate Limiting (100 requests per min)');
  console.log('Making rapid requests to /health endpoint...\n');

  let healthBlocked = false;
  let healthBlockedAt = null;
  const maxRequests = 10; // Don't abuse the server

  for (let i = 1; i <= maxRequests; i++) {
    try {
      const response = await fetch(`${PRODUCTION_URL}/health`, {
        method: 'GET'
      });

      const status = response.status;

      if (status === 429) {
        console.log(`  Request ${i}: ❌ BLOCKED (429)`);
        if (!healthBlocked) {
          healthBlocked = true;
          healthBlockedAt = i;
        }
      } else if (status === 200) {
        console.log(`  Request ${i}: ✅ Allowed (200 OK)`);
      } else {
        console.log(`  Request ${i}: ⚠️  Unexpected (${status})`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      console.log(`  Request ${i}: ❌ Error: ${error.message}`);
    }
  }

  console.log('');
  if (healthBlocked) {
    console.log(`✅ PASS: General rate limiting is WORKING (blocked at request ${healthBlockedAt})`);
  } else {
    console.log(`ℹ️  INFO: No rate limiting on /health (expected - health checks usually exempt)`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Check for rate limit headers
  console.log('Test 3: Rate Limit Headers');
  console.log('Checking if server returns rate limit headers...\n');

  try {
    const response = await fetch(`${PRODUCTION_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' })
    });

    const headers = {
      'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
      'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
      'X-RateLimit-Reset': response.headers.get('X-RateLimit-Reset'),
      'Retry-After': response.headers.get('Retry-After')
    };

    console.log('  Rate Limit Headers:');
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        console.log(`    ${key}: ${value}`);
      }
    });

    if (Object.values(headers).every(v => !v)) {
      console.log('  ⚠️  No rate limit headers found (should be added for better UX)');
    } else {
      console.log('  ✅ Rate limit headers present');
    }

  } catch (error) {
    console.log(`  ❌ Error checking headers: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('Summary:');
  console.log('  - Login rate limiting:', blocked ? '✅ Working' : '❌ Not working');
  console.log('  - General rate limiting:', healthBlocked ? '✅ Working' : 'ℹ️  Not tested fully');
  console.log('\nNote: This test used minimal requests to avoid abusing the server.');
  console.log('Full rate limit thresholds may be higher than tested.');
}

testRateLimiting().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
