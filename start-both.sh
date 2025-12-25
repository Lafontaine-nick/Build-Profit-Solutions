#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting Backend and Frontend..."
echo ""

# Terminal 1: Backend
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/backend && npm run dev"'

# Terminal 2: Frontend (LAN)
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/mobile && npm run dev:lan"'

echo "✅ Both services starting in separate terminal windows"
echo "   Backend: http://localhost:3001"
echo "   Frontend: Check the Expo terminal for QR code"
