#!/bin/bash

echo "🔧 Fixing Expo Go and TypeScript Issues..."

# Clear all caches
echo "🧹 Clearing caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-* 2>/dev/null || true

# Fix remaining critical TypeScript issues
echo "🔨 Fixing remaining TypeScript issues..."

# Fix icon names
find . -name "*.tsx" -exec sed -i '' 's/attach_money/attach-money/g' {} \;
find . -name "*.tsx" -exec sed -i '' 's/location_on/location-on/g' {} \;
find . -name "*.tsx" -exec sed -i '' 's/isDarkMode/darkMode/g' {} \;

# Fix timeout type issues
find . -name "*.tsx" -exec sed -i '' 's/NodeJS\.Timeout/ReturnType<typeof setTimeout>/g' {} \;

echo "✅ Fixes applied successfully!"
echo "�� Starting Expo with cleared cache..."

# Start Expo with tunnel and clear cache
npx expo start --tunnel --clear
