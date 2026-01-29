#!/bin/bash

# Development startup script that ensures proper network configuration
echo "🚀 Starting Build Profit Solutions - Development Mode"
echo "=================================================="

# Get the local network IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect local network IP. Using fallback: 192.168.0.201"
    LOCAL_IP="192.168.0.201"
fi

echo "📡 Detected local IP: $LOCAL_IP"
echo "🔧 Backend should be accessible at: http://$LOCAL_IP:3001"
echo ""

# Check if backend is running
echo "🔍 Checking if backend is running..."
if curl -s http://$LOCAL_IP:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running and accessible"
else
    echo "❌ Backend is not accessible at http://$LOCAL_IP:3001"
    echo "💡 Make sure to start the backend server first:"
    echo "   cd ../backend && node src/server.js"
    echo ""
fi

# Start Expo without tunnel for better local development
echo "🎯 Starting Expo development server..."
echo "📱 Mobile simulators will use: http://$LOCAL_IP:3001"
echo "🌐 Web browser will use: http://localhost:3001"
echo ""

npx expo start -c


