#!/bin/bash

echo "🚀 Starting Build Profit Solutions Backend (LAN Access)..."
echo ""

cd "$(dirname "$0")/backend" || exit 1

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

# Get local IP address for LAN access
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)

if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="YOUR_LOCAL_IP"
fi

echo "🌐 Starting backend server..."
echo "   Port: 3001"
echo ""
echo "📍 Access URLs:"
echo "   Local:    http://localhost:3001"
echo "   LAN:      http://${LOCAL_IP}:3001"
echo "   Health:   http://localhost:3001/health"
echo "   API:      http://localhost:3001/api"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

npm start

















