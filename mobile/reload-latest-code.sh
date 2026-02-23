#!/bin/bash

echo "🔄 Reloading App with Latest Code"
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

# Step 2: Clear ALL caches
echo "2️⃣ Clearing all caches..."
rm -rf .expo .expo-shared 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .metro-cache 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true

# Step 3: Clear watchman if installed
if command -v watchman > /dev/null 2>&1; then
    echo "   Clearing watchman cache..."
    watchman watch-del-all 2>/dev/null || true
fi

echo ""
echo "✅ Caches cleared!"
echo ""
echo "3️⃣ Starting Expo with fresh cache..."
echo "   This will load the latest code"
echo ""
echo "📱 After Metro starts:"
echo "   - In iOS Simulator: Press Cmd+R to reload"
echo "   - Or shake simulator: Device → Shake (Cmd+Ctrl+Z) → Reload"
echo ""
echo "===================================="
echo ""

# Start with clear cache
EXPO_NO_DOCTOR=1 npx expo start --clear
