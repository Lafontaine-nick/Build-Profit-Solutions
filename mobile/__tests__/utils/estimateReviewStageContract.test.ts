import {
  applyDraftToEstimate,
  syncConfirmScopeMeasurementsFromPackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import { confirmedAppliedRevealLines } from '@/utils/estimateInitialRevealUi';
import { displayPriceSourceLabel } from '@/utils/suggestedPricingCardUi';

const REVIEW_LINES = [
  { itemId: 'flooring_lvp', label: 'Whole-house LVP', total: 6300, material: 3500, labor: 2800, allowance: 0 },
  { itemId: 'floor_demo', label: 'Flooring demo', total: 1575, material: 315, labor: 1260, allowance: 0 },
  { itemId: 'bathroom_updates', label: 'Bathrooms', total: 8200, material: 4000, labor: 4200, allowance: 0 },
  { itemId: 'cabinets', label: 'Kitchen cabinets', total: 12000, material: 8000, labor: 4000, allowance: 0 },
  { itemId: 'interior_paint', label: 'Interior paint', total: 6700, material: 1700, labor: 5000, allowance: 0 },
  { itemId: 'interior_door_install', label: 'Interior doors', total: 2400, material: 1200, labor: 1200, allowance: 0 },
  { itemId: 'baseboard_install', label: 'Baseboard', total: 1540, material: 600, labor: 940, allowance: 0 },
  { itemId: 'roofing', label: 'Roofing', total: 9800, material: 5200, labor: 4600, allowance: 0 },
  { itemId: 'hvac', label: 'HVAC', total: 11000, material: 7000, labor: 4000, allowance: 0 },
  { itemId: 'stucco', label: 'Stucco', total: 9000, material: 3500, labor: 5500, allowance: 0 },
  { itemId: 'drywall', label: 'Drywall', total: 22500, material: 9225, labor: 13275, allowance: 0 },
];

function snapshotTotals(lines: typeof REVIEW_LINES) {
  return lines.reduce(
    (totals, line) => ({
      total: totals.total + line.total,
      material: totals.material + line.material,
      labor: totals.labor + line.labor,
      allowance: totals.allowance + line.allowance,
    }),
    { total: 0, material: 0, labor: 0, allowance: 0 }
  );
}

function reviewDraft(lines: typeof REVIEW_LINES): EstimateAiDraft {
  const totals = snapshotTotals(lines);
  return {
    scopeAssumptionsConfirmed: true,
    originalNotes:
      'Whole house remodel. Flooring, bathrooms, kitchen, paint, doors, baseboard, roofing, HVAC, stucco, and drywall.',
    scopeChecklist: {
      templateKey: 'room_remodel',
      items: lines.map(line => ({
        id: line.itemId,
        label: line.label,
        inputType: 'yes_no',
        state: 'included',
      })),
    },
    scopePackages: lines.map(line => ({
      name: line.label,
      scope: line.label,
      checklistItemId: line.itemId,
      price: line.total,
      materialPrice: line.material,
      laborPrice: line.labor,
      priceProvidedByUser: true,
      status: 'user_provided',
    })),
    scopeMeasurements: {
      itemQuantities: {},
      pricingAcceptance: {},
      confirmedScopePricingSnapshot: {
        ...totals,
        lines: lines.map(line => ({ ...line })),
      },
    },
  } as unknown as EstimateAiDraft;
}

function bidTotal(draft: EstimateAiDraft) {
  const { bid } = applyDraftToEstimate({}, draft, { applyConfirmedOnly: true });
  const material = (bid.materialLineItems as Array<{ total?: number }>).reduce(
    (sum, line) => sum + Number(line.total || 0),
    0
  );
  const labor = (bid.laborLineItems as Array<{ total?: number }>).reduce(
    (sum, line) => sum + Number(line.total || 0),
    0
  );
  return material + labor;
}

describe('estimate review stage contract', () => {
  it('keeps the same trades and dollars from Confirm Scope through the PDF', () => {
    const draft = reviewDraft(REVIEW_LINES);
    const reveal = confirmedAppliedRevealLines(draft);
    expect(reveal?.map(line => [line.name, line.amount])).toEqual(
      REVIEW_LINES.map(line => [line.label, line.total])
    );
    expect(bidTotal(draft)).toBe(snapshotTotals(REVIEW_LINES).total);
    expect(displayPriceSourceLabel('Suggested · National Average')).toBe(
      'National planning rate'
    );
    expect(
      displayPriceSourceLabel(
        'Production planning rate · Plan 39 gypsum board benchmark'
      )
    ).toBe('Local benchmark');
  });

  it('keeps an edited drywall price on the way back and leaves the other trades', () => {
    const draft = reviewDraft(REVIEW_LINES);
    const packages = draft.scopePackages || [];
    const drywall = packages.find(pkg => pkg.checklistItemId === 'drywall');
    drywall!.price = 23000;
    drywall!.materialPrice = 9430;
    drywall!.laborPrice = 13570;
    const edited = syncConfirmScopeMeasurementsFromPackages(draft);
    const snapshot = edited.scopeMeasurements?.confirmedScopePricingSnapshot;
    expect(snapshot?.lines.find(line => line.itemId === 'drywall')?.total).toBe(
      23000
    );
    expect(snapshot?.lines.find(line => line.itemId === 'flooring_lvp')?.total).toBe(
      6300
    );
    expect(snapshot?.total).toBe(snapshotTotals(REVIEW_LINES).total - 22500 + 23000);
    const reveal = confirmedAppliedRevealLines(edited);
    expect(reveal?.find(line => line.name === 'Drywall')?.amount).toBe(23000);
    expect(reveal?.find(line => line.name === 'Whole-house LVP')?.amount).toBe(6300);
    const back = syncConfirmScopeMeasurementsFromPackages(edited);
    expect(back.scopeMeasurements?.confirmedScopePricingSnapshot?.total).toBe(
      snapshot?.total
    );
  });

  it('drops HVAC from the confirmed total when the card is removed', () => {
    const draft = reviewDraft(REVIEW_LINES);
    draft.scopeChecklist!.items = draft.scopeChecklist!.items.map(item =>
      item.id === 'hvac' ? { ...item, state: 'excluded' } : item
    );
    draft.scopePackages = (draft.scopePackages || []).filter(
      pkg => pkg.checklistItemId !== 'hvac'
    );
    const removed = syncConfirmScopeMeasurementsFromPackages(draft);
    const snapshot = removed.scopeMeasurements?.confirmedScopePricingSnapshot;
    expect(snapshot?.lines.map(line => line.itemId)).not.toContain('hvac');
    expect(snapshot?.total).toBe(snapshotTotals(REVIEW_LINES).total - 11000);
    expect(
      confirmedAppliedRevealLines(removed)?.map(line => line.name)
    ).not.toContain('HVAC');
    expect(bidTotal(removed)).toBe(snapshotTotals(REVIEW_LINES).total - 11000);
  });
});
