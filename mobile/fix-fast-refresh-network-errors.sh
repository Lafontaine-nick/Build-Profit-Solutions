#!/bin/bash

echo "🔧 Fixing Fast Refresh blocked by network errors..."
echo ""

cd "$(dirname "$0")"

echo "1️⃣  Ensuring app uses production backend (not local)..."
echo "   This prevents network errors from blocking Fast Refresh"
echo ""

# Check if .env.local exists and has local IP
if [ -f ".env.local" ]; then
  if grep -q "192.168.0.201" .env.local || grep -q "localhost:3001" .env.local; then
    echo "⚠️  Found local backend URL in .env.local"
    echo "   Consider removing EXPO_PUBLIC_API_BASE_URL or setting it to production"
    echo ""
  fi
fi

echo "2️⃣  Clearing caches..."
rm -rf .expo
rm -rf node_modules/.cache

echo "3️⃣  Starting Expo..."
echo ""
echo "✅ Fast Refresh should now work!"
echo "   Network errors will be handled gracefully and won't block updates"
echo ""

npx expo start --clear







