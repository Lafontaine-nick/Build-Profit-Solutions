# 🔐 Google & Apple Sign-In Setup Guide

This guide will walk you through setting up Google and Apple OAuth sign-in for your app using Clerk.

## Quick Start (5 minutes)

### Step 1: Get Your Clerk Key

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Sign up** for a free account (or log in)
3. **Create a new application** or select existing
4. **Copy your Publishable Key** from **API Keys** section
   - Starts with `pk_test_` (development) or `pk_live_` (production)

### Step 2: Add Key to Your App

```bash
cd mobile
nano .env.local
```

Add this line (replace with your actual key):
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_REAL_KEY_HERE
```

### Step 3: Enable OAuth in Clerk Dashboard

1. In Clerk Dashboard, go to **User & Authentication** → **Social Connections**
2. Click **Configure** next to **Google**
3. Follow the setup steps below for Google
4. Click **Configure** next to **Apple** (iOS only)
5. Follow the setup steps below for Apple

### Step 4: Restart Your App

```bash
cd mobile
npx expo start --clear
```

The Google and Apple buttons will now appear and work! 🎉

---

## Detailed Setup Instructions

## Step 3: Enable OAuth Providers in Clerk

### For Google Sign-In:

1. In Clerk Dashboard, go to **User & Authentication** → **Social Connections**
2. Find **Google** and click **Configure**
3. You'll need to create a Google OAuth app:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or select existing)
   - Enable **Google+ API**
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: 
     - `https://accounts.clerk.dev/v1/oauth_callback`
     - `clerk://accounts.clerk.dev/v1/oauth_callback` (for mobile)
   - Copy the **Client ID** and **Client Secret**
4. Back in Clerk, paste your Google **Client ID** and **Client Secret**
5. Click **Save**

### For Apple Sign-In:

1. In Clerk Dashboard, go to **User & Authentication** → **Social Connections**
2. Find **Apple** and click **Configure**
3. You'll need to set up Apple Sign-In:
   - Go to [Apple Developer Portal](https://developer.apple.com/)
   - Create an **App ID** with Sign in with Apple capability
   - Create a **Service ID** for Sign in with Apple
   - Configure the redirect URL: `https://accounts.clerk.dev/v1/oauth_callback`
   - Create a **Key** for Sign in with Apple
   - Download the key file (.p8)
4. Back in Clerk, upload your Apple key file and enter:
   - **Team ID** (from Apple Developer account)
   - **Key ID** (from the key you created)
   - **Service ID**
5. Click **Save**

## Step 4: Update App Configuration

Make sure your `app.config.js` includes the Clerk key:

```javascript
extra: {
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  // ... other config
}
```

## Step 5: Restart Your App

After configuring everything:

```bash
cd mobile
npx expo start --clear
```

## Step 6: Test OAuth Sign-In

1. Open your app
2. Go to the **Create account** or **Sign in** screen
3. You should now see:
   - **Continue with Google** button
   - **Continue with Apple** button (iOS only)
4. Click either button to test the OAuth flow

## Troubleshooting

### Buttons don't appear:
- Make sure your Clerk key is set correctly in `.env.local`
- Restart Expo with `--clear` flag
- Check that the key starts with `pk_test_` or `pk_live_`

### OAuth flow fails:
- Verify OAuth providers are enabled in Clerk dashboard
- Check that redirect URIs are configured correctly
- Make sure you're using the correct Client ID/Secret for Google
- For Apple, verify your key file and IDs are correct

### "OAuth Setup Required" message:
- This means Clerk is configured but OAuth providers aren't set up yet
- Follow Step 3 above to enable Google/Apple in Clerk

## Free Tier Limits

Clerk's free tier includes:
- ✅ Up to 5,000 monthly active users
- ✅ All authentication methods (including OAuth)
- ✅ Perfect for development and testing

## Need Help?

- Clerk Documentation: https://clerk.com/docs
- Clerk Support: support@clerk.com
- Google OAuth Setup: https://developers.google.com/identity/protocols/oauth2
- Apple Sign-In Setup: https://developer.apple.com/sign-in-with-apple/

