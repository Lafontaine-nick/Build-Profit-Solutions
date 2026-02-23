#!/bin/bash

echo "🚀 Starting Backend Server"
echo "=========================="
echo ""

cd "$(dirname "$0")/backend" || exit 1

# Check if already running
if lsof -i :3001 > /dev/null 2>&1; then
    echo "⚠️  Port 3001 is already in use"
    echo "   Stopping existing process..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

if lsof -i :3000 > /dev/null 2>&1; then
    echo "⚠️  Port 3000 is already in use"
    echo "   Stopping existing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Creating .env from env.example..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "   ✅ Created .env file"
        echo "   ⚠️  Please update .env with your API keys"
    else
        echo "   ❌ env.example not found"
    fi
    echo ""
fi

# Start the server
echo "🌐 Starting backend server..."
echo "   Port 3001: Main API"
echo "   Port 3000: Secondary API"
echo ""
echo "   Health check: http://localhost:3001/health"
echo "   API Base: http://localhost:3001/api"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

npm start
