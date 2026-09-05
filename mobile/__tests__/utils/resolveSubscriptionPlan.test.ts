jest.mock('@/services/stripeService', () => ({
  resolveLiveStripePriceId: (_planId: string, stripePriceId: string) => stripePriceId,
}));

import {
  normalizeSubscriptionPlanId,
  priceIdToPlanId,
} from '@/utils/resolveSubscriptionPlan';

describe('resolveSubscriptionPlan', () => {
  it('maps legacy Basic and Professional Stripe price ids to premium', () => {
    const plans = [{ id: 'premium', stripePriceId: 'price_new' }];
    expect(priceIdToPlanId('price_1THzBgAEo74nL2FWYjwMWqcX', plans)).toBe('premium');
    expect(priceIdToPlanId('price_1THzkTAEo74nL2FWxRsZvwXL', plans)).toBe('premium');
  });

  it('normalizes legacy basic plan id to premium', () => {
    expect(normalizeSubscriptionPlanId('basic')).toBe('premium');
    expect(normalizeSubscriptionPlanId('professional')).toBe('premium');
  });
});
