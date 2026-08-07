#!/usr/bin/env bash
#
# Build Profit Solutions — dev startup (backend + mobile)
#
# Usage:
#   ./start-dev-stack.sh              # default: API on :3001 + Expo dev-client (LAN)
#   ./start-dev-stack.sh web          # API + Expo web only (browser UI, no dev client)
#   ./start-dev-stack.sh tunnel       # API + Expo dev-client (tunnel; good on restrictive Wi‑Fi)
#   ./start-dev-stack.sh backend      # API only (foreground; Ctrl+C stops)
#   ./start-dev-stack.sh --no-kill    # do not free ports / kill listeners first
#
# Env:
#   BPS_LOG_DIR   # default: repo root (writes backend-dev.log)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="dev-lan"
NO_KILL=false
for arg in "$@"; do
  if [[ "$arg" == "--no-kill" ]]; then
    NO_KILL=true
    continue
  fi
  if [[ "$arg" == -* ]]; then
    echo "Unknown flag: $arg"
    exit 1
  fi
  MODE="$arg"
done

LOG_DIR="${BPS_LOG_DIR:-$SCRIPT_DIR}"
BACKEND_LOG="$LOG_DIR/backend-dev.log"

free_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -ti ":$port" >/dev/null 2>&1; then
      echo "Port $port in use — stopping listener(s)…"
      lsof -ti ":$port" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
}

stop_common_dev_processes() {
  echo "Stopping prior Expo / Metro / backend matches (best effort)…"
  pkill -f "[e]xpo start" 2>/dev/null || true
  pkill -f "[m]etro" 2>/dev/null || true
  pkill -f "node.*src/server.js" 2>/dev/null || true
  pkill -f "nodemon.*server.js" 2>/dev/null || true
  sleep 1
}

if [[ "$NO_KILL" != true ]]; then
  stop_common_dev_processes
  # Metro often hops 8082+ if an old packager is still bound — free a small range so Safari matches the URL you open.
  for p in 8081 8082 8083 8084 8085; do
    free_port "$p"
  done
  free_port 3001
  free_port 3000
fi

echo ""
echo "Tip: When Metro prints a URL, open that exact host and port in Safari (e.g. :8081)."
echo "     If Metro switched to :8082, an old :8081 tab can look “frozen” or out of date."
echo ""

ensure_backend() {
  cd "$SCRIPT_DIR/backend"
  if [[ ! -d node_modules ]]; then
    echo "Installing backend dependencies…"
    npm install
  fi
  if [[ ! -f .env ]] && [[ -f env.example ]]; then
    echo "No backend/.env — copy env.example to .env and fill secrets when you need them."
  fi
}

wait_for_api() {
  local tries=30
  local i=1
  while [[ "$i" -le "$tries" ]]; do
    if curl -sf "http://127.0.0.1:3001/health" >/dev/null 2>&1; then
      echo "Backend is up: http://127.0.0.1:3001/health"
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
  echo "WARN: health check did not pass yet. Logs: tail -f \"$BACKEND_LOG\""
}

start_backend_background() {
  ensure_backend
  echo "Starting backend (logs: $BACKEND_LOG)…"
  : >"$BACKEND_LOG"
  (cd "$SCRIPT_DIR/backend" && node src/server.js >>"$BACKEND_LOG" 2>&1) &
  echo "Backend PID: $!"
  wait_for_api
}

case "$MODE" in
  backend)
    ensure_backend
    echo "Backend foreground — http://127.0.0.1:3001/api  (Ctrl+C to stop)"
    exec node src/server.js
    ;;
  web)
    start_backend_background
    cd "$SCRIPT_DIR/mobile"
    if [[ ! -d node_modules ]]; then
      echo "Installing mobile dependencies…"
      npm install
    fi
    echo "Starting Expo for web (desktop browser)…"
    exec npm run web:desktop
    ;;
  tunnel)
    start_backend_background
    cd "$SCRIPT_DIR/mobile"
    if [[ ! -d node_modules ]]; then
      npm install
    fi
    echo "Starting Expo dev-client (tunnel)…"
    exec npm run start:dev:tunnel
    ;;
  dev-lan|""|default)
    start_backend_background
    cd "$SCRIPT_DIR/mobile"
    if [[ ! -d node_modules ]]; then
      npm install
    fi
    echo "Starting Expo dev-client (LAN)…"
    echo "Tip: set EXPO_PUBLIC_API_BASE_URL in mobile/.env.local to http://<this-mac-LAN-ip>:3001/api for a physical phone."
    exec npm run start:dev:lan
    ;;
  --no-kill)
    echo "Use: ./start-dev-stack.sh [--no-kill] [dev-lan|web|tunnel|backend]"
    exit 1
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Try: dev-lan | web | tunnel | backend"
    exit 1
    ;;
esac
