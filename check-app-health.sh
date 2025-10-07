#!/bin/bash
# Build Profit Solutions - Health Check Script
# Run this anytime to check your app's health

echo "🔍 Build Profit Solutions - Health Check"
echo "========================================"

# Check for HTML entities in files
echo -n "Checking for HTML entities... "
if grep -r "&nbsp;\|<pre\|</pre" mobile/app/ >/dev/null 2>&1; then
    echo "❌ FOUND!"
    echo "Files with HTML:"
    grep -r "&nbsp;\|<pre\|</pre" mobile/app/ | cut -d: -f1 | sort -u
else
    echo "✅ Clean"
fi

# Check for duplicate routes
echo -n "Checking for duplicate routes... "
DUPES=$(find mobile/app -name "*.tsx" -o -name "*.jsx" | sed 's/\.[^.]*$//' | sort | uniq -d)
if [ -n "$DUPES" ]; then
    echo "❌ FOUND!"
    echo "Duplicate routes:"
    echo "$DUPES"
else
    echo "✅ No duplicates"
fi

# Check if servers are running
echo -n "Checking backend server (3001)... "
if lsof -i :3001 | grep LISTEN >/dev/null 2>&1; then
    echo "✅ Running"
else
    echo "⚪ Not running"
fi

echo -n "Checking mobile server (8081)... "
if lsof -i :8081 | grep LISTEN >/dev/null 2>&1; then
    echo "✅ Running"
else
    echo "⚪ Not running"
fi

# Check for critical packages
echo -n "Checking @react-native-community/slider... "
if [ -d "mobile/node_modules/@react-native-community/slider" ]; then
    echo "✅ Installed"
else
    echo "❌ Missing (run: npm install @react-native-community/slider)"
fi

# Check git status
echo ""
echo "Git Status:"
git status -s | head -10 || echo "Not in a git repository"

echo "========================================"
echo "Health check complete!"
echo ""
echo "Quick fixes:"
echo "  - Clear cache: cd mobile && npx expo start -c"
echo "  - Kill servers: killall -9 node"
echo "  - Full reset: ./APP_TROUBLESHOOTING_GUIDE.md (see recovery section)" 