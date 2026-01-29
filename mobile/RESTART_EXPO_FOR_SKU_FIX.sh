#!/bin/bash

echo "🔄 Restarting Expo for SKU Search Fix..."
echo ""

# Stop any running Expo processes
echo "1. Stopping Expo processes..."
pkill -f "expo start" 2>/dev/null
sleep 2

# Clear all caches
echo "2. Clearing caches..."
rm -rf .expo node_modules/.cache .metro-cache 2>/dev/null
echo "   ✅ Caches cleared"

# Start Expo with clear flag
echo ""
echo "3. Starting Expo with fresh cache..."
echo "   📱 Wait for QR code, then scan with Expo Go"
echo "   💡 Make sure to CLOSE Expo Go app completely first!"
echo ""
npx expo start --clear --lan
