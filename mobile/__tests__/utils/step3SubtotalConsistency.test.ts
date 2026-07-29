import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { syncSelectedScopePricing } from '@/utils/estimateAiDraft';
import { sumAppliedScopePricingFromDraft } from '@/utils/benchmarkReasonablenessContext';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';
import {
  getUniformStatusLabel,
  scopePackagePricedAmount,
  sumLiveScopePackageTotals,
} from '@/utils/estimateDraftReviewUi';

describe('Step 3 subtotal consistency', () => {
  it('scales over-split material/labor so legs never exceed package total', () => {
    const draft = {
      scopePackages: [],
      scopeMeasurements: { itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const pkg = {
      name: 'Excavation',
      scope: 'excavation',
      price: 4437.84,
      knownSubtotal: 4437.84,
      materialPrice: 3500,
      laborPrice: 3000, // over-split vs $4,437.84 package
      priceSource: 'user_provided',
      status: 'user_provided',
    };
    const breakdown = resolveScopePackageBudgetBreakdown(pkg as any, draft);
    expect(breakdown).not.toBeNull();
    expect(breakdown!.total).toBeCloseTo(4437.84, 2);
    expect(breakdown!.material + breakdown!.labor).toBeCloseTo(4437.84, 2);
    expect(breakdown!.material + breakdown!.labor).toBeLessThanOrEqual(4437.84 + 0.02);
  });

  it('sums live row amounts for Calculated total (ignores stale header field)', () => {
    const draft = {
      calculatedLineItemTotal: 999999,
      calculatedTotal: 999999,
      scopePackages: [
        {
          name: 'Plans / engineering',
          price: 3000,
          knownSubtotal: 3000,
          status: 'user_provided',
          priceSource: 'user_provided',
        },
        {
          name: 'Permits / fees (incl. impact)',
          price: 32000,
          knownSubtotal: 32000,
          status: 'user_provided',
          priceSource: 'user_provided',
        },
        {
          name: 'Excavation',
          price: 4437.84,
          knownSubtotal: 4437.84,
          materialPrice: 443.78,
          laborPrice: 3994.06,
          status: 'user_provided',
          priceSource: 'user_provided',
        },
      ],
      scopeMeasurements: { itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    expect(sumLiveScopePackageTotals(draft)).toBeCloseTo(39437.84, 2);
    expect(scopePackagePricedAmount(draft.scopePackages![2], draft)).toBeCloseTo(4437.84, 2);
  });

  it('does not claim Confirm Scope prices came from notes', () => {
    expect(
      getUniformStatusLabel([
        { name: 'A', status: 'user_provided' },
        { name: 'B', status: 'user_provided' },
      ] as any)
    ).toBe('All items have prices');
  });

  it('syncSelectedScopePricing strips takeoff-calculated prices not Applied on Confirm Scope', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'landscaping', label: 'Landscaping', inputType: 'yes_no', state: 'included' },
          { id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'included' },
          { id: 'excavation', label: 'Excavation', inputType: 'yes_no', state: 'included' },
        ],
      },
      scopeMeasurements: {
        itemQuantities: {
          excavation__material: { quantity: '444', unit: 'allowance', quantitySource: 'user_entered' },
          excavation__labor: { quantity: '3994', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {},
      },
      scopePackages: [
        {
          name: 'Landscaping / site walls & gates',
          checklistItemId: 'landscaping',
          price: 13007.6,
          status: 'calculated',
          priceSource: 'notes',
          pricedFromSqftAllowances: true,
        },
        {
          name: 'Foundation',
          checklistItemId: 'foundation',
          price: 22647.4,
          materialPrice: 6800,
          laborPrice: 15847.4,
          status: 'calculated',
          priceSource: 'notes',
        },
        {
          name: 'Excavation',
          checklistItemId: 'excavation',
          price: 4438,
          materialPrice: 444,
          laborPrice: 3994,
          status: 'user_provided',
          priceSource: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
    } as unknown as EstimateAiDraft;

    const synced = syncSelectedScopePricing(draft);
    const landscaping = synced.scopePackages!.find((p) => p.checklistItemId === 'landscaping');
    const foundation = synced.scopePackages!.find((p) => p.checklistItemId === 'foundation');
    const excavation = synced.scopePackages!.find((p) => p.checklistItemId === 'excavation');

    expect(landscaping?.price).toBeNull();
    expect(landscaping?.status).toBe('missing_price');
    expect(foundation?.price).toBeNull();
    expect(excavation?.price).toBeCloseTo(4438, 0);

    const applied = sumAppliedScopePricingFromDraft(synced);
    expect(applied?.total).toBeCloseTo(4438, 0);
    expect(sumLiveScopePackageTotals(synced)).toBeCloseTo(4438, 0);
  });

  it('visible Step 3 row amounts sum to hero applied total (excludes unapplied national averages)', () => {
    const items = [
      { id: 'plumbing_rough', label: 'Plumbing rough-in', inputType: 'yes_no', state: 'included' },
      { id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom', items },
      confirmedAssumptions: items,
      scopePackages: [
        {
          name: 'Plumbing rough-in (shower / tub)',
          scope: 'Rough-in',
          checklistItemId: 'plumbing_rough',
          price: 1750,
          knownSubtotal: 1750,
          status: 'ai_suggested',
          priceSource: 'national_trade_average',
        },
        {
          name: 'Cleanup, haul-off & disposal',
          scope: 'Final clean',
          checklistItemId: 'cleanup',
          price: 1000,
          knownSubtotal: 1000,
          status: 'user_provided',
        },
      ],
      scopeMeasurements: {
        showerWallTileSqft: 80,
        itemQuantities: {
          cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          cleanup: { status: 'accepted', totalAmount: 1000 },
        },
      },
    } as unknown as EstimateAiDraft;

    const synced = syncSelectedScopePricing(draft);
    const hero = sumAppliedScopePricingFromDraft(synced)?.total;
    const rowSum = sumLiveScopePackageTotals(synced);
    expect(hero).toBe(1000);
    expect(rowSum).toBe(1000);
    expect(scopePackagePricedAmount(synced.scopePackages![0], synced)).toBe(0);
  });
});
