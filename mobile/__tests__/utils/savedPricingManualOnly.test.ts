import {
  buildSavedPricingProposalFromTemplates,
  fetchRoughPricingProposal,
  proposalHasTemplateOrLibraryRates,
} from '@/utils/estimateAiDraftPricing';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('saved pricing for manual-only allowance scopes', () => {
  const applianceDraft = {
    originalNotes: 'Ground-up home 3,098 sqft',
    scopeChecklist: { templateKey: 'ground_up' },
    scopeMeasurements: { floorAreaSqft: 3098 },
    scopePackages: [
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

  it('matches lump-sum saved bid template for appliance install (not living SF)', () => {
    const templates = [
      {
        name: 'Prior kitchen bid',
        payload: {
          laborLineItems: [
            {
              name: 'Appliance hookup / install',
              total: 850,
              unit: 'lump_sum',
              mode: 'flat',
            },
          ],
          materialLineItems: [],
        },
      },
    ];

    const proposal = buildSavedPricingProposalFromTemplates(applianceDraft, templates);
    expect(proposal.empty).toBe(false);
    expect(proposal.lines?.[0]).toMatchObject({
      packageName: 'Appliance install',
      total: 850,
      priceSource: 'saved_template',
    });
    expect(proposalHasTemplateOrLibraryRates(proposal)).toBe(true);
  });

  it('does not fabricate national-average rough pricing for appliances', async () => {
    const proposal = await fetchRoughPricingProposal(applianceDraft, [
      {
        name: 'Prior kitchen bid',
        payload: {
          laborLineItems: [
            {
              name: 'Appliance hookup / install',
              total: 850,
              unit: 'lump_sum',
              mode: 'flat',
            },
          ],
        },
      },
    ]);
    const applianceLines = (proposal.lines || []).filter((l) => /appliance/i.test(l.packageName));
    expect(applianceLines.length).toBe(0);
  });
});
