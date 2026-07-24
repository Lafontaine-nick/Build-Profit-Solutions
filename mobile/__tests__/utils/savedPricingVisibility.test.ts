import { syncSelectedScopePricing, type EstimateAiDraft } from '@/utils/estimateAiDraft';
import { foldAskAiMeasurementsIntoScopeSnapshot, sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import {
  filterProposalToTemplateLibraryOnly,
  proposalHasTemplateOrLibraryRates,
  type PricingProposal,
} from '@/utils/estimateAiDraftPricing';

function makeProposal(overrides: Partial<PricingProposal> = {}): PricingProposal {
  return {
    empty: false,
    source: 'saved_pricing',
    sourceLabel: 'Saved',
    lines: [],
    totalSuggested: 0,
    scopeItems: [],
    ...overrides,
  };
}

describe('proposalHasTemplateOrLibraryRates', () => {
  it('returns false when only scope-confirmed prices are present', () => {
    const proposal = makeProposal({
      lines: [
        {
          packageName: 'Permits / fees',
          lineType: 'lump_sum',
          label: 'Permits / fees allowance',
          unitType: 'lump_sum',
          quantity: 1,
          unitRate: 3500,
          total: 3500,
          formula: '$3,500 entered during scope confirmation',
          priceSource: 'scope_confirmation',
          sourceLabel: 'Entered in Confirm Scope',
          confidence: 'high',
          status: 'confirmed',
          requiresApproval: true,
        },
      ],
    });
    expect(proposalHasTemplateOrLibraryRates(proposal)).toBe(false);
  });

  it('returns true when saved template rates are present', () => {
    const proposal = makeProposal({
      lines: [
        {
          packageName: 'Tile demo',
          lineType: 'labor',
          label: 'Tile demo',
          unitType: 'sqft',
          quantity: 200,
          unitRate: 2.5,
          total: 500,
          formula: '200 sqft × $2.5/sqft = $500',
          priceSource: 'saved_template',
          sourceLabel: 'Saved template',
          confidence: 'medium',
          status: 'confirmed',
          requiresApproval: true,
        },
      ],
    });
    expect(proposalHasTemplateOrLibraryRates(proposal)).toBe(true);
  });
});

describe('filterProposalToTemplateLibraryOnly', () => {
  it('strips scope-confirmed lines and keeps template matches', () => {
    const proposal = makeProposal({
      scopeItems: [
        {
          scopeItemId: 'permits',
          scopeName: 'Permits / fees',
          quantity: 1,
          unit: 'allowance',
          proposedRates: [
            {
              label: 'Permits / fees allowance',
              pricingType: 'lump_sum',
              rate: 3500,
              unit: 'lump_sum',
              quantity: 1,
              total: 3500,
              formula: '$3,500 entered during scope confirmation',
              source: 'scope_confirmation',
              confidence: 'high',
              assumptions: ['Entered in Confirm Scope'],
              requiresApproval: true,
            },
          ],
          comparison: {},
          recommended: {
            source: 'scope_confirmation',
            sourceLabel: 'Entered in Confirm Scope',
            reason: 'Pricing was entered during scope confirmation.',
            confidence: 'high',
          },
          warnings: [],
          reviewStatus: 'confirmed',
        },
        {
          scopeItemId: 'tile_demo',
          scopeName: 'Tile demo',
          quantity: 200,
          unit: 'sqft',
          proposedRates: [
            {
              label: 'Tile demo labor',
              pricingType: 'labor',
              rate: 2.5,
              unit: 'sqft',
              quantity: 200,
              total: 500,
              formula: '200 sqft × $2.5/sqft = $500',
              source: 'saved_template',
              confidence: 'medium',
              assumptions: ['Saved template'],
              requiresApproval: true,
            },
          ],
          comparison: {},
          recommended: {
            source: 'saved_template',
            sourceLabel: 'Saved template',
            reason: 'Matched from saved pricing.',
            confidence: 'medium',
          },
          warnings: [],
          reviewStatus: 'confirmed',
        },
      ],
      lines: [
        {
          packageName: 'Permits / fees',
          lineType: 'lump_sum',
          label: 'Permits / fees allowance',
          unitType: 'lump_sum',
          quantity: 1,
          unitRate: 3500,
          total: 3500,
          formula: '$3,500 entered during scope confirmation',
          priceSource: 'scope_confirmation',
          sourceLabel: 'Entered in Confirm Scope',
          confidence: 'high',
          status: 'confirmed',
          requiresApproval: true,
        },
        {
          packageName: 'Tile demo',
          lineType: 'labor',
          label: 'Tile demo labor',
          unitType: 'sqft',
          quantity: 200,
          unitRate: 2.5,
          total: 500,
          formula: '200 sqft × $2.5/sqft = $500',
          priceSource: 'saved_template',
          sourceLabel: 'Saved template',
          confidence: 'medium',
          status: 'confirmed',
          requiresApproval: true,
        },
      ],
      totalSuggested: 4000,
    });

    const filtered = filterProposalToTemplateLibraryOnly(proposal);

    expect(filtered.lines).toHaveLength(1);
    expect(filtered.lines?.[0]?.packageName).toBe('Tile demo');
    expect(filtered.totalSuggested).toBe(500);
    expect(
      filtered.scopeItems?.some((item) =>
        (item.proposedRates || []).some((rate) => rate.source === 'scope_confirmation')
      )
    ).toBe(false);
    expect(
      filtered.scopeItems?.some((item) =>
        (item.proposedRates || []).some((rate) => rate.source === 'saved_template')
      )
    ).toBe(true);
  });
});

describe('syncSelectedScopePricing keeps scope-confirmed prices on review', () => {
  it('applies allowance pricing from scope measurements to packages', () => {
    const draft = {
      scopePackages: [{ name: 'Permits / fees', scope: 'permits' }],
      scopeMeasurements: {
        itemQuantities: {
          permits: { quantity: 3500, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    } as unknown as EstimateAiDraft;

    const synced = syncSelectedScopePricing(draft);
    const pkg = synced.scopePackages?.[0];
    expect(pkg?.knownSubtotal).toBe(3500);
    expect(pkg?.status).toBe('user_provided');
    expect(synced.calculatedLineItemTotal).toBe(3500);
  });

  it('does not overwrite Ask AI trash haul-off $3k with cleanup $1k', () => {
    const draft = {
      scopePackages: [
        {
          name: 'Cleanup & disposal',
          scope: 'Final clean',
          price: 1000,
          knownSubtotal: 1000,
          status: 'user_provided',
          priceProvidedByUser: true,
          checklistItemId: 'cleanup',
        },
        {
          name: 'Trash Haul Off',
          scope: 'Trash Haul Off',
          price: 3000,
          knownSubtotal: 3000,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      rooms: [
        {
          name: 'Trash Haul Off',
          scope: 'Trash Haul Off',
          price: 3000,
          priceProvidedByUser: true,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
          haul_off: { quantity: 3000, unit: 'allowance', quantitySource: 'user_entered' },
          haul_off__allowance: { quantity: 3000, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
      calculatedLineItemTotal: 305000,
    } as unknown as EstimateAiDraft;

    const synced = syncSelectedScopePricing(draft);
    const trash = synced.scopePackages?.find((p) => p.name === 'Trash Haul Off');
    const cleanup = synced.scopePackages?.find((p) => p.name === 'Cleanup & disposal');
    expect(trash?.price).toBe(3000);
    expect(cleanup?.price).toBe(1000);
    expect(synced.rooms?.[0]?.price).toBe(3000);
    // Header total must refresh from live package prices (not stale 305k).
    expect(synced.calculatedLineItemTotal).toBe(4000);
  });

  it('Ask AI disposal $8k updates calculated total after scope snapshot fold', () => {
    const step2Snapshot = {
      itemQuantities: {
        cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        framing: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
        framing__allowance: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
      },
    };
    const refineDraft = {
      scopePackages: [
        {
          name: 'Framing',
          scope: 'Framing',
          price: 500000,
          knownSubtotal: 500000,
          status: 'user_provided',
          checklistItemId: 'framing',
        },
        {
          name: 'Cleanup & disposal',
          scope: 'Final clean',
          price: 8000,
          knownSubtotal: 8000,
          status: 'user_provided',
          priceProvidedByUser: true,
          checklistItemId: 'cleanup',
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          cleanup: { quantity: 8000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 8000, unit: 'allowance', quantitySource: 'user_entered' },
          framing: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
          framing__allowance: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
      calculatedLineItemTotal: 500000,
    } as unknown as EstimateAiDraft;

    const folded = {
      ...refineDraft,
      scopeMeasurements: foldAskAiMeasurementsIntoScopeSnapshot(
        step2Snapshot,
        refineDraft.scopeMeasurements
      ),
    };
    const synced = syncSelectedScopePricing(folded);
    const cleanup = synced.scopePackages?.find((p) => /cleanup/i.test(p.name));
    expect(cleanup?.price).toBe(8000);
    expect(synced.calculatedLineItemTotal).toBe(508000);
  });

  it('syncSelectedScopePricing preserves Ask AI cleanup revision over stale measurements', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [{ id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' }],
      },
      scopePackages: [
        {
          name: 'Cleanup & disposal',
          scope: 'Final clean',
          checklistItemId: 'cleanup',
          price: 8000,
          knownSubtotal: 8000,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: { cleanup: { status: 'accepted', totalAmount: 1000 } },
      },
    } as unknown as EstimateAiDraft;

    const synced = syncSelectedScopePricing(draft);
    expect(synced.scopePackages?.[0]?.price).toBe(8000);
    expect(sumStep3ReviewBudgetTotals(synced)?.total).toBe(8000);
  });
});
