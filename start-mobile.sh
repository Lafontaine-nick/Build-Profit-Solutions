#!/bin/bash

echo "📱 Starting Mobile App (Expo)"
echo "============================="
echo ""

cd "$(dirname "$0")/mobile" || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Parse arguments
USE_TUNNEL=false
USE_SIMULATOR=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --tunnel|-t)
            USE_TUNNEL=true
            shift
            ;;
        --simulator|-s)
            USE_SIMULATOR=true
            shift
            ;;
        --clear|-c)
            echo "🧹 Clearing Expo cache..."
            npx expo start --clear
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--tunnel|--simulator|--clear]"
            exit 1
            ;;
    esac
done

# Start Expo based on mode
if [ "$USE_TUNNEL" = true ]; then
    echo "🌐 Starting Expo in TUNNEL mode (for hotel WiFi, etc.)"
    echo ""
    npx expo start --tunnel
elif [ "$USE_SIMULATOR" = true ]; then
    echo "📱 Starting Expo for iOS Simulator (localhost)"
    echo ""
    npx expo start --ios
else
    echo "💡 Starting Expo in LAN mode"
    echo "   Use --tunnel for hotel WiFi"
    echo "   Use --simulator for iOS Simulator"
    echo ""
    npx expo start --clear
fi
