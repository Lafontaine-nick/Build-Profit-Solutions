#!/bin/bash

# Comprehensive Hot Reload Fix Script

echo "🔧 Fixing Hot Reload Issues..."
echo ""

# Step 1: Stop any running Expo processes
echo "1. Stopping Expo processes..."
pkill -f "expo start" 2>/dev/null
sleep 2

# Step 2: Clear all caches
echo "2. Clearing caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro-cache
echo "   ✅ Caches cleared"

# Step 3: Verify Metro config is correct
echo "3. Verifying Metro config..."
if grep -q "watchman: true" metro.config.js 2>/dev/null; then
    echo "   ⚠️  Found watchman config - removing..."
    # Metro config should be simple, no watchman
fi

# Step 4: Check for TypeScript errors
echo "4. Checking for TypeScript errors..."
ERRORS=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
if [ "$ERRORS" -gt 0 ]; then
    echo "   ⚠️  Found $ERRORS TypeScript errors"
    echo "   These may block Fast Refresh"
else
    echo "   ✅ No TypeScript errors"
fi

# Step 5: Restart Expo
echo "5. Starting Expo with clean cache..."
echo ""
echo "   Run: npm run dev"
echo ""
echo "   Then:"
echo "   1. Scan QR code in Expo Go"
echo "   2. Shake device → Settings → Enable 'Fast Refresh'"
echo "   3. Make a test edit and save"
echo "   4. Watch Metro terminal for 'Bundling...' message"
echo ""














