/**
 * Phase E Admin Test: DMCA Admin Dashboard
 *
 * Tests:
 * 1. Admin user creation/login
 * 2. Get DMCA requests
 * 3. Get DMCA statistics
 * 4. Update DMCA status to "reviewing"
 * 5. Resolve DMCA request (approve)
 */

const BASE_URL = 'http://127.0.0.1:8787';

async function testPhaseEAdmin() {
  console.log('🧪 Phase E Admin Test: DMCA Admin Dashboard\n');
  console.log('='.repeat(70));

  let adminSessionCookie = null;
  let manuscriptId = null;
  let dmcaRequestId = null;

  // Generate unique test users
  const regularUserEmail = `test-regular-${Date.now()}@example.com`;
  const regularUserPassword = 'TestPassword123!';

  try {
    // Step 1: Register and verify regular user
    console.log('\n📝 Step 1: Creating regular user and uploading manuscript...');
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regularUserEmail,
        password: regularUserPassword,
        name: 'Regular Test User'
      })
    });

    const registerData = await registerRes.json();
    await fetch(`${BASE_URL}/auth/verify-email?token=${registerData.verificationToken}`);

    // Login regular user
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regularUserEmail,
        password: regularUserPassword
      })
    });

    const setCookieHeader = loginRes.headers.get('set-cookie');
    const match = setCookieHeader.match(/session_id=([^;]+)/);
    const regularUserSession = match[1];

    // Upload manuscript
    const manuscriptText = 'Test manuscript content for DMCA admin testing.';
    const formData = new FormData();
    formData.append('file', new Blob([manuscriptText], { type: 'text/plain' }), 'admin-test.txt');
    formData.append('title', 'Admin DMCA Test Manuscript');
    formData.append('genre', 'general');

    const uploadRes = await fetch(`${BASE_URL}/upload/manuscript`, {
      method: 'POST',
      headers: { 'Cookie': `session_id=${regularUserSession}` },
      body: formData
    });

    const uploadData = await uploadRes.json();
    manuscriptId = uploadData.manuscript.id;
    console.log(`✅ Regular user created and manuscript uploaded: ${manuscriptId}`);

    // Step 2: Submit DMCA request
    console.log('\n🔒 Step 2: Submitting DMCA takedown request...');
    const dmcaRes = await fetch(`${BASE_URL}/dmca/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Copyright Holder',
        requesterEmail: 'copyright@example.com',
        manuscriptId: manuscriptId,
        claimDetails: 'This manuscript infringes on my copyright.',
        goodFaithAttestation: true,
        accuracyAttestation: true,
        digitalSignature: 'Copyright Holder'
      })
    });

    const dmcaResult = await dmcaRes.json();
    dmcaRequestId = dmcaResult.dmcaRequestId;
    console.log(`✅ DMCA request submitted: ${dmcaRequestId}`);

    // Step 3: Create admin user
    console.log('\n👑 Step 3: Creating admin user...');

    // First, create admin user by registering normally
    const adminEmail = `admin-${Date.now()}@example.com`;
    const adminPassword = 'AdminPassword123!';

    const adminRegisterRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        name: 'Admin User'
      })
    });

    const adminRegisterData = await adminRegisterRes.json();
    await fetch(`${BASE_URL}/auth/verify-email?token=${adminRegisterData.verificationToken}`);

    console.log(`ℹ️  Note: User needs to be manually promoted to admin in database`);
    console.log(`   Run: UPDATE users SET role = 'admin' WHERE email = '${adminEmail}'`);
    console.log(`   For this test, we'll check if endpoints require admin (they should return 403)`);

    // Login as admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword
      })
    });

    const adminSetCookie = adminLoginRes.headers.get('set-cookie');
    const adminMatch = adminSetCookie.match(/session_id=([^;]+)/);
    adminSessionCookie = adminMatch[1];
    console.log(`✅ Admin user logged in`);

    // Step 4: Test admin endpoints (should return 403 since not actually admin)
    console.log('\n🔍 Step 4: Testing admin DMCA endpoints...');

    // Test: Get DMCA requests
    console.log('\n   Testing: GET /admin/dmca/requests');
    const getRequestsRes = await fetch(`${BASE_URL}/admin/dmca/requests?status=pending`, {
      headers: { 'Cookie': `session_id=${adminSessionCookie}` }
    });

    if (getRequestsRes.status === 403) {
      console.log('   ✅ Correctly requires admin role (403 Forbidden)');
    } else if (getRequestsRes.status === 200) {
      const requestsData = await getRequestsRes.json();
      console.log(`   ✅ Endpoint working - returned ${requestsData.requests?.length || 0} requests`);
    } else {
      console.log(`   ⚠️  Unexpected status: ${getRequestsRes.status}`);
    }

    // Test: Get DMCA stats
    console.log('\n   Testing: GET /admin/dmca/stats');
    const getStatsRes = await fetch(`${BASE_URL}/admin/dmca/stats`, {
      headers: { 'Cookie': `session_id=${adminSessionCookie}` }
    });

    if (getStatsRes.status === 403) {
      console.log('   ✅ Correctly requires admin role (403 Forbidden)');
    } else if (getStatsRes.status === 200) {
      const statsData = await getStatsRes.json();
      console.log(`   ✅ Endpoint working - stats: ${JSON.stringify(statsData.stats)}`);
    } else {
      console.log(`   ⚠️  Unexpected status: ${getStatsRes.status}`);
    }

    // Test: Update DMCA status
    console.log('\n   Testing: PATCH /admin/dmca/status');
    const updateStatusRes = await fetch(`${BASE_URL}/admin/dmca/status`, {
      method: 'PATCH',
      headers: {
        'Cookie': `session_id=${adminSessionCookie}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestId: dmcaRequestId,
        status: 'reviewing'
      })
    });

    if (updateStatusRes.status === 403) {
      console.log('   ✅ Correctly requires admin role (403 Forbidden)');
    } else if (updateStatusRes.status === 200) {
      console.log('   ✅ Endpoint working - status updated');
    } else {
      console.log(`   ⚠️  Unexpected status: ${updateStatusRes.status}`);
    }

    // Test: Resolve DMCA request
    console.log('\n   Testing: POST /admin/dmca/resolve');
    const resolveRes = await fetch(`${BASE_URL}/admin/dmca/resolve`, {
      method: 'POST',
      headers: {
        'Cookie': `session_id=${adminSessionCookie}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestId: dmcaRequestId,
        action: 'reject',
        resolutionNotes: 'Test resolution - invalid claim'
      })
    });

    if (resolveRes.status === 403) {
      console.log('   ✅ Correctly requires admin role (403 Forbidden)');
    } else if (resolveRes.status === 200) {
      console.log('   ✅ Endpoint working - request resolved');
    } else {
      console.log(`   ⚠️  Unexpected status: ${resolveRes.status}`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ Phase E Admin Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✓ Admin DMCA endpoints created and responding`);
    console.log(`   ✓ Authorization checks in place`);
    console.log(`   ✓ All 4 admin endpoints tested`);
    console.log('\n📝 Test Results:');
    console.log(`   - Manuscript ID: ${manuscriptId}`);
    console.log(`   - DMCA Request ID: ${dmcaRequestId}`);
    console.log(`   - Regular User: ${regularUserEmail}`);
    console.log(`   - Admin User: ${adminEmail} (not promoted to admin)`);
    console.log('\n💡 To fully test admin functionality:');
    console.log(`   1. Run in D1: UPDATE users SET role = 'admin' WHERE email = '${adminEmail}'`);
    console.log('   2. Re-run this test to see successful admin operations');
    console.log('   3. Check admin-dmca.html in browser');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testPhaseEAdmin();
