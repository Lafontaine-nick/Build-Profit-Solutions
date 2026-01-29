#!/usr/bin/env node

/**
 * OAuth Setup Verification Script
 * Checks if OAuth is properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying OAuth Setup...\n');

// Check 1: Clerk Key
const envPath = path.join(__dirname, '.env.local');
let clerkKey = null;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=(.+)/);
  if (match) {
    clerkKey = match[1].trim();
  }
}

if (clerkKey && clerkKey.startsWith('pk_test_') && clerkKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk') {
  console.log('✅ Clerk Key: Configured');
  console.log(`   Key: ${clerkKey.substring(0, 20)}...`);
} else {
  console.log('❌ Clerk Key: Not configured or invalid');
  console.log('   Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local');
}

// Check 2: OAuth Buttons Component
const oauthButtonsPath = path.join(__dirname, 'components', 'OAuthButtons.tsx');
if (fs.existsSync(oauthButtonsPath)) {
  console.log('✅ OAuth Buttons Component: Found');
} else {
  console.log('❌ OAuth Buttons Component: Missing');
}

// Check 3: Auth Screen
const authPath = path.join(__dirname, 'app', 'auth.tsx');
if (fs.existsSync(authPath)) {
  const authContent = fs.readFileSync(authPath, 'utf8');
  if (authContent.includes('OAuthButtons')) {
    console.log('✅ Auth Screen: OAuth integrated');
  } else {
    console.log('⚠️  Auth Screen: OAuth not integrated');
  }
} else {
  console.log('❌ Auth Screen: Not found');
}

// Check 4: useRequireAuth checks Clerk auth
const useRequireAuthPath = path.join(__dirname, 'hooks', 'useRequireAuth.ts');
if (fs.existsSync(useRequireAuthPath)) {
  const content = fs.readFileSync(useRequireAuthPath, 'utf8');
  if (content.includes('useAuth') && content.includes('clerkAuth')) {
    console.log('✅ useRequireAuth: Checks Clerk auth state');
  } else {
    console.log('⚠️  useRequireAuth: May not check Clerk auth state');
  }
} else {
  console.log('❌ useRequireAuth: Not found');
}

// Check 5: Error handling in auth.tsx
if (fs.existsSync(authPath)) {
  const authContent = fs.readFileSync(authPath, 'utf8');
  if (authContent.includes('isActuallySignedIn') && authContent.includes('clerkAuth?.isSignedIn')) {
    console.log('✅ Error Handling: Verifies actual auth state');
  } else {
    console.log('⚠️  Error Handling: May not verify auth state');
  }
}

console.log('\n📋 Next Steps:');
console.log('1. Set up Google OAuth in Google Cloud Console');
console.log('2. Add credentials to Clerk dashboard');
console.log('3. See GOOGLE_OAUTH_SETUP.md for detailed instructions');
console.log('4. See OAUTH_FIXES_SUMMARY.md for what was fixed');
console.log('5. Reload your app: npx expo start -c --tunnel');
console.log('\n💡 Tip: If OAuth stops working, check OAUTH_TROUBLESHOOTING.md');

