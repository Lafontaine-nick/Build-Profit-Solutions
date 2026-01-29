# 🔐 Google OAuth Setup - Step by Step

Follow these exact steps to enable Google Sign-In:

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### 1.2 Create or Select a Project
1. Click the project dropdown at the top
2. Click **"New Project"** (or select existing)
3. Name it: **"Build Profit Solutions"**
4. Click **"Create"**

### 1.3 Enable Google+ API
1. Go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"**
3. Click on it and click **"Enable"**

### 1.4 Create OAuth 2.0 Credentials
1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. If prompted, configure OAuth consent screen:
   - User Type: **External** (for testing)
   - App name: **Build Profit Solutions**
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"** through the steps
4. Back to Credentials:
   - Application type: **Web application**
   - Name: **Build Profit Solutions Web Client**
   - Authorized redirect URIs: Add these EXACT URLs:
     ```
     https://accounts.clerk.dev/v1/oauth_callback
     clerk://accounts.clerk.dev/v1/oauth_callback
     ```
   - Click **"Create"**
5. **COPY** the **Client ID** and **Client Secret** (you'll need these!)

## Step 2: Configure in Clerk Dashboard

### 2.1 Go to Clerk Dashboard
1. Visit: https://dashboard.clerk.com
2. Select your application: **"Build profit solutions"**
3. Go to **"Configure"** → **"SSO connections"** (or **"User & authentication"** → **"Social Connections"**)

### 2.2 Configure Google
1. Find **"Google"** in the list
2. Click the **gear icon** (⚙️) or **"Configure"**
3. Paste your **Client ID** from Step 1.4
4. Paste your **Client Secret** from Step 1.4
5. Click **"Save"**

## Step 3: Test in Your App

1. **Reload your app** (press `r` in Expo terminal or shake device → Reload)
2. Go to **Sign In** or **Create Account** screen
3. You should see **"Continue with Google"** button
4. Click it to test!

## Troubleshooting

**Buttons don't appear?**
- Make sure you saved the credentials in Clerk
- Reload the app with cache clear: `npx expo start -c --tunnel`
- Check that redirect URIs match exactly

**OAuth flow fails?**
- Verify redirect URIs in Google Console match exactly
- Check Clerk dashboard for error messages
- Make sure Google+ API is enabled

## Quick Checklist

- [ ] Created Google Cloud project
- [ ] Enabled Google+ API
- [ ] Created OAuth 2.0 Client ID (Web application)
- [ ] Added redirect URIs:
  - `https://accounts.clerk.dev/v1/oauth_callback`
  - `clerk://accounts.clerk.dev/v1/oauth_callback`
- [ ] Copied Client ID and Client Secret
- [ ] Pasted credentials in Clerk dashboard
- [ ] Saved configuration in Clerk
- [ ] Reloaded app
- [ ] Tested Google sign-in button





