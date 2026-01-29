#!/bin/bash

echo "🔄 Restarting Expo with cleared cache..."
echo ""

cd "$(dirname "$0")" || exit 1

echo "🧹 Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache

echo ""
echo "✅ Cache cleared!"
echo ""
echo "🚀 Starting Expo..."
echo "   After it starts, reload your app (shake device → Reload)"
echo ""

npx expo start --clear







