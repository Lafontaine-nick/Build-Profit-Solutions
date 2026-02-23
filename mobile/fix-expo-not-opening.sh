#!/bin/bash

echo "🔧 Fixing Expo App Not Opening..."
echo "=================================="
echo ""

# Step 1: Kill all Expo and Metro processes
echo "1️⃣ Stopping all Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "node.*expo" 2>/dev/null || true

# Step 2: Free up port 8081
echo "2️⃣ Freeing port 8081..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Wait for processes to fully stop
sleep 2

# Step 3: Clear all caches
echo "3️⃣ Clearing all caches..."
cd "$(dirname "$0")"
rm -rf .expo .expo-shared 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .metro-cache 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🚀 Starting Expo with tunnel mode..."
echo "   (This will show a QR code you can scan)"
echo ""
echo "📱 Next steps:"
echo "   1. Wait for QR code to appear"
echo "   2. Open Expo Go app on your phone"
echo "   3. Scan the QR code"
echo "   4. App should load!"
echo ""
echo "=================================="
echo ""

# Start Expo with tunnel mode and clear cache
EXPO_NO_DOCTOR=1 npx expo start --tunnel --clear
