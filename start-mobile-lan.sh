#!/usr/bin/env bash
# Start Expo on your LAN so a physical device on the same Wi‑Fi can load the app.
# Uses mobile/scripts/lan-packager-host-env.sh so Metro uses your real LAN IP (not VPN/Docker).
#
# Usage (from repo root — Build-Profit-Solutions):
#   ./start-mobile-lan.sh                    # Expo Go + LAN
#   ./start-mobile-lan.sh dev                # Development build (expo-dev-client) + LAN  ← use after: eas build --profile development
#   ./start-mobile-lan.sh dev --clear        # dev client + clear Metro cache
#   ./start-mobile-lan.sh --clear            # Expo Go + clear cache
#
# From mobile/ you can also run:
#   npm run start:lan          # Expo Go + LAN
#   npm run start:dev:lan      # dev client + LAN (same as ./start-mobile-lan.sh dev)
#
# Prerequisites:
#   - Phone and Mac on the same network; allow incoming connections on port 8081 if prompted.
#   - Development build: install the dev client from your EAS build, then use `dev` mode.
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/mobile"

# shellcheck disable=SC1091
source ./scripts/lan-packager-host-env.sh

export EXPO_NO_DOCTOR=1

USE_DEV_CLIENT=0
PASS_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "dev" ]]; then
    USE_DEV_CLIENT=1
  else
    PASS_ARGS+=("$arg")
  fi
done

if [[ "$USE_DEV_CLIENT" -eq 1 ]]; then
  exec npx expo start --lan --dev-client "${PASS_ARGS[@]}"
else
  exec npx expo start --lan "${PASS_ARGS[@]}"
fi
