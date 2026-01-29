#!/bin/bash

# Development startup script with proper hot reload configuration
# This script starts Expo in a way that maximizes hot reload reliability

echo "🚀 Starting Expo in development mode..."
echo ""

# Clear caches only on first run (comment out after first use)
# rm -rf .expo node_modules/.cache

# Start Expo with tunnel mode (more reliable for physical devices)
# Remove --clear flag to enable hot reload
npx expo start --tunnel

# Note: After first connection, you can restart without --tunnel for faster startup:
# npx expo start














