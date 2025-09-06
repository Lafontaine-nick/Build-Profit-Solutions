const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripeService = require('../services/stripeService');

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
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
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

// Cancel subscription
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