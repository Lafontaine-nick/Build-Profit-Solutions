#!/bin/bash

echo "🚀 Starting Expo in Tunnel Mode"
echo "==============================="
echo ""

# Navigate to project directory
cd "$(dirname "$0")/mobile" || {
    echo "❌ Error: Could not find mobile directory"
    echo "   Make sure you're running this from the project root"
    exit 1
}

echo "📍 Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Kill any existing Expo processes
echo "🛑 Stopping any existing Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

sleep 2

# Clear caches
echo "🧹 Clearing caches..."
rm -rf .expo .expo-shared node_modules/.cache 2>/dev/null || true

echo ""
echo "✅ Ready to start!"
echo ""
echo "🌐 Starting Expo in TUNNEL mode..."
echo "   This creates a public URL that works across networks"
echo "   May take 30-60 seconds to establish tunnel"
echo ""
echo "📱 After QR code appears:"
echo "   1. Open Expo Go"
echo "   2. Scan the QR code"
echo "   3. Or manually enter the URL shown"
echo ""
echo "==============================="
echo ""

# Start with tunnel mode
EXPO_NO_DOCTOR=1 npx expo start --tunnel --clear
