#!/bin/bash

echo "🔍 Diagnosing WiFi Connection Issue"
echo "===================================="
echo ""

# Step 1: Check if Expo is running
echo "1️⃣ Checking if Expo/Metro is running..."
if lsof -i :8081 > /dev/null 2>&1; then
    echo "✅ Metro bundler is running on port 8081"
    lsof -i :8081
else
    echo "❌ Metro bundler is NOT running on port 8081"
    echo "   You need to start Expo first!"
fi

echo ""
echo "2️⃣ Finding your computer's IP address..."
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
if [ -z "$LOCAL_IP" ]; then
    echo "❌ Could not detect IP address"
    echo "   Try: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
else
    echo "✅ Your computer's IP: $LOCAL_IP"
    echo ""
    echo "   Your phone should connect to: exp://$LOCAL_IP:8081"
    echo "   Or in browser: http://$LOCAL_IP:8081"
fi

echo ""
echo "3️⃣ Checking firewall status..."
if command -v /usr/libexec/ApplicationFirewall/socketfilterfw > /dev/null 2>&1; then
    FIREWALL_STATE=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -i "enabled" || echo "disabled")
    echo "   Firewall state: $FIREWALL_STATE"
    if echo "$FIREWALL_STATE" | grep -qi "enabled"; then
        echo "   ⚠️  Firewall is ON - might be blocking port 8081"
        echo "   💡 You may need to allow Node.js in firewall settings"
    fi
else
    echo "   Could not check firewall (may need sudo)"
fi

echo ""
echo "4️⃣ Testing if port 8081 is accessible..."
if [ ! -z "$LOCAL_IP" ]; then
    echo "   Try opening this in your phone's browser:"
    echo "   http://$LOCAL_IP:8081"
    echo ""
    echo "   If you see Metro bundler page → Port is accessible ✅"
    echo "   If connection fails → Firewall/network issue ❌"
fi

echo ""
echo "===================================="
echo "📱 Next Steps:"
echo ""
echo "1. Make sure Expo is running:"
echo "   cd mobile && npx expo start --lan --clear"
echo ""
echo "2. Check the IP address shown above"
echo ""
echo "3. In Expo Go:"
echo "   - Tap 'Enter URL manually'"
echo "   - Type: exp://$LOCAL_IP:8081"
echo ""
echo "4. Or scan the QR code from terminal"
echo ""
echo "5. If still not working, try:"
echo "   - Check firewall settings"
echo "   - Try tunnel mode: npx expo start --tunnel"
echo "   - Use iOS Simulator: npx expo start (then press 'i')"
