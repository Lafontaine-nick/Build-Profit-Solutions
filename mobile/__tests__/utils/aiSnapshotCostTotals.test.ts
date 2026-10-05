import { applyDraftToEstimate, sumEstimateLineTotals } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import {
  aiSnapshotLinesNeedRebuild,
  appliedAiSnapshotCostTotals,
  lineTotalsAtApply,
} from '@/utils/aiSnapshotCostTotals';

const drywallDraft = () =>
  ({
    scopeAssumptionsConfirmed: true,
    scopeChecklist: {
      templateKey: 'kitchen',
      items: [{ id: 'drywall', inputType: 'yes_no', state: 'included' }],
    },
    confirmedAssumptions: [{ id: 'drywall', inputType: 'yes_no', state: 'included' }],
    scopeMeasurements: {
      itemQuantities: {
        drywall__material: { quantity: '35.2', unit: 'allowance', quantitySource: 'user_entered' },
        drywall__labor: { quantity: '51.6', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        drywall: { selectionStatus: 'accepted', totalAmount: 86.8 },
      },
    },
    scopePackages: [
      {
        name: 'Drywall / patching',
        checklistItemId: 'drywall',
        price: 86.8,
        materialPrice: 35.2,
        laborPrice: 51.6,
        status: 'user_provided',
        priceProvidedByUser: true,
      },
    ],
  }) as unknown as EstimateAiDraft;

const current = (bid: any) => sumEstimateLineTotals(bid.materialLineItems, bid.laborLineItems);

const bumpFirstMaterial = (bid: any, by: number) => ({
  ...bid,
  materialLineItems: bid.materialLineItems.map((row: any, i: number) =>
    i === 0 ? { ...row, total: Number(row.total) + by, unitPrice: Number(row.unitPrice) + by } : row
  ),
});

describe('appliedAiSnapshotCostTotals', () => {
  const applied = () => applyDraftToEstimate({}, drywallDraft(), { applyConfirmedOnly: true }).bid as any;

  it('records line totals at apply that match Confirm Scope', () => {
    const bid = applied();
    const step3 = sumStep3ReviewBudgetTotals(bid.aiEstimateDraftSnapshot.draft)!;
    expect(step3.total).toBeGreaterThan(0);
    expect(bid.aiEstimateDraftSnapshot.lineTotalsAtApply).toEqual(current(bid));
    expect(appliedAiSnapshotCostTotals(bid, current(bid))).toEqual({
      material: step3.material,
      labor: step3.labor,
    });
  });

  it('adds a hand edit to a material line on top of Confirm Scope', () => {
    const bid = applied();
    const step3 = sumStep3ReviewBudgetTotals(bid.aiEstimateDraftSnapshot.draft)!;
    const edited = bumpFirstMaterial(bid, 350);
    expect(appliedAiSnapshotCostTotals(edited, current(edited))).toEqual({
      material: step3.material + 350,
      labor: step3.labor,
    });
  });

  it('re-derives the apply totals for snapshots saved before they were recorded', () => {
    const bid = applied();
    const { lineTotalsAtApply: _omit, ...legacySnapshot } = bid.aiEstimateDraftSnapshot;
    const legacy = bumpFirstMaterial({ ...bid, aiEstimateDraftSnapshot: legacySnapshot }, 350);
    expect(lineTotalsAtApply(legacySnapshot)).toEqual(current(bid));
    expect(appliedAiSnapshotCostTotals(legacy, current(legacy))?.material).toBe(
      current(bid).material + 350
    );
  });

  it('counts added and removed lines', () => {
    const bid = applied();
    const added = { ...bid, materialLineItems: [...bid.materialLineItems, { name: 'Primer', total: 120 }] };
    expect(appliedAiSnapshotCostTotals(added, current(added))?.material).toBe(current(bid).material + 120);
    const removed = { ...bid, materialLineItems: [] };
    expect(appliedAiSnapshotCostTotals(removed, current(removed))?.material).toBe(0);
  });

  it('returns null without an applied draft', () => {
    expect(appliedAiSnapshotCostTotals({}, { material: 10, labor: 10 })).toBeNull();
  });
});

describe('aiSnapshotLinesNeedRebuild', () => {
  const applied = () => applyDraftToEstimate({}, drywallDraft(), { applyConfirmedOnly: true }).bid as any;
  const legacy = (bid: any) => {
    const { lineTotalsAtApply: _omit, ...snapshot } = bid.aiEstimateDraftSnapshot;
    return { ...bid, aiEstimateDraftSnapshot: snapshot };
  };

  it('keeps hand edits and added lines on snapshots with recorded apply totals', () => {
    const bid = applied();
    expect(aiSnapshotLinesNeedRebuild(bumpFirstMaterial(bid, 350))).toBe(false);
    expect(
      aiSnapshotLinesNeedRebuild({ ...bid, materialLineItems: [...bid.materialLineItems, { name: 'Primer', total: 120 }] })
    ).toBe(false);
  });

  it('rebuilds when the recorded apply itself exceeded Confirm Scope', () => {
    const bid = applied();
    const inflated = {
      ...bid,
      aiEstimateDraftSnapshot: {
        ...bid.aiEstimateDraftSnapshot,
        lineTotalsAtApply: { material: current(bid).material + 86.8, labor: current(bid).labor },
      },
    };
    expect(aiSnapshotLinesNeedRebuild(inflated)).toBe(true);
  });

  it('keeps a price edit on an older snapshot', () => {
    expect(aiSnapshotLinesNeedRebuild(bumpFirstMaterial(legacy(applied()), 350))).toBe(false);
  });

  it('rebuilds an older snapshot carrying a stale row the draft no longer produces', () => {
    const bid = legacy(applied());
    const stale = { ...bid, materialLineItems: [...bid.materialLineItems, { name: 'Patch repair', total: 86.8 }] };
    expect(aiSnapshotLinesNeedRebuild(stale)).toBe(true);
  });
});
