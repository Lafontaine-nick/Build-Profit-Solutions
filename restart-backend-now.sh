#!/bin/bash

echo "🔄 FORCING BACKEND RESTART..."
echo ""

cd "$(dirname "$0")/backend" || exit 1

# Kill ALL node processes related to this project
echo "🛑 Killing all backend processes..."
pkill -9 -f "node.*server.js" 2>/dev/null
pkill -9 -f "nodemon" 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
sleep 3

# Verify port is free
if lsof -ti:3001 > /dev/null 2>&1; then
    echo "⚠️  Port 3001 still in use, force killing..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Clear any Node.js cache
echo "🧹 Clearing cache..."
rm -rf node_modules/.cache 2>/dev/null || true

# Verify the code is correct
echo "✅ Verifying code..."
if grep -q "budgetMin is OPTIONAL" src/routes/project-leads.js; then
    echo "   ✅ Code is correct - budgetMin is optional"
else
    echo "   ❌ WARNING: Code might not be updated!"
fi

# Start the server
echo ""
echo "🚀 Starting backend server..."
echo "   Watch for: '✅ CODE VERSION: budgetMin is OPTIONAL'"
echo ""

npm start
