/**
 * Canonical subscription catalog for the mobile app.
 * Display amounts are loaded from Stripe so UI matches what customers pay.
 *
 * Professional / premium: optional STRIPE_PRODUCT_PROFESSIONAL=prod_...
 * If set, uses that Product's **Default price** in Stripe (the one with the blue "Default" badge).
 * Fixes cases where STRIPE_PRICE_PREMIUM still points at an old archived price id.
 */

const { filterLaunchSubscriptionPlans } = require('../constants/releaseFlags');

const PLAN_DEFINITIONS = [
  {
    id: 'basic',
    envVar: 'STRIPE_PRICE_BASIC',
    stripePriceIdFallback: 'price_1THzBgAEo74nL2FWYjwMWqcX',
    priceFallback: 45,
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
    stripePriceIdFallback: 'price_1THzkTAEo74nL2FWxRsZvwXL',
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
      'Find Subcontractors & verified directory (full access)',
      'Price spike alerts',
      'Supplier integrations',
      'Priority support',
    ],
  },
  {
    id: 'business',
    envVar: 'STRIPE_PRICE_BUSINESS',
    stripePriceIdFallback: 'price_1THzFnAEo74nL2FWaVZo8JXA',
    priceFallback: 179,
    name: 'Business Plan',
    description:
      'One company workspace with up to 5 team seats, individual logins, shared project records, and role-based access for growing construction teams.',
    tag: 'Business Team Workspace',
    cta: 'Upgrade to Business',
    recommended: false,
    features: [
      'Company workspace',
      'Up to 5 team seats',
      'Individual team logins',
      'Shared project records',
      'Notes, expenses, logs, and calendar events',
      'Role-based access foundation',
      'Activity tracking foundation',
    ],
  },
];

function resolvePriceId(def) {
  const raw = process.env[def.envVar];
  let trimmed = raw != null ? String(raw).trim().replace(/^["']|["']$/g, '') : '';
  trimmed = trimmed.replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (trimmed.startsWith('price_')) {
    return trimmed;
  }
  return def.stripePriceIdFallback;
}

function trimEnv(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Use Stripe Product.default_price (Dashboard "Default") so new prices win without juggling price ids.
 * @returns {Promise<{ stripePriceId: string, unitAmountCents: number, price: number } | null>}
 */
async function resolveProfessionalFromProductDefault(stripeClient) {
  const prodId = trimEnv(process.env.STRIPE_PRODUCT_PROFESSIONAL);
  if (!prodId.startsWith('prod_')) {
    return null;
  }
  const product = await stripeClient.products.retrieve(prodId, {
    expand: ['default_price'],
  });
  let dp = product.default_price;
  let priceObj;
  if (typeof dp === 'string') {
    priceObj = await stripeClient.prices.retrieve(dp);
  } else if (dp && typeof dp === 'object' && dp.id) {
    priceObj = dp;
  }
  if (!priceObj?.id || priceObj.unit_amount == null) {
    console.warn(
      `[mobile-plan-catalog] STRIPE_PRODUCT_PROFESSIONAL=${prodId} has no default_price with unit_amount`
    );
    return null;
  }
  return {
    stripePriceId: priceObj.id,
    unitAmountCents: priceObj.unit_amount,
    price: priceObj.unit_amount / 100,
  };
}

/**
 * @param {import('stripe').default} stripeClient
 * @returns {Promise<Array<{ id: string, name: string, price: number, features: string[], stripePriceId: string, description?: string, tag?: string, cta?: string, recommended?: boolean }>>}
 */
async function getMobilePlansCatalog(stripeClient) {
  const out = [];
  for (const def of PLAN_DEFINITIONS) {
    let stripePriceId = resolvePriceId(def);
    let price = def.priceFallback;
    /** Set when Stripe returns a price; use to verify env points at the intended Price (e.g. 8900 vs 7900). */
    let unitAmountCents = null;

    if (def.id === 'premium') {
      try {
        const fromProduct = await resolveProfessionalFromProductDefault(stripeClient);
        if (fromProduct) {
          stripePriceId = fromProduct.stripePriceId;
          price = fromProduct.price;
          unitAmountCents = fromProduct.unitAmountCents;
          console.log(
            `[mobile-plan-catalog] premium → STRIPE_PRODUCT_PROFESSIONAL default_price ${stripePriceId} unit_amount=${unitAmountCents} (${price})`
          );
          out.push({
            id: def.id,
            name: def.name,
            price,
            unitAmountCents,
            features: def.features,
            stripePriceId,
            description: def.description,
            tag: def.tag,
            cta: def.cta,
            recommended: def.recommended,
            priceSource: 'product_default',
          });
          continue;
        }
      } catch (e) {
        console.warn(
          `[mobile-plan-catalog] STRIPE_PRODUCT_PROFESSIONAL lookup failed, falling back to STRIPE_PRICE_PREMIUM:`,
          e?.message || e
        );
      }
    }

    try {
      const p = await stripeClient.prices.retrieve(stripePriceId);
      if (p.active === false) {
        throw new Error(`Stripe price ${stripePriceId} is inactive`);
      }
      if (p.unit_amount != null) {
        price = p.unit_amount / 100;
        unitAmountCents = p.unit_amount;
      }
      console.log(
        `[mobile-plan-catalog] ${def.id} → Stripe price ${stripePriceId} unit_amount=${p.unit_amount} (${price} ${p.currency || 'usd'})`
      );
    } catch (e) {
      console.warn(
        `[mobile-plan-catalog] Could not load Stripe price ${stripePriceId} (${def.id}):`,
        e?.message || e
      );
      const fallback = def.stripePriceIdFallback;
      if (fallback && fallback !== stripePriceId) {
        try {
          const p2 = await stripeClient.prices.retrieve(fallback);
          if (p2.active === false) {
            throw new Error(`Fallback price ${fallback} is inactive`);
          }
          stripePriceId = fallback;
          if (p2.unit_amount != null) {
            price = p2.unit_amount / 100;
            unitAmountCents = p2.unit_amount;
          }
          console.log(
            `[mobile-plan-catalog] ${def.id} → using fallback Stripe price ${fallback} (${price})`
          );
        } catch (e2) {
          console.warn(
            `[mobile-plan-catalog] Fallback price ${fallback} also invalid for ${def.id}:`,
            e2?.message || e2
          );
        }
      }
    }
    out.push({
      id: def.id,
      name: def.name,
      price,
      unitAmountCents,
      features: def.features,
      stripePriceId,
      description: def.description,
      tag: def.tag,
      cta: def.cta,
      recommended: def.recommended,
    });
  }
  return filterLaunchSubscriptionPlans(out);
}

module.exports = {
  PLAN_DEFINITIONS,
  getMobilePlansCatalog,
};
