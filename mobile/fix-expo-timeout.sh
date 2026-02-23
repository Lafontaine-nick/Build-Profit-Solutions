#!/bin/bash

echo "🔧 Fixing Expo Go Timeout Issue"
echo "==============================="
echo ""

# Your computer's IP
YOUR_IP="10.71.3.126"

echo "📍 Your IP: $YOUR_IP"
echo ""

# Step 1: Check if Metro is running
echo "1️⃣ Checking if Metro/Expo is running..."
if lsof -i :8081 > /dev/null 2>&1; then
    echo "✅ Metro is running on port 8081"
    echo ""
    echo "   Current Metro process:"
    lsof -i :8081 | head -2
    echo ""
    echo "   ⚠️  Metro might be using wrong IP or connection mode"
    echo "   Let's restart it with correct settings..."
    echo ""
    pkill -f "expo start"
    pkill -f "metro"
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    sleep 2
else
    echo "❌ Metro is NOT running on port 8081"
    echo "   This is why Expo Go is timing out!"
fi

# Step 2: Clear caches
echo "2️⃣ Clearing Expo caches..."
cd "$(dirname "$0")"
rm -rf .expo .expo-shared node_modules/.cache 2>/dev/null || true

echo ""
echo "✅ Ready to start!"
echo ""
echo "🚀 Starting Expo with LAN mode..."
echo "   Your phone should connect to: exp://$YOUR_IP:8081"
echo ""
echo "📱 In Expo Go:"
echo "   1. Tap 'Enter URL manually'"
echo "   2. Type: exp://$YOUR_IP:8081"
echo "   3. Or scan the QR code that appears"
echo ""
echo "💡 If timeout persists, try tunnel mode:"
echo "   npx expo start --tunnel --clear"
echo ""
echo "==============================="
echo ""

# Start with LAN mode
EXPO_NO_DOCTOR=1 npx expo start --lan --clear
