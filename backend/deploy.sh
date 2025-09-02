#!/bin/bash

echo "🚀 Deploying Build Profit Solutions Backend to Render..."

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI not found. Please install it first:"
    echo "   brew install render"
    echo "   Or visit: https://render.com/docs/cli"
    exit 1
fi

# Check if logged in to Render
if ! render whoami &> /dev/null; then
    echo "❌ Not logged in to Render. Please run: render login"
    exit 1
fi

echo "✅ Render CLI found and authenticated"

# Create the service
echo "📦 Creating Render service..."
render service create \
    --name build-profit-solutions-backend \
    --env node \
    --plan starter \
    --build-command "npm install" \
    --start-command "npm start" \
    --env-var NODE_ENV=production \
    --env-var PORT=10000 \
    --env-var FRONTEND_URL=https://build-profit-solutions-mobile.vercel.app

echo "✅ Service created successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Go to https://dashboard.render.com"
echo "2. Find your service: build-profit-solutions-backend"
echo "3. Add these environment variables:"
echo "   - OPENAI_API_KEY"
echo "   - DATABASE_URL"
echo "   - JWT_SECRET"
echo "   - STRIPE_SECRET_KEY"
echo "   - STRIPE_WEBHOOK_SECRET"
echo "   - CLERK_SECRET_KEY"
echo "4. Deploy the service"
echo ""
echo "🌐 Your backend will be available at:"
echo "   https://build-profit-solutions-backend.onrender.com" 