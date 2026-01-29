#!/usr/bin/env node

/**
 * Google Sign-In Diagnostic Tool
 * 
 * This script checks your Google OAuth setup and identifies issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Google Sign-In Diagnostic Tool\n');
console.log('================================\n');

// Check 1: Clerk Key
console.log('1️⃣ Checking Clerk Configuration...');
const envPath = path.join(__dirname, '../.env.local');
let clerkKey = null;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=(.+)/);
  if (match) {
    clerkKey = match[1].trim();
  }
}

if (clerkKey && clerkKey.startsWith('pk_test_') && clerkKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk') {
  console.log('   ✅ Clerk Key: Configured');
  console.log(`   📝 Key: ${clerkKey.substring(0, 20)}...`);
} else {
  console.log('   ❌ Clerk Key: NOT configured or invalid');
  console.log('   💡 Fix: Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local');
  console.log('   📖 See: CLERK_KEY_SETUP.md\n');
}

// Check 2: Google OAuth Setup Status
console.log('\n2️⃣ Google OAuth Setup Checklist...');
console.log('   ⚠️  Manual checks required:');
console.log('   [ ] Google Cloud Console: OAuth client created');
console.log('   [ ] Google Cloud Console: Redirect URI configured');
console.log('   [ ] Clerk Dashboard: Google OAuth enabled');
console.log('   [ ] Clerk Dashboard: Client ID and Secret added');
console.log('\n   📖 See: GOOGLE_OAUTH_SETUP.md for step-by-step instructions\n');

// Check 3: Common Issues
console.log('3️⃣ Common Issues & Solutions:\n');
console.log('   ❌ "OAuth Not Configured" error:');
console.log('      → Google OAuth not enabled in Clerk Dashboard');
console.log('      → Go to: https://dashboard.clerk.com → Configure → SSO connections → Google\n');

console.log('   ❌ "Session already exists" error:');
console.log('      → Stale session or OAuth misconfiguration');
console.log('      → Clear app data or sign out completely\n');

console.log('   ❌ Button doesn\'t appear:');
console.log('      → Clerk key not configured correctly');
console.log('      → Restart Expo with: npx expo start --clear\n');

console.log('   ❌ OAuth flow redirects but fails:');
console.log('      → Redirect URI mismatch in Google Console');
console.log('      → Should be: https://accounts.clerk.dev/v1/oauth_callback');
console.log('      → Or your Clerk instance URL: https://YOUR-INSTANCE.clerk.accounts.dev/v1/oauth_callback\n');

// Check 4: Next Steps
console.log('4️⃣ Next Steps:\n');
console.log('   📋 Quick Fix Checklist:');
console.log('   1. Verify Clerk key in .env.local');
console.log('   2. Go to Clerk Dashboard: https://dashboard.clerk.com');
console.log('   3. Navigate to: Configure → SSO connections → Google');
console.log('   4. Make sure "Use custom credentials" is enabled');
console.log('   5. Verify Client ID and Client Secret are set');
console.log('   6. Check redirect URI in Google Console matches Clerk');
console.log('   7. Restart Expo: npx expo start --clear');
console.log('   8. Test Google sign-in button\n');

console.log('   🔗 Helpful Links:');
console.log('   - Clerk Dashboard: https://dashboard.clerk.com');
console.log('   - Google Cloud Console: https://console.cloud.google.com/');
console.log('   - Setup Guide: mobile/GOOGLE_OAUTH_SETUP.md\n');

console.log('================================\n');
console.log('✅ Diagnostic complete!\n');












