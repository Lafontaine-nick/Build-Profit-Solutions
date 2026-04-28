#!/usr/bin/env bash
#
# Build Profit Solutions — local dev (recommended)
# - Backend: nodemon on default port (see backend logs in that window)
# - Mobile: Expo dev client + LAN (physical device on same Wi‑Fi)
#
# Usage (from repo root):
#   chmod +x start-app-dev-client.sh   # once
#   ./start-app-dev-client.sh
#
# Requires macOS (opens two Terminal.app windows). For Linux, run the two
# commands printed at the bottom manually in separate terminals.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script uses macOS Terminal.app. Run these two commands instead:"
  echo ""
  echo "  Terminal 1:  cd \"$ROOT/backend\" && npm run dev"
  echo "  Terminal 2:  cd \"$ROOT/mobile\" && npm run start:dev:lan"
  exit 0
fi

echo "Opening Terminal windows: backend (nodemon) + mobile (Expo dev client, LAN)…"
osascript \
  -e "tell application \"Terminal\" to do script \"cd $(printf %q "$ROOT")/backend && echo 'Backend (nodemon)' && npm run dev\"" \
  >/dev/null

sleep 1

osascript \
  -e "tell application \"Terminal\" to do script \"cd $(printf %q "$ROOT")/mobile && echo 'Mobile (Expo dev client + LAN)' && npm run start:dev:lan\"" \
  >/dev/null

echo ""
echo "Done. Check the two Terminal windows."
echo "  Backend health (if exposed): http://localhost:3001/health"
echo "  Open the dev build on your phone and connect to Metro from the Expo URL/QR."
