const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeService = require('../services/stripeService');

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

    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

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

// Create checkout session using plan key (basic|premium) and email/name
router.post('/subscribe', async (req, res) => {
  try {
    const { email, name, plan, successUrl, cancelUrl } = req.body;
    if (!email || !plan) {
      return res.status(400).json({ success: false, error: 'email and plan are required' });
    }

    const plans = stripeService.getSubscriptionPlans();
    const selected = plans[plan];
    if (!selected) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    // Find or create customer
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

    // Get user email from auth token or request
    const authHeader = req.headers.authorization;
    let email = null;
    
    // Try to extract email from token or use query param
    if (req.query.email) {
      email = req.query.email;
      console.log('📧 Using email from query param:', email);
    } else if (req.user && req.user.email) {
      email = req.user.email;
      console.log('📧 Using email from req.user:', email);
    }
    
    if (!email) {
      console.log('⚠️ No email provided, returning empty subscriptions');
      // If no email, return empty array (user might not have subscriptions yet)
      return res.json({ success: true, subscriptions: [] });
    }
    
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