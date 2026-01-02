#!/bin/bash

# API Keys Setup Script for Build Profit Solutions
# This script helps you configure SerpAPI and WebScrapingAPI keys

echo "🔑 API Keys Setup for Product Search"
echo "======================================"
echo ""
echo "This will help you configure API keys for real product images and pricing."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating from env.example..."
    cp env.example .env
fi

echo "Choose which API to configure:"
echo "1. SerpAPI (Recommended - includes product images)"
echo "   - Free tier: 100 searches/month"
echo "   - Sign up: https://serpapi.com/"
echo ""
echo "2. WebScrapingAPI"
echo "   - Free tier: 1,000 requests/month"
echo "   - Sign up: https://www.webscrapingapi.com/"
echo ""
echo "3. Both"
echo ""
read -p "Enter choice (1, 2, or 3): " choice

case $choice in
    1)
        echo ""
        echo "📝 SerpAPI Setup:"
        echo "1. Go to https://serpapi.com/users/sign_up"
        echo "2. Sign up (free tier available)"
        echo "3. Go to https://serpapi.com/dashboard"
        echo "4. Copy your API key"
        echo ""
        read -p "Paste your SerpAPI key here: " serp_key
        
        if [ ! -z "$serp_key" ]; then
            # Remove old SERPAPI_KEY line and add new one
            sed -i.bak '/^SERPAPI_KEY=/d' .env
            echo "SERPAPI_KEY=$serp_key" >> .env
            echo "✅ SerpAPI key configured!"
        else
            echo "❌ No key provided. Skipping..."
        fi
        ;;
    2)
        echo ""
        echo "📝 WebScrapingAPI Setup:"
        echo "1. Go to https://www.webscrapingapi.com/"
        echo "2. Sign up (free tier available, no credit card)"
        echo "3. Go to your dashboard"
        echo "4. Copy your API key"
        echo ""
        read -p "Paste your WebScrapingAPI key here: " web_key
        
        if [ ! -z "$web_key" ]; then
            # Remove old WEBSCRAPINGAPI_KEY line and add new one
            sed -i.bak '/^WEBSCRAPINGAPI_KEY=/d' .env
            echo "WEBSCRAPINGAPI_KEY=$web_key" >> .env
            echo "✅ WebScrapingAPI key configured!"
        else
            echo "❌ No key provided. Skipping..."
        fi
        ;;
    3)
        echo ""
        echo "📝 SerpAPI Setup:"
        echo "1. Go to https://serpapi.com/users/sign_up"
        echo "2. Sign up (free tier available)"
        echo "3. Go to https://serpapi.com/dashboard"
        echo "4. Copy your API key"
        echo ""
        read -p "Paste your SerpAPI key here: " serp_key
        
        if [ ! -z "$serp_key" ]; then
            sed -i.bak '/^SERPAPI_KEY=/d' .env
            echo "SERPAPI_KEY=$serp_key" >> .env
            echo "✅ SerpAPI key configured!"
        fi
        
        echo ""
        echo "📝 WebScrapingAPI Setup:"
        echo "1. Go to https://www.webscrapingapi.com/"
        echo "2. Sign up (free tier available, no credit card)"
        echo "3. Go to your dashboard"
        echo "4. Copy your API key"
        echo ""
        read -p "Paste your WebScrapingAPI key here: " web_key
        
        if [ ! -z "$web_key" ]; then
            sed -i.bak '/^WEBSCRAPINGAPI_KEY=/d' .env
            echo "WEBSCRAPINGAPI_KEY=$web_key" >> .env
            echo "✅ WebScrapingAPI key configured!"
        fi
        ;;
    *)
        echo "❌ Invalid choice. Exiting..."
        exit 1
        ;;
esac

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart your backend server:"
echo "   cd /Users/nicholas/Documents/Build-Profit-Solutions/backend"
echo "   npm start"
echo ""
echo "2. Test the API by searching for products in your app"
echo ""
echo "3. Check backend logs for:"
echo "   ✅ '🔑 Using SerpAPI for real pricing data' (if using SerpAPI)"
echo "   ✅ '🔑 Using WebScrapingAPI for real data' (if using WebScrapingAPI)"
echo ""
