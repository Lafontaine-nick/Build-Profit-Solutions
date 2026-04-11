#!/usr/bin/env bash
# Build Profit Solutions — mobile app startup
# Usage:
#   ./start-app.sh           # default: Expo tunnel (physical device / Expo Go)
#   ./start-app.sh tunnel    # same as default
#   ./start-app.sh dev       # dev client + tunnel (custom native build)
#   ./start-app.sh lan       # LAN (same Wi‑Fi as phone; uses scripts/lan-packager-host-env.sh)
#   ./start-app.sh ios       # open iOS Simulator (localhost bundler)
#   ./start-app.sh sim       # alias for ios
#   ./start-app.sh clear     # kill Expo/Metro, clear caches, then dev + tunnel
#
# Prerequisites: Node/npm, from repo: cd mobile && npm install
# Secrets: copy .env.example → .env.local if needed (not committed)

set -e
cd "$(dirname "$0")"

MODE="${1:-tunnel}"

kill_expo() {
  echo "Stopping existing Expo / Metro..."
  pkill -f "expo start" 2>/dev/null || true
  pkill -f "metro" 2>/dev/null || true
  sleep 1
}

case "$MODE" in
  tunnel|"")
    echo "Starting Expo (tunnel) — scan QR in Expo Go or dev client..."
    EXPO_NO_DOCTOR=1 npx expo start --tunnel
    ;;
  dev)
    echo "Starting Expo dev client (tunnel)..."
    npm run dev
    ;;
  lan)
    echo "Starting Expo (LAN) — phone must be on same network..."
    npm run start:lan
    ;;
  ios|sim|simulator)
    echo "Starting Expo for iOS Simulator (localhost)..."
    npm run start:sim
    ;;
  go)
    echo "Starting Expo tunnel + open Expo Go..."
    npm run start:go
    ;;
  web)
    npm run dev:web
    ;;
  clear|reset)
    kill_expo
    echo "Clearing caches..."
    rm -rf .expo .expo-shared node_modules/.cache .metro-cache 2>/dev/null || true
    command -v watchman >/dev/null 2>&1 && watchman watch-del-all 2>/dev/null || true
    echo "Starting dev client (tunnel, clear)..."
    npm run dev:reset
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Use: tunnel | dev | lan | ios | go | web | clear"
    exit 1
    ;;
esac
