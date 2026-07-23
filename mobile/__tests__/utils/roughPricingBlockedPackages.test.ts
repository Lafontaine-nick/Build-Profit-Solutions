import {
  fetchRoughPricingProposal,
  packageHasRoughNationalAverage,
} from '@/utils/estimateAiDraftPricing';
import { getNationalAverageBudgetSplit } from '@/utils/scopeItemQuantities';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('rough pricing national averages for soft-cost / finish packages', () => {
  it('has national averages for permits, cleanup, cabinets — not appliances or contingency', () => {
    expect(getNationalAverageBudgetSplit('appliances')).toBeUndefined();
    expect(getNationalAverageBudgetSplit('permits')?.labor).toBe(3500);
    expect(getNationalAverageBudgetSplit('cleanup')?.material).toBe(450);
    expect(getNationalAverageBudgetSplit('cleanup')?.labor).toBe(550);
    expect(getNationalAverageBudgetSplit('cabinets')?.unit).toBe('lf');
    expect(getNationalAverageBudgetSplit('contingency')).toBeUndefined();
  });

  it('marks appliance install and contingency as manual-only allowances', () => {
    expect(
      packageHasRoughNationalAverage({ name: 'Appliance install', scope: 'appliances' })
    ).toBe(false);
    expect(
      packageHasRoughNationalAverage({ name: 'Contingency allowance', scope: 'contingency' })
    ).toBe(false);
    expect(packageHasRoughNationalAverage({ name: 'Framing', scope: 'framing' })).toBe(true);
  });

  it('does not suggest national-average allowance for unpriced appliance install', async () => {
    const draft = {
      originalNotes: 'Ground-up home',
      scopeChecklist: { templateKey: 'ground_up' },
      scopePackages: [
        {
          name: 'Framing',
          scope: 'framing',
          price: 67000,
          status: 'user_provided',
          scopeQuantities: [{ quantity: 4070, unit: 'sqft' }],
        },
        {
          name: 'Appliance install',
          scope: 'Reconnect and install appliances after cabinets.',
          price: null,
          status: 'missing_price',
          scopeQuantities: [{ quantity: 3098, unit: 'sqft' }],
        },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const proposal = await fetchRoughPricingProposal(draft, []);
    const applianceLines = (proposal.lines || []).filter((l) =>
      /appliance/i.test(l.packageName)
    );
    expect(applianceLines.length).toBe(0);
  });

  it('suggests ground-up soft-cost barometer for permits when unpriced', async () => {
    const draft = {
      originalNotes: 'Ground-up home',
      scopeChecklist: { templateKey: 'ground_up' },
      scopePackages: [
        {
          name: 'Permits / fees (incl. impact)',
          scope: 'permits',
          price: null,
          status: 'missing_price',
        },
      ],
      rooms: [],
    } as unknown as EstimateAiDraft;

    const proposal = await fetchRoughPricingProposal(draft, []);
    expect(proposal.empty).toBe(false);
    const permitLines = (proposal.lines || []).filter((l) => /permit/i.test(l.packageName));
    expect(permitLines[0]?.total).toBe(32000);
  });
});
