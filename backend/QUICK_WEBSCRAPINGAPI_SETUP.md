# Quick WebScrapingAPI Setup

## Steps:

1. **Sign up** at https://www.webscrapingapi.com/
   - Free tier: 1,000 requests/month
   - No credit card required

2. **Get your API key** from the dashboard

3. **Add to .env file:**
   ```bash
   cd /Users/nicholas/Documents/Build-Profit-Solutions/backend
   # Edit .env and replace this line:
   WEBSCRAPINGAPI_KEY=YOUR_WEBSCRAPINGAPI_KEY_HERE
   # With your actual key:
   WEBSCRAPINGAPI_KEY=your_actual_key_here
   ```

4. **Restart backend:**
   ```bash
   # Stop current backend (Ctrl+C or pkill)
   npm start
   ```

## What This Does:

- WebScrapingAPI will be used as a backup if SerpAPI fails
- It scrapes actual product pages and extracts real images
- May provide better image URLs that work directly in React Native

## Current Setup:

Your system tries APIs in this order:
1. Direct Store API (no key needed)
2. **SerpAPI** (you have this configured ✅)
3. **WebScrapingAPI** (add this as backup)
4. Mock Data (fallback)
