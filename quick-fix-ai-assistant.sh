#!/bin/bash

echo "🔧 Quick Fix: AI Assistant"
echo "=========================="
echo ""

# Check backend
echo "1. Checking backend..."
if curl -s --max-time 2 http://localhost:3001/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running on port 3001"
else
    echo "   ❌ Backend is NOT running"
    echo "   💡 Start it with: ./start-backend.sh"
    exit 1
fi

echo ""
echo "2. Quick fixes to try:"
echo ""
echo "   📱 In iOS Simulator:"
echo "      - Press Cmd + R to reload"
echo "      - Or shake device → 'Reload'"
echo ""
echo "   🔄 If that doesn't work:"
echo "      - Close and reopen the AI Assistant modal"
echo "      - Try asking a simple question first"
echo ""
echo "   🌐 Check the console logs:"
echo "      - Look for 'AI Assistant connecting to: http://localhost:3001'"
echo "      - If you see '192.168.x.x', the app needs to be reloaded"
echo ""
echo "   🔑 If you see auth errors:"
echo "      - You may need to log out and log back in"
echo ""
