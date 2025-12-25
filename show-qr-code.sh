#!/bin/bash

# Show QR Code for Expo Connection
# This script displays connection info and opens the Expo DevTools

echo "📱 Build Profit Solutions - QR Code Connection"
echo "=============================================="
echo ""

# Check if Expo is running
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Expo is running on port 8081"
    echo ""
    
    # Try to get the actual connection URL from Expo
    echo "🔗 Opening Expo DevTools in browser..."
    open http://localhost:8081
    
    echo ""
    echo "📋 Connection Information:"
    echo "   Local: http://localhost:8081"
    echo "   LAN: exp://192.168.0.201:8081"
    echo ""
    echo "📱 To connect from your phone:"
    echo "   1. Open Expo Go app"
    echo "   2. Scan the QR code from the browser window that just opened"
    echo "   3. Or manually enter: exp://192.168.0.201:8081"
    echo ""
    echo "💡 Tip: If using tunnel mode, check the Expo DevTools page for the tunnel URL"
    
else
    echo "❌ Expo is not running"
    echo ""
    echo "🚀 Starting Expo in tunnel mode..."
    cd "$(dirname "$0")/mobile"
    npx expo start --tunnel
fi





