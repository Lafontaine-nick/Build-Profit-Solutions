#!/bin/bash

echo "🔍 API Error Diagnostic Tool"
echo "============================"
echo ""

# Check network IP
echo "1️⃣  Checking Network IP..."
CURRENT_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
echo "   Current IP: $CURRENT_IP"
echo ""

# Check if backend is running locally
echo "2️⃣  Testing Backend Connection..."
BACKEND_URL="http://192.168.0.201:3001"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    echo "   ✅ Backend is running and accessible"
elif [ "$HEALTH_CHECK" = "000" ]; then
    echo "   ❌ Backend is NOT running or not accessible"
    echo "   💡 Start backend with: cd ../backend && npm start"
else
    echo "   ⚠️  Backend responded with status: $HEALTH_CHECK"
fi
echo ""

# Check production backend
echo "3️⃣  Testing Production Backend..."
PROD_URL="https://build-profit-solutions-backend.onrender.com"
PROD_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/health" 2>/dev/null || echo "000")

if [ "$PROD_CHECK" = "200" ]; then
    echo "   ✅ Production backend is accessible"
elif [ "$PROD_CHECK" = "000" ]; then
    echo "   ❌ Production backend is not accessible (network issue or down)"
else
    echo "   ⚠️  Production backend responded with status: $PROD_CHECK"
fi
echo ""

# Check API configuration
echo "4️⃣  Checking API Configuration..."
if [ -f "app.config.js" ]; then
    echo "   ✅ app.config.js exists"
    API_URL=$(grep -o "apiBaseUrl.*" app.config.js | head -1)
    echo "   Config: $API_URL"
else
    echo "   ❌ app.config.js not found"
fi
echo ""

# Check environment variables
echo "5️⃣  Checking Environment Variables..."
if [ -f ".env.local" ]; then
    echo "   ✅ .env.local exists"
    if grep -q "EXPO_PUBLIC_API_BASE_URL" .env.local; then
        echo "   API URL in .env.local:"
        grep "EXPO_PUBLIC_API_BASE_URL" .env.local
    else
        echo "   ⚠️  EXPO_PUBLIC_API_BASE_URL not set in .env.local"
    fi
else
    echo "   ⚠️  .env.local not found (optional)"
fi
echo ""

# Summary
echo "📋 Summary:"
echo "=========="
if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ Local backend is running - API errors might be:"
    echo "   - CORS issues"
    echo "   - Authentication problems"
    echo "   - Wrong endpoint paths"
    echo "   - Request format issues"
elif [ "$PROD_CHECK" = "200" ]; then
    echo "✅ Production backend is accessible"
    echo "   Consider using production URL if local backend is down"
else
    echo "❌ Both backends are unreachable"
    echo "   This is likely a network connectivity issue"
fi
echo ""
echo "💡 Next Steps:"
echo "   1. Check the Expo console for specific error messages"
echo "   2. Look for '🌐 ApiService making request to:' logs"
echo "   3. Verify the exact error message in the app"
echo ""







