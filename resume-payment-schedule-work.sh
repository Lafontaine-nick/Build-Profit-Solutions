#!/bin/bash

# 🚀 Resume Payment Schedule Work - Startup Script
# Last worked on: Payment schedule switching and rounding improvements

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  Build Profit Solutions - Resuming Payment Schedule Work"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What we worked on today:"
echo "   ✅ Payment schedule switching logic (Hybrid → Time-Based/Milestone clears payments)"
echo "   ✅ Payment amount rounding (2 decimal places max using roundPayment helper)"
echo ""
echo "📁 Files modified:"
echo "   • mobile/app/(tabs)/estimate-generator.jsx"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project root
cd "$(dirname "$0")" || exit 1

# Check if we should start backend too
if [ "$1" = "--with-backend" ] || [ "$1" = "-b" ]; then
    echo "🌐 Starting backend server..."
    echo ""
    # Start backend in background
    cd backend || exit 1
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        npm install
    fi
    npm start &
    BACKEND_PID=$!
    cd ..
    echo "   ✅ Backend starting on port 3001 (PID: $BACKEND_PID)"
    echo ""
    sleep 2
fi

# Start mobile app
echo "📱 Starting mobile app (Expo)..."
echo ""
echo "   💡 Tips:"
echo "   • Press 'i' to open iOS simulator"
echo "   • Press 'a' to open Android emulator"
echo "   • Scan QR code with Expo Go app on your phone"
echo "   • Press 'r' to reload the app"
echo "   • Press Ctrl+C to stop"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd mobile || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing mobile dependencies..."
    npm install
    echo ""
fi

# Start Expo
npx expo start --clear

# Cleanup: if backend was started, kill it when script exits
if [ ! -z "$BACKEND_PID" ]; then
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
fi
