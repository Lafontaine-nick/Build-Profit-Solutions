# 🔐 Clerk Authentication Setup

## Get Your Clerk API Key

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Sign up or log in**
3. **Create a new application** (or select existing)
4. **Go to API Keys** section
5. **Copy your Publishable Key** (starts with `pk_live_` or `pk_test_`)

## Update Your App

### Update .env.local file:
```bash
cd mobile
nano .env.local
```

Replace the placeholder key with your real key:
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_REAL_KEY_HERE
```

### Or disable Clerk temporarily:

Update `mobile/.env.local`:
```
# Comment out or remove Clerk key to bypass authentication
# EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Then restart Expo:
```bash
npx expo start --clear
```

## Test Without Clerk

You can test the app without authentication by:
1. Removing Clerk from the layout temporarily
2. Or using mock authentication
3. Or getting a real Clerk key (free tier available)

## Free Tier

Clerk offers a free tier with:
- Up to 5,000 monthly active users
- All authentication methods
- Perfect for testing and development 