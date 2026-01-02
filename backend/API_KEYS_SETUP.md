# API Keys Setup Guide

## Quick Setup

Run the setup script:
```bash
cd /Users/nicholas/Documents/Build-Profit-Solutions/backend
./setup-api-keys.sh
```

Or manually edit the `.env` file.

## Option 1: SerpAPI (Recommended for Images)

**Why SerpAPI?**
- ✅ Includes product images in search results
- ✅ Reliable Google Shopping data
- ✅ Easy setup

**Steps:**
1. Sign up at https://serpapi.com/users/sign_up
   - Free tier: 100 searches/month
   - Credit card required (but won't charge for free tier)

2. Get your API key:
   - Go to https://serpapi.com/dashboard
   - Copy your API key

3. Add to `.env` file:
   ```bash
   SERPAPI_KEY=your_actual_serpapi_key_here
   ```

4. Restart backend:
   ```bash
   npm start
   ```

## Option 2: WebScrapingAPI

**Why WebScrapingAPI?**
- ✅ More requests (1,000/month free tier)
- ✅ Direct website scraping
- ✅ No credit card required

**Steps:**
1. Sign up at https://www.webscrapingapi.com/
   - Free tier: 1,000 requests/month
   - No credit card required

2. Get your API key from the dashboard

3. Add to `.env` file:
   ```bash
   WEBSCRAPINGAPI_KEY=your_actual_webscrapingapi_key_here
   ```

4. Restart backend:
   ```bash
   npm start
   ```

## How It Works

The system tries APIs in this priority order:
1. **Direct Store API** (no key needed, but may be rate-limited)
2. **SerpAPI** (if `SERPAPI_KEY` is set)
3. **WebScrapingAPI** (if `WEBSCRAPINGAPI_KEY` is set)
4. **Mock Data** (fallback)

## What You Get With API Keys

✅ **Real product images** - Images come directly from search results  
✅ **Actual current prices** - Real-time pricing from Home Depot/Lowe's  
✅ **Real product titles** - Accurate product names and descriptions  
✅ **Direct product links** - Links to actual product pages  
✅ **Location-based pricing** - Prices based on ZIP code  

## Testing

After configuring keys, test with:
```bash
curl "http://localhost:3001/api/sku/search?store=hd&zip=89141&q=2x4+lumber"
```

Look for these log messages:
- ✅ `🔑 Using SerpAPI for real pricing data`
- ✅ `🔑 Using WebScrapingAPI for real data`
- ✅ `✅ SerpAPI returned X results`
- ✅ `✅ WebScrapingAPI returned X results`

If you see:
- ❌ `⚠️ No API keys configured, using mock data`

Then check:
1. Your `.env` file has the correct key names
2. No extra spaces or quotes around the keys
3. You've restarted the backend server

## Troubleshooting

**Images still not showing?**
- SerpAPI includes images in the `thumbnail` field
- Check backend logs for image URLs
- Verify the API is returning results (not mock data)

**API not working?**
- Check your API key is correct (no extra spaces)
- Verify you haven't exceeded free tier limits
- Check backend console for error messages
- Try the other API option

**Need help?**
- Check backend logs: `npm start` (look for error messages)
- Verify `.env` file format (no quotes, no spaces)
- Test API key directly with curl or Postman
