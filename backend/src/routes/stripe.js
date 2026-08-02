const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeService = require('../services/stripeService');
const { getMobilePlansCatalog } = require('../services/mobilePlanCatalog');
const { authenticateToken } = require('../middleware/authenticateToken');

/**
 * Stripe Checkout only allows http(s) success/cancel URLs — not custom schemes.
 * After payment, the in-app browser loads this page; we redirect into the native app.
 * Placeholder {CHECKOUT_SESSION_ID} is replaced by Stripe on redirect.
 */
const DEEP_LINK_SCHEME = process.env.MOBILE_APP_DEEP_LINK_SCHEME || 'buildprofitsolutions';

function sendDeepLinkHtml(res, { path, stripeQuery }) {
  const query = stripeQuery || '';
  const deep = `${DEEP_LINK_SCHEME}://${path.replace(/^\//, '')}${query}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Build Profit Solutions</title>
  <style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center;color:#0f172a;background:#f8fafc}</style>
</head>
<body>
  <p>Returning to the app…</p>
  <p style="margin-top:16px"><a id="open" href="${deep.replace(/"/g, '&quot;')}">Open app</a></p>
  <script>
    (function(){
      var deep = ${JSON.stringify(deep)};
      try { window.location.replace(deep); } catch (e) {}
    })();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

function authenticatedEmail(req, requestedEmail) {
  const ownerEmail = String(req.user?.email || '').trim().toLowerCase();
  const requested = String(requestedEmail || '').trim().toLowerCase();
  if (!ownerEmail) {
    const error = new Error('Authenticated account email is required');
    error.statusCode = 403;
    throw error;
  }
  if (requested && requested !== ownerEmail) {
    const error = new Error('Billing account does not belong to the authenticated user');
    error.statusCode = 403;
    throw error;
  }
  return ownerEmail;
}

router.get('/checkout-return', (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  sendDeepLinkHtml(res, { path: 'payment/success', stripeQuery: q });
});

router.get('/checkout-cancel', (req, res) => {
  sendDeepLinkHtml(res, { path: 'payment/cancel', stripeQuery: '' });
});

/** Payment method setup (Stripe Customer Portal / setup mode) — same https → app bridge */
router.get('/checkout-return-manage-cards', (req, res) => {
  let q = '';
  if (req.url.includes('?')) {
    q = `${req.url.slice(req.url.indexOf('?'))}&setup=success`;
  } else {
    q = '?setup=success';
  }
  sendDeepLinkHtml(res, { path: 'payment/manage-cards', stripeQuery: q });
});

router.get('/checkout-cancel-manage-cards', (req, res) => {
  sendDeepLinkHtml(res, { path: 'payment/manage-cards', stripeQuery: '?setup=cancel' });
});

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = stripeService.getSubscriptionPlans();
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

/** Mobile Choose Your Plan: env price IDs + live amounts from Stripe (matches Render STRIPE_PRICE_*). */
router.get('/mobile-plans', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || String(process.env.STRIPE_SECRET_KEY).includes('your_stripe')) {
      return res.status(503).json({
        success: false,
        error: 'Stripe is not configured on the server',
      });
    }
    const plans = await getMobilePlansCatalog(stripe);
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching mobile plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription plans' });
  }
});

// Customer, checkout, subscription, and payment mutations require verified ownership.
router.use(authenticateToken);

// Create Stripe customer
router.post('/customer', async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key')) {
      return res.status(500).json({ 
        success: false, 
        error: 'Stripe API key not configured. Please set STRIPE_SECRET_KEY in your .env file. Get your keys from https://dashboard.stripe.com/test/apikeys' 
      });
    }

    const { name } = req.body;
    const email = authenticatedEmail(req, req.body?.email);

    // Try to find existing customer by email first
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing && existing.data && existing.data.length > 0) {
      return res.json({ success: true, customerId: existing.data[0].id });
    }

    const customer = await stripeService.createCustomer(email, name || email);
    res.json({ success: true, customerId: customer.id });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    
    // Provide helpful error messages
    if (error.type === 'StripeAuthenticationError') {
      return res.status(500).json({ 
        success: false, 
        error: 'Stripe API key is invalid. Please check your STRIPE_SECRET_KEY in .env file. Get your keys from https://dashboard.stripe.com/test/apikeys' 
      });
    }
    
    res.status(500).json({ success: false, error: 'Failed to create customer' });
  }
});

// Change an existing active subscription to a new Stripe price (upgrade/downgrade).
router.post('/change-plan', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key')) {
      return res.status(503).json({
        success: false,
        error: 'Stripe is not configured on this server.',
      });
    }

    const { priceId } = req.body;
    const email = authenticatedEmail(req, req.body?.email);
    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'email and priceId are required',
      });
    }

    const customers = await stripe.customers.list({ email: String(email).trim(), limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({
        success: false,
        error: 'No Stripe customer found for this account.',
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    });
    const trialing = await stripe.subscriptions.list({
      customer: customerId,
      status: 'trialing',
      limit: 10,
    });

    const activePool = [...subscriptions.data, ...trialing.data].filter(
      (sub) =>
        (sub.status === 'active' || sub.status === 'trialing') && !sub.cancel_at_period_end
    );

    const activeSubscription = activePool.sort((a, b) => {
      const aAmt = a.items?.data?.[0]?.price?.unit_amount || 0;
      const bAmt = b.items?.data?.[0]?.price?.unit_amount || 0;
      return bAmt - aAmt;
    })[0];

    if (!activeSubscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found. Use checkout to start a new plan.',
      });
    }

    const subscriptionItemId = activeSubscription.items?.data?.[0]?.id;
    if (!subscriptionItemId) {
      return res.status(400).json({
        success: false,
        error: 'Could not locate subscription item to update.',
      });
    }

    let targetPriceId = String(priceId).trim();
    try {
      const targetPrice = await stripe.prices.retrieve(targetPriceId);
      if (!targetPrice.active && targetPrice.product) {
        const productId =
          typeof targetPrice.product === 'string'
            ? targetPrice.product
            : targetPrice.product.id;
        const activePrices = await stripe.prices.list({
          product: productId,
          active: true,
          limit: 20,
        });
        const replacement = activePrices.data.find(
          (p) => p.recurring?.interval === targetPrice.recurring?.interval,
        );
        if (replacement?.id) {
          console.log(
            `[change-plan] Replacing inactive price ${targetPriceId} → active ${replacement.id}`,
          );
          targetPriceId = replacement.id;
        } else {
          return res.status(400).json({
            success: false,
            error:
              'The selected plan price is inactive in Stripe. Update STRIPE_PRICE_* env vars or activate the price in Stripe Dashboard.',
          });
        }
      }
    } catch (priceErr) {
      return res.status(400).json({
        success: false,
        error: priceErr?.message || 'Invalid target price for plan change.',
      });
    }

    const updated = await stripe.subscriptions.update(activeSubscription.id, {
      items: [{ id: subscriptionItemId, price: targetPriceId }],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false,
    });

    const price = updated.items?.data?.[0]?.price;
    let planName = 'Updated plan';
    if (price?.nickname) {
      planName = price.nickname;
    } else if (price?.product && typeof price.product === 'string') {
      try {
        const product = await stripe.products.retrieve(price.product);
        planName = product.name || planName;
      } catch {
        /* keep default */
      }
    }

    res.json({
      success: true,
      subscriptionId: updated.id,
      planName,
      status: updated.status,
    });
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to change subscription plan',
    });
  }
});

// Create checkout session using plan key (basic|premium) and email/name
router.post('/subscribe', async (req, res) => {
  try {
    const { name, plan, successUrl, cancelUrl } = req.body;
    const email = authenticatedEmail(req, req.body?.email);
    if (!plan) {
      return res.status(400).json({ success: false, error: 'email and plan are required' });
    }

    const plans = stripeService.getSubscriptionPlans();
    const selected = plans[plan];
    if (!selected) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    let customerId;
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing && existing.data && existing.data.length > 0) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripeService.createCustomer(email, name || email);
      customerId = customer.id;
    }

    const session = await stripeService.createCheckoutSession(
      customerId,
      selected.id,
      successUrl || 'https://example.com/success',
      cancelUrl || 'https://example.com/cancel'
    );

    res.json({ success: true, url: session.url, sessionId: session.id, customerId });
  } catch (error) {
    console.error('Error creating subscription session:', error?.message || error);
    res.status(500).json({ success: false, error: 'Failed to create subscription session' });
  }
});

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { customerId, priceId, successUrl, cancelUrl } = req.body;
    
    if (!customerId || !priceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: customerId and priceId' 
      });
    }

    const customer = await stripe.customers.retrieve(customerId);
    authenticatedEmail(req, customer?.email);

    const session = await stripeService.createCheckoutSession(
      customerId, 
      priceId, 
      successUrl, 
      cancelUrl
    );

    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to create checkout session',
    });
  }
});

// Stripe webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await stripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get customer subscriptions
router.get('/customer/:customerId/subscriptions', async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await stripe.customers.retrieve(customerId);
    authenticatedEmail(req, customer?.email);
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
    });
    
    res.json({ success: true, subscriptions: subscriptions.data });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

// Get subscriptions for current user (by email from auth token)
router.get('/subscriptions', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key')) {
      return res.status(503).json({
        success: false,
        error:
          'Stripe is not configured on this server. Set STRIPE_SECRET_KEY in backend/.env (see backend/env.example). Restart the backend after saving.',
      });
    }

    const email = authenticatedEmail(req, req.query.email);
    
    // Find customer by email
    console.log('🔍 Searching for Stripe customer with email:', email);
    const customers = await stripe.customers.list({ email, limit: 1 });
    
    if (customers.data.length === 0) {
      console.log('⚠️ No Stripe customer found for email:', email);
      return res.json({ success: true, subscriptions: [] });
    }
    
    const customerId = customers.data[0].id;
    console.log('✅ Found customer:', customerId);
    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.default_payment_method', 'data.items.data.price'],
    });
    
    console.log('📋 Found', subscriptions.data.length, 'subscriptions for customer');
    
    // Format subscriptions for mobile app
    const formattedSubscriptions = subscriptions.data.map(sub => {
      // Explicitly check for cancel_at_period_end - Stripe may return undefined if false
      const cancelAtPeriodEnd = sub.cancel_at_period_end === true || sub.cancel_at_period_end === 'true';
      const formatted = {
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: cancelAtPeriodEnd, // Explicitly set to boolean
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        plan: {
          id: sub.items.data[0]?.price?.id || null, // Include price ID for plan mapping
          nickname: sub.items.data[0]?.price?.nickname || sub.items.data[0]?.price?.product?.name || 'Unknown Plan',
          amount: sub.items.data[0]?.price?.unit_amount || 0,
        },
      };
      console.log('📋 Formatted subscription:', {
        id: formatted.id,
        status: formatted.status,
        cancel_at_period_end: formatted.cancel_at_period_end,
        raw_cancel_at_period_end: sub.cancel_at_period_end,
      });
      return formatted;
    });
    
    console.log('📋 Returning', formattedSubscriptions.length, 'formatted subscriptions');
    res.json({ success: true, subscriptions: formattedSubscriptions });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    if (error.type === 'StripeAuthenticationError') {
      return res.status(503).json({
        success: false,
        error:
          'Stripe API key is invalid or revoked. Update STRIPE_SECRET_KEY in backend/.env (test key: Dashboard → Developers → API keys). Restart the backend.',
      });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

// Cancel subscription (matches mobile app endpoint)
router.post('/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'subscriptionId is required' 
      });
    }
    const existingSubscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] });
    authenticatedEmail(req, existingSubscription.customer?.email);
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

// Cancel subscription (alternative endpoint)
router.post('/subscriptions/:subscriptionId/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const existingSubscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] });
    authenticatedEmail(req, existingSubscription.customer?.email);
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

module.exports = router; 