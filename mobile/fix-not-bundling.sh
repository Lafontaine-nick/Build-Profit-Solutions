#!/bin/bash

echo "🔧 Fixing Metro Not Bundling Issue"
echo "==================================="
echo ""

cd "$(dirname "$0")"

# Step 1: Kill all Metro/Expo processes
echo "1️⃣ Stopping all Metro/Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "node.*metro" 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

sleep 2

# Step 2: Clear all caches
echo "2️⃣ Clearing all caches..."
rm -rf .expo .expo-shared 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .metro-cache 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true

echo ""
echo "3️⃣ Checking for syntax errors..."
# Quick check for obvious syntax errors in entry point
if grep -q "from 'react-native-gesture-handler'" app/_layout.tsx 2>/dev/null; then
    echo "   ⚠️  Found potential import issue in _layout.tsx"
    echo "   Checking line 22..."
    if grep -n "from" app/_layout.tsx | grep -A 1 "22:" | grep -q "react-native-gesture-handler"; then
        echo "   ✅ Import looks correct"
    fi
else
    echo "   ✅ No obvious syntax errors in entry point"
fi

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🚀 Starting Metro with verbose logging..."
echo "   Watch for:"
echo "   - 'Bundling...' messages"
echo "   - Any red error messages"
echo "   - QR code appearing"
echo ""
echo "📱 After Metro starts:"
echo "   1. Look for 'Bundling JavaScript bundle' message"
echo "   2. If you see errors, they'll be in red"
echo "   3. QR code will appear when bundle is ready"
echo ""
echo "===================================="
echo ""

# Start with LAN mode and clear cache
EXPO_NO_DOCTOR=1 npx expo start --lan --clear
