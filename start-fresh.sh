#!/bin/bash

# Fresh Start Script for Build Profit Solutions
# This script stops all processes, clears caches, and starts both backend and mobile

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
# Clear Expo caches
cd mobile
rm -rf .expo .expo-shared node_modules/.cache .metro-cache 2>/dev/null || true

# Clear Watchman cache if available
if command -v watchman &> /dev/null; then
    watchman watch-del-all 2>/dev/null || true
fi

cd "$SCRIPT_DIR"
echo "✅ Caches cleared"
echo ""

echo "🚀 Starting Backend..."
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    if [ -f "env.example" ]; then
        echo "   Creating .env from env.example..."
        cp env.example .env
        echo "   ✅ Created .env file"
        echo "   ⚠️  Please update .env with your API keys"
    fi
    echo ""
fi

# Start backend in background
echo "🌐 Backend starting on port 3001..."
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: tail -f backend.log"
echo ""

# Wait a bit for backend to start
sleep 3

echo "🚀 Starting Mobile App..."
cd "$SCRIPT_DIR/mobile"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing mobile dependencies..."
    npm install
    echo ""
fi

echo "📱 Starting Expo with clean cache..."
echo "   This will open in your current terminal"
echo "   Scan the QR code with Expo Go app"
echo ""

# Start Expo with clear cache
npx expo start --clear

# Note: This script will block here running Expo
# To run both in background, you could use:
# npx expo start --clear > ../mobile.log 2>&1 &
