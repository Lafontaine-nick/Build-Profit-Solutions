#!/bin/bash
echo "🧹 Clearing all Expo and Metro caches..."

# Clear Metro bundler cache
rm -rf node_modules/.cache
rm -rf .expo
rm -rf .expo-shared

# Clear watchman cache (if installed)
watchman watch-del-all 2>/dev/null || true

# Clear npm cache
npm cache clean --force

# Clear Metro bundler cache
npx expo start --clear

echo "✅ Cache cleared! Now restart with: npx expo start"
