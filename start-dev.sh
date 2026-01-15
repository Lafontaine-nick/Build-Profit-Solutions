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

# Note: Not clearing caches to preserve Fast Refresh/hot reload
# If you need to clear caches, run: cd mobile && npm run dev:clear
echo "💡 Fast Refresh enabled - caches preserved for hot reload"
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
osascript -e 'tell app "Terminal" to do script "cd '"$SCRIPT_DIR"'/mobile && echo \"🚀 Starting Mobile App...\" && npx expo start --lan"'

echo ""
echo "✅ Both services starting in separate terminal windows"
echo "   Backend: http://localhost:3001"
echo "   Mobile: Check the Expo terminal for QR code"
echo ""
echo "💡 Tip: Use start-fresh.sh to run both in current terminal"
