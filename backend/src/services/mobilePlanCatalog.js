/**
 * Canonical subscription catalog for the mobile app.
 * Stripe Price IDs come from env (Render): STRIPE_PRICE_BASIC, STRIPE_PRICE_PREMIUM, STRIPE_PRICE_BUSINESS.
 * Display amounts are loaded from Stripe so UI matches what customers pay.
 */

const PLAN_DEFINITIONS = [
  {
    id: 'basic',
    envVar: 'STRIPE_PRICE_BASIC',
    stripePriceIdFallback: 'price_1SVnzJAEo74nL2FWW479mvXJ',
    priceFallback: 39,
    name: 'Basic Plan',
    description: 'Get started with essential tools for solo contractors.',
    tag: 'Starter',
    cta: 'Start with Basic',
    recommended: false,
    features: [
      '3–5 active projects',
      'Basic project dashboard',
      'Material & labor costing',
      'AI Estimate Assistant (lite usage)',
      'Save/export estimates (BPS branding)',
      'Leads tab (view only)',
      'Simple customer CRM',
      'Email support',
    ],
  },
  {
    id: 'premium',
    envVar: 'STRIPE_PRICE_PREMIUM',
    stripePriceIdFallback: 'price_1SVnzKAEo74nL2FWI9JR5mW7',
    priceFallback: 89,
    name: 'Professional Plan',
    description: 'Built to protect margins and scale profitably.',
    tag: 'Most Popular',
    cta: 'Upgrade to Professional',
    recommended: true,
    features: [
      'Unlimited projects',
      'Full AI Estimator',
      'Custom branded estimate PDFs',
      'Live job costing & profitability tracking',
      'Overhead & markup automation',
      'Full Leads tab (filters + management)',
      'Budget vs. actuals tracking',
      'Subcontractor marketplace (full access)',
      'Price spike alerts',
      'Supplier integrations',
      'Priority support',
    ],
  },
  {
    id: 'business',
    envVar: 'STRIPE_PRICE_BUSINESS',
    stripePriceIdFallback: 'price_1SwOqmAEo74nL2FW6vCf983W',
    priceFallback: 179,
    name: 'Business Plan',
    description: 'For teams that need forecasting, AI optimization, and integrations.',
    tag: 'Teams',
    cta: 'Scale with Business',
    recommended: false,
    features: [
      'Everything in Professional',
      '5–10 team members',
      'Role-based permissions',
      'Advanced analytics & forecasting',
      'Profit simulation tools',
      'AI Bid Optimization (premium)',
      'Invoice generation & payment tracking',
      'Custom integrations (QuickBooks, Zapier, Gmail)',
      'Dedicated account support',
    ],
  },
];

function resolvePriceId(def) {
  const raw = process.env[def.envVar];
  const trimmed = raw != null ? String(raw).trim().replace(/^["']|["']$/g, '') : '';
  if (trimmed.startsWith('price_')) {
    return trimmed;
  }
  return def.stripePriceIdFallback;
}

/**
 * @param {import('stripe').default} stripeClient
 * @returns {Promise<Array<{ id: string, name: string, price: number, features: string[], stripePriceId: string, description?: string, tag?: string, cta?: string, recommended?: boolean }>>}
 */
async function getMobilePlansCatalog(stripeClient) {
  const out = [];
  for (const def of PLAN_DEFINITIONS) {
    const stripePriceId = resolvePriceId(def);
    let price = def.priceFallback;
    try {
      const p = await stripeClient.prices.retrieve(stripePriceId);
      if (p.unit_amount != null) {
        price = p.unit_amount / 100;
      }
    } catch (e) {
      console.warn(
        `[mobile-plan-catalog] Could not load Stripe price ${stripePriceId} (${def.id}):`,
        e?.message || e
      );
    }
    out.push({
      id: def.id,
      name: def.name,
      price,
      features: def.features,
      stripePriceId,
      description: def.description,
      tag: def.tag,
      cta: def.cta,
      recommended: def.recommended,
    });
  }
  return out;
}

module.exports = {
  PLAN_DEFINITIONS,
  getMobilePlansCatalog,
};
