require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  try {
    console.log('Setting up Stripe products and prices...');
    console.log('Using Stripe key:', process.env.STRIPE_SECRET_KEY ? 'Found' : 'Not found');

    const professionalProduct = await stripe.products.create({
      name: 'Professional',
      description:
        'Full platform access — estimating, AI, job costing, supplier lookup, and tax organization.',
    });

    const professionalPrice = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 9900, // $99.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const professionalAnnual = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 99000, // $990.00/year
      currency: 'usd',
      recurring: { interval: 'year' },
    });

    console.log('✅ Professional created:');
    console.log(`   Product ID: ${professionalProduct.id}`);
    console.log(`   Monthly Price ID: ${professionalPrice.id}`);
    console.log(`   Annual Price ID: ${professionalAnnual.id}`);

    const businessProduct = await stripe.products.create({
      name: 'Business',
      description: 'Team workspace with up to 5 seats (launch when team features ship).',
    });

    const businessPrice = await stripe.prices.create({
      product: businessProduct.id,
      unit_amount: 19900, // $199.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log('✅ Business created (hidden until BUSINESS_PLAN_ENABLED):');
    console.log(`   Product ID: ${businessProduct.id}`);
    console.log(`   Price ID: ${businessPrice.id}`);

    console.log('\n📝 Add these to your backend .env file:');
    console.log(`STRIPE_PRODUCT_PROFESSIONAL=${professionalProduct.id}`);
    console.log(`STRIPE_PRICE_PREMIUM=${professionalPrice.id}`);
    console.log(`STRIPE_PRICE_PROFESSIONAL_ANNUAL=${professionalAnnual.id}`);
    console.log(`STRIPE_PRICE_BUSINESS=${businessPrice.id}`);
  } catch (error) {
    console.error('Error setting up Stripe products:', error);
  }
}

setupStripeProducts();
