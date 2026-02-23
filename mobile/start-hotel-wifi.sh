#!/bin/bash

echo "🏨 Starting Expo for Hotel WiFi"
echo "==============================="
echo ""
echo "💡 Hotel WiFi often blocks device-to-device connections"
echo "   Tunnel mode bypasses this by using internet"
echo ""

cd "$(dirname "$0")"

# Kill any existing processes
echo "1️⃣ Stopping existing processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

sleep 2

# Clear caches
echo "2️⃣ Clearing caches..."
rm -rf .expo .expo-shared node_modules/.cache 2>/dev/null || true

echo ""
echo "✅ Ready!"
echo ""
echo "🌐 Starting in TUNNEL mode..."
echo "   This works on hotel WiFi by using internet"
echo "   May take 30-60 seconds to establish tunnel"
echo ""
echo "📱 After QR code appears:"
echo "   1. Open Expo Go"
echo "   2. Scan QR code"
echo "   3. App should connect!"
echo ""
echo "💡 Alternative: Use iOS Simulator (no network needed)"
echo "   Press 'i' after Metro starts"
echo ""
echo "==============================="
echo ""

# Start with tunnel mode
EXPO_NO_DOCTOR=1 npx expo start --tunnel --clear
