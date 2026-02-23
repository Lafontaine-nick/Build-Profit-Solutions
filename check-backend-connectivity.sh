#!/bin/bash

echo "🔍 Backend Connectivity Check"
echo "=============================="
echo ""

# Check if backend is running
echo "1. Checking if backend is running..."
if lsof -i :3001 > /dev/null 2>&1; then
    echo "   ✅ Backend is running on port 3001"
    lsof -i :3001 | grep LISTEN
else
    echo "   ❌ Backend is NOT running on port 3001"
    echo "   💡 Start it with: cd backend && npm start"
    exit 1
fi

echo ""

# Check localhost connection
echo "2. Testing localhost connection..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ Backend responds on localhost:3001"
    curl -s http://localhost:3001/health | head -1
else
    echo "   ❌ Backend does NOT respond on localhost:3001"
fi

echo ""

# Get current IP addresses
echo "3. Your Mac's IP addresses:"
if command -v ipconfig > /dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null && echo "   en0 (WiFi): $(ipconfig getifaddr en0 2>/dev/null)" || echo "   en0: Not found"
    ipconfig getifaddr en1 2>/dev/null && echo "   en1 (Ethernet): $(ipconfig getifaddr en1 2>/dev/null)" || echo "   en1: Not found"
else
    echo "   Run: ifconfig | grep 'inet ' to find your IP"
fi

echo ""

# Check if app is trying to connect to correct IP
echo "4. App is trying to connect to: 192.168.1.115:3001"
echo "   Make sure this matches your Mac's current IP address"
echo ""

# Test connection from Mac to that IP
echo "5. Testing connection to 192.168.1.115:3001..."
if curl -s --max-time 3 http://192.168.1.115:3001/health > /dev/null 2>&1; then
    echo "   ✅ Can reach backend at 192.168.1.115:3001"
else
    echo "   ❌ CANNOT reach backend at 192.168.1.115:3001"
    echo "   💡 This IP might be wrong or blocked by firewall"
    echo "   💡 Try using tunnel mode: npx expo start --tunnel"
fi

echo ""
echo "=============================="
echo ""
echo "💡 Solutions:"
echo "   1. If IP is wrong: Update app.config.js with correct IP"
echo "   2. If on hotel WiFi: Use tunnel mode: npx expo start --tunnel"
echo "   3. If using simulator: Use localhost:3001 instead"
