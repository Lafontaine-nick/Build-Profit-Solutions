# Stripe Setup Guide

## Quick Setup Steps

### 1. Get Your Stripe Test API Keys

1. Go to [Stripe Dashboard - API Keys](https://dashboard.stripe.com/test/apikeys)
2. If you don't have a Stripe account, sign up for free at [stripe.com](https://stripe.com)
3. Copy your **Secret key** (starts with `sk_test_...`)
4. Copy your **Publishable key** (starts with `pk_test_...`)

### 2. Update Backend .env File

Edit `backend/.env` and set:

```env
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
STRIPE_PRODUCT_PROFESSIONAL=prod_...
STRIPE_PRICE_PREMIUM=price_...   # Professional $99/month
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...  # optional $990/year
STRIPE_PRICE_BUSINESS=price_...  # Business $199/month (when team workspace ships)
```

**Note:** The webhook secret is optional for now. You can leave it as `whsec_your_webhook_secret_here` until you set up webhooks.

### 3. Restart Backend Server

After updating the `.env` file, restart the backend server.

### 4. Create Stripe Products & Prices

#### Option A: Use the Setup Script (Recommended)

```bash
cd backend
node setup-stripe.js
```

This creates:

- **Professional** — $99/month (+ optional $990/year)
- **Business** — $199/month (hidden in app until team workspace launches)

#### Option B: Create Manually in Stripe Dashboard

1. Go to [Stripe Dashboard - Products](https://dashboard.stripe.com/test/products)
2. Create **Professional** at **$99/month** recurring
3. Optionally add **$990/year** as a second price on the same product
4. Set the monthly price as the product **Default price**
5. Copy Price IDs (start with `price_...`) into `backend/.env`

### 5. Test the Integration

1. Open the mobile app
2. Navigate to **Payment & Billing**
3. Tap **View Plans**
4. Subscribe to **Professional** ($99/mo, 7-day trial if configured in Stripe)
5. You should be redirected to Stripe Checkout

## Launch pricing (current)

| Plan | Price | App visibility |
|------|-------|----------------|
| Professional | $99/mo or $990/yr | Shown to all new subscribers |
| Business | $199/mo | Hidden until `BUSINESS_PLAN_ENABLED=true` |

Legacy Basic ($45) and older Professional ($89) Stripe prices still resolve to **Professional** access for existing subscribers.

## Troubleshooting

### Error: "Stripe API key not configured"

- Make sure you've updated `STRIPE_SECRET_KEY` in `backend/.env`
- Restart the backend server after updating `.env`

### Error: "Stripe API key is invalid"

- Check that your key starts with `sk_test_` (for test mode)
- Make sure there are no extra spaces in the `.env` file

### Error: "Price ID not found"

- Create the $99 Professional price in Stripe Dashboard
- Set `STRIPE_PRICE_PREMIUM` to the live `price_...` id
- Or set `STRIPE_PRODUCT_PROFESSIONAL` to the product id and mark the $99 price as **Default**

## Need Help?

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Dashboard](https://dashboard.stripe.com/test)
