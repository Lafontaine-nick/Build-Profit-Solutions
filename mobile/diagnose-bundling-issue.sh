#!/bin/bash

echo "🔍 Diagnosing Why App Won't Bundle"
echo "===================================="
echo ""

# Check 1: Is Metro running?
echo "1️⃣ Checking if Metro bundler is running..."
if lsof -i :8081 > /dev/null 2>&1; then
    echo "✅ Metro is running on port 8081"
    echo ""
    echo "   Process details:"
    lsof -i :8081 | head -3
else
    echo "❌ Metro is NOT running"
    echo "   This is why it's not bundling!"
    echo "   Metro needs to be running to bundle your app"
fi

echo ""

# Check 2: Check for common errors in entry point
echo "2️⃣ Checking for common issues..."
cd "$(dirname "$0")"

# Check if entry point exists
if [ -f "app/_layout.tsx" ] || [ -f "app/_layout.jsx" ] || [ -f "app/_layout.ts" ] || [ -f "app/_layout.js" ]; then
    echo "✅ Entry point (_layout) exists"
else
    echo "❌ Entry point (_layout) not found!"
    echo "   Expo Router requires app/_layout.tsx or app/_layout.jsx"
fi

# Check if app directory exists
if [ -d "app" ]; then
    echo "✅ app/ directory exists"
    echo "   Found $(find app -name "*.tsx" -o -name "*.jsx" | wc -l | tr -d ' ') route files"
else
    echo "❌ app/ directory not found!"
fi

echo ""

# Check 3: Check for syntax errors
echo "3️⃣ Checking for TypeScript/JavaScript errors..."
if command -v npx > /dev/null 2>&1; then
    echo "   Running type check..."
    npx tsc --noEmit 2>&1 | head -20
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo "   ✅ No TypeScript errors found"
    else
        echo "   ⚠️  TypeScript errors found (may prevent bundling)"
    fi
else
    echo "   ⚠️  Could not run type check"
fi

echo ""

# Check 4: Check package.json and dependencies
echo "4️⃣ Checking dependencies..."
if [ -f "package.json" ]; then
    echo "✅ package.json exists"
    if [ -d "node_modules" ]; then
        echo "✅ node_modules exists"
        if [ -d "node_modules/expo" ]; then
            echo "✅ Expo is installed"
        else
            echo "❌ Expo is NOT installed!"
            echo "   Run: npm install"
        fi
    else
        echo "❌ node_modules not found!"
        echo "   Run: npm install"
    fi
else
    echo "❌ package.json not found!"
fi

echo ""
echo "===================================="
echo ""
echo "📋 Summary & Next Steps:"
echo ""

if ! lsof -i :8081 > /dev/null 2>&1; then
    echo "🚨 MAIN ISSUE: Metro bundler is not running"
    echo ""
    echo "   Fix: Start Metro bundler:"
    echo "   cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile"
    echo "   npx expo start --lan --clear"
    echo ""
    echo "   Then watch the terminal for:"
    echo "   - 'Bundling...' messages"
    echo "   - Any error messages"
    echo "   - QR code appearing"
else
    echo "✅ Metro is running"
    echo ""
    echo "   If it's still not bundling, check:"
    echo "   1. Look at Metro terminal for error messages"
    echo "   2. Try making a small change to trigger bundling"
    echo "   3. Check if there are syntax errors in your code"
    echo ""
    echo "   To see what Metro is doing:"
    echo "   - Check the terminal where Metro is running"
    echo "   - Look for 'Bundling...' or error messages"
fi

echo ""
echo "💡 Quick Fix:"
echo "   cd /Users/nicholas/Documents/Build-Profit-Solutions/mobile"
echo "   pkill -f 'expo start'"
echo "   rm -rf .expo node_modules/.cache"
echo "   npx expo start --lan --clear"
echo ""
