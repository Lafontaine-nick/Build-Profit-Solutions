#!/bin/bash

# Fix Metro Bundling Issues
# Run this script to clear all caches and restart Metro

echo "🛑 Stopping Metro bundler..."
pkill -f "expo start" || echo "No Metro process found"

echo "🧹 Clearing all caches..."
cd /Users/nick_lafontaine/build-profit-solutions/mobile
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro-cache
rm -rf .metro

echo "✅ Caches cleared!"
echo ""
echo "🚀 Starting Metro with cleared cache..."
echo ""

npx expo start --clear






