#!/bin/bash

echo "🚀 Deploying Build Profit Solutions Mobile App to Expo..."

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g @expo/eas-cli
fi

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
    echo "❌ Not logged in to Expo. Please run: eas login"
    exit 1
fi

echo "✅ EAS CLI found and authenticated"

# Build and publish the app
echo "📱 Building and publishing app..."
eas build --platform all --profile preview --non-interactive

echo "✅ App published successfully!"
echo ""
echo "🔗 Your app is now available at:"
echo "   https://expo.dev/@buildprofitsolutions/build-profit-solutions-mobile"
echo ""
echo "📱 To test with Expo Go:"
echo "1. Install Expo Go on your device"
echo "2. Scan the QR code from the Expo dashboard"
echo "3. Or visit: https://expo.dev/@buildprofitsolutions/build-profit-solutions-mobile"
echo ""
echo "🌐 Web version available at:"
echo "   https://build-profit-solutions-mobile.vercel.app" 