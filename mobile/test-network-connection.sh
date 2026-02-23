#!/bin/bash

echo "🔍 Testing Network Connection"
echo "============================="
echo ""

YOUR_IP="10.71.3.126"

echo "📍 Your Computer IP: $YOUR_IP"
echo ""

# Test 1: Check if Metro is running
echo "1️⃣ Checking if Metro bundler is running..."
if lsof -i :8081 > /dev/null 2>&1; then
    echo "✅ Metro is running on port 8081"
    METRO_RUNNING=true
else
    echo "❌ Metro is NOT running on port 8081"
    echo "   This is the problem! Metro needs to be running."
    METRO_RUNNING=false
fi

echo ""

# Test 2: Check network interface
echo "2️⃣ Checking network configuration..."
ifconfig | grep -A 5 "inet $YOUR_IP" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ IP address $YOUR_IP is configured"
else
    echo "⚠️  IP address $YOUR_IP might not be active"
fi

echo ""

# Test 3: Check for APIPA address (indicates network issues)
echo "3️⃣ Checking for network issues..."
if ifconfig | grep "inet 169.254" > /dev/null 2>&1; then
    echo "⚠️  Found APIPA address (169.254.x.x)"
    echo "   This indicates network configuration problems"
    echo "   Your device might not be properly connected to WiFi"
else
    echo "✅ No APIPA addresses found"
fi

echo ""

# Test 4: Check firewall
echo "4️⃣ Firewall status..."
if command -v /usr/libexec/ApplicationFirewall/socketfilterfw > /dev/null 2>&1; then
    FIREWALL=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -i "enabled" || echo "disabled")
    if echo "$FIREWALL" | grep -qi "enabled"; then
        echo "⚠️  Firewall is ON - might be blocking connections"
        echo "   System Settings → Network → Firewall → Allow Node.js"
    else
        echo "✅ Firewall is off or allowing connections"
    fi
else
    echo "   Could not check firewall (may need sudo)"
fi

echo ""
echo "============================="
echo ""
echo "📱 IMPORTANT: Expo Go doesn't need INTERNET"
echo "   It needs LOCAL NETWORK connection to your computer"
echo ""
echo "✅ Solutions:"
echo ""

if [ "$METRO_RUNNING" = false ]; then
    echo "1. Start Metro bundler:"
    echo "   cd mobile && npx expo start --lan --clear"
    echo ""
fi

echo "2. Test if phone can reach computer:"
echo "   On your phone's browser, go to:"
echo "   http://$YOUR_IP:8081"
echo ""
echo "   ✅ If you see Metro page → Network is fine"
echo "   ❌ If it fails → Firewall or network issue"
echo ""

echo "3. If network issues persist, use iOS Simulator:"
echo "   cd mobile && npx expo start --clear"
echo "   Then press 'i' for iOS Simulator"
echo "   (No network needed - uses localhost)"
echo ""

echo "4. Or use tunnel mode (needs internet but bypasses local network):"
echo "   cd mobile && npx expo start --tunnel --clear"
echo ""
