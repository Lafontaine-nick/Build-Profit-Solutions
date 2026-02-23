#!/bin/bash

echo "🚀 Starting Build Profit Solutions"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "mobile" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Expected directories: backend/ and mobile/"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -i :$1 > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check and kill existing processes on ports 3000 and 3001
echo "🔍 Checking for existing backend processes..."
if check_port 3001; then
    echo "   ⚠️  Port 3001 is in use, stopping existing process..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

if check_port 3000; then
    echo "   ⚠️  Port 3000 is in use, stopping existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start backend
echo ""
echo "${BLUE}📦 Starting Backend Server...${NC}"
echo "   Port 3001: Main API"
echo "   Port 3000: Secondary API"
echo ""

cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing backend dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "   ⚠️  Warning: .env file not found"
    if [ -f "env.example" ]; then
        echo "   Creating .env from env.example..."
        cp env.example .env
        echo "   ✅ Created .env file"
        echo "   ⚠️  Please update .env with your API keys"
    fi
    echo ""
fi

# Start backend in background
echo "   🌐 Starting backend server..."
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if check_port 3001; then
    echo "   ✅ Backend started successfully (PID: $BACKEND_PID)"
    echo "   📊 Health check: http://localhost:3001/health"
else
    echo "   ❌ Backend failed to start. Check backend.log for errors."
    exit 1
fi

cd ..

# Start mobile app
echo ""
echo "${GREEN}📱 Starting Mobile App (Expo)...${NC}"
echo ""

cd mobile

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing mobile dependencies..."
    npm install
    echo ""
fi

# Determine if we should use tunnel mode
USE_TUNNEL=false
if [ "$1" == "--tunnel" ] || [ "$1" == "-t" ]; then
    USE_TUNNEL=true
    echo "   🌐 Using tunnel mode (for hotel WiFi, etc.)"
elif [ "$1" == "--simulator" ] || [ "$1" == "-s" ]; then
    echo "   📱 Using iOS Simulator mode (localhost)"
    USE_TUNNEL=false
else
    echo "   💡 Tip: Use --tunnel for hotel WiFi or --simulator for iOS Simulator"
fi

echo ""
echo "   🚀 Starting Expo..."
echo ""

# Start Expo
if [ "$USE_TUNNEL" = true ]; then
    npx expo start --tunnel
else
    npx expo start --clear
fi
