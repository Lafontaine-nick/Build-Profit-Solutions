# 🔑 Step-by-Step Clerk Key Setup Guide

Follow these steps to get your Clerk key and add it to your app.

## Step 1: Create a Clerk Account (if you don't have one)

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Click "Sign Up"** (or "Log In" if you already have an account)
3. **Sign up with**:
   - Email address, OR
   - GitHub account (recommended for developers)

## Step 2: Create a New Application

1. **After logging in**, you'll see the Clerk dashboard
2. **Click "Create Application"** button (or "New Application")
3. **Fill in the details**:
   - **Application Name**: `Build Profit Solutions` (or any name you prefer)
   - **Authentication Options**: Keep default settings
4. **Click "Create"**

## Step 3: Get Your Publishable Key

1. **In your application dashboard**, look for the **"API Keys"** section
   - It's usually in the left sidebar or in the main dashboard
2. **Find the "Publishable Key"**
   - It will start with `pk_test_` (for development) or `pk_live_` (for production)
   - For now, use the **test key** (starts with `pk_test_`)
3. **Click the copy icon** next to the key to copy it
   - It will look something like: `pk_test_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890`

## Step 4: Add the Key to Your App

### Option A: Using Terminal (Recommended)

1. **Open Terminal** and navigate to your mobile directory:
   ```bash
   cd /Users/nick_lafontaine/build-profit-solutions/mobile
   ```

2. **Open the .env.local file**:
   ```bash
   nano .env.local
   ```
   (Or use `code .env.local` if you prefer VS Code)

3. **Find this line**:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
   ```

4. **Replace** `pk_test_your_clerk_publishable_key_here` with your actual key:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
   ```
   (Use YOUR actual key, not this example!)

5. **Save the file**:
   - In nano: Press `Ctrl + X`, then `Y`, then `Enter`
   - In VS Code: Just save the file (`Cmd + S`)

### Option B: Using VS Code or Your Editor

1. **Open the file**: `mobile/.env.local`
2. **Find the line** with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. **Replace the placeholder** with your actual Clerk key
4. **Save the file**

## Step 5: Verify the Key is Set

1. **Check that your key is correct**:
   ```bash
   cd /Users/nick_lafontaine/build-profit-solutions/mobile
   cat .env.local | grep CLERK
   ```

2. **You should see**:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY
   ```

3. **Make sure**:
   - The key starts with `pk_test_` or `pk_live_`
   - There are no extra spaces or quotes around the key
   - The key is on a single line

## Step 6: Restart Your App

1. **Stop your current Expo server** (if running):
   - Press `Ctrl + C` in the terminal where Expo is running

2. **Clear the cache and restart**:
   ```bash
   cd /Users/nick_lafontaine/build-profit-solutions/mobile
   npx expo start --clear
   ```

3. **Wait for the app to reload** - you should see the Metro bundler start

## Step 7: Test It Works

1. **Open your app** on your device/simulator
2. **Go to the Create Account or Sign In screen**
3. **You should now see**:
   - ✅ "Continue with Google" button
   - ✅ "Continue with Apple" button (iOS only)
   - ✅ The buttons should appear (they were hidden before)

## Troubleshooting

### Key not working?

1. **Check the key format**:
   - Must start with `pk_test_` or `pk_live_`
   - Should be about 50-60 characters long
   - No spaces or line breaks

2. **Make sure you saved the file**:
   ```bash
   cat mobile/.env.local
   ```

3. **Restart Expo with cache clear**:
   ```bash
   npx expo start --clear
   ```

4. **Check the console** for errors:
   - Look for "Clerk OAuth hooks not available" messages
   - If you see this, the key might not be loaded correctly

### Still having issues?

1. **Verify the key in Clerk Dashboard**:
   - Go back to https://dashboard.clerk.com
   - Check that you copied the correct key
   - Make sure you're using the **Publishable Key**, not the Secret Key

2. **Check your app.config.js**:
   - The file should have: `clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - This is already set up correctly in your project ✅

3. **Try a different key**:
   - In Clerk Dashboard, you can regenerate keys if needed
   - Make sure to update `.env.local` with the new key

## Next Steps

Once your Clerk key is set up, you can:
1. ✅ Use email/password authentication (already working)
2. ✅ Set up Google OAuth (see `OAUTH_SETUP_GUIDE.md`)
3. ✅ Set up Apple OAuth (see `OAUTH_SETUP_GUIDE.md`)

## Need Help?

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk Support**: support@clerk.com
- **Clerk Discord**: https://clerk.com/discord






