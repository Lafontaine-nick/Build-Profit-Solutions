#!/bin/bash

# Development Start Script for Build Profit Solutions
# Starts both backend and mobile in separate terminal windows (macOS)

set -e  # Exit on error

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Stopping existing processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
sleep 2
echo "✅ All processes stopped"
echo ""

echo "🧹 Clearing caches..."
cd mobile
rm -rf .expo .expo-shared node_modules/.cache .metro-cache 2>/dev/null || true

# Clear Watchman cache if available
if command -v watchman &> /dev/null; then
    watchman watch-del-all 2>/dev/null || true
fi

cd "$SCRIPT_DIR"
echo "✅ Caches cleared"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  This script is designed for macOS (uses osascript)"
    echo "   Use start-fresh.sh instead for other platforms"
    exit 1
fi

echo "🚀 Starting Backend in new terminal..."
osascript -e 'tell app "Terminal" to do script "cd '"$SCRIPT_DIR"'/backend && echo \"🚀 Starting Backend...\" && npm start"'

sleep 2

echo "🚀 Starting Mobile App in new terminal..."
osascript -e 'tell app "Terminal" to do script "cd '"$SCRIPT_DIR"'/mobile && echo \"🚀 Starting Mobile App...\" && npx expo start --clear"'

echo ""
echo "✅ Both services starting in separate terminal windows"
echo "   Backend: http://localhost:3001"
echo "   Mobile: Check the Expo terminal for QR code"
echo ""
echo "💡 Tip: Use start-fresh.sh to run both in current terminal"
