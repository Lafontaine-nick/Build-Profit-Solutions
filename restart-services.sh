#!/bin/bash

# Restart Services Script for Build Profit Solutions
# This script stops all services and restarts them fresh

echo "🛑 Stopping all services..."
echo "=================================="

# Stop all running services
pkill -f "node src/server.js" 2>/dev/null
pkill -f "expo start" 2>/dev/null
pkill -f "ts-node-dev" 2>/dev/null
pkill -f "metro" 2>/dev/null

# Wait for processes to stop
sleep 2

echo "✅ All services stopped"
echo ""
echo "🚀 Starting services..."
echo "=================================="

# Start Backend
echo "📡 Starting Backend Server..."
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: tail -f /tmp/backend.log"

# Wait for backend to start
sleep 3

# Check backend health
if curl -s http://localhost:3001/health > /dev/null; then
    echo "   ✅ Backend is running on http://localhost:3001"
else
    echo "   ⚠️  Backend may not be ready yet"
fi

echo ""
echo "📱 Starting Mobile App..."
echo "=================================="
echo "   Run this in a NEW terminal window to see QR code:"
echo ""
echo "   cd /Users/nick_lafontaine/build-profit-solutions/mobile"
echo "   npx expo start --tunnel --clear"
echo ""
echo "   OR use:"
echo "   cd /Users/nick_lafontaine/build-profit-solutions/mobile && npx expo start --tunnel --clear"
echo ""

# Start mobile app in background (but user should run in separate terminal to see QR)
cd /Users/nick_lafontaine/build-profit-solutions/mobile
npx expo start --tunnel --clear > /tmp/expo.log 2>&1 &
EXPO_PID=$!
echo "   Expo PID: $EXPO_PID"
echo "   Logs: tail -f /tmp/expo.log"
echo ""

echo "✅ Services starting..."
echo "=================================="
echo ""
echo "📊 Check Status:"
echo "   Backend: curl http://localhost:3001/health"
echo "   View Backend Logs: tail -f /tmp/backend.log"
echo "   View Expo Logs: tail -f /tmp/expo.log"
echo ""
echo "📱 To see QR code, run in a new terminal:"
echo "   cd mobile && npx expo start --tunnel --clear"
echo ""











