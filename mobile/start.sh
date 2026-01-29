#!/bin/bash

# Simple startup script for mobile app
# Kills existing processes and starts Expo with LAN mode

cd "$(dirname "$0")"

echo "🛑 Stopping existing Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
sleep 2

echo "🧹 Clearing caches..."
rm -rf .expo .expo-shared node_modules/.cache .metro-cache 2>/dev/null || true

if command -v watchman &> /dev/null; then
    watchman watch-del-all 2>/dev/null || true
fi

echo "🚀 Starting Expo with LAN mode..."
echo ""

npm run dev:lan
