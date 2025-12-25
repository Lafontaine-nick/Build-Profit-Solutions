# Stripe Setup Guide

## Quick Setup Steps

### 1. Get Your Stripe Test API Keys

1. Go to [Stripe Dashboard - API Keys](https://dashboard.stripe.com/test/apikeys)
2. If you don't have a Stripe account, sign up for free at [stripe.com](https://stripe.com)
3. Copy your **Secret key** (starts with `sk_test_...`)
4. Copy your **Publishable key** (starts with `pk_test_...`)

### 2. Update Backend .env File

Edit `/Users/nick_lafontaine/build-profit-solutions/backend/.env` and replace:

```env
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
```

**Note:** The webhook secret is optional for now. You can leave it as `whsec_your_webhook_secret_here` until you set up webhooks.

### 3. Restart Backend Server

After updating the .env file, restart the backend server:

```bash
# Stop the current server (find the process and kill it, or use Ctrl+C)
# Then restart:
cd /Users/nick_lafontaine/build-profit-solutions/backend
npm start
```

### 4. Create Stripe Products & Prices

You have two options:

#### Option A: Use the Setup Script (Recommended)
```bash
cd /Users/nick_lafontaine/build-profit-solutions/backend
node setup-stripe.js
```

This will create:
- Basic Plan ($25/month)
- Professional Plan ($49/month)  
- Business Plan ($79/month)

#### Option B: Create Manually in Stripe Dashboard

1. Go to [Stripe Dashboard - Products](https://dashboard.stripe.com/test/products)
2. Click "Add product"
3. Create each plan:
   - **Basic Plan**: $25/month recurring
   - **Professional Plan**: $49/month recurring
   - **Business Plan**: $79/month recurring
4. Copy the Price IDs (start with `price_...`) and update them in:
   - `backend/.env` (STRIPE_PRICE_BASIC, STRIPE_PRICE_PREMIUM)
   - `mobile/services/stripeService.ts` (lines 177, 200, 221)

### 5. Test the Integration

Once configured:
1. Open your mobile app
2. Navigate to Payment & Billing
3. Click "View Plans"
4. Click "Start with Basic" (or any plan)
5. You should be redirected to Stripe Checkout

## Current Price IDs in Code

The mobile app is configured to use these Price IDs:
- Basic: `price_1S61YbAEo74nL2FWa0EZt4CE`
- Professional: `price_1S61YbAEo74nL2FWJQzrcFFG`
- Business: `price_1S61YbAEo74nL2FWTfBusiness` (placeholder - needs to be created)

**Important:** Make sure the Price IDs in Stripe match the ones in your code, or update the code to match your Stripe Price IDs.

## Troubleshooting

### Error: "Stripe API key not configured"
- Make sure you've updated `STRIPE_SECRET_KEY` in `backend/.env`
- Restart the backend server after updating .env

### Error: "Stripe API key is invalid"
- Check that your key starts with `sk_test_` (for test mode)
- Make sure there are no extra spaces in the .env file
- Verify the key is copied correctly from Stripe Dashboard

### Error: "Price ID not found"
- Make sure you've created the products/prices in Stripe Dashboard
- Verify the Price IDs match between Stripe and your code
- Price IDs should start with `price_`

## Need Help?

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Dashboard](https://dashboard.stripe.com/test)



