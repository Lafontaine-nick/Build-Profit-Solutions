#!/bin/bash
# Build Profit Solutions — start backend (kills existing on 3001/3000, then starts)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Backend Server"
echo "=========================="
echo ""

# Free ports 3001 and 3000 if in use
for port in 3001 3000; do
  if lsof -ti :$port >/dev/null 2>&1; then
    echo "⚠️  Port $port in use — stopping existing process..."
    lsof -ti :$port | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
done

cd "$SCRIPT_DIR/backend" || exit 1

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

if [ ! -f ".env" ]; then
  echo "⚠️  No .env found (optional; copy from env.example if needed)"
  echo ""
fi

echo "🌐 Starting backend..."
echo "   Port 3001: Main API"
echo "   Port 3000: Secondary API"
echo "   Health: http://localhost:3001/health"
echo "   API:    http://localhost:3001/api"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

npm start
