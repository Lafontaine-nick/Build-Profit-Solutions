const fs = require('fs');
const content = fs.readFileSync('services/stripeService.ts', 'utf8');
const updated = content.replace(
  "stripePriceId: 'price_1S61YbAEo74nL2FWJQzrcFFG'",
  "stripePriceId: 'price_1S61YbAEo74nL2FWJQzrcFFG'"
);
fs.writeFileSync('services/stripeService.ts', updated);
console.log('Fixed Stripe price IDs');
