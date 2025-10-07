# 🎯 Next Session Action Items

## 📅 Date: When You Return

---

## 🔴 HIGH PRIORITY - API Integrations

### 1. Home Depot & Lowe's Official APIs
**Goal:** Replace SerpAPI with official, legal APIs for product data

#### Home Depot Product Advertising API
- [ ] Apply for Home Depot API access
- [ ] Get API credentials
- [ ] Implement API integration in `backend/src/routes/sku.js`
- [ ] Test product search functionality
- [ ] Add proper attribution and disclaimers

**Application Link:** https://developer.homedepot.com/

#### Lowe's API / Affiliate Program
- [ ] Research Lowe's API availability
- [ ] Apply for Lowe's affiliate program as backup
- [ ] Get API credentials or affiliate links
- [ ] Implement API integration in `backend/src/routes/sku.js`
- [ ] Test product search functionality

**Affiliate Link:** https://www.lowes.com/l/affiliate-program

---

### 2. Yelp Fusion API
**Goal:** Legally access contractor reviews and ratings

#### Yelp Integration
- [ ] Sign up for Yelp Fusion API (free tier available)
- [ ] Get API key
- [ ] Create new route: `backend/src/routes/yelp.js`
- [ ] Implement business search by name/location
- [ ] Fetch ratings, reviews, contact info
- [ ] Update SubcontractorSearchModal to use real Yelp data
- [ ] Add proper Yelp attribution ("Powered by Yelp")

**Application Link:** https://www.yelp.com/developers/v3/manage_app

---

### 3. Subcontractor Registration System
**Goal:** Build your own contractor database (most legally safe)

#### Backend Setup
- [ ] Create new route: `backend/src/routes/subcontractors.js`
- [ ] Create database schema for contractors
- [ ] Implement contractor registration endpoint
- [ ] Implement contractor search endpoint
- [ ] Add authentication for contractor accounts

#### Frontend Setup
- [ ] Create contractor registration form
- [ ] Add contractor profile management
- [ ] Integrate with existing SubcontractorSearchModal

---

## 📋 Legal Compliance Checklist

### Current Status:
✅ Using SerpAPI (relatively safe for development)
✅ Linking to official product pages
✅ Not caching retailer data
⚠️ Need to add disclaimers
⚠️ Need official APIs for production

### To Do:
- [ ] Add disclaimer to AttachSkuModal: "Prices are estimates from public search results"
- [ ] Add Yelp attribution when using their data
- [ ] Create Terms of Service for your app
- [ ] Create Privacy Policy
- [ ] Add data source attributions throughout the app

---

## 🎉 What We Completed Today:

✅ Fixed SKU search prices with SerpAPI integration
✅ Added customer information page
✅ Merged project scope into project information
✅ Renamed "Labor & Crew" to "Labor & Subs"
✅ Added pricing modes (hourly/sqft) to labor page
✅ Fixed decimal input and keyboard scrolling in modals
✅ Created subcontractor marketplace with mock data
✅ Added trade filtering for subcontractors
✅ **Made profile button fully functional with detailed modal**
✅ Discussed legal compliance for data usage

---

## 📝 API Keys Needed:

1. **Home Depot API Key** - TBD
2. **Lowe's API Key** - TBD
3. **Yelp Fusion API Key** - TBD

Store these in: `backend/.env`

```env
# Add these when you get them
HOME_DEPOT_API_KEY=your_key_here
LOWES_API_KEY=your_key_here
YELP_API_KEY=your_key_here
```

---

## 🚀 Priority Order:

1. **Apply for APIs** (can take a few days for approval)
2. **Add disclaimers** to current app (quick win)
3. **Implement Yelp API** (easier than Home Depot/Lowe's)
4. **Implement Home Depot/Lowe's APIs** (once approved)
5. **Build contractor registration system** (long-term solution)

---

## 📞 Contact for API Applications:

- **Your app name:** Build Profit Solutions
- **App description:** Construction bid management and estimation tool for contractors
- **Use case:** Help contractors find materials and compare prices to build accurate bids

---

**All code is committed and saved! Ready to continue when you return.** 🎉

