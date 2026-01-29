# 🚀 Quick Fix: Google Sign-In Not Working

## ✅ Your Clerk Key is Configured!

The diagnostic shows your Clerk key is set up correctly. The issue is likely that **Google OAuth isn't enabled** in your Clerk dashboard.

---

## 🔧 Quick Fix (5 minutes)

### Step 1: Enable Google OAuth in Clerk Dashboard

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Select your app**: "Build profit solutions"
3. **Navigate to**: `Configure` → `SSO connections` (or `User & Authentication` → `Social Connections`)
4. **Find "Google"** in the list
5. **Click the gear icon** (⚙️) or **"Configure"** button
6. **Enable Google OAuth**:
   - Toggle **"Use custom credentials"** to ON
   - You'll need to add Google Client ID and Secret (see Step 2)

### Step 2: Get Google OAuth Credentials

You have two options:

#### Option A: Use Clerk's Default (Easiest - 1 minute)
1. In Clerk Dashboard → Google OAuth settings
2. **Don't enable "Use custom credentials"** - leave it OFF
3. Clerk will use their default Google OAuth app
4. Click **"Save"**
5. **Done!** ✅

#### Option B: Use Your Own Google OAuth (More Control - 5 minutes)
1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or select a project**
3. **Enable Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search "Google+ API" → Enable
4. **Create OAuth 2.0 Client**:
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: **Web application**
   - Name: "Build Profit Solutions"
   - **Authorized redirect URIs**: Add this EXACT URL:
     ```
     https://accounts.clerk.dev/v1/oauth_callback
     ```
   - Click "Create"
5. **Copy Client ID and Client Secret**
6. **Back in Clerk Dashboard**:
   - Enable "Use custom credentials"
   - Paste Client ID
   - Paste Client Secret
   - Click "Save"

### Step 3: Restart Your App

```bash
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --clear
```

### Step 4: Test

1. **Open your app** on your device
2. **Go to Sign In or Create Account screen**
3. **Tap "Continue with Google"**
4. **Should work now!** ✅

---

## 🐛 Common Errors & Fixes

### Error: "OAuth Not Configured"
**Fix**: Google OAuth not enabled in Clerk Dashboard
- Go to Clerk Dashboard → Configure → SSO connections → Google
- Make sure it's enabled (either with custom credentials or Clerk's default)

### Error: "Session already exists"
**Fix**: Stale session
- Sign out completely from the app
- Clear app data (or reinstall app)
- Try again

### Error: Redirect URI mismatch
**Fix**: Wrong redirect URI in Google Console
- In Google Cloud Console → Credentials → Your OAuth client
- Make sure redirect URI is: `https://accounts.clerk.dev/v1/oauth_callback`
- Or use your Clerk instance URL: `https://YOUR-INSTANCE.clerk.accounts.dev/v1/oauth_callback`

### Button doesn't appear
**Fix**: App needs restart
```bash
cd mobile
npx expo start --clear
```
- Shake device → Reload
- Or restart Expo completely

---

## 📚 Full Setup Guide

For detailed step-by-step instructions, see:
- **`mobile/GOOGLE_OAUTH_SETUP.md`** - Complete setup guide
- **`mobile/CLERK_KEY_SETUP.md`** - Clerk key setup (already done ✅)

---

## ✅ Checklist

- [x] Clerk key configured (✅ Done!)
- [ ] Google OAuth enabled in Clerk Dashboard
- [ ] Google Client ID/Secret added (if using custom)
- [ ] Redirect URI configured in Google Console (if using custom)
- [ ] App restarted with `--clear` flag
- [ ] Tested Google sign-in button

---

**Need help?** Run the diagnostic tool:
```bash
cd mobile
node scripts/diagnose-google-signin.js
```












