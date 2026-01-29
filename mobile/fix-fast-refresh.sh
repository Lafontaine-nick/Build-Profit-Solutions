#!/bin/bash

echo "🔥 Fixing Fast Refresh..."
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")"

echo "1️⃣  Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache

echo "2️⃣  Clearing Metro bundler cache..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

echo "3️⃣  Starting Expo with cleared cache..."
echo ""
echo "✅ Ready! Now:"
echo "   - Scan QR code with Expo Go"
echo "   - Shake device → Settings → Enable 'Fast Refresh'"
echo "   - Make a change and save - it should reload automatically"
echo ""

npx expo start --clear







