# Yelp Fusion API Setup Guide

## 🎯 What You Get with Yelp API

The Yelp Fusion API integration allows your Build Profit Solutions app to:

- ✅ **Find Contractors & Subcontractors** - Search by specialty (electrician, plumber, HVAC, etc.)
- ✅ **Find Material Suppliers** - Locate hardware stores, lumber yards, and building supply shops near job sites
- ✅ **Verify Business Credibility** - Get real reviews, ratings, and business information
- ✅ **Get Contact Information** - Phone numbers, addresses, website URLs
- ✅ **Check Business Hours** - Know when suppliers are open
- ✅ **Distance Calculation** - Find closest options to your project location

---

## 🆓 Free Tier Details

**Yelp Fusion API is FREE!**
- **5,000 API calls per day**
- **No credit card required**
- **Full access to business search, details, and reviews**
- More than enough for most small-to-medium construction apps

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create a Yelp Account (if you don't have one)
1. Go to https://www.yelp.com/signup
2. Create an account with your email
3. Verify your email address

### Step 2: Create an App and Get Your API Key
1. Go to https://www.yelp.com/developers/v3/manage_app
2. Log in with your Yelp account
3. Click **"Create New App"**
4. Fill in the form:
   - **App Name**: Build Profit Solutions (or your app name)
   - **Industry**: Construction / Home Services
   - **Company**: Your company name
   - **Website**: Your app URL (or GitHub repo URL)
   - **Description**: "Construction contractor app for finding materials and subcontractors"
   - **Contact Email**: Your email
5. Agree to the Terms of Service
6. Click **"Create New App"**
7. You'll see your **API Key** immediately!

### Step 3: Add API Key to Your Backend
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend

# Add your API key to .env file
echo "YELP_API_KEY=your_actual_api_key_here" >> .env
```

### Step 4: Restart Your Backend
```bash
npm start
```

---

## 🧪 Test Your Setup

### Test 1: Check API Key Status
```bash
curl http://localhost:3001/api/yelp/test-key
```

**Expected Response:**
```json
{
  "hasKey": true,
  "keyPreview": "AbCdEfGh...",
  "isValid": true,
  "message": "✅ Yelp API key is valid!"
}
```

### Test 2: Search for Contractors
```bash
curl "http://localhost:3001/api/yelp/search?term=contractors&location=Las%20Vegas,%20NV"
```

### Test 3: Search for Building Supplies
```bash
curl "http://localhost:3001/api/yelp/search?term=building%20supplies&location=89109&limit=10"
```

---

## 📚 API Endpoints

### 1. Search Businesses
**Endpoint:** `GET /api/yelp/search`

**Use Cases:**
- Find contractors by specialty
- Find material suppliers near job sites
- Search for any construction-related businesses

**Query Parameters:**
- `term` - Search term (e.g., "electrician", "lumber", "HVAC")
- `location` - Location (address, city, state, or ZIP)
- `latitude` & `longitude` - Alternative to location (more precise)
- `categories` - Yelp category aliases (e.g., "contractors", "buildingsupplies")
- `radius` - Search radius in meters (max 40,000 = ~25 miles)
- `limit` - Number of results (1-50, default 20)
- `sort_by` - Sort order: "best_match" (default), "rating", "review_count", "distance"
- `open_now` - Set to "true" to only show currently open businesses

**Example Request:**
```bash
curl "http://localhost:3001/api/yelp/search?term=electrician&location=89109&radius=16000&limit=10&sort_by=rating"
```

**Example Response:**
```json
{
  "businesses": [
    {
      "id": "business-id-123",
      "name": "ABC Electric Services",
      "imageUrl": "https://...",
      "url": "https://www.yelp.com/biz/...",
      "rating": 4.5,
      "reviewCount": 127,
      "categories": [
        { "alias": "electricians", "title": "Electricians" }
      ],
      "location": {
        "address": "1234 Main St",
        "city": "Las Vegas",
        "state": "NV",
        "zipCode": "89109",
        "displayAddress": ["1234 Main St", "Las Vegas, NV 89109"]
      },
      "coordinates": {
        "latitude": 36.1699,
        "longitude": -115.1398
      },
      "phone": "+17025551234",
      "displayPhone": "(702) 555-1234",
      "distance": 2.5,
      "isClosed": false,
      "price": "$$"
    }
  ],
  "total": 45,
  "metadata": {
    "isMockData": false,
    "message": "✅ Real Yelp data",
    "dataSource": "yelp"
  }
}
```

---

### 2. Get Business Details
**Endpoint:** `GET /api/yelp/business/:id`

**Use Case:** Get detailed information about a specific business including hours, photos, and more.

**Example Request:**
```bash
curl "http://localhost:3001/api/yelp/business/abc-electric-services-las-vegas"
```

**Example Response:**
```json
{
  "business": {
    "id": "abc-electric-services-las-vegas",
    "name": "ABC Electric Services",
    "rating": 4.5,
    "reviewCount": 127,
    "hours": [
      {
        "open": [
          { "day": 0, "start": "0800", "end": "1700" },
          { "day": 1, "start": "0800", "end": "1700" }
        ],
        "is_open_now": true
      }
    ],
    "photos": [
      "https://photo1.jpg",
      "https://photo2.jpg"
    ],
    "transactions": ["pickup", "delivery"]
  },
  "metadata": {
    "isMockData": false,
    "dataSource": "yelp"
  }
}
```

---

### 3. Get Business Reviews
**Endpoint:** `GET /api/yelp/reviews/:id`

**Use Case:** Get up to 3 reviews for a business to verify quality and reputation.

**Example Request:**
```bash
curl "http://localhost:3001/api/yelp/reviews/abc-electric-services-las-vegas"
```

**Example Response:**
```json
{
  "reviews": [
    {
      "id": "review-123",
      "rating": 5,
      "text": "Great service! Very professional and on time.",
      "timeCreated": "2024-10-01T12:00:00Z",
      "url": "https://www.yelp.com/...",
      "user": {
        "id": "user-123",
        "name": "John D.",
        "imageUrl": "https://..."
      }
    }
  ],
  "total": 127,
  "metadata": {
    "isMockData": false,
    "dataSource": "yelp"
  }
}
```

---

## 🎨 Common Use Cases in Your App

### 1. Find Subcontractors for a Project
```javascript
// Search for electricians near a project
const response = await fetch(
  `/api/yelp/search?term=electrician&location=${projectZipCode}&radius=16000&sort_by=rating&limit=10`
);
const data = await response.json();
```

### 2. Find Material Suppliers Near Job Site
```javascript
// Find building supply stores
const response = await fetch(
  `/api/yelp/search?categories=buildingsupplies&latitude=${lat}&longitude=${lng}&radius=8000&open_now=true`
);
```

### 3. Verify Contractor Reputation
```javascript
// Get reviews for a contractor
const response = await fetch(`/api/yelp/reviews/${businessId}`);
const { reviews } = await response.json();
```

---

## 🏗️ Yelp Categories for Construction

Here are useful Yelp category aliases you can use:

**Contractors:**
- `contractors` - General contractors
- `electricians` - Electricians
- `plumbing` - Plumbers
- `hvac` - HVAC services
- `roofing` - Roofing contractors
- `flooring` - Flooring services
- `painters` - Painters
- `landscaping` - Landscaping

**Suppliers:**
- `buildingsupplies` - Building supplies
- `hardware` - Hardware stores
- `lumber` - Lumber yards
- `homedecor` - Home decor

**Example:**
```bash
curl "http://localhost:3001/api/yelp/search?categories=plumbing,electricians&location=89109"
```

---

## 📊 API Limits & Best Practices

### Rate Limits
- **5,000 calls per day** (free tier)
- No per-second limit specified by Yelp
- Resets daily at midnight PST

### Best Practices
1. **Cache Results** - Don't search for the same business multiple times
2. **Use Specific Terms** - "plumber Las Vegas" is better than just "contractor"
3. **Use Coordinates** - More accurate than text addresses when available
4. **Set Reasonable Radius** - Don't search the entire state
5. **Limit Results** - Only request what you need (10-20 is usually enough)

---

## 🔧 Troubleshooting

### Issue: "Invalid API key"
**Solution:** Check that your API key is correctly added to `.env` file without extra spaces or quotes.

### Issue: "No results found"
**Solutions:**
- Try a broader search term
- Increase the search radius
- Remove the `open_now` filter
- Try a different category

### Issue: "Mock data is being returned"
**Solutions:**
1. Verify API key is in `.env` file
2. Restart the backend server
3. Test with: `curl http://localhost:3001/api/yelp/test-key`

---

## 🎯 Next Steps

Once your Yelp API is set up:

1. **Integrate into your mobile app** - Add contractor/supplier search screens
2. **Cache popular searches** - Store frequently accessed businesses
3. **Add favorites** - Let users save their preferred contractors
4. **Enable contact** - Add "Call" and "Get Directions" buttons
5. **Show reviews** - Display ratings prominently

---

## 💡 Pro Tips

1. **Combine with SKU API** - Search Yelp for suppliers, then check Home Depot/Lowes for specific products
2. **Location-based** - Use GPS to find nearest suppliers when on a job site
3. **Filter by rating** - Only show businesses with 4+ stars
4. **Check hours** - Show if a supplier is currently open
5. **Distance sorting** - Sort by closest first for urgent needs

---

## 📖 Official Documentation

- **Yelp Fusion API Docs**: https://docs.developer.yelp.com/docs/fusion-intro
- **API Dashboard**: https://www.yelp.com/developers/v3/manage_app
- **Category List**: https://docs.developer.yelp.com/docs/resources-categories

---

## ✅ Summary

✅ **Free & Easy** - No credit card, 5,000 calls/day  
✅ **Comprehensive Data** - Reviews, ratings, hours, contact info  
✅ **Perfect for Construction** - Find contractors, suppliers, and verify businesses  
✅ **Mock Data Fallback** - App works even without API key (for testing)

**Need Help?** Check the logs in your terminal when making API calls. The backend will show detailed information about what's happening.

