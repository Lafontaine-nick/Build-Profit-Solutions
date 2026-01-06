# SKU Search Reliability Guide

## ✅ How It Works Now

Your SKU search is now **production-ready** and will automatically:

1. **Try SerpAPI first** (you have a key configured) → Real product images & prices
2. **Fallback to WebScrapingAPI** (if configured) → Real product images & prices  
3. **Fallback to Direct Store API** (no key needed) → Real product images & prices
4. **Last resort: Mock data** → Placeholder images & estimated prices

## 🔧 Verification

**Before starting your app, verify everything is working:**

```bash
cd backend
npm run verify-sku
```

This will check:
- ✅ API keys are configured
- ✅ Backend is running
- ✅ SKU search endpoint works
- ✅ Real product images are being returned
- ✅ Real pricing data is available

## 📋 Startup Checklist

**Every time you start your app, make sure:**

1. **Backend is running:**
   ```bash
   cd backend
   npm start
   ```
   - Should see: `🚀 Server running on port 3001`
   - Should see: `✅ SKU Search API ready`

2. **API keys are configured:**
   ```bash
   # Check your .env file has:
   SERPAPI_KEY=your_actual_key_here
   # (Not "YOUR_SERPAPI_KEY_HERE")
   ```

3. **Verify SKU search works:**
   ```bash
   npm run verify-sku
   ```

## 🚨 Troubleshooting

### Images Not Showing

**Symptom:** Only seeing placeholder "Lumber" images

**Check:**
1. Run `npm run verify-sku` - does it show "real product images"?
2. Check backend logs for: `✅ SerpAPI returned X results with REAL product images!`
3. If you see `⚠️ Using mock data`, your API keys might not be configured

**Fix:**
- Make sure `SERPAPI_KEY` in `.env` is set to your actual key (not placeholder)
- Restart backend after changing `.env`

### Prices Are Estimates

**Symptom:** Prices seem generic/estimated

**Check:**
- Backend logs should show which API succeeded
- Run `npm run verify-sku` - does it say "MOCK DATA" or "REAL DATA"?

**Fix:**
- Configure SerpAPI key (free tier: 100 searches/month)
- Or configure WebScrapingAPI key

### Backend Connection Failed

**Symptom:** "Network request failed" in app

**Check:**
1. Backend is running: `curl http://localhost:3001/health`
2. Network detection is using correct IP (check app logs)
3. iOS Simulator should use network IP, not localhost

**Fix:**
- Start backend: `cd backend && npm start`
- Restart Expo app with cleared cache: `npx expo start -c`

## 🔐 API Key Setup

### SerpAPI (Recommended - You Already Have This!)

**Free Tier:** 100 searches/month  
**What You Get:** Real product images + Google Shopping prices

1. Your key is already configured in `.env`
2. Make sure it's not the placeholder: `YOUR_SERPAPI_KEY_HERE`
3. If you need a new key: https://serpapi.com/

### WebScrapingAPI (Optional Backup)

**Free Tier:** 1,000 requests/month  
**What You Get:** Direct website scraping

1. Sign up: https://www.webscrapingapi.com/
2. Add to `.env`: `WEBSCRAPINGAPI_KEY=your_key_here`
3. Restart backend

## 📊 What Gets Returned

### With Real APIs (SerpAPI/WebScrapingAPI):
- ✅ **Real product images** from Home Depot/Lowe's
- ✅ **Actual current prices** from Google Shopping or store websites
- ✅ **Real product titles** and specifications
- ✅ **Direct product links**

### With Mock Data (Fallback):
- ⚠️ **Placeholder images** (colored squares with category labels)
- ⚠️ **Estimated prices** (based on common item prices)
- ⚠️ **Generic product names**
- ✅ **Still functional** for testing UI

## 🎯 Key Configuration Files

1. **`backend/.env`** - API keys
   ```bash
   SERPAPI_KEY=your_actual_key_here
   WEBSCRAPINGAPI_KEY=your_key_here (optional)
   ```

2. **`backend/src/routes/sku.js`** - Search logic (already optimized)

3. **`mobile/utils/networkDetection.ts`** - Network IP detection (already fixed)

## 🔄 Current Status

**Your setup is now:**
- ✅ SerpAPI enabled and prioritized (you have a key)
- ✅ Proper timeout handling (15 seconds for APIs)
- ✅ Robust fallback chain
- ✅ Better error logging
- ✅ Network detection fixed for simulators

**Every startup should:**
1. Backend logs: `🔑 Trying SerpAPI...`
2. Backend logs: `✅ SerpAPI returned X results with REAL product images!`
3. App shows: Real product images and prices

## 🛡️ Safeguards Added

1. **Verification script** - Run before starting app to check everything
2. **Increased timeouts** - 15 seconds for real APIs (was 3 seconds)
3. **Better error logging** - Shows exactly which API succeeded/failed
4. **Robust fallback chain** - Always has a working option
5. **Network detection** - Fixed for iOS Simulator

---

**Last Updated:** After fixing SKU search issues  
**Status:** Production-ready ✅
