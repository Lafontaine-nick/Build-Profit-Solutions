#!/bin/bash

# Quick fix for Expo not showing edits
# This clears all caches and restarts Metro

echo "🛑 Stopping Metro bundler..."
pkill -9 -f "expo\|metro" 2>/dev/null || echo "No Metro process found"

echo "🧹 Clearing all caches..."
cd /Users/nick_lafontaine/build-profit-solutions/mobile
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro-cache
rm -rf .metro
rm -rf .expo-shared

echo "✅ All caches cleared!"
echo ""
echo "🚀 Starting Metro with cleared cache..."
echo ""

npx expo start --clear --reset-cache






