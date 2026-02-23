#!/bin/bash

echo "🔍 Diagnosing Google Sign-In Issue"
echo "==================================="
echo ""

cd "$(dirname "$0")"

# Check 1: Clerk key configured
echo "1️⃣ Checking Clerk configuration..."
if [ -f ".env.local" ]; then
    if grep -q "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.local; then
        echo "✅ Clerk key found in .env.local"
        CLERK_KEY=$(grep "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.local | cut -d '=' -f2)
        if [ ! -z "$CLERK_KEY" ] && [ "$CLERK_KEY" != "YOUR_CLERK_KEY_HERE" ]; then
            echo "✅ Clerk key is set (starts with: ${CLERK_KEY:0:10}...)"
        else
            echo "❌ Clerk key is not set or is placeholder"
        fi
    else
        echo "❌ Clerk key not found in .env.local"
    fi
else
    echo "⚠️  .env.local file not found"
fi

echo ""

# Check 2: Check for common error patterns
echo "2️⃣ Common issues to check:"
echo ""
echo "   📋 Checklist:"
echo "   [ ] Google OAuth enabled in Clerk Dashboard"
echo "   [ ] Google Client ID/Secret configured (or using Clerk default)"
echo "   [ ] Redirect URI matches: https://accounts.clerk.dev/v1/oauth_callback"
echo "   [ ] App restarted after enabling OAuth"
echo ""

# Check 3: Network connectivity (for hotel WiFi)
echo "3️⃣ Network check..."
echo "   ⚠️  If you're on hotel WiFi, OAuth might be blocked"
echo "   💡 Try using your phone's mobile hotspot instead"
echo ""

echo "===================================="
echo ""
echo "🔧 Quick Fix Steps:"
echo ""
echo "1. Enable Google OAuth in Clerk Dashboard:"
echo "   → https://dashboard.clerk.com"
echo "   → Your app → Configure → SSO connections"
echo "   → Find Google → Click Configure"
echo "   → Either use Clerk's default OR add your own credentials"
echo ""
echo "2. Restart your app:"
echo "   cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile"
echo "   npx expo start --clear"
echo ""
echo "3. Test Google sign-in button"
echo ""
echo "📚 Full guide: mobile/GOOGLE_OAUTH_SETUP.md"
echo ""
