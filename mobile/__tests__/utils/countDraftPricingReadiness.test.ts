import { countDraftPricingReadiness } from '@/utils/scopeItemQuantities';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('countDraftPricingReadiness', () => {
  it('counts only unpriced scope packages on Step 3 — not every measured checklist item', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'framing', state: 'included', inputType: 'quantity' },
          { id: 'drywall', state: 'included', inputType: 'quantity' },
          { id: 'appliances', state: 'included', inputType: 'quantity' },
          { id: 'contingency', state: 'included', inputType: 'quantity' },
        ],
      },
      scopeMeasurements: {
        floorAreaSqft: 3098,
        itemQuantities: {},
      },
      scopePackages: [
        {
          name: 'Framing',
          scope: 'framing',
          price: 67000,
          materialPrice: 30000,
          laborPrice: 37000,
          status: 'user_provided',
          scopeQuantities: [{ quantity: 4070, unit: 'sqft' }],
        },
        {
          name: 'Drywall',
          scope: 'drywall',
          price: 23500,
          materialPrice: 10000,
          laborPrice: 13500,
          status: 'user_provided',
          scopeQuantities: [{ quantity: 10843, unit: 'sqft' }],
        },
        {
          name: 'Appliance install',
          scope: 'appliances',
          price: null,
          status: 'missing_price',
          scopeQuantities: [{ quantity: 3098, unit: 'sqft' }],
        },
        {
          name: 'Contingency allowance',
          scope: 'contingency',
          price: null,
          status: 'missing_price',
        },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const readiness = countDraftPricingReadiness(draft);
    // 1 measured-unpriced + 1 needs measurement — not 24 from checklist living-SF readiness.
    expect(readiness.ready).toBe(1);
    expect(readiness.needsMeasurement).toBe(1);
  });
});
