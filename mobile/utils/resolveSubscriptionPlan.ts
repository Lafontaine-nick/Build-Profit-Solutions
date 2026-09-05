import { resolveLiveStripePriceId } from '@/services/stripeService';

export const LIVE_BUSINESS_STRIPE_PRICE_ID = 'price_1THzFnAEo74nL2FWaVZo8JXA';

const PLAN_TIER: Record<string, number> = {
  business: 3,
  premium: 2,
  professional: 2,
  basic: 2, // legacy Basic subscribers → same tier as Professional
};

/** Legacy Stripe price IDs (retired tiers) still map to Professional for billing display. */
const LEGACY_PRICE_ID_TO_PLAN_ID: Record<string, string> = {
  price_1THzBgAEo74nL2FWYjwMWqcX: 'premium', // legacy Basic $45
  price_1THzkTAEo74nL2FWxRsZvwXL: 'premium', // legacy Professional $89
};

export function normalizeSubscriptionPlanId(planId: unknown): string | null {
  if (typeof planId !== 'string') return null;
  const normalized = planId.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'professional') return 'premium';
  if (normalized === 'basic') return 'premium';
  return normalized;
}

type PlanCatalogEntry = { id: string; stripePriceId: string };

export function priceIdToPlanId(
  priceId: string | null | undefined,
  plans: PlanCatalogEntry[]
): string | null {
  if (!priceId) return null;

  for (const plan of plans) {
    const livePriceId = resolveLiveStripePriceId(plan.id, plan.stripePriceId);
    if (priceId === plan.stripePriceId || priceId === livePriceId) {
      return normalizeSubscriptionPlanId(plan.id);
    }
  }

  if (priceId === LIVE_BUSINESS_STRIPE_PRICE_ID) {
    return 'business';
  }

  const legacyPlanId = LEGACY_PRICE_ID_TO_PLAN_ID[priceId];
  if (legacyPlanId) {
    return normalizeSubscriptionPlanId(legacyPlanId);
  }

  return null;
}

/** When a customer has multiple active subs (e.g. Pro + Business checkout), pick the highest tier. */
export function resolveBestPlanIdFromSubscriptions(
  subscriptions: unknown[],
  plans: PlanCatalogEntry[]
): string | null {
  const subs = Array.isArray(subscriptions) ? subscriptions : [];

  const active = subs.filter(
    (sub: any) =>
      (sub?.status === 'active' || sub?.status === 'trialing') && !sub?.cancel_at_period_end
  );
  const pool =
    active.length > 0
      ? active
      : subs.filter((sub: any) => sub?.status === 'active' || sub?.status === 'trialing');

  let bestPlanId: string | null = null;
  let bestTier = -1;

  for (const sub of pool) {
    const planId = priceIdToPlanId((sub as any)?.plan?.id, plans);
    if (!planId) continue;
    const tier = PLAN_TIER[planId] ?? 0;
    if (tier > bestTier) {
      bestTier = tier;
      bestPlanId = planId;
    }
  }

  return bestPlanId;
}
