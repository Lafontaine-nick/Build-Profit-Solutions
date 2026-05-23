const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUBSCRIPTION_PLANS = {
  basic: {
    id: process.env.STRIPE_PRICE_BASIC || 'price_basic_monthly',
    name: 'Basic Plan',
    price: 4500, // $45.00 in cents (display / legacy; live checkout uses Stripe Price)
    features: ['Lead Management', 'Basic Analytics', 'Email Support']
  },
  premium: {
    id: process.env.STRIPE_PRICE_PREMIUM || 'price_premium_monthly', 
    name: 'Premium Plan',
    price: 8900, // $89.00 in cents (display / legacy; live checkout uses Stripe Price)
    features: ['Lead Management', 'Advanced Analytics', 'AI Lead Scoring', 'Priority Support', 'Data Export']
  }
};

const createCustomer = async (email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'build_profit_solutions'
      }
    });
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

const createSubscription = async (customerId, priceId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

const createCheckoutSession = async (customerId, priceId, successUrl, cancelUrl) => {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        customer_id: customerId
      }
    });
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

const handleWebhook = async (event) => {
  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    throw error;
  }
};

const handleSubscriptionCreated = async (subscription) => {
  console.log('Subscription created:', subscription.id);
  // Add your business logic here
};

const handleSubscriptionUpdated = async (subscription) => {
  console.log('Subscription updated:', subscription.id);
  // Add your business logic here
};

const handleSubscriptionDeleted = async (subscription) => {
  console.log('Subscription deleted:', subscription.id);
  // Add your business logic here
};

const handlePaymentSucceeded = async (invoice) => {
  console.log('Payment succeeded for invoice:', invoice.id);
  // Add your business logic here
};

const handlePaymentFailed = async (invoice) => {
  console.log('Payment failed for invoice:', invoice.id);
  // Add your business logic here
};

const getSubscriptionPlans = () => {
  return SUBSCRIPTION_PLANS;
};

module.exports = {
  createCustomer,
  createSubscription,
  createCheckoutSession,
  handleWebhook,
  getSubscriptionPlans
};
