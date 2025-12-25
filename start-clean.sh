#!/bin/bash

# Clean start script - stops existing processes first

echo "🛑 Stopping existing processes..."
pkill -f "expo start" 2>/dev/null
pkill -f "node src/server.js" 2>/dev/null
pkill -f "metro" 2>/dev/null
sleep 2

echo "✅ Processes stopped"
echo ""
echo "🚀 Starting Backend..."
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start &
BACKEND_PID=$!
sleep 3

echo "🚀 Starting Mobile App..."
cd /Users/nick_lafontaine/build-profit-solutions/mobile
rm -rf .expo node_modules/.cache
npx expo start --tunnel --clear











