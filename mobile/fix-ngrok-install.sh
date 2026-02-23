#!/bin/bash

echo "🔧 Fixing @expo/ngrok Installation"
echo "==================================="
echo ""

# Option 1: Install globally with proper permissions
echo "1️⃣ Installing @expo/ngrok globally..."
npm install -g @expo/ngrok@^4.1.0

echo ""
echo "2️⃣ Verifying installation..."
if npm list -g @expo/ngrok > /dev/null 2>&1; then
    echo "✅ @expo/ngrok is installed globally"
    npm list -g @expo/ngrok
else
    echo "❌ Installation might have failed"
    echo ""
    echo "💡 Trying alternative: Install locally in project..."
    cd "$(dirname "$0")"
    npm install @expo/ngrok@^4.1.0
fi

echo ""
echo "==================================="
echo ""
echo "🚀 Now try starting Expo again:"
echo "   npx expo start --tunnel --clear"
echo ""
echo "💡 Alternative: Use LAN mode (no ngrok needed):"
echo "   npx expo start --lan --clear"
