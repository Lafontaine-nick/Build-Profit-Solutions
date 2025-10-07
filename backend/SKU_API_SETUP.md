# SKU Search - Real Pricing Setup Guide

## Current Issue
Your SKU search is returning **mock/fake data** because no API keys are configured. To get real Home Depot and Lowes pricing, you need to set up one of the following APIs.

## ✅ Solution Options

### Option 1: WebScrapingAPI (Recommended)
**Best for**: Direct website scraping with JavaScript rendering

1. **Sign up**: https://www.webscrapingapi.com/
   - Free tier: 1,000 requests/month
   - No credit card required for free tier

2. **Get your API key** from the dashboard

3. **Add to .env file**:
   ```bash
   cd /Users/nick_lafontaine/build-profit-solutions/backend
   echo "WEBSCRAPINGAPI_KEY=your_actual_key_here" >> .env
   ```

4. **Restart the backend**:
   ```bash
   npm start
   ```

### Option 2: SerpAPI
**Best for**: Google Shopping results (more reliable but fewer details)

1. **Sign up**: https://serpapi.com/
   - Free tier: 100 searches/month
   - Credit card required (but won't charge for free tier)

2. **Get your API key** from the dashboard

3. **Add to .env file**:
   ```bash
   cd /Users/nick_lafontaine/build-profit-solutions/backend
   echo "SERPAPI_KEY=your_actual_key_here" >> .env
   ```

4. **Restart the backend**:
   ```bash
   npm start
   ```

## 🔍 How It Works

### Priority Order
The system tries APIs in this order:
1. **WebScrapingAPI** (if key is set)
2. **SerpAPI** (if key is set)
3. **Mock Data** (fallback when no keys are available)

### What You Get

#### With Real API Keys:
- ✅ Actual current prices from Home Depot and Lowes
- ✅ Real product titles and specifications
- ✅ Direct links to product pages
- ✅ Product images (when available)
- ✅ Location-based pricing (uses ZIP code)

#### With Mock Data (Current):
- ❌ Estimated prices (may not match reality)
- ❌ Generic product names
- ❌ No direct product links
- ❌ No images
- ⚠️ Good for testing UI, bad for real quotes

## 📊 API Comparison

| Feature | WebScrapingAPI | SerpAPI | Mock Data |
|---------|----------------|---------|-----------|
| Free Tier | 1,000 req/month | 100 req/month | Unlimited |
| Accuracy | High (direct scraping) | Medium (Google results) | Low (estimates) |
| Product Details | Excellent | Good | Poor |
| Setup Difficulty | Easy | Easy | None |
| Credit Card | No | Yes | N/A |

## 🚀 Quick Setup (WebScrapingAPI)

```bash
# 1. Go to https://www.webscrapingapi.com/ and sign up
# 2. Copy your API key
# 3. Run these commands:

cd /Users/nick_lafontaine/build-profit-solutions/backend
echo "WEBSCRAPINGAPI_KEY=paste_your_key_here" >> .env

# 4. Restart backend
pkill -f "node src/server.js"
npm start
```

## 🧪 Test Your Setup

After adding API keys, test with:

```bash
curl "http://localhost:3001/api/sku/search?store=hd&zip=89011&q=2x4+lumber"
```

Look for the log message:
- ✅ `🔑 Using WebScrapingAPI for real data` (good!)
- ❌ `⚠️ No valid API keys found, using mock data` (needs setup)

## 💡 Recommendations

1. **For Development**: WebScrapingAPI (1,000 requests is plenty for testing)
2. **For Production**: Consider paid tiers based on usage
3. **For Demo**: Current mock data works fine for UI testing

## Need Help?

If you run into issues:
1. Check that your API key is correctly added to `.env`
2. Make sure there are no extra spaces or quotes around the key
3. Restart the backend server after adding keys
4. Check the backend console for error messages

