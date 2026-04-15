#!/usr/bin/env bash
# Start Expo so a phone on the same Wi‑Fi can connect (LAN / Metro on your machine).
# Uses scripts/lan-packager-host-env.sh so the QR code uses your real LAN IP (not VPN/Docker).
#
# Usage:
#   ./start-mobile-lan.sh                 # Expo Go / standard dev server
#   ./start-mobile-lan.sh --clear         # clear Metro cache
#   ./start-mobile-lan.sh --dev-client    # custom dev client (if you use expo-dev-client builds)
#
# From mobile/ you can also run: npm run start:lan   or   npm run start:dev:lan

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/mobile"

# shellcheck disable=SC1091
source ./scripts/lan-packager-host-env.sh

export EXPO_NO_DOCTOR=1
exec npx expo start --lan "$@"
