#!/bin/bash

echo "🚀 Starting Expo with Correct IP Address"
echo "========================================"
echo ""

# Your IP from ifconfig
YOUR_IP="10.71.3.126"

echo "📍 Detected IP: $YOUR_IP"
echo ""

# Step 1: Kill all Expo processes
echo "1️⃣ Stopping all Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

sleep 2

# Step 2: Clear caches
echo "2️⃣ Clearing caches..."
cd "$(dirname "$0")"
rm -rf .expo .expo-shared node_modules/.cache 2>/dev/null || true

echo ""
echo "✅ Ready to start!"
echo ""
echo "🚀 Starting Expo with LAN mode..."
echo "   Your phone should connect to: exp://$YOUR_IP:8081"
echo ""
echo "📱 Next steps:"
echo "   1. Wait for QR code to appear"
echo "   2. In Expo Go: Tap 'Enter URL manually'"
echo "   3. Type: exp://$YOUR_IP:8081"
echo "   4. Or scan the QR code"
echo ""
echo "========================================"
echo ""

# Start with LAN mode
EXPO_NO_DOCTOR=1 npx expo start --lan --clear
