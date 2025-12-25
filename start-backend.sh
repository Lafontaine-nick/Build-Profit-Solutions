#!/bin/bash

echo "🚀 Starting Build Profit Solutions Backend..."
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

# Start the server
echo "🌐 Starting backend server on port 3001..."
echo "   Access it at: http://localhost:3001"
echo "   Health check: http://localhost:3001/health"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

npm start







