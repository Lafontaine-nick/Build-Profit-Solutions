#!/bin/bash

echo "🔧 Quick Fix for Expo Go Not Opening"
echo "===================================="
echo ""

# Step 1: Kill all processes
echo "1️⃣ Stopping all Expo/Metro processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "node.*expo" 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

sleep 2

# Step 2: Clear caches
echo "2️⃣ Clearing caches..."
cd "$(dirname "$0")"
rm -rf .expo .expo-shared node_modules/.cache 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📱 Choose connection mode:"
echo ""
echo "1. LAN Mode (fast, same WiFi required)"
echo "2. Tunnel Mode (works across networks, slower)"
echo "3. iOS Simulator (most reliable)"
echo ""
read -p "Enter choice (1/2/3): " choice

case $choice in
  1)
    echo ""
    echo "🚀 Starting with LAN mode..."
    echo "   Make sure your phone and computer are on the same WiFi!"
    echo ""
    EXPO_NO_DOCTOR=1 npx expo start --lan --clear
    ;;
  2)
    echo ""
    echo "🚀 Starting with tunnel mode..."
    echo "   This may take 30-60 seconds to establish connection"
    echo ""
    EXPO_NO_DOCTOR=1 npx expo start --tunnel --clear
    ;;
  3)
    echo ""
    echo "🚀 Starting for iOS Simulator..."
    echo "   Press 'i' when prompted to open simulator"
    echo ""
    EXPO_NO_DOCTOR=1 npx expo start --clear
    ;;
  *)
    echo "Invalid choice. Starting with LAN mode..."
    EXPO_NO_DOCTOR=1 npx expo start --lan --clear
    ;;
esac
