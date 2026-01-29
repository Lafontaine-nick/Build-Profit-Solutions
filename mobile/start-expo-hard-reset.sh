#!/bin/bash

# Hard cache reset and Expo startup script
echo "🔄 Killing all Expo/Metro processes..."
pkill -9 -f "expo\|metro" 2>/dev/null
lsof -ti:8081 | xargs kill -9 2>/dev/null
sleep 2

echo "🧹 Clearing all caches..."
cd "$(dirname "$0")"
rm -rf .expo node_modules/.cache .metro-cache .metro .expo-shared .expo/ios .expo/android 2>/dev/null
find . -name "*.tsbuildinfo" -delete 2>/dev/null

echo "🚀 Starting Expo with TUNNEL mode and hard cache reset..."
EXPO_NO_METRO_LAZY=1 npx expo start --tunnel --clear --reset-cache






