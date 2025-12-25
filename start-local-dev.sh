#!/bin/bash

echo "🚀 Starting Local Development Environment"
echo "=========================================="
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if backend is already running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Backend is already running on port 3001"
    echo "   Skipping backend startup..."
    echo ""
else
    echo "📦 Starting Backend Server..."
    echo "   This will run in the background"
    echo ""
    
    cd "$SCRIPT_DIR/backend" || exit 1
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "📥 Installing backend dependencies..."
        npm install
    fi
    
    # Start backend in background
    npm start > /tmp/bps-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend started (PID: $BACKEND_PID)"
    echo "   Logs: tail -f /tmp/bps-backend.log"
    echo ""
    
    # Wait a moment for backend to start
    echo "⏳ Waiting for backend to start..."
    sleep 3
    
    # Test if backend is responding
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend is running on http://localhost:3001"
    else
        echo "⚠️  Backend may still be starting..."
    fi
    echo ""
fi

# Start mobile app
echo "📱 Starting Mobile App..."
echo "   This will open in your terminal"
echo ""
echo "   After Expo starts:"
echo "   - Press 'i' for iOS simulator"
echo "   - Press 'a' for Android emulator"  
echo "   - Press 'w' for web browser"
echo "   - Shake device → Reload to refresh"
echo ""

cd "$SCRIPT_DIR/mobile" || exit 1

# Clear cache and start
rm -rf .expo node_modules/.cache
npx expo start --clear







