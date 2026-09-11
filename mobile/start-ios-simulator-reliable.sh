#!/usr/bin/env bash

# Reliable local development startup for the iOS Simulator.
# Usage: ./start-ios-simulator-reliable.sh

set -euo pipefail

cd "$(dirname "$0")"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode is required. Install it, then select it with:"
  echo "sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Node.js/npm is required but npx was not found."
  exit 1
fi

echo "Stopping stale Expo and Metro processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "[m]etro" 2>/dev/null || true
for port in 8081 8082 19000 19001 19002; do
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
  fi
done

echo "Clearing local Expo/Metro caches..."
rm -rf .expo .expo-shared node_modules/.cache .metro-cache

if command -v watchman >/dev/null 2>&1; then
  watchman watch-del-all >/dev/null 2>&1 || true
fi

echo "Opening iOS Simulator..."
open -a Simulator
sleep 2

echo "Starting the development client on localhost..."
echo "Press Ctrl+C to stop Metro."
exec env EXPO_NO_DOCTOR=1 npx expo start \
  --dev-client \
  --localhost \
  --clear \
  --ios
