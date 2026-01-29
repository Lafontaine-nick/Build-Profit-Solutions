#!/bin/bash

echo "🚀 Build Profit Solutions - Release Setup"
echo "=========================================="

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g @expo/eas-cli
else
    echo "✅ EAS CLI already installed"
fi

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
    echo "🔐 Please login to Expo:"
    eas login
else
    echo "✅ Already logged in to Expo"
fi

# Configure EAS
echo "⚙️  Configuring EAS build..."
eas build:configure

echo ""
echo "🎯 Next Steps:"
echo "1. Test your app thoroughly"
echo "2. Run: eas build --platform all --profile development"
echo "3. Test the development build"
echo "4. Run: eas build --platform all --profile production"
echo "5. Submit to app stores (if needed)"
echo ""
echo "📋 See RELEASE_CHECKLIST.md for complete checklist" 