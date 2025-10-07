#!/bin/bash

# Build Profit Solutions - Easy Startup Script
# This script starts both the backend server and mobile app

echo "🏗️ Starting Build Profit Solutions..."
echo "=================================="

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        echo "✅ Port $1 is available"
        return 0
    fi
}

# Check if ports are available
echo "🔍 Checking ports..."
check_port 3001
check_port 8081

# Start backend server
echo ""
echo "🚀 Starting Backend Server..."
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server started successfully"
    echo "   📊 Health: http://localhost:3001/health"
    echo "   🔗 API: http://localhost:3001/api"
else
    echo "❌ Backend server failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start mobile app
echo ""
echo "📱 Starting Mobile App..."
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --lan &
MOBILE_PID=$!

# Wait for mobile app to start
sleep 5

echo ""
echo "🎉 Build Profit Solutions is running!"
echo "=================================="
echo "📱 Mobile App: Scan QR code with Expo Go"
echo "🌐 Backend API: http://192.168.0.201:3001"
echo "📊 Health Check: http://localhost:3001/health"
echo ""
echo "🔍 SKU Search is ready to use!"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $MOBILE_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait

