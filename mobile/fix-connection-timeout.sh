#!/bin/bash

echo "🔧 Fixing Connection Timeout Issue..."
echo "====================================="
echo ""

# Step 1: Kill all Expo processes
echo "1️⃣ Stopping all Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "node.*expo" 2>/dev/null || true

# Step 2: Free up port 8081
echo "2️⃣ Freeing port 8081..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Wait for processes to stop
sleep 2

# Step 3: Clear caches
echo "3️⃣ Clearing caches..."
cd "$(dirname "$0")"
rm -rf .expo .expo-shared node_modules/.cache 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🚀 Starting Expo with TUNNEL mode..."
echo "   (This works across different networks)"
echo ""
echo "📱 Next steps:"
echo "   1. Wait for QR code to appear (may take 30-60 seconds)"
echo "   2. In Expo Go: Tap 'Go Home' button"
echo "   3. Scan the NEW QR code from terminal"
echo "   4. App should connect successfully!"
echo ""
echo "💡 Why tunnel mode?"
echo "   - Works even if device and computer are on different networks"
echo "   - More reliable connection"
echo "   - Bypasses local network issues"
echo ""
echo "====================================="
echo ""

# Start Expo with tunnel mode (most reliable for physical devices)
EXPO_NO_DOCTOR=1 npx expo start --tunnel --clear
