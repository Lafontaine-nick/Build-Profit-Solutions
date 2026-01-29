# 🚀 Quick OAuth Setup Guide

Your Clerk key is already configured! ✅

## Next Steps to Enable Google & Apple Sign-In:

### 1. Go to Clerk Dashboard
Visit: https://dashboard.clerk.com

### 2. Enable Google OAuth
1. Go to **User & Authentication** → **Social Connections**
2. Find **Google** and click **Configure**
3. You'll need to:
   - Create a Google OAuth app at [Google Cloud Console](https://console.cloud.google.com/)
   - Get Client ID and Client Secret
   - Add redirect URI: `https://accounts.clerk.dev/v1/oauth_callback`
4. Paste your Google credentials in Clerk
5. Click **Save**

### 3. Enable Apple OAuth (iOS only)
1. Go to **User & Authentication** → **Social Connections**
2. Find **Apple** and click **Configure**
3. You'll need:
   - Apple Developer account
   - App ID with Sign in with Apple capability
   - Service ID
   - Key file (.p8)
4. Upload and configure in Clerk
5. Click **Save**

### 4. Restart Your App
After enabling OAuth providers:

```bash
cd mobile
npx expo start -c --tunnel
```

The Google and Apple buttons will now work! 🎉

## Testing
1. Open your app
2. Go to Sign In or Create Account screen
3. You should see:
   - ✅ "Continue with Google" button
   - ✅ "Continue with Apple" button (iOS only)
4. Click either button to test OAuth flow

## Troubleshooting

**Buttons don't appear?**
- Make sure you restarted Expo with `-c` flag (clears cache)
- Check that OAuth providers are enabled in Clerk dashboard

**OAuth flow fails?**
- Verify redirect URIs are correct in Google/Apple console
- Check Clerk dashboard for error messages
- Make sure you're using the correct Client ID/Secret

## Your Current Setup
- ✅ Clerk Key: Configured in `.env.local`
- ⏳ Google OAuth: Needs to be enabled in Clerk dashboard
- ⏳ Apple OAuth: Needs to be enabled in Clerk dashboard





