#!/bin/bash

echo "🔄 Restarting Build Profit Solutions Backend..."
echo ""

cd "$(dirname "$0")/backend" || exit 1

# Kill any existing backend processes
echo "🛑 Stopping existing backend processes..."
pkill -f "node.*server.js" 2>/dev/null
pkill -f "nodemon.*server.js" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 2

# Check if port 3001 is still in use
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "⚠️  Port 3001 is still in use. Trying to force kill..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start the backend server
echo "🚀 Starting backend server..."
echo "   Access it at: http://localhost:3001"
echo "   Health check: http://localhost:3001/health"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Use nodemon if available, otherwise use node
if command -v nodemon &> /dev/null || [ -f "node_modules/.bin/nodemon" ]; then
    npm run dev
else
    npm start
fi
