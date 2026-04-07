#!/bin/bash

# Stop any existing Expo processes
echo "🛑 Stopping existing Expo processes..."
pkill -f "expo start" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

# Wait for processes to fully stop
sleep 2

# Clear port 8081 if it's in use
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Wait a bit more
sleep 1

# Start Expo with LAN mode (without --clear to enable Fast Refresh)
echo "🚀 Starting Expo with LAN mode..."
echo "💡 Default npm script is tunnel (npm start). Use LAN only if tunnel is slow."
echo "💡 If the phone shows wrong IP or cannot connect, use: npm run start:go"
echo "💡 Fast Refresh is enabled - edits will appear automatically"
cd "$(dirname "$0")"
# Force Metro/Expo to advertise the same IP your phone can reach (avoids Docker/VPN interfaces).
# shellcheck source=scripts/lan-packager-host-env.sh
source "./scripts/lan-packager-host-env.sh"
# Skip dependency validation to avoid fetch errors
EXPO_NO_DOCTOR=1 npx expo start --lan
