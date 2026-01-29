#!/bin/bash

cd /Users/nick_lafontaine/build-profit-solutions/mobile

# Kill any existing Metro processes
pkill -9 -f "expo\|metro" 2>/dev/null

# Clear caches
rm -rf .expo node_modules/.cache .metro-cache .metro .expo-shared

# Start Expo
npx expo start --clear
