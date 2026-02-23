#!/bin/bash

echo "📱 Starting Expo with iOS Simulator"
echo "===================================="
echo ""

cd "$(dirname "$0")"

# Check if Xcode is installed
if ! command -v xcodebuild > /dev/null 2>&1; then
    echo "❌ Xcode is not installed or not in PATH"
    echo ""
    echo "   Please install Xcode from the App Store"
    echo "   Then run: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
    exit 1
fi

echo "✅ Xcode is installed"
echo ""

# Kill any existing processes
echo "1️⃣ Stopping existing Expo processes..."
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
echo "🚀 Starting Expo..."
echo "   When prompted, press 'i' to open iOS Simulator"
echo ""
echo "📱 What will happen:"
echo "   1. Metro bundler will start"
echo "   2. You'll see options: [i] iOS Simulator"
echo "   3. Press 'i' on your keyboard"
echo "   4. iOS Simulator will open automatically"
echo "   5. Your app will load in the simulator"
echo ""
echo "💡 No network needed - uses localhost!"
echo ""
echo "===================================="
echo ""

# Start Expo (will prompt for simulator)
EXPO_NO_DOCTOR=1 npx expo start --clear
