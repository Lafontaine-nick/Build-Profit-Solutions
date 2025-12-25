#!/bin/bash

echo "🚀 Starting Backend Server..."
echo ""

cd "$(dirname "$0")/backend" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies first..."
    npm install
    echo ""
fi

echo "🌐 Starting backend on port 3001..."
echo "   This will keep running until you press Ctrl+C"
echo ""

npm start







