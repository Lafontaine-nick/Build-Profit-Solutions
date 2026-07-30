import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import { hasAcceptedScopePricing } from '@/utils/acceptedPricingSummaryUi';
import {
  applyConfirmScopeUnpricedPricingProposal,
  buildConfirmScopeUnpricedPricingProposal,
  draftEligibleForConfirmScopeUnpricedPricing,
  listConfirmScopeUnpricedPricingRows,
} from '@/utils/confirmScopeUnpricedPricing';
import { fetchRoughPricingProposal } from '@/utils/estimateAiDraftPricing';

function bathroomUnpricedDraft(): EstimateAiDraft {
  return {
    scopeAssumptionsConfirmed: true,
    scopeChecklist: { templateKey: 'bathroom' },
    projectType: 'bathroom',
    confirmedAssumptions: [
      {
        id: 'toilet',
        label: 'Toilet',
        state: 'included',
        inputType: 'choice',
        choiceId: 'replacing',
      },
      {
        id: 'paint_repair',
        label: 'Interior painting/patch and repair',
        state: 'included',
        inputType: 'yes_no',
      },
      {
        id: 'floor_tile',
        label: 'Floor tile',
        state: 'included',
        inputType: 'yes_no',
      },
    ],
    scopeMeasurements: {
      bathroomFloorSqft: 90,
      bathroomPaintRepairScope: 'full_room',
      itemQuantities: {
        floor_tile: { quantity: '90', unit: 'sqft', quantitySource: 'user_entered' },
        floor_tile__material: { quantity: '360', unit: 'allowance', quantitySource: 'user_entered' },
        floor_tile__labor: { quantity: '450', unit: 'allowance', quantitySource: 'user_entered' },
        toilet: { quantity: '1', unit: 'each', quantitySource: 'user_entered' },
        paint_repair: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        floor_tile: buildAcceptanceFromSuggestedBlock({
          total: 810,
          material: 360,
          labor: 450,
          lumpSumOnly: false,
          rateSourceLabel: 'National Average',
          materialSource: 'national_average',
          laborSource: 'national_average',
        }),
      },
    },
  } as unknown as EstimateAiDraft;
}

describe('confirmScopeUnpricedPricing', () => {
  it('lists only in-scope Confirm Scope rows without applied pricing', () => {
    const draft = bathroomUnpricedDraft();
    expect(draftEligibleForConfirmScopeUnpricedPricing(draft)).toBe(true);

    const rows = listConfirmScopeUnpricedPricingRows(draft);
    const ids = rows.map((row) => row.itemId);

    expect(ids).toContain('toilet');
    expect(ids).toContain('paint_repair');
    expect(ids).not.toContain('floor_tile');
    expect(rows.every((row) => row.block.total > 0)).toBe(true);
  });

  it('builds a confirmScopeOnly proposal with Step 2-style scope items', () => {
    const draft = bathroomUnpricedDraft();
    const proposal = buildConfirmScopeUnpricedPricingProposal(draft);

    expect(proposal.confirmScopeOnly).toBe(true);
    expect(proposal.empty).toBe(false);
    expect(proposal.scopeItems?.length).toBeGreaterThanOrEqual(2);
    expect(proposal.scopeItems?.every((item) => (item.proposedRates?.length ?? 0) > 0)).toBe(true);
    expect(proposal.confirmScopeRows?.length).toBe(proposal.scopeItems?.length);
  });

  it('apply writes pricing acceptance for included rows only', () => {
    const draft = bathroomUnpricedDraft();
    const proposal = buildConfirmScopeUnpricedPricingProposal(draft);
    const toiletRow = proposal.confirmScopeRows?.find((row) => row.itemId === 'toilet');
    expect(toiletRow).toBeTruthy();

    const includedIds = new Set(['toilet']);
    const next = applyConfirmScopeUnpricedPricingProposal(draft, proposal, includedIds);
    const measurements = next.scopeMeasurements || {};

    expect(
      hasAcceptedScopePricing(
        'toilet',
        measurements.itemQuantities || {},
        measurements.pricingAcceptance
      )
    ).toBe(true);
    expect(
      hasAcceptedScopePricing(
        'paint_repair',
        measurements.itemQuantities || {},
        measurements.pricingAcceptance
      )
    ).toBe(false);
  });

  it('fetchRoughPricingProposal prefers confirm-scope unpriced rows when Step 2 is confirmed', async () => {
    const draft = bathroomUnpricedDraft();
    const proposal = await fetchRoughPricingProposal(draft, []);

    expect(proposal.confirmScopeOnly).toBe(true);
    expect(proposal.scopeItems?.some((item) => item.scopeItemId === 'toilet')).toBe(true);
    expect(proposal.scopeItems?.some((item) => item.scopeItemId === 'floor_tile')).toBe(false);
  });
});
