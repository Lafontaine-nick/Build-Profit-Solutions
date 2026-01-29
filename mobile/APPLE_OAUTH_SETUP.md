# 🍎 Apple Sign-In Setup - Step by Step

Follow these exact steps to enable Apple Sign-In (iOS only):

## Prerequisites
- Apple Developer Account (required for Apple Sign-In)
- Your app must be running on iOS (Apple Sign-In doesn't work on Android)

## Step 1: Configure Apple Sign-In in Apple Developer Portal

### 1.1 Create App ID with Sign in with Apple
1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Sign in with your Apple Developer account
3. Go to **Certificates, Identifiers & Profiles**
4. Click **Identifiers** → **+** (plus button)
5. Select **App IDs** → **Continue**
6. Select **App** → **Continue**
7. Fill in:
   - **Description**: Build Profit Solutions
   - **Bundle ID**: Use your app's bundle ID (e.g., `com.yourcompany.buildprofitsolutions`)
8. Scroll down and check **Sign in with Apple**
9. Click **Continue** → **Register**

### 1.2 Create Service ID
1. Still in **Identifiers**, click **+** again
2. Select **Services IDs** → **Continue**
3. Fill in:
   - **Description**: Build Profit Solutions Web
   - **Identifier**: `com.yourcompany.buildprofitsolutions.web` (must be unique)
4. Click **Continue** → **Register**
5. Click on your new Service ID
6. Check **Sign in with Apple**
7. Click **Configure**
8. Select your **Primary App ID** (the one from Step 1.1)
9. **Domains and Subdomains**: Add `accounts.clerk.dev`
10. **Return URLs**: Add `https://accounts.clerk.dev/v1/oauth_callback`
11. Click **Save** → **Continue** → **Save**

### 1.3 Create Key for Sign in with Apple
1. Go to **Keys** → **+** (plus button)
2. Fill in:
   - **Key Name**: Sign in with Apple Key
   - Check **Sign in with Apple**
3. Click **Configure**
4. Select your **Primary App ID** (from Step 1.1)
5. Click **Save** → **Continue** → **Register**
6. **IMPORTANT**: Download the key file (.p8) - you can only download it once!
7. **Note your Key ID** (shown on the confirmation page)
8. **Note your Team ID** (found in the top right of Apple Developer Portal)

## Step 2: Configure in Clerk Dashboard

### 2.1 Go to Clerk Dashboard
1. Visit: https://dashboard.clerk.com
2. Select your application: **"Build profit solutions"** (or your app name)
3. Go to **User & Authentication** → **Social Connections**

### 2.2 Configure Apple
1. Find **Apple** in the list
2. Click **Configure** (or the gear icon ⚙️)
3. Fill in the form:
   - **Team ID**: Your Apple Developer Team ID (from Step 1.3)
   - **Key ID**: Your Key ID (from Step 1.3)
   - **Service ID**: Your Service ID (from Step 1.2, e.g., `com.yourcompany.buildprofitsolutions.web`)
   - **Key File**: Upload the .p8 key file you downloaded in Step 1.3
4. Click **Save**

## Step 3: Test in Your App

1. **Reload your app** (press `r` in Expo terminal or shake device → Reload)
2. Go to **Sign In** or **Create Account** screen
3. You should see **"Continue with Apple"** button
4. Click it to test the Apple Sign-In flow

## Troubleshooting

### "Apple Sign-In Error" or network errors:
- ✅ Verify Apple OAuth is enabled in Clerk dashboard
- ✅ Check that your Service ID return URL matches: `https://accounts.clerk.dev/v1/oauth_callback`
- ✅ Make sure your Key ID, Team ID, and Service ID are correct
- ✅ Verify the .p8 key file was uploaded correctly

### Button doesn't appear:
- ✅ Make sure you're on iOS (Apple Sign-In only works on iOS)
- ✅ Restart Expo with `--clear` flag: `npx expo start -c`
- ✅ Check that Clerk key is configured correctly

### "Sign in with Apple" not available:
- ✅ Make sure you have an Apple Developer account
- ✅ Verify your App ID has "Sign in with Apple" capability enabled
- ✅ Check that you're testing on a real iOS device or simulator (not Android)

## Important Notes

- ⚠️ Apple Sign-In **only works on iOS devices** (iPhone, iPad, iOS Simulator)
- ⚠️ You **must have an Apple Developer account** (free or paid)
- ⚠️ The .p8 key file can only be downloaded **once** - keep it safe!
- ⚠️ Service ID return URL must **exactly match**: `https://accounts.clerk.dev/v1/oauth_callback`

## Quick Checklist

- [ ] Created App ID with Sign in with Apple capability
- [ ] Created Service ID with Sign in with Apple
- [ ] Created Key for Sign in with Apple
- [ ] Downloaded .p8 key file
- [ ] Noted Key ID and Team ID
- [ ] Configured Apple in Clerk dashboard with all credentials
- [ ] Tested on iOS device or simulator

Once all steps are complete, Apple Sign-In should work! 🎉





