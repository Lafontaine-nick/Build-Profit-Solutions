require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  try {
    console.log('Setting up Stripe products and prices...');
    console.log('Using Stripe key:', process.env.STRIPE_SECRET_KEY ? 'Found' : 'Not found');

    // Create Basic Plan Product
    const basicProduct = await stripe.products.create({
      name: 'Basic Plan',
      description: 'Basic subscription plan with lead management and analytics',
    });

    const basicPrice = await stripe.prices.create({
      product: basicProduct.id,
      unit_amount: 2500, // $25.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log('✅ Basic Plan created:');
    console.log(`   Product ID: ${basicProduct.id}`);
    console.log(`   Price ID: ${basicPrice.id}`);

    // Create Premium Plan Product
    const premiumProduct = await stripe.products.create({
      name: 'Premium Plan',
      description: 'Premium subscription plan with advanced features and AI',
    });

    const premiumPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 5000, // $50.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log('✅ Premium Plan created:');
    console.log(`   Product ID: ${premiumProduct.id}`);
    console.log(`   Price ID: ${premiumPrice.id}`);

    console.log('\n📝 Add these to your .env file:');
    console.log(`STRIPE_PRICE_BASIC=${basicPrice.id}`);
    console.log(`STRIPE_PRICE_PREMIUM=${premiumPrice.id}`);

  } catch (error) {
    console.error('Error setting up Stripe products:', error);
  }
}

setupStripeProducts();
