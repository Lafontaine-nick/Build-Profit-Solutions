# OAuth Troubleshooting Guide

This document explains common OAuth issues and how to prevent them.

## ✅ Issues We Fixed

### 1. Redirect URI Configuration
**Problem**: Redirect URIs must match exactly in both Google Console and Clerk Dashboard.

**Solution**:
- **Google Console**: Only use `https://` URIs (not `clerk://` for web applications)
  - ✅ `https://accounts.clerk.dev/v1/oauth_callback`
  - ✅ `https://nearby-collie-1.clerk.accounts.dev/v1/oauth_callback`
  - ❌ `clerk://accounts.clerk.dev/v1/oauth_callback` (only for mobile apps, not web)

- **Clerk Dashboard**: Use your instance-specific redirect URI
  - ✅ `https://nearby-collie-1.clerk.accounts.dev/v1/oauth_callback`

### 2. Auth State Mismatch
**Problem**: Two auth systems (Clerk and clerkAuthService) were out of sync.

**Solution**: Updated `useRequireAuth` to check Clerk's auth state when Clerk is enabled.

### 3. "Session Exists" Error Handling
**Problem**: Error message was misleading - it said "already signed in" but user wasn't actually signed in.

**Solution**: Code now verifies actual Clerk auth state before treating it as success.

## 🔍 How to Verify OAuth is Working

1. **Check Clerk Dashboard**:
   - Go to Configure → SSO connections → Google
   - Verify "Use custom credentials" is enabled
   - Verify Client ID and Client Secret are set
   - Verify redirect URI includes `/v1/oauth_callback`

2. **Check Google Console**:
   - Go to APIs & Services → Credentials
   - Edit your OAuth 2.0 Client ID
   - Verify redirect URIs are correct (only `https://` for web apps)

3. **Test in App**:
   - Tap "Continue with Google"
   - Should redirect to Google sign-in
   - After signing in, should return to app and be logged in

## 🚨 Common Errors and Fixes

### Error: "Session already exists"
- **If user IS signed in**: This is normal, app should navigate to main screen
- **If user is NOT signed in**: OAuth isn't configured properly in Clerk dashboard

### Error: "OAuth Not Configured"
**For Google**:
- Check Clerk dashboard → SSO connections → Google is enabled
- Verify Client ID and Secret are set
- Verify redirect URI is correct

**For Apple**:
- Check Clerk dashboard → SSO connections → Apple is enabled
- Verify Service ID, Key ID, Team ID, and Key file (.p8) are set
- Verify Apple Developer Portal configuration is complete
- See `APPLE_OAUTH_SETUP.md` for detailed setup

### Error: "Invalid Redirect URI" (Google only)
- Check Google Console redirect URIs match exactly
- Remove any `clerk://` URIs from web application OAuth client
- Only use `https://` URIs for web applications

### Error: "Apple Sign-In Error" (Apple only)
- Verify Apple Developer account is active
- Check App ID has "Sign in with Apple" enabled
- Verify Service ID is configured with correct return URLs
- Ensure Key file (.p8) is valid and uploaded to Clerk
- See `APPLE_OAUTH_SETUP.md` for step-by-step instructions

### User gets redirected back to auth after signing in
- This was caused by `useRequireAuth` checking wrong auth system
- Fixed: Now checks Clerk's auth state when Clerk is enabled

## 📝 Checklist for OAuth Setup

### Google OAuth
- [ ] Google OAuth app created in Google Cloud Console
- [ ] Redirect URIs added to Google Console (only `https://`)
- [ ] Google OAuth enabled in Clerk Dashboard
- [ ] Client ID and Secret added to Clerk Dashboard
- [ ] Redirect URI in Clerk matches: `https://[your-instance].clerk.accounts.dev/v1/oauth_callback`
- [ ] App reloaded after configuration changes
- [ ] Tested Google sign-in flow

### Apple OAuth (iOS only)
- [ ] Apple Developer account active
- [ ] App ID created with "Sign in with Apple" enabled
- [ ] Service ID created and configured
- [ ] Key file (.p8) created and downloaded
- [ ] Return URLs configured in Service ID
- [ ] Apple OAuth enabled in Clerk Dashboard
- [ ] Service ID, Key ID, Team ID, and Key file added to Clerk
- [ ] App reloaded after configuration changes
- [ ] Tested Apple sign-in flow on iOS device

## 🔄 If OAuth Stops Working

1. **Check Configuration**:
   - Verify all settings in Clerk Dashboard
   - Verify redirect URIs in Google Console

2. **Clear Cache**:
   ```bash
   cd mobile
   npx expo start -c --tunnel
   ```

3. **Check Logs**:
   - Look for "Session exists error detected" in logs
   - Check if `isActuallySignedIn` is true or false
   - Verify `useRequireAuth` is checking Clerk auth state

4. **Re-test**:
   - Sign out completely
   - Try Google sign-in again
   - Check logs for any errors

