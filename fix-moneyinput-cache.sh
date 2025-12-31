#!/bin/bash

echo "🔧 Fixing MoneyInput Error - Clearing Cache and Restarting"
echo "=========================================================="
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")/mobile" || exit 1

echo "1️⃣  Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .expo-shared
rm -rf .metro
echo "✅ Cache cleared"
echo ""

echo "2️⃣  Stopping existing Expo processes..."
pkill -f "expo start" 2>/dev/null
pkill -f "metro" 2>/dev/null
sleep 2
echo "✅ Processes stopped"
echo ""

echo "3️⃣  Verifying MoneyInput is removed..."
if grep -r "MoneyInput" app/\(tabs\)/estimate-generator.jsx > /dev/null 2>&1; then
  echo "❌ ERROR: MoneyInput still found in file!"
  exit 1
else
  echo "✅ MoneyInput not found - file is clean"
fi
echo ""

echo "4️⃣  Starting Expo with cleared cache..."
echo "   Press 'r' in the terminal to reload after it starts"
echo ""
npx expo start --clear --tunnel




























