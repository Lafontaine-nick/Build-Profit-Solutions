#!/bin/bash

# Build Profit Solutions - Production Build Script
echo "🚀 Starting production build process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the mobile directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Run type checking
echo "🔍 Running TypeScript type checking..."
npm run type-check

if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found. Please fix them before building."
    exit 1
fi

# Run linting
echo "🧹 Running ESLint..."
npm run lint

if [ $? -ne 0 ]; then
    echo "❌ ESLint errors found. Please fix them before building."
    exit 1
fi

# Run tests
echo "🧪 Running tests..."
npm test -- --passWithNoTests

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Please fix them before building."
    exit 1
fi

# Build for production
echo "🏗️ Building for production..."

# Build for iOS
echo "📱 Building for iOS..."
npx expo build:ios --clear-cache

# Build for Android
echo "🤖 Building for Android..."
npx expo build:android --clear-cache

# Build for web
echo "🌐 Building for web..."
npx expo build:web --clear-cache

echo "✅ Production build completed successfully!"
echo "📁 Build artifacts are ready for deployment." 