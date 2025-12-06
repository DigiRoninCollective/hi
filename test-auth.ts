#!/usr/bin/env ts-node
/**
 * Authentication System Test
 * Tests the complete sign-in flow: registration, login, session validation
 */

import { registerUser, loginUser, validateSession, logoutUser } from './src/auth.service';

async function testAuthFlow() {
  console.log('🔐 PumpLauncher Authentication System Test\n');
  console.log('='.repeat(60));

  const testUsername = 'testuser_' + Date.now();
  const testPassword = 'TestPassword123!@#';
  const testEmail = `${testUsername}@test.local`;

  try {
    // 1. Test User Registration
    console.log('\n1️⃣  Testing User Registration...');
    const registerResult = await registerUser(testUsername, testPassword, testEmail);

    if (!registerResult.success) {
      console.log(`   ❌ Registration failed: ${registerResult.error}`);
      return;
    }

    console.log(`   ✅ Registration successful`);
    console.log(`   - User ID: ${registerResult.user?.id}`);
    console.log(`   - Username: ${registerResult.user?.username}`);
    console.log(`   - Email: ${registerResult.user?.email}`);
    console.log(`   - Role: ${registerResult.user?.role}`);

    // 2. Test User Login
    console.log('\n2️⃣  Testing User Login...');
    const loginResult = await loginUser(testUsername, testPassword, '192.168.1.1', 'Mozilla/5.0');

    if (!loginResult.success) {
      console.log(`   ❌ Login failed: ${loginResult.error}`);
      return;
    }

    console.log(`   ✅ Login successful`);
    console.log(`   - Session Token: ${loginResult.token?.slice(0, 20)}...`);
    console.log(`   - User: ${loginResult.user?.username}`);
    console.log(`   - Session ID: ${loginResult.session?.id}`);
    console.log(`   - Expires At: ${loginResult.session?.expires_at}`);

    // 3. Test Session Validation
    console.log('\n3️⃣  Testing Session Validation...');
    const validationResult = await validateSession(loginResult.token!);

    if (!validationResult.valid) {
      console.log(`   ❌ Session validation failed`);
      return;
    }

    console.log(`   ✅ Session validation successful`);
    console.log(`   - User: ${validationResult.user?.username}`);
    console.log(`   - Role: ${validationResult.user?.role}`);
    console.log(`   - Active: ${validationResult.user?.is_active}`);

    // 4. Test Invalid Password
    console.log('\n4️⃣  Testing Invalid Password Handling...');
    const invalidLoginResult = await loginUser(testUsername, 'WrongPassword', '192.168.1.1', 'Mozilla/5.0');

    if (invalidLoginResult.success) {
      console.log(`   ❌ Invalid password was accepted (security issue!)`);
      return;
    }

    console.log(`   ✅ Invalid password correctly rejected`);
    console.log(`   - Error: ${invalidLoginResult.error}`);

    // 5. Test User Not Found
    console.log('\n5️⃣  Testing Non-existent User...');
    const notFoundResult = await loginUser('nonexistent_user_' + Date.now(), testPassword, '192.168.1.1', 'Mozilla/5.0');

    if (notFoundResult.success) {
      console.log(`   ❌ Non-existent user was accepted (security issue!)`);
      return;
    }

    console.log(`   ✅ Non-existent user correctly rejected`);
    console.log(`   - Error: ${notFoundResult.error}`);

    // 6. Test Logout
    console.log('\n6️⃣  Testing User Logout...');
    const logoutSuccess = await logoutUser(loginResult.token!);

    if (!logoutSuccess) {
      console.log(`   ❌ Logout failed`);
      return;
    }

    console.log(`   ✅ Logout successful`);

    // 7. Verify Session is Invalidated After Logout
    console.log('\n7️⃣  Testing Session Invalidation After Logout...');
    const invalidatedResult = await validateSession(loginResult.token!);

    if (invalidatedResult.valid) {
      console.log(`   ❌ Session still valid after logout (security issue!)`);
      return;
    }

    console.log(`   ✅ Session correctly invalidated after logout`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ All authentication tests passed!\n');
    console.log('Summary:');
    console.log('  ✓ User registration works');
    console.log('  ✓ User login works');
    console.log('  ✓ Session creation works');
    console.log('  ✓ Session validation works');
    console.log('  ✓ Password verification works');
    console.log('  ✓ Invalid password rejection works');
    console.log('  ✓ User not found rejection works');
    console.log('  ✓ Session logout works');
    console.log('  ✓ Session invalidation after logout works\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

testAuthFlow();
