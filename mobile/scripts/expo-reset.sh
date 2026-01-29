#!/usr/bin/env bash
set -euo pipefail

echo "=============================="
echo "Expo Reset: LAN + Clear Cache"
echo "=============================="

# Ensure we run from the project root (where package.json lives)
if [ ! -f "package.json" ]; then
  echo "❌ package.json not found. Run this from your mobile app root folder."
  exit 1
fi

echo "✅ Killing any stuck Expo/Metro processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "react-native start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true
pkill -f "node.*metro" 2>/dev/null || true

echo "✅ Clearing Watchman watches (if installed)..."
if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all 2>/dev/null || true
else
  echo "⚠️ watchman not installed (skipping watchman reset)"
fi

echo "✅ Clearing Metro temporary caches..."
rm -rf "${TMPDIR:-/tmp}/metro-"* "${TMPDIR:-/tmp}/haste-map-"* 2>/dev/null || true

echo "✅ Clearing node_modules/.cache (if it exists)..."
rm -rf node_modules/.cache 2>/dev/null || true

echo "✅ Starting Expo in LAN mode with a full cache clear..."
npx expo start --lan --clear














