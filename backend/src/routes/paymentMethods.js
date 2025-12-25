const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Helper to get customer ID from email
async function getCustomerIdFromEmail(email) {
  if (!email) return null;
  
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data && customers.data.length > 0) {
      return customers.data[0].id;
    }
  } catch (error) {
    console.error('Error finding customer:', error);
  }
  return null;
}

// Get payment methods for a customer
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      console.log('⚠️ No email provided in payment methods request');
      return res.json([]); // Return empty array instead of error
    }

    console.log('🔍 Looking up payment methods for email:', email);
    const customerId = await getCustomerIdFromEmail(email);
    
    if (!customerId) {
      // No customer found, return empty array (not an error)
      console.log('ℹ️ No customer found for email:', email, '- returning empty array');
      return res.json([]);
    }

    // Get all payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    // Get customer to find default payment method
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    // Format payment methods for frontend
    const formattedMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      brand: pm.card?.brand || 'card',
      last4: pm.card?.last4 || '',
      expMonth: pm.card?.exp_month || 0,
      expYear: pm.card?.exp_year || 0,
      isDefault: pm.id === defaultPaymentMethodId,
      customerId: customerId,
      createdAt: new Date(pm.created * 1000).toISOString(),
    }));

    console.log('✅ Retrieved payment methods for customer:', customerId, '- Found:', formattedMethods.length);
    res.json(formattedMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Set default payment method
router.put('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body || req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const customerId = await getCustomerIdFromEmail(email);
    
    if (!customerId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update customer's default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: id,
      },
    });

    console.log('✅ Set default payment method:', id, 'for customer:', customerId);
    res.json({ success: true, message: 'Default payment method updated' });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

// Delete payment method
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Detach payment method from customer
    await stripe.paymentMethods.detach(id);

    console.log('✅ Deleted payment method:', id);
    res.json({ success: true, message: 'Payment method deleted' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// Create checkout session for adding payment method (setup mode)
router.post('/checkout-session', async (req, res) => {
  try {
    const { email, successUrl, cancelUrl } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let customerId = await getCustomerIdFromEmail(email);
    
    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
    }

    // Create checkout session in setup mode (for collecting payment methods)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'setup', // Setup mode - only collects payment method, doesn't charge
      success_url: successUrl || 'https://build-profit-solutions.com/payment/success?setup=complete',
      cancel_url: cancelUrl || 'https://build-profit-solutions.com/payment/cancel',
      metadata: {
        customer_id: customerId,
        purpose: 'add_payment_method',
      },
    });

    console.log('✅ Created checkout session for adding payment method:', session.id, 'for customer:', customerId);
    res.json({
      sessionId: session.id,
      url: session.url,
      customerId: customerId,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create setup intent for adding a new payment method (alternative method)
router.post('/setup-intent', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let customerId = await getCustomerIdFromEmail(email);
    
    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
    }

    // Create setup intent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    console.log('✅ Created setup intent for customer:', customerId);
    res.json({
      clientSecret: setupIntent.client_secret,
      customerId: customerId,
    });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

module.exports = router;

